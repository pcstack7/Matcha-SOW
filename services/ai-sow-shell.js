/**
 * ai-sow-shell.js
 *
 * Generates the AI-Statement-of-Work DOCX by injecting the AI-generated body
 * into the official Altera APAC SOW template (assets/templates/apac-sow-shell.docx)
 * rather than building the document from scratch. This yields pixel-perfect
 * cover, headers, footers, Document Control tables and classification.
 *
 * The template is *property-driven*: a set of data-bound content controls
 * (<w:sdt>) throughout the document are bound to document properties —
 *
 *   • Title          → core property  dc:title          (cover + headers)
 *   • Project subtitle→ core property  dc:subject
 *   • Client name     → extended prop  Company           (~40 occurrences)
 *   • Status line     → core property  cp:contentStatus  (cover + footer)
 *   • Classification  → core property  dc:description    (e.g. CONFIDENTIAL)
 *
 * Setting these properties makes Word populate every bound control, and
 * editing any one control (or the property) keeps them all in sync — exactly
 * the single-source "edit client name once" behaviour requested. We ALSO
 * overwrite each control's cached text so LibreOffice / docx-preview show the
 * right values before Word ever refreshes the bindings.
 *
 * The example body (everything in the third section, between the Document
 * Control/Contents section break and the final <w:sectPr>) is replaced with
 * the converted AI markdown.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import { stripLeadingMetaBlock } from './sow-frontmatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHELL_PATH = path.join(__dirname, '..', 'assets', 'templates', 'apac-sow-shell.docx');

// ── XML helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inline **bold** → runs. Returns OOXML run(s) for one line of text using the
// BodyVerdana run style so injected text matches the template body font.
function inlineRuns(text, { runStyle = 'BodyVerdana' } = {}) {
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  const rpr = (bold) =>
    `<w:rPr>${runStyle ? `<w:rStyle w:val="${runStyle}"/>` : ''}${bold ? '<w:b/>' : ''}</w:rPr>`;
  const push = (t, bold) => {
    if (!t) return;
    out.push(`<w:r>${rpr(bold)}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
  };
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index), false);
    push(m[1], true);
    last = m.index + m[0].length;
  }
  push(text.slice(last), false);
  return out.join('') || `<w:r>${rpr(false)}<w:t/></w:r>`;
}

const para = (style, innerRuns) =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${innerRuns}</w:p>`;

// Heading paragraph that uses the template's built-in heading style numbering.
// The template's Heading1/2/3 styles auto-number (numId=35), so we DON'T
// suppress it and we strip any manual "1.0 "/"2.1 " prefix the model may have
// emitted — Word then numbers headings automatically and consistently
// (1, 1.1, 2 …) regardless of which sections are present. This avoids both the
// "numbering is gone" problem and double numbering like "1.1.0 …".
const stripLeadingNumber = (t) =>
  String(t || '').replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '').trim();
const headingPara = (style, text) =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>` +
  `<w:r><w:t xml:space="preserve">${esc(stripLeadingNumber(text))}</w:t></w:r></w:p>`;

// "Table N" caption (Caption style + SEQ Table field) placed above each table.
// The template's NATIVE List of Tables field (TOC \c "Table") collects these,
// so injected tables show up in the document's table references. Word renumbers
// the SEQ fields on field-refresh; we seed the cached number for pre-refresh.
let _tableSeq = 0;
function tableCaption() {
  _tableSeq += 1;
  return (
    `<w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr>` +
    `<w:r><w:t xml:space="preserve">Table </w:t></w:r>` +
    `<w:fldSimple w:instr=" SEQ Table \\* ARABIC "><w:r><w:t>${_tableSeq}</w:t></w:r></w:fldSimple>` +
    `</w:p>`
  );
}

// ── Markdown table parsing (reused shape from the existing exporters) ──────────
function parseTableBlock(lines, start) {
  const headerLine = lines[start];
  const sepLine = lines[start + 1];
  if (!sepLine || !/^\s*\|?[\s:|-]+\|?\s*$/.test(sepLine) || !sepLine.includes('-')) return null;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const headers = cells(headerLine);
  const rows = [];
  let i = start + 2;
  for (; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|') && !lines[i].includes('|')) break;
    if (lines[i].trim() === '') break;
    rows.push(cells(lines[i]));
  }
  return { headers, rows, endIndex: i };
}

function tableXml(tbl) {
  const cols = tbl.headers.length || 1;
  const cellW = Math.floor(9360 / cols);
  const grid = `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${cellW}"/>`).join('')}</w:tblGrid>`;
  // Header fill 383392 (Altera primary purple) matches the Document Control /
  // Version History table's header band so every table is colour-consistent.
  const cell = (text, header) =>
    `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/>${header ? '<w:shd w:val="clear" w:color="auto" w:fill="383392"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr>` +
    inlineRuns(text, { runStyle: header ? null : 'BodyVerdana' }).replace(
      /<w:rPr>/g,
      header ? '<w:rPr><w:b/><w:color w:val="FFFFFF"/>' : '<w:rPr>'
    ) +
    `</w:p></w:tc>`;
  const row = (arr, header) => `<w:tr>${arr.map((c) => cell(c, header)).join('')}</w:tr>`;
  const body = tbl.rows
    .map((r) => row([...r, ...Array(Math.max(0, cols - r.length)).fill('')].slice(0, cols), false))
    .join('');
  return (
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="9360" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/></w:tblBorders></w:tblPr>` +
    grid +
    row(tbl.headers, true) +
    body +
    `</w:tbl><w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr></w:p>`
  );
}

/**
 * Convert AI SOW markdown into a string of WordprocessingML block elements
 * (paragraphs + tables) styled with the template's own styles.
 *
 *   #/##/###      → Heading1
 *   ####+         → Heading2
 *   bullet (-,*,•)→ Bullet1
 *   | a | b |     → table
 *   everything else → BodyText
 */
