/**
 * sow-frontmatter.js
 *
 * Shared builder for the three "front matter" pages that lead an
 * AI-generated Statement of Work:
 *
 *   Page 1  — Cover         (Altera contour graphic + title + customer + meta)
 *   Page 2  — Index         (table of contents)
 *   Page 3  — Records       (version-control table + approval table)
 *
 * Two render targets share this module:
 *   • DOCX  via docx-js  → buildDocxFrontMatter(sow)  returns an array of
 *                          docx children to splice in before the body.
 *   • PDF   via pdfkit   → renderPdfFrontMatter(doc, sow) draws directly
 *                          into the document and leaves the cursor on a
 *                          fresh page ready for the body.
 *
 * Data note: the `sows` table stores no version, quote number, or signatory
 * details.  We therefore default the version to "1.0", use the SOW author +
 * created date for the version-control row, and leave the approval table's
 * signatory/signature cells blank for manual sign-off (with role labels
 * pre-filled for Altera and the customer).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Paragraph, TextRun, ImageRun, PageBreak, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
  ShadingType, TableOfContents,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom,
  HorizontalPositionAlign, VerticalPositionAlign,
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Brand palette ────────────────────────────────────────────────────────────
const COLORS = {
  ink: '151744',      // primary-dark
  purple: '393392',   // primary-purple
  light: '707CF1',    // primary-light
  white: 'FFFFFF',
  rule: 'D1D5DB',
  headerFill: '707CF1',
};

const DEFAULT_VERSION = '1.0';

// ── A4 page geometry (the Altera APAC template is A4) ──────────────────────────
// docx-js defaults to A4; we size the full-bleed cover image to the full sheet.
const A4 = {
  widthPx: 794,   // 210 mm @ 96 dpi
  heightPx: 1123, // 297 mm @ 96 dpi
};

// ── Brand assets (read once, cached) ──────────────────────────────────────────
const ASSET_DIR = path.join(__dirname, '..', 'assets', 'brand');
const COVER_BG_PATH = path.join(ASSET_DIR, 'altera-cover-bg.jpg');   // full-page mountain
const LOGO_WHITE_PATH = path.join(ASSET_DIR, 'altera-logo-white.png'); // white wordmark
const LOGO_NATURAL = { width: 468, height: 180 }; // px — for aspect ratio

const _bufferCache = {};
function readAsset(p) {
  if (p in _bufferCache) return _bufferCache[p];
  try {
    _bufferCache[p] = fs.readFileSync(p);
  } catch {
    _bufferCache[p] = null; // graceful: cover still renders without the asset
  }
  return _bufferCache[p];
}
const getCoverBgBuffer = () => readAsset(COVER_BG_PATH);
const getLogoWhiteBuffer = () => readAsset(LOGO_WHITE_PATH);

// ── Shared field derivation ───────────────────────────────────────────────────
function deriveFields(sow) {
  const customer = sow.account_name || 'Customer';
  // These SOWs are produced by the AI generator, so the version-control row
  // attributes authorship to "AI Generated" rather than the logged-in user.
  const author = 'AI Generated';
  const dateObj = sow.created_at ? new Date(sow.created_at) : new Date();
  const longDate = formatLongDate(dateObj);

  // Subtitle: "Product — Engagement" when both exist, else whichever is present.
  const subtitleBits = [sow.product_name, sow.engagement_type_name].filter(Boolean);
  const subtitle = subtitleBits.join(' — ');

  return {
    customer,
    author,
    longDate,
    subtitle,
    clientNumber: sow.client_number || null,
    version: DEFAULT_VERSION,
  };
}

function formatLongDate(d) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCX
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns an array of docx children: cover, index, and records pages, each
 * separated by page breaks. Splice these in front of the body content.
 */
