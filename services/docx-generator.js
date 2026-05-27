/**
 * docx-generator — fills a processed .docx template (containing `{{KEY}}`
 * markers) with user-supplied values and returns the result as a Buffer.
 *
 * Powered by docxtemplater, which transparently handles `{{KEY}}` patterns
 * even when Word splits them across runs.
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Generate a filled .docx from a processed template buffer and a values map.
 *
 * @param {Buffer} templateBuffer  - .docx with {{KEY}} markers (produced by injector)
 * @param {Object} values          - { CLIENT_FULL_NAME: '...', QUOTE_NUMBER: '...', ... }
 * @returns {Buffer} the filled .docx
 */
export function generateDocument(templateBuffer, values) {
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    // Render missing keys as empty string instead of throwing — keeps the
    // user experience forgiving when an old template references a placeholder
    // that wasn't filled in.
    nullGetter: () => '',
  });

  // Coerce all values to strings so docxtemplater never sees undefined/null
  const safeValues = {};
  for (const [k, v] of Object.entries(values || {})) {
    safeValues[k] = v == null ? '' : String(v);
  }

  doc.render(safeValues);

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

/**
 * List every `{{KEY}}` token present in a processed template buffer.
 * Useful for sanity-checking that all placeholders were marked up correctly
 * after the injection step.
 *
 * @param {Buffer} templateBuffer
 * @returns {Array<string>} unique placeholder keys found in the template
 */
export function listPlaceholdersInTemplate(templateBuffer) {
  const zip = new PizZip(templateBuffer);
  const keys = new Set();
  const PLACEHOLDER_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

  for (const fileName of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/.test(fileName)) continue;
    const file = zip.file(fileName);
    if (!file) continue;
    const xml = file.asText();
    let m;
    while ((m = PLACEHOLDER_RE.exec(xml)) !== null) {
      keys.add(m[1]);
    }
  }

  return [...keys];
}

export default { generateDocument, listPlaceholdersInTemplate };
