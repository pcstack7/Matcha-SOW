/**
 * docx-version-cleaner — strips revision-history table contents from uploaded
 * .docx templates.
 *
 * SOW source documents almost always include a "Revision History" / "Version
 * Control" table at the top with columns like:
 *
 *   Version | Date | Author | Description of Changes
 *
 * When we reuse such a document as a TEMPLATE, the previous client's revision
 * rows must not carry over to new SOWs. This module locates those tables by
 * their header-row text and empties every data row's text content, leaving the
 * table structure intact so users can add fresh entries.
 *
 * Detection heuristic (intentionally conservative to avoid false positives):
 *   - Examine the first <w:tr> of every <w:tbl>
 *   - Concatenate all <w:t> text in the header row
 *   - Require BOTH:
 *       (a) the word "version" or "revision" appears, AND
 *       (b) at least 2 distinct keywords from the version-table vocabulary
 *           are present (e.g. "version" + "date", "revision" + "author")
 *
 * That combination filters out unrelated tables (e.g. a generic "Date /
 * Description" change-log embedded mid-document) while reliably catching the
 * standard SOW revision-history block.
 */

import PizZip from 'pizzip';
import { decodeXmlEntities } from './docx-scanner.js';

const TARGET_PART_REGEX = /^word\/(document|header\d+|footer\d+)\.xml$/;

// Keywords that commonly appear as column headers in a revision-history table.
// We require >= 2 of these to be present, and at least one must be
// "version" or "revision" (the strong signals).
const VERSION_HEADER_KEYWORDS = [
  'version',
  'revision',
  'date',
  'author',
  'description',
  'changes',
  'modified by',
  'modified',
  'released',
  'approved by',
  'approved',
  'reviewed by',
  'reviewer',
  'comments',
  'remarks',
  'sign-off',
  'signed off',
];

function isVersionTableHeader(headerText) {
  const lower = headerText.toLowerCase();
  const hits = new Set();
  for (const kw of VERSION_HEADER_KEYWORDS) {
    if (lower.includes(kw)) hits.add(kw);
  }
  const hasVersionOrRevision = hits.has('version') || hits.has('revision');
  return hasVersionOrRevision && hits.size >= 2;
}

/** Extract decoded text content from a chunk of run XML. */
function extractTextFromXml(xml) {
  const parts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    parts.push(decodeXmlEntities(m[1]));
  }
  return parts.join(' ').trim();
}

/**
 * Inspect one <w:tbl>...</w:tbl> chunk. If its header row identifies it as a
 * version-history table, return a version with all data-row text emptied.
 * Otherwise return the table unchanged.
 *
 * @returns {{xml: string, cleared: boolean}}
 */
function cleanTableXml(tableXml) {
  const rowRegex = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g;
  const rows = [];
  let rm;
  while ((rm = rowRegex.exec(tableXml)) !== null) {
    rows.push({ start: rm.index, end: rm.index + rm[0].length, xml: rm[0] });
  }
  // Need at least a header row + 1 data row to be worth touching.
  if (rows.length < 2) return { xml: tableXml, cleared: false };

  const headerText = extractTextFromXml(rows[0].xml);
  if (!isVersionTableHeader(headerText)) {
    return { xml: tableXml, cleared: false };
  }

  // Rebuild the table: header row untouched, every other row is fully cleared:
  //   • <w:t> text nodes blanked (removes all plain text)
  //   • <w:drawing>...</w:drawing> blocks removed (removes inline images,
  //     e.g. signature scans in Approval table cells)
  //   • <mc:AlternateContent>...</mc:AlternateContent> removed (Word's
  //     compatibility wrapper that also carries drawing/image content)
  let result = '';
  let cursor = 0;
  for (let i = 0; i < rows.length; i++) {
    result += tableXml.substring(cursor, rows[i].start);
    if (i === 0) {
      result += rows[i].xml;
    } else {
      let cleared = rows[i].xml
        // Blank out text runs
        .replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, '<w:t$1></w:t>')
        // Remove inline drawings (signature images, diagrams)
        .replace(/<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/g, '')
        // Remove AlternateContent wrappers (also carry image data in newer Word)
        .replace(/<mc:AlternateContent\b[^>]*>[\s\S]*?<\/mc:AlternateContent>/g, '')
        // Remove legacy VML images (older Word format)
        .replace(/<v:shape\b[^>]*>[\s\S]*?<\/v:shape>/g, '')
        .replace(/<w:pict\b[^>]*>[\s\S]*?<\/w:pict>/g, '');
      result += cleared;
    }
    cursor = rows[i].end;
  }
  result += tableXml.substring(cursor);
  return { xml: result, cleared: true };
}

/**
 * Process every <w:tbl> in an XML part.
 * @returns {{xml: string, tablesCleared: number}}
 */
function cleanXmlPart(xml) {
  let tablesCleared = 0;
  const result = xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g, (tableXml) => {
    const { xml: newXml, cleared } = cleanTableXml(tableXml);
    if (cleared) tablesCleared++;
    return newXml;
  });
  return { xml: result, tablesCleared };
}

/**
 * Public API — scan a .docx buffer and empty all detected version-control
 * tables. Returns the (possibly unchanged) buffer plus a count of tables
 * cleared, so the caller can surface this in the UI.
 *
 * @param {Buffer} buffer raw .docx bytes
 * @returns {{buffer: Buffer, tablesCleared: number}}
 */
export function cleanVersionTables(buffer) {
  const zip = new PizZip(buffer);
  let totalCleared = 0;
  let anyChanged = false;

  for (const fileName of Object.keys(zip.files)) {
    if (!TARGET_PART_REGEX.test(fileName)) continue;
    const file = zip.file(fileName);
    if (!file) continue;
    const original = file.asText();
    const { xml, tablesCleared } = cleanXmlPart(original);
    if (xml !== original) {
      zip.file(fileName, xml);
      totalCleared += tablesCleared;
      anyChanged = true;
    }
  }

  return {
    buffer: anyChanged
      ? zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
      : buffer,
    tablesCleared: totalCleared,
  };
}

export default { cleanVersionTables };