export function buildDocxFrontMatter(sow) {
  const f = deriveFields(sow);
  const children = [];

  // ── Page 1 — Cover ────────────────────────────────────────────────────
  // Full-bleed mountain background (anchored to the page, behind everything),
  // the white Altera wordmark top-left, then the title block in white text
  // floating over the open sky area. White text reads cleanly on the dusk image.
  const bgBuf = getCoverBgBuffer();
  const logoBuf = getLogoWhiteBuffer();

  const coverAnchors = [];
  if (bgBuf) {
    coverAnchors.push(
      new ImageRun({
        type: 'jpg',
        data: bgBuf,
        transformation: { width: A4.widthPx, height: A4.heightPx },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
          behindDocument: true,
          allowOverlap: true,
        },
        altText: { title: 'Altera', description: 'Altera cover', name: 'AlteraCoverBg' },
      })
    );
  }
  if (logoBuf) {
    const logoW = 170;
    const logoH = Math.round(logoW * (LOGO_NATURAL.height / LOGO_NATURAL.width));
    coverAnchors.push(
      new ImageRun({
        type: 'png',
        data: logoBuf,
        transformation: { width: logoW, height: logoH },
        floating: {
          // ~1 inch in from the top-left corner of the page (914400 EMU = 1in)
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 914400 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 820000 },
          behindDocument: false,
          allowOverlap: true,
        },
        altText: { title: 'Altera', description: 'Altera Digital Health', name: 'AlteraLogo' },
      })
    );
  }

  // Anchor paragraph carries the floating images; it occupies no visible height.
  children.push(
    new Paragraph({
      children: coverAnchors,
      spacing: { after: 0 },
    })
  );

  // Title block — pushed down into the sky area with leading blank space.
  const whiteTitle = (text, size, bold, after) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 360 },
      spacing: { after },
      children: [new TextRun({ text, bold, font: 'Verdana', size, color: COLORS.white })],
    });

  // Spacer to drop the title into the upper-middle of the page (below the logo).
  children.push(new Paragraph({ spacing: { before: 3600 }, children: [] }));

  children.push(whiteTitle('Statement of Work', 56, true, 160));
  children.push(whiteTitle(f.customer, 34, true, f.subtitle ? 100 : 320));
  if (f.subtitle) children.push(whiteTitle(f.subtitle, 24, false, 320));

  const metaLine = (label, value) =>
    new Paragraph({
      indent: { left: 360 },
      spacing: { after: 50 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, font: 'Verdana', size: 20, color: COLORS.white }),
        new TextRun({ text: value, font: 'Verdana', size: 20, color: COLORS.white }),
      ],
    });
  if (f.clientNumber) children.push(metaLine('Client #', String(f.clientNumber)));
  children.push(metaLine('Date', f.longDate));
  children.push(metaLine('Version', f.version));

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Page 2 — Index / Contents ─────────────────────────────────────────
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'Contents', bold: true, font: 'Verdana', size: 32, color: COLORS.light }),
      ],
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: 'Tip: right-click the contents above and choose “Update Field” to populate page numbers.',
          italics: true, font: 'Verdana', size: 16, color: '9CA3AF',
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ── Page 3 — Version control + Approval ───────────────────────────────
  children.push(
    sectionHeading('Version Control'),
    buildDocxVersionTable(f),
    new Paragraph({ spacing: { after: 300 }, text: '' }),
    sectionHeading('Approval'),
    buildDocxApprovalTable(f),
    new Paragraph({ children: [new PageBreak()] })
  );

  return children;
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [
      new TextRun({ text, bold: true, font: 'Verdana', size: 28, color: COLORS.purple }),
    ],
  });
}

function headerCell(text, widthDxa) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { fill: COLORS.headerFill, type: ShadingType.CLEAR, color: 'auto' },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, font: 'Verdana', size: 18, color: COLORS.white })],
      }),
    ],
  });
}

function bodyCell(text, widthDxa) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || '', font: 'Verdana', size: 18, color: '1F2937' })],
      }),
    ],
  });
}

function tableBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: COLORS.rule };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

// Version-control / revision-history table — one auto-filled initial row.
function buildDocxVersionTable(f) {
  // Total content width for US Letter w/ 1" margins ≈ 9360 DXA
  const cols = [1400, 1700, 2600, 3660]; // Version | Date | Author | Description
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cols,
    borders: tableBorders(),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Version', cols[0]),
          headerCell('Date', cols[1]),
          headerCell('Author', cols[2]),
          headerCell('Description of Changes', cols[3]),
        ],
      }),
      new TableRow({
        children: [
          bodyCell(f.version, cols[0]),
          bodyCell(f.longDate, cols[1]),
          bodyCell(f.author, cols[2]),
          bodyCell('Initial version', cols[3]),
        ],
      }),
    ],
  });
}

