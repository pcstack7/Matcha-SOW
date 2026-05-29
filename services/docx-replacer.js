/**
 * docx-replacer — applies ad-hoc find/replace pairs to an already-filled .docx
 * Buffer right before download.
 *
 * Use case: a user has selected a template and filled all known placeholders,
 * but the document still contains text they need to swap out on the fly
 * (environment names, hostnames, project codes, etc. that weren't pre-marked
 * as placeholders).
 *
 * Implementation note: this re-uses the same per-paragraph run-flattening
 * trick as services/docx-injector.js — Word can split a phrase across many
 * <w:r> runs, so we flatten each paragraph's text into a single string, do
 * the substitutions there, and then put the result back into the first run
 * while emptying the others.
 */

import PizZip from 'pizzip';
import { decodeXmlEntities } from './docx-scanner.js';

const TARGET_PART_REGEX = /^word\/(document|header\d+|footer\d+)\.xml$/;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function encodeXmlText(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a RegExp for one find/replace pair. The `find` field is treated as
 * literal text (not a user-supplied regex) — special chars are escaped.
 */
function buildFindRegex(find, { caseSensitive, wholeWord }) {
  let pattern = escapeRegex(find);
  if (wholeWord) pattern = `\\b${pattern}\\b`;
  const flags = caseSensitive ? 'g' : 'gi';
  return new RegExp(pattern, flags);
}

/**
 * Locate every non-overlapping match in `flatText` across all replacements.
 * Returns matches sorted left-to-right. When two replacements would overlap,
 * the earlier (longer-first sorted) one wins.
 */
function findAllMatches(flatText, replacements) {
  const raw = [];
  replacements.forEach((r, idx) => {
    if (!r.find) return;
    let regex;
    try {
      regex = buildFindRegex(r.find, r);
    } catch {
      return; // invalid pattern — skip
    }
    let m;
    while ((m = regex.exec(flatText)) !== null) {
      if (m[0].length === 0) { regex.lastIndex++; continue; }
      raw.push({ start: m.index, end: m.index + m[0].length, replaceIdx: idx });
    }
  });

  // Earliest-first; ties broken by replacement index (which is in
  // longest-first order, so the longer find-text wins on overlap).
  raw.sort((a, b) => a.start - b.start || a.replaceIdx - b.replaceIdx);

  // Drop any match that overlaps with one we've already accepted.
  const accepted = [];
  for (const m of raw) {
    const last = accepted[accepted.length - 1];
    if (!last || m.start >= last.end) accepted.push(m);
  }
  return accepted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-paragraph rewriting (mirrors docx-injector.js)
// ─────────────────────────────────────────────────────────────────────────────

function processParagraph(paragraphXml, replacements) {
  const runRegex = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
  const runs = [];
  let rm;
  while ((rm = runRegex.exec(paragraphXml)) !== null) {
    runs.push({ start: rm.index, end: rm.index + rm[0].length, xml: rm[0] });
  }
  if (runs.length === 0) return paragraphXml;

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

  const matches = findAllMatches(fullText, replacements);
  if (matches.length === 0) return paragraphXml;

  // Stitch the new flattened text together.
  let newText = '';
  let cursor = 0;
  for (const m of matches) {
    newText += fullText.substring(cursor, m.start);
    newText += replacements[m.replaceIdx].replace || '';
    cursor = m.end;
  }
  newText += fullText.substring(cursor);

  // First run gets the new text, subsequent runs are emptied (formatting kept).
  let result = '';
  let lastIndex = 0;
  let firstRunDone = false;

  for (const run of runs) {
    result += paragraphXml.substring(lastIndex, run.start);
    lastIndex = run.end;

    if (!firstRunDone) {
      let isFirstT = true;
      const encoded = encodeXmlText(newText);
      const newRun = run.xml.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (_match, attrs) => {
        if (isFirstT) {
          isFirstT = false;
          if (!/\bxml:space=/.test(attrs)) attrs += ' xml:space="preserve"';
          return `<w:t${attrs}>${encoded}</w:t>`;
        }
        return `<w:t${attrs}></w:t>`;
      });
      result += newRun;
      firstRunDone = true;
    } else {
      const cleared = run.xml.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, '<w:t$1></w:t>');
      result += cleared;
    }
  }
  result += paragraphXml.substring(lastIndex);
  return result;
}

function processXmlPart(xml, replacements) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (p) => processParagraph(p, replacements));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply ad-hoc find/replace pairs to a .docx Buffer.
 *
 * @param {Buffer} buffer
 * @param {Array<{find:string, replace:string, caseSensitive?:boolean, wholeWord?:boolean}>} replacements
 *   - `find`: literal text to look for (NOT a regex; special chars are escaped)
 *   - `replace`: literal text to substitute
 *   - `caseSensitive`: default true (safer — won't accidentally match "Opal"
 *     when looking for "opal")
 *   - `wholeWord`: default false (most SOW identifiers have hyphens/dots)
 * @returns {Buffer}
 */
export function applyAdHocReplacements(buffer, replacements) {
  if (!Array.isArray(replacements) || replacements.length === 0) return buffer;

  const valid = replacements
    .filter((r) => r && typeof r.find === 'string' && r.find.length > 0 && typeof r.replace === 'string')
    .map((r) => ({
      find: r.find,
      replace: r.replace,
      caseSensitive: r.caseSensitive !== false, // default true
      wholeWord: !!r.wholeWord,
    }));

  if (valid.length === 0) return buffer;

  // Longest-first so e.g. "GENESIS-PROD-01" beats "GENESIS" on overlap.
  valid.sort((a, b) => b.find.length - a.find.length);

  const zip = new PizZip(buffer);

  for (const fileName of Object.keys(zip.files)) {
    if (!TARGET_PART_REGEX.test(fileName)) continue;
    const file = zip.file(fileName);
    if (!file) continue;
    const original = file.asText();
    const rewritten = processXmlPart(original, valid);
    if (rewritten !== original) {
      zip.file(fileName, rewritten);
    }
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export default { applyAdHocReplacements };
