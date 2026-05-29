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

// ── Cover image (read once, cached) ───────────────────────────────────────────
const COVER_IMAGE_PATH = path.join(__dirname, '..', 'assets', 'brand', 'altera-cover.png');
const COVER_IMAGE_NATURAL = { width: 1658, height: 1388 }; // px — for aspect ratio

let _coverBufferCache;
function getCoverImageBuffer() {
  if (_coverBufferCache !== undefined) return _coverBufferCache;
  try {
    _coverBufferCache = fs.readFileSync(COVER_IMAGE_PATH);
  } catch {
    _coverBufferCache = null; // graceful: cover renders without the graphic
  }
  return _coverBufferCache;
}

// ── Shared field derivation ───────────────────────────────────────────────────
function deriveFields(sow) {
  const customer = sow.account_name || 'Customer';
  const author =
    sow.created_by_display_name || sow.created_by_username || 'Altera Digital Health';
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
  const coverBuf = getCoverImageBuffer();
  if (coverBuf) {
    const imgW = 260;
    const imgH = Math.round(imgW * (COVER_IMAGE_NATURAL.height / COVER_IMAGE_NATURAL.width));
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 600 },
        children: [
          new ImageRun({
            type: 'png',
            data: coverBuf,
            transformation: { width: imgW, height: imgH },
            altText: { title: 'Altera', description: 'Altera brand graphic', name: 'AlteraCover' },
          }),
        ],
      })
    );
  } else {
    children.push(new Paragraph({ spacing: { before: 1800 }, text: '' }));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({ text: 'Statement of Work', bold: true, font: 'Verdana', size: 56, color: COLORS.ink }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: f.subtitle ? 120 : 400 },
      children: [
        new TextRun({ text: f.customer, bold: true, font: 'Verdana', size: 32, color: COLORS.purple }),
      ],
    })
  );

  if (f.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({ text: f.subtitle, font: 'Verdana', size: 24, color: COLORS.light }),
        ],
      })
    );
  }

  // Meta lines (client #, date) centred under the title block
  const metaLine = (label, value) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, font: 'Verdana', size: 20, color: COLORS.ink }),
        new TextRun({ text: value, font: 'Verdana', size: 20, color: COLORS.ink }),
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
  const margin = doc.page.margins.left;
  const contentW = pageW - margin * 2;

  // ── Page 1 — Cover ────────────────────────────────────────────────────
  const coverBuf = getCoverImageBuffer();
  if (coverBuf) {
    const imgW = 230;
    const imgX = (pageW - imgW) / 2;
    doc.image(coverBuf, imgX, 110, { width: imgW });
    doc.y = 110 + imgW * (COVER_IMAGE_NATURAL.height / COVER_IMAGE_NATURAL.width) + 40;
  } else {
    doc.y = 200;
  }

  doc.font('Helvetica-Bold').fontSize(28).fillColor('#151744')
    .text('Statement of Work', margin, doc.y, { align: 'center', width: contentW });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#393392')
    .text(f.customer, { align: 'center', width: contentW });

  if (f.subtitle) {
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(12).fillColor('#707CF1')
      .text(f.subtitle, { align: 'center', width: contentW });
  }

  doc.moveDown(1.5);
  // NB: pdfkit's `continued: true` mis-positions segments under center
  // alignment (each fragment is centred independently and they overlap), so
  // render each meta line as a single centred string.
  doc.font('Helvetica').fontSize(10).fillColor('#151744');
  const metaCenter = (label, value) =>
    doc.text(`${label}: ${value}`, { align: 'center', width: contentW, lineGap: 2 });
  if (f.clientNumber) metaCenter('Client #', String(f.clientNumber));
  metaCenter('Date', f.longDate);
  metaCenter('Version', f.version);

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