// Approval table — role labels pre-filled, signatory/signature left blank.
function buildDocxApprovalTable(f) {
  const cols = [1300, 1700, 2400, 2960, 1000]; // Version | Date | Signatory | Role & org | Signature
  const blankRow = (roleLabel) =>
    new TableRow({
      children: [
        bodyCell(f.version, cols[0]),
        bodyCell('', cols[1]),
        bodyCell('', cols[2]),
        bodyCell(roleLabel, cols[3]),
        bodyCell('', cols[4]),
      ],
    });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: cols,
    borders: tableBorders(),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Version', cols[0]),
          headerCell('Date', cols[1]),
          headerCell('Signatory Name', cols[2]),
          headerCell('Role and Organisation', cols[3]),
          headerCell('Signature', cols[4]),
        ],
      }),
      blankRow('Altera Digital Health'),
      blankRow(`Authorised Signatory, ${f.customer}`),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF (pdfkit)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draws the cover, index, and records pages into a pdfkit document.
 * Leaves the cursor on a fresh page so the caller can render the body.
 *
 * PDF limitation: pdfkit has no auto-updating TOC field, so the index lists
 * section titles without live page numbers (a static contents page).
 */
export function renderPdfFrontMatter(doc, sow) {
  const f = deriveFields(sow);
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = doc.page.margins.left;

  // ── Page 1 — Cover ────────────────────────────────────────────────────
  // Full-bleed mountain background, white logo top-left, white title block
  // floating over the sky area.
  const bgBuf = getCoverBgBuffer();
  const logoBuf = getLogoWhiteBuffer();

  if (bgBuf) {
    // `cover` scales the image to fill the whole page, cropping any overflow
    // so the A4-ratio photo isn't distorted on a Letter-sized page.
    doc.image(bgBuf, 0, 0, { cover: [pageW, pageH], align: 'center', valign: 'center' });
  }

  const inset = 60; // left inset for logo + title block
  if (logoBuf) {
    doc.image(logoBuf, inset, 64, { width: 150 });
    // Thin pink accent rule under the logo (matches the brand cover).
    doc.save().rect(inset, 64 + 60, 90, 3).fill('#F56E7B').restore();
  }

  // Title block in the upper-middle of the page (white on the dusk sky).
  const titleW = pageW - inset * 2;
  let ty = pageH * 0.32;
  doc.fillColor('#FFFFFF');
  doc.font('Helvetica-Bold').fontSize(30).text('Statement of Work', inset, ty, { width: titleW });
  ty = doc.y + 8;
  doc.font('Helvetica-Bold').fontSize(18).text(f.customer, inset, ty, { width: titleW });
  if (f.subtitle) {
    ty = doc.y + 4;
    doc.font('Helvetica').fontSize(12).fillColor('#E5E7FF').text(f.subtitle, inset, ty, { width: titleW });
  }

  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(10).fillColor('#FFFFFF');
  const metaLine = (label, value) =>
    doc.text(`${label}: ${value}`, inset, doc.y, { width: titleW, lineGap: 2 });
  if (f.clientNumber) metaLine('Client #', String(f.clientNumber));
  metaLine('Date', f.longDate);
  metaLine('Version', f.version);

  // ── Page 2 — Index / Contents ─────────────────────────────────────────
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#707CF1').text('Contents');
  doc.moveDown(0.5);

  // Derive section titles from the SOW body's top-level headings.
  const sectionTitles = extractTopLevelHeadings(sow.content);
  doc.font('Helvetica').fontSize(11).fillColor('#000000');
  if (sectionTitles.length === 0) {
    doc.fillColor('#9CA3AF').text('(Section list will mirror the document headings.)');
  } else {
    sectionTitles.forEach((title, idx) => {
      doc.fillColor('#151744').text(`${idx + 1}.  ${title}`, { lineGap: 4 });
    });
  }

  // ── Page 3 — Version control + Approval ───────────────────────────────
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#393392').text('Version Control');
  doc.moveDown(0.4);
  renderPdfTable(doc, {
    headers: ['Version', 'Date', 'Author', 'Description of Changes'],
    widths: [0.13, 0.18, 0.27, 0.42],
    rows: [[f.version, f.longDate, f.author, 'Initial version']],
  });

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#393392').text('Approval');
  doc.moveDown(0.4);
  renderPdfTable(doc, {
    headers: ['Version', 'Date', 'Signatory Name', 'Role and Organisation', 'Signature'],
    widths: [0.12, 0.16, 0.24, 0.32, 0.16],
    rows: [
      [f.version, '', '', 'Altera Digital Health', ''],
      [f.version, '', '', `Authorised Signatory, ${f.customer}`, ''],
    ],
  });

  // Body starts on a fresh page.
  doc.addPage();
}