export function markdownToOoxml(markdown) {
  _tableSeq = 0; // restart table caption numbering per document
  // Drop the AI's leading "Statement of Work / Project / Client / Date /
  // Version / ---" block — the cover already carries that information.
  const lines = stripLeadingMetaBlock(String(markdown || '')).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') { i++; continue; }

    // Table — captioned "Table N" so the template's native List of Tables
    // (TOC \c "Table") picks it up.
    if (trimmed.startsWith('|')) {
      const tbl = parseTableBlock(lines, i);
      if (tbl) { out.push(tableCaption() + tableXml(tbl)); i = tbl.endIndex; continue; }
    }

    // Headings — map by hash count so hierarchy is preserved. The SOW uses
    // '## ' for top-level sections and '### ' for sub-sections, so:
    //   #/##  → Heading1,  ###  → Heading2,  ####+ → Heading3.
    // Word's heading styles auto-number these (1, 1.1, 1.1.1).
    const hashMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hashMatch) {
      const level = Math.min(3, Math.max(1, hashMatch[1].length - 1));
      const t = hashMatch[2].replace(/\*\*/g, '').replace(/:$/, '').trim();
      out.push(headingPara(`Heading${level}`, t));
      i++; continue;
    }
    // ALL-CAPS line → top-level heading; fully-bold line → sub-heading.
    if (/^[A-Z][A-Z\s]{2,}:?\s*$/.test(trimmed)) {
      out.push(headingPara('Heading1', trimmed.replace(/:$/, '').trim()));
      i++; continue;
    }
    if (/^\*\*.*\*\*$/.test(trimmed)) {
      out.push(headingPara('Heading2', trimmed.replace(/\*\*/g, '').trim()));
      i++; continue;
    }

    // Bullets (including nested — flattened to one level)
    if (/^\s*[-*•]\s+/.test(line)) {
      const t = trimmed.replace(/^[-*•]\s+/, '');
      out.push(para('Bullet1', inlineRuns(t)));
      i++; continue;
    }

    // Body paragraph
    out.push(para('BodyText', inlineRuns(trimmed)));
    i++;
  }
  return out.join('');
}

