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
  const timeoutMs = opts.timeoutMs || 60000;
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

  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(inPath, docxBuffer);
    } catch (e) {
      cleanup();
      return reject(e);
    }

    // Per-call UserInstallation avoids profile-lock clashes under concurrency.
    const args = [
      '--headless', '--norestore', '--nolockcheck', '--nodefault',
      `-env:UserInstallation=file://${profileDir}`,
      '--convert-to', 'pdf:writer_pdf_Export',
      '--outdir', workDir,
      inPath,
    ];

    const proc = spawn(soffice, args, { timeout: timeoutMs });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => { cleanup(); reject(err); });
    proc.on('close', (code) => {
      if (code !== 0) {
        cleanup();
        return reject(new Error(`soffice exited ${code}: ${stderr.slice(0, 500)}`));
      }
      try {
        const pdf = fs.readFileSync(outPath);
        cleanup();
        resolve(pdf);
      } catch (e) {
        cleanup();
        reject(new Error(`PDF not produced: ${e.message}`));
      }
    });
  });
}

export default { convertDocxToPdf, isLibreOfficeAvailable };