// Minimal fixed-layout table renderer for the front-matter PDF tables.
function renderPdfTable(doc, { headers, widths, rows }) {
  const margin = doc.page.margins.left;
  const contentW = doc.page.width - margin * 2;
  const colW = widths.map((w) => w * contentW);
  const rowH = 22;
  let x = margin;
  let y = doc.y;

  // Header row
  doc.rect(margin, y, contentW, rowH).fill('#707CF1');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 6, { width: colW[i] - 8, height: rowH, ellipsis: true });
    x += colW[i];
  });
  y += rowH;

  // Body rows
  doc.font('Helvetica').fontSize(9).fillColor('#1F2937');
  rows.forEach((row) => {
    // Measure tallest cell to allow wrapping
    let maxH = rowH;
    row.forEach((cell, i) => {
      const h = doc.heightOfString(String(cell || ' '), { width: colW[i] - 8 }) + 12;
      if (h > maxH) maxH = h;
    });
    // Borders + text
    x = margin;
    doc.lineWidth(0.5).strokeColor('#D1D5DB');
    row.forEach((cell, i) => {
      doc.rect(x, y, colW[i], maxH).stroke();
      doc.fillColor('#1F2937').text(String(cell || ''), x + 4, y + 6, {
        width: colW[i] - 8, height: maxH - 8,
      });
      x += colW[i];
    });
    y += maxH;
  });

  doc.y = y;
  doc.x = margin;
}

// Pull top-level (# / ## or ALL-CAPS) headings from the SOW markdown to build
// a static contents list for the PDF.  Mirrors the export's header heuristics.
function extractTopLevelHeadings(content) {
  if (!content) return [];
  const titles = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Mirror the DOCX export: 1–3 hashes are top-level sections. Strip the **
    // bold wrapper AI content tends to add (e.g. "### **1.0 Solution Overview**").
    if (/^#{1,3}\s+/.test(line)) {
      titles.push(line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '').trim());
    } else if (/^[A-Z][A-Z\s]{2,}:?\s*$/.test(line) && line.length <= 60) {
      titles.push(line.replace(/:$/, '').trim());
    }
  }
  // Drop the redundant "Statement of Work" title (already on the cover) and
  // de-duplicate consecutive repeats.
  return titles.filter(
    (t, i) => t && t !== titles[i - 1] && t.toLowerCase() !== 'statement of work'
  );
}

/**
 * Strip the leading metadata block that AI-generated SOWs tend to open with,
 * now that the cover page carries the same information:
 *
 *   ### **Statement of Work**
 *   **Project:** ...
 *   **Client:**  ...
 *   **Date:**    ...
 *   **Version:** 1.0
 *   ---
 *
 * Conservative: only strips when a recognisable "Label:" meta block is found
 * at the very top. Otherwise returns the content untouched.
 */
export function stripLeadingMetaBlock(content) {
  if (!content) return content;
  const lines = content.split('\n');
  let i = 0;

  const skipBlanks = () => { while (i < lines.length && lines[i].trim() === '') i++; };

  skipBlanks();

  // Optional leading "Statement of Work" heading (any heading level / bold).
  if (i < lines.length) {
    const t = lines[i].replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim().toLowerCase();
    if (t === 'statement of work') i++;
  }
  skipBlanks();

  // Consume contiguous "Label:" metadata lines.
  const metaRe = /^\*{0,2}\s*(project|client|customer|account|date|version|prepared\s+by|prepared\s+for|author)\s*:/i;
  let metaCount = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') { i++; continue; }
    if (metaRe.test(line)) { i++; metaCount++; continue; }
    break;
  }

  if (metaCount === 0) return content; // no meta block detected — leave as-is

  // Drop a trailing horizontal rule and any surrounding blank lines.
  while (
    i < lines.length &&
    (lines[i].trim() === '' || /^-{3,}$/.test(lines[i].trim()) || /^\*{3,}$/.test(lines[i].trim()))
  ) i++;

  return lines.slice(i).join('\n');
}
