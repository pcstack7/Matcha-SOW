/**
 * docx-injector — rewrites a raw .docx Buffer, replacing literal text
 * strings with `{{KEY}}` markers so the document becomes a fillable template.
 *
 * Word splits text across <w:r> (run) elements for myriad reasons —
 * formatting changes, spell-check, smart quotes, etc. — so a naive
 * find-and-replace on the XML misses cross-run matches.
 *
 * Strategy used here:
 *   1. Process each XML part (document.xml + headers + footers) separately.
 *   2. Walk paragraph by paragraph (<w:p>...</w:p>).
 *   3. Within each paragraph, concatenate the text of every <w:t> into a single
 *      string (decoded from XML entities) AND keep a map of which run each
 *      character came from.
 *   4. Find target strings in the flattened text.
 *   5. Where matches exist, rewrite the paragraph: put the new text (with
 *      `{{KEY}}` substituted in place of matches) into the first run; empty
 *      every other <w:t> in the paragraph so the original visible content
 *      isn't duplicated.
 *
 * This preserves the original paragraph styling (the first run's <w:rPr>),
 * which is acceptable for SOW templates where the placeholder text is almost
 * always part of a uniformly formatted span.
 */

import PizZip from 'pizzip';
import { decodeXmlEntities } from './docx-scanner.js';

const TARGET_PART_REGEX = /^word\/(document|header\d+|footer\d+)\.xml$/;

// ─────────────────────────────────────────────────────────────────────────────
// Entity encoding for safe XML insertion
// ─────────────────────────────────────────────────────────────────────────────

function encodeXmlText(s) {
  if (s == null) return '';
  // Only the minimal set required for text-node content.
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-paragraph rewriting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject `{{KEY}}` markers into a single paragraph XML chunk.
 * Returns the rewritten paragraph (or the original if no matches were found).
 *
 * @param {string} paragraphXml - the raw <w:p>...</w:p> source
 * @param {Array<{key:string, found_text:string}>} mappings - sorted by length DESC
 */
function processParagraph(paragraphXml, mappings) {
  // Locate every <w:r>...</w:r> run inside this paragraph
  const runRegex = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
  const runs = [];
  let rm;
  while ((rm = runRegex.exec(paragraphXml)) !== null) {
    runs.push({ start: rm.index, end: rm.index + rm[0].length, xml: rm[0] });
  }
  if (runs.length === 0) return paragraphXml;

  // For each run, extract the decoded text content of its <w:t> elements
  const runTexts = runs.map((r) => {
    const texts = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tRegex.exec(r.xml)) !== null) {
      texts.push(decodeXmlEntities(tm[1]));
    }
    return texts.join('');
  });

  const fullText = runTexts.join('');
  if (!fullText) return paragraphXml;

  // Find non-overlapping match ranges. Mappings are pre-sorted longest first.
  const matches = [];
  for (const mapping of mappings) {
    if (!mapping.found_text) continue;
    let pos = 0;
    while ((pos = fullText.indexOf(mapping.found_text, pos)) !== -1) {
      const end = pos + mapping.found_text.length;
      const overlap = matches.some((r) => !(end <= r.start || pos >= r.end));
      if (!overlap) {
        matches.push({ start: pos, end, key: mapping.key });
      }
      pos = end;
    }
  }
  if (matches.length === 0) return paragraphXml;

  // Build the new flattened text with placeholders substituted in.
  matches.sort((a, b) => a.start - b.start);
  let newText = '';
  let cursor = 0;
  for (const m of matches) {
    newText += fullText.substring(cursor, m.start);
    newText += `{{${m.key}}}`;
    cursor = m.end;
  }
  newText += fullText.substring(cursor);

  // Stitch the paragraph back together: first run gets the new text,
  // subsequent runs have their <w:t> contents emptied.
  let result = '';
  let lastIndex = 0;
  let firstRunDone = false;

  for (const run of runs) {
    // Preserve anything that sits between runs (paragraph properties etc.)
    result += paragraphXml.substring(lastIndex, run.start);
    lastIndex = run.end;

    if (!firstRunDone) {
      // Put the entire new text into the first <w:t> of this run, empty any
      // additional <w:t> elements in the same run.
      let isFirstT = true;
      const encoded = encodeXmlText(newText);
      const newRun = run.xml.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (_match, attrs) => {
        if (isFirstT) {
          isFirstT = false;
          // Ensure xml:space="preserve" so leading/trailing spaces survive.
          if (!/\bxml:space=/.test(attrs)) attrs += ' xml:space="preserve"';
          return `<w:t${attrs}>${encoded}</w:t>`;
        }
        return `<w:t${attrs}></w:t>`;
      });
      result += newRun;
      firstRunDone = true;
    } else {
      // Clear all text in subsequent runs (preserves formatting, just no text).
      const cleared = run.xml.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, '<w:t$1></w:t>');
      result += cleared;
    }
  }
  result += paragraphXml.substring(lastIndex);
  return result;
}

/**
 * Process every paragraph in an XML part.
 */
function processXmlPart(xml, mappings) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (p) => processParagraph(p, mappings));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject placeholders into a .docx buffer. Mappings tell the injector which
 * exact text strings should become which `{{KEY}}` markers.
 *
 * @param {Buffer} buffer
 * @param {Array<{key:string, found_text:string}>} mappings
 * @returns {Buffer} processed .docx with markers in place
 */
export function injectPlaceholders(buffer, mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return buffer; // nothing to do — return as-is
  }

  // Sort longest-first so e.g. "St Luke's Medical Center" wins over "SLMC"
  // if they happened to overlap.
  const sorted = [...mappings]
    .filter((m) => m && m.key && m.found_text)
    .sort((a, b) => b.found_text.length - a.found_text.length);

  if (sorted.length === 0) return buffer;

  const zip = new PizZip(buffer);

  for (const fileName of Object.keys(zip.files)) {
    if (!TARGET_PART_REGEX.test(fileName)) continue;
    const file = zip.file(fileName);
    if (!file) continue;
    const original = file.asText();
    const rewritten = processXmlPart(original, sorted);
    if (rewritten !== original) {
      zip.file(fileName, rewritten);
    }
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export default { injectPlaceholders };
