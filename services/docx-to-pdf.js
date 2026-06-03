/**
 * docx-to-pdf.js
 *
 * Converts a .docx buffer to PDF using a headless LibreOffice (soffice).
 * Used so the AI-SOW PDF export matches the DOCX exactly (same cover,
 * headers, footers, Document Control, classification).
 *
 * LibreOffice must be installed on the host:
 *   Ubuntu/EC2:  sudo apt-get install -y libreoffice
 *
 * The binary is resolved from SOFFICE_PATH, then `soffice`, then `libreoffice`
 * on PATH. isLibreOfficeAvailable() lets callers fall back gracefully.
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

function resolveSofficeBinary() {
  const candidates = [
    process.env.SOFFICE_PATH,
    'soffice',
    'libreoffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ].filter(Boolean);
  for (const bin of candidates) {
    try {
      const r = spawnSync(bin, ['--version'], { timeout: 8000 });
      if (r.status === 0) return bin;
    } catch {
      /* try next */
    }
  }
  return null;
}

let _cachedBinary;
function getSoffice() {
  if (_cachedBinary === undefined) _cachedBinary = resolveSofficeBinary();
  return _cachedBinary;
}

export function isLibreOfficeAvailable() {
  return !!getSoffice();
}

/**
 * Convert a .docx buffer to a PDF buffer via headless LibreOffice.
 * @param {Buffer} docxBuffer
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=60000]
 * @returns {Promise<Buffer>} the PDF bytes
 */
export function convertDocxToPdf(docxBuffer, opts = {}) {
  const timeoutMs = opts.timeoutMs || 90000;
  const soffice = getSoffice();
  if (!soffice) return Promise.reject(new Error('LibreOffice (soffice) not found on host'));

  const id = crypto.randomBytes(8).toString('hex');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `sow-pdf-${id}-`));
  const profileDir = path.join(workDir, 'lo-profile');
  const inPath = path.join(workDir, 'in.docx');
  const outPath = path.join(workDir, 'in.pdf');

  const cleanup = () => {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* noop */ }
  };
  const fileUrl = (p) => 'file://' + p.split(path.sep).map(encodeURIComponent).join('/');

  const runSoffice = (args) =>
    new Promise((resolve, reject) => {
      const proc = spawn(soffice, args, { timeout: timeoutMs });
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => resolve({ code, stderr }));
    });

  return (async () => {
    try {
      fs.writeFileSync(inPath, docxBuffer);

      // Preferred path: a Basic macro that opens the doc, updates ALL indexes
      // (TOC, List of Tables, List of Figures) and refreshes fields (page
      // numbers), then exports to PDF. Plain `--convert-to` does NOT refresh
      // these, so the PDF's contents/table references would otherwise be stale.
      //
      // IMPORTANT: LibreOffice writes a *default* empty Standard/Module1 when
      // it initialises a fresh UserInstallation, which would clobber our macro.
      // So we initialise the profile FIRST, then write the macro, then run it.
      await runSoffice([
        '--headless', '--norestore',
        `-env:UserInstallation=${fileUrl(profileDir)}`,
        '--terminate_after_init',
      ]);
      writeUpdateMacro(profileDir, fileUrl(inPath), fileUrl(outPath));
      const macroRes = await runSoffice([
        '--headless', '--norestore', '--nolockcheck', '--nodefault', '--nologo', '--invisible',
        `-env:UserInstallation=${fileUrl(profileDir)}`,
        'vnd.sun.star.script:Standard.Module1.Main?language=Basic&location=application',
      ]);
      if (fs.existsSync(outPath)) {
        const pdf = fs.readFileSync(outPath);
        cleanup();
        return pdf;
      }
      console.warn('PDF macro update path produced no file, falling back to plain convert-to:',
        (macroRes.stderr || '').slice(0, 300));

      // Fallback: plain conversion (fields not refreshed, but PDF still renders
      // the template layout). Better a slightly-stale TOC than no PDF.
      const conv = await runSoffice([
        '--headless', '--norestore', '--nolockcheck', '--nodefault',
        `-env:UserInstallation=${fileUrl(profileDir)}`,
        '--convert-to', 'pdf:writer_pdf_Export',
        '--outdir', workDir,
        inPath,
      ]);
      if (!fs.existsSync(outPath)) {
        cleanup();
        throw new Error(`soffice produced no PDF (exit ${conv.code}): ${(conv.stderr || '').slice(0, 300)}`);
      }
      const pdf = fs.readFileSync(outPath);
      cleanup();
      return pdf;
    } catch (e) {
      cleanup();
      throw e;
    }
  })();
}

// Writes a self-contained Basic macro library into the per-call LibreOffice
// profile. Main() loads the input, updates every document index + all text
// fields, and exports to PDF — the absolute file URLs are baked in so the
// macro needs no arguments.
function writeUpdateMacro(profileDir, inUrl, outUrl) {
  const basicDir = path.join(profileDir, 'user', 'basic');
  const stdDir = path.join(basicDir, 'Standard');
  fs.mkdirSync(stdDir, { recursive: true });

  const librariesXlb =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE library:libraries PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "libraries.dtd">\n` +
    `<library:libraries xmlns:library="http://openoffice.org/2000/library" xmlns:xlink="http://www.w3.org/1999/xlink">\n` +
    ` <library:library library:name="Standard" xlink:href="$(USER)/basic/Standard/script.xlb/" xlink:type="simple" library:link="false"/>\n` +
    `</library:libraries>`;

  const moduleXlb =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd">\n` +
    `<library:library xmlns:library="http://openoffice.org/2000/library" library:name="Standard" library:readonly="false" library:passwordprotected="false">\n` +
    ` <library:element library:name="Module1"/>\n` +
    `</library:library>`;

  const basic =
    `Sub Main\n` +
    `  Dim oDoc As Object\n` +
    `  Dim oArgs(0) As New com.sun.star.beans.PropertyValue\n` +
    `  oArgs(0).Name = "Hidden"\n` +
    `  oArgs(0).Value = True\n` +
    `  oDoc = StarDesktop.loadComponentFromURL("${inUrl}", "_blank", 0, oArgs())\n` +
    `  On Error Resume Next\n` +
    `  Dim oIndexes As Object, i As Integer\n` +
    `  oIndexes = oDoc.getDocumentIndexes()\n` +
    `  For i = 0 To oIndexes.Count - 1\n` +
    `    oIndexes.getByIndex(i).update()\n` +
    `  Next i\n` +
    `  oDoc.getTextFields().refresh()\n` +
    `  On Error GoTo 0\n` +
    `  Dim oPdf(0) As New com.sun.star.beans.PropertyValue\n` +
    `  oPdf(0).Name = "FilterName"\n` +
    `  oPdf(0).Value = "writer_pdf_Export"\n` +
    `  oDoc.storeToURL("${outUrl}", oPdf())\n` +
    `  oDoc.close(False)\n` +
    `  StarDesktop.terminate()\n` +
    `End Sub`;

  const moduleXba =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">\n` +
    `<script:module xmlns:script="http://openoffice.org/2000/script" script:name="Module1" script:language="StarBasic">` +
    basic.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
    `</script:module>`;

  fs.writeFileSync(path.join(basicDir, 'script.xlb'), librariesXlb);
  fs.writeFileSync(path.join(stdDir, 'script.xlb'), moduleXlb);
  fs.writeFileSync(path.join(stdDir, 'Module1.xba'), moduleXba);
}

export default { convertDocxToPdf, isLibreOfficeAvailable };