// ── Document-property setters ──────────────────────────────────────────────────
function setCoreProp(coreXml, tag, value) {
  const v = esc(value);
  // tag like "dc:title" or "cp:contentStatus" or "dc:description" or "dc:subject"
  const re = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`);
  if (re.test(coreXml)) return coreXml.replace(re, `$1${v}$3`);
  // Insert before closing tag if missing
  return coreXml.replace(/<\/cp:coreProperties>/, `<${tag}>${v}</${tag}></cp:coreProperties>`);
}

function setCompany(appXml, value) {
  const v = esc(value);
  if (/<Company>[\s\S]*?<\/Company>/.test(appXml)) {
    return appXml.replace(/<Company>[\s\S]*?<\/Company>/, `<Company>${v}</Company>`);
  }
  return appXml.replace(/<\/Properties>/, `<Company>${v}</Company></Properties>`);
}

// ── Cached content-control text replacement ────────────────────────────────────
// Replaces the visible <w:t> text inside every data-bound sdt whose binding
// xpath matches `xpathFragment`, so renders show the value before a field
// refresh. Multi-run sdt content is collapsed to a single run's text.
function replaceBoundControlText(xml, xpathFragment, newText) {
  return xml.replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, (sdt) => {
    if (!sdt.includes(xpathFragment)) return sdt;
    const contentMatch = sdt.match(/<w:sdtContent>([\s\S]*?)<\/w:sdtContent>/);
    if (!contentMatch) return sdt;
    let content = contentMatch[1];
    let replaced = false;
    // Replace the first <w:t> with the new text; blank the rest.
    content = content.replace(/(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g, (full, open, _t, close) => {
      if (!replaced) { replaced = true; return `${open.replace(/\/>/, '>')}${esc(newText)}${close}`; }
      return `${open}${close}`;
    });
    if (!replaced) return sdt;
    return sdt.replace(/<w:sdtContent>[\s\S]*?<\/w:sdtContent>/, `<w:sdtContent>${content}</w:sdtContent>`);
  });
}

// ── Body region replacement ────────────────────────────────────────────────────
// Replace everything between the Document-Control/Contents section break
// (sectPr referencing rId21 / header2) and the final body <w:sectPr>
// (rId28 / header3) with the generated body OOXML.
function injectBody(documentXml, bodyOoxml) {
  // End of the paragraph that holds the section-2 break
  const sect2 = documentXml.match(/<w:sectPr\b[^>]*>(?:(?!<\/w:sectPr>)[\s\S])*?rId21[\s\S]*?<\/w:sectPr>/);
  if (!sect2) throw new Error('ai-sow-shell: could not locate section-2 break (rId21)');
  // The sectPr sits inside <w:pPr>…</w:pPr></w:p>; keep through that paragraph close.
  const afterSect2 = sect2.index + sect2[0].length;
  const tailStart = documentXml.indexOf('</w:p>', afterSect2);
  if (tailStart === -1) throw new Error('ai-sow-shell: malformed section-2 paragraph');
  const keepHead = documentXml.slice(0, tailStart + '</w:p>'.length);

  // Final body sectPr (rId28) — preserve it and everything after.
  const finals = [...documentXml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)].filter((m) =>
    m[0].includes('rId28')
  );
  if (!finals.length) throw new Error('ai-sow-shell: could not locate final body sectPr (rId28)');
  const finalSect = finals[finals.length - 1];
  const keepTail = documentXml.slice(finalSect.index);

  return `${keepHead}${bodyOoxml}${keepTail}`;
}

// ── Version History table: fill the first data row ─────────────────────────────
// Operates only on the first table (Document Control → Version History):
//   Date | Version | Author | Scope
// Replaces the placeholder Date/Version text and fills the empty Author/Scope
// cells of the first data row.
function fillVersionHistory(documentXml, { date, version, author, scope }) {
  const m = documentXml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/);
  if (!m) return documentXml;
  let tbl = m[0];

  tbl = tbl.replace(/<w:t([^>]*)>dd-mm-yy<\/w:t>/, `<w:t$1>${esc(date)}</w:t>`);
  tbl = tbl.replace(/<w:t([^>]*)>v0\.x\/X\.0<\/w:t>/, `<w:t$1>${esc(version)}</w:t>`);

  // First two empty-cell paragraphs in the table are row-1 Author & Scope.
  let filled = 0;
  tbl = tbl.replace(/<\/w:pPr><\/w:p>/g, (full) => {
    filled += 1;
    if (filled === 1) return `</w:pPr><w:r><w:t xml:space="preserve">${esc(author)}</w:t></w:r></w:p>`;
    if (filled === 2) return `</w:pPr><w:r><w:t xml:space="preserve">${esc(scope)}</w:t></w:r></w:p>`;
    return full;
  });

  return documentXml.slice(0, m.index) + tbl + documentXml.slice(m.index + m[0].length);
}

// ── Settings: force field refresh on open ──────────────────────────────────────
function setUpdateFields(settingsXml) {
  if (/<w:updateFields\b/.test(settingsXml)) {
    return settingsXml.replace(/<w:updateFields[^>]*\/>/, '<w:updateFields w:val="true"/>');
  }
  // Insert right after <w:settings ...> opening tag
  return settingsXml.replace(/(<w:settings\b[^>]*>)/, '$1<w:updateFields w:val="true"/>');
}

/**
 * Build the AI SOW DOCX from the template shell.
 *
 * @param {object} opts
 * @param {string} opts.title          SOW / project title (cover + headers)
 * @param {string} opts.projectTitle   subtitle line (dc:subject) — optional
 * @param {string} opts.clientName     client name → Company property (~40 refs)
 * @param {string} opts.status         e.g. "Final"
 * @param {string} opts.version        e.g. "1.0"
 * @param {string} opts.date           e.g. "02-06-26"
 * @param {string} opts.classification e.g. "CONFIDENTIAL"
 * @param {string} opts.markdown       AI-generated SOW body (markdown)
 * @returns {Buffer} the .docx bytes
 */
export function generateAiSowDocx(opts) {
  const {
    title = 'Statement of Work',
    projectTitle = '',
    clientName = 'Client',
    status = 'Draft',
    version = '1.0',
    date = '',
    classification = 'CONFIDENTIAL',
    markdown = '',
  } = opts || {};

  const statusLine = `Status: ${status} | Version: ${version} | Date: ${date}`;

  const zip = new PizZip(fs.readFileSync(SHELL_PATH));

  // 1. Document properties (so Word's bound controls resolve correctly)
  let core = zip.file('docProps/core.xml').asText();
  core = setCoreProp(core, 'dc:title', title);
  if (projectTitle) core = setCoreProp(core, 'dc:subject', projectTitle);
  core = setCoreProp(core, 'cp:contentStatus', statusLine);
  core = setCoreProp(core, 'dc:description', `[${classification}]`);
  zip.file('docProps/core.xml', core);

  const appFile = zip.file('docProps/app.xml');
  if (appFile) zip.file('docProps/app.xml', setCompany(appFile.asText(), clientName));

  // 2. Replace cached content-control text + inject body in document.xml
  let doc = zip.file('word/document.xml').asText();
  doc = replaceBoundControlText(doc, 'ns0:title', title);
  if (projectTitle) doc = replaceBoundControlText(doc, 'ns0:subject', projectTitle);
  doc = replaceBoundControlText(doc, 'ns0:Company', clientName);
  doc = replaceBoundControlText(doc, 'contentStatus', statusLine);
  doc = replaceBoundControlText(doc, 'ns0:description', `[${classification}]`);
  // Document Control → Version History initial row
  doc = fillVersionHistory(doc, {
    date,
    version: `v${version}`,
    author: 'AI Generated',
    scope: 'Initial version',
  });
  // Inject the AI body in place of the example content
  doc = injectBody(doc, markdownToOoxml(markdown));
  zip.file('word/document.xml', doc);

  // 3. Footer4 also carries Status + classification bound controls
  const f4 = zip.file('word/footer4.xml');
  if (f4) {
    let footer = f4.asText();
    footer = replaceBoundControlText(footer, 'contentStatus', statusLine);
    footer = replaceBoundControlText(footer, 'ns0:description', `[${classification}]`);
    zip.file('word/footer4.xml', footer);
  }

  // 4. Force fields (TOC, bound controls) to refresh when Word opens the file
  const settings = zip.file('word/settings.xml');
  if (settings) zip.file('word/settings.xml', setUpdateFields(settings.asText()));

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── Map a SOW DB record → generator options ────────────────────────────────────
function ddmmyy(d) {
  const dt = d ? new Date(d) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}-${p(dt.getMonth() + 1)}-${String(dt.getFullYear()).slice(-2)}`;
}

// Derive a cover title: prefer the AI content's leading "Statement of Work: X"
// heading, else fall back to product/engagement, else a generic title.
function deriveTitle(sow) {
  const firstLines = String(sow.content || '').split('\n').slice(0, 6);
  for (const raw of firstLines) {
    const m = raw.match(/statement of work\s*[:\-–]\s*(.+)$/i);
    if (m) return m[1].replace(/\*\*/g, '').replace(/[#*]/g, '').trim();
  }
  const bits = [sow.product_name, sow.engagement_type_name].filter(Boolean);
  return bits.join(' — ') || 'Statement of Work';
}

export function buildAiSowOptsFromSow(sow) {
  return {
    title: deriveTitle(sow),
    projectTitle: sow.engagement_type_name || sow.product_name || 'Statement of Work',
    clientName: sow.account_name || 'Client',
    status: 'Draft',
    version: '1.0',
    date: ddmmyy(sow.created_at),
    classification: 'CONFIDENTIAL',
    markdown: sow.content || '',
  };
}

export default { generateAiSowDocx, markdownToOoxml, buildAiSowOptsFromSow };
