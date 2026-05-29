/**
 * docx-scanner — parses a raw .docx Buffer and detects placeholder occurrences
 * across body, headers, and footers.
 *
 * Detection strategies, applied per placeholder definition:
 *   1. detect_regex     — regex patterns supplied by the admin
 *   2. data_source map  — exact text matches against known account fields
 *
 * Each candidate match is returned with its found text, occurrence count, and
 * a coarse confidence score so the admin can confirm/reject during upload.
 */

import PizZip from 'pizzip';

const TARGET_PART_REGEX = /^word\/(document|header\d+|footer\d+)\.xml$/;

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decode XML entities back to their literal characters so regex matching and
 * UI display work against the natural text the document actually contains.
 */
export function decodeXmlEntities(s) {
  if (!s) return '';
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&'); // & must be last to avoid double-decoding
}

/**
 * Extract plain text from one XML part by concatenating all <w:t> contents.
 * Inserts a single space between adjacent runs to avoid words mashing together
 * when Word splits a phrase across runs (e.g. spell-check induced splits).
 */
function extractTextFromPart(xml) {
  const chunks = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    chunks.push(decodeXmlEntities(m[1]));
  }
  // Paragraph boundary detection — newline at every </w:p>
  // (cheap heuristic; the actual paragraph structure isn't needed for matching)
  return chunks.join('');
}

/**
 * Extract the full text content of every body/header/footer part of a .docx.
 * Returns { text, partTexts } — `text` is everything concatenated, `partTexts`
 * is a map of part name -> text for diagnostic purposes.
 */
export function extractText(buffer) {
  const zip = new PizZip(buffer);
  const partTexts = {};
  for (const fileName of Object.keys(zip.files)) {
    if (!TARGET_PART_REGEX.test(fileName)) continue;
    const file = zip.file(fileName);
    if (!file) continue;
    partTexts[fileName] = extractTextFromPart(file.asText());
  }
  return {
    text: Object.values(partTexts).join('\n'),
    partTexts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

/**
 * Apply a list of regex patterns to text. Returns a Map of found_text -> count.
 * Captures group 0 (whole match) by default — placeholder definitions can use
 * the entire matched string as the find-and-replace target.
 */
function applyRegexPatterns(text, patterns) {
  const found = new Map();
  for (const pattern of patterns || []) {
    if (!pattern || typeof pattern !== 'string') continue;
    let regex;
    try {
      regex = new RegExp(pattern, 'g');
    } catch (e) {
      // Invalid regex — skip silently; admin can fix it in the library
      continue;
    }
    let m;
    while ((m = regex.exec(text)) !== null) {
      const value = m[0];
      if (!value) continue; // guard against zero-width matches
      found.set(value, (found.get(value) || 0) + 1);
    }
  }
  return found;
}

/**
 * Build a regex pattern from a literal candidate that treats quote variants
 * (straight vs curly) as equivalent. This matters because Word auto-corrects
 * apostrophes to U+2019, so a master record with a straight apostrophe will
 * otherwise fail to match.
 */
function buildFlexibleQuotePattern(candidate) {
  return escapeRegex(candidate)
    .replace(/'/g, "['‘’ʼ`]")  // straight + curly + modifier + backtick
    .replace(/"/g, '["“”]');             // straight + curly
}

/**
 * Match a placeholder against data-source values pulled from existing accounts.
 * Returns a Map of verbatim-as-found-in-document text -> occurrence count, so
 * the injector can later do an exact-substring match.
 */
function applyDataSourceMatching(text, dataSource, accounts) {
  const found = new Map();
  if (!dataSource || !Array.isArray(accounts) || accounts.length === 0) return found;

  const [table, field] = dataSource.split('.');
  if (table !== 'accounts' || !field) return found;

  for (const acc of accounts) {
    const raw = acc[field];
    if (raw == null || String(raw).trim() === '') continue;
    const candidate = String(raw).trim();

    // Word-boundary heuristic: tighten matching for short alphabetic acronyms.
    const useWordBoundary = candidate.length <= 6 && /^[A-Za-z]+$/.test(candidate);
    const pattern = buildFlexibleQuotePattern(candidate);
    const re = new RegExp(useWordBoundary ? `\\b${pattern}\\b` : pattern, 'g');

    // Capture the actual matched substring(s) so the injector can locate them
    // verbatim — quote variants and all.
    const matches = text.match(re) || [];
    for (const verbatim of matches) {
      found.set(verbatim, (found.get(verbatim) || 0) + 1);
    }
  }

  return found;
}

/**
 * Scan a .docx buffer for placeholder occurrences.
 *
 * @param {Buffer} buffer            raw .docx bytes
 * @param {Array}  definitions       placeholder definitions from the library
 *                                   (with detect_regex parsed as array)
 * @param {Array}  [accounts]        active account rows (for data-source matching)
 * @returns {Array<{
 *   key: string,
 *   label: string,
 *   input_type: string,
 *   data_source: string|null,
 *   found_text: string,
 *   occurrences: number,
 *   confidence: 'high'|'medium'|'low',
 * }>}
 */
export function scanDocument(buffer, definitions, accounts = []) {
  const { text } = extractText(buffer);
  const results = [];

  for (const def of definitions) {
    if (!def.is_active) continue;

    // Combine all detection methods into a single candidate map
    const candidates = new Map();

    // 1. Regex patterns
    const regexHits = applyRegexPatterns(text, def.detect_regex || []);
    for (const [k, v] of regexHits) candidates.set(k, (candidates.get(k) || 0) + v);

    // 2. Data-source matching (only if not already detected via regex)
    if (def.data_source) {
      const dataHits = applyDataSourceMatching(text, def.data_source, accounts);
      for (const [k, v] of dataHits) candidates.set(k, (candidates.get(k) || 0) + v);
    }

    if (candidates.size === 0) continue;

    // Emit one result per distinct candidate string. The admin can confirm/reject
    // each one in the upload UI.
    for (const [found_text, occurrences] of candidates.entries()) {
      results.push({
        key: def.key,
        label: def.label,
        input_type: def.input_type,
        data_source: def.data_source || null,
        found_text,
        occurrences,
        confidence: pickConfidence(def, occurrences, found_text),
      });
    }
  }

  // Sort: high-confidence first, then by occurrence count, then alphabetically by key
  results.sort((a, b) => {
    const cw = { high: 0, medium: 1, low: 2 };
    if (cw[a.confidence] !== cw[b.confidence]) return cw[a.confidence] - cw[b.confidence];
    if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
    return a.key.localeCompare(b.key);
  });

  return results;
}

function pickConfidence(def, occurrences, found_text) {
  // Account-sourced matches (CLIENT_FULL_NAME) — high confidence because they
  // come from a known catalog, not pattern guessing.
  if (def.data_source) return 'high';
  // Multi-occurrence regex matches are also high confidence.
  if (occurrences >= 2) return 'high';
  // Single matches via regex are medium.
  if (occurrences === 1) return 'medium';
  return 'low';
}

export default { scanDocument, extractText, decodeXmlEntities };
