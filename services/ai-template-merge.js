/**
 * ai-template-merge.js
 *
 * When an AI SOW is generated against a selected AI template, this module
 * guarantees the output FOLLOWS that template's section structure:
 *
 *   • A section/subsection present in BOTH the AI SOW and the template
 *     → keep the AI SOW's content (the model's client-specific wording wins).
 *   • A section/subsection present in the template but MISSING from the AI SOW
 *     → insert the template's own content for it, verbatim, in the template's
 *       relative position (nested under its parent when the parent exists;
 *       the whole parent + children when the parent is also missing).
 *   • A section the AI SOW has but the template doesn't → kept as-is.
 *
 * The template is parsed into a nested section tree with markdown bodies
 * (paragraphs, lists, and tables → markdown tables; images are dropped — the
 * AI-SOW pipeline stores plain markdown and can't embed images). The AI SOW
 * stays an untouched string into which missing sections are spliced, so the
 * model's original formatting/numbering is preserved exactly.
 */

import mammoth from 'mammoth';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Entity + inline helpers ────────────────────────────────────────────────────
function decodeEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&'); // last
}

// Convert an HTML inline fragment to markdown text (bold/italic/links kept).
function htmlInlineToMd(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\s*(strong|b)\s*>/gi, '**').replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
      .replace(/<\s*(em|i)\s*>/gi, '*').replace(/<\s*\/\s*(em|i)\s*>/gi, '*')
      .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/<img\b[^>]*>/gi, '')        // drop images
      .replace(/<[^>]+>/g, '')              // strip any remaining tags
  ).replace(/[ \t]+/g, ' ').trim();
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// Convert an HTML <table> to a markdown table.
function htmlTableToMd(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((c) =>
      htmlInlineToMd(c[1]).replace(/\|/g, '\\|') || ' '
    )
  );
  if (rows.length === 0) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(cols - r.length).fill(' ')];
  const header = pad(rows[0]);
  const sep = Array(cols).fill('---');
  const body = rows.slice(1).map(pad);
  return [header, sep, ...body].map((r) => `| ${r.join(' | ')} |`).join('\n');
}

// ── HTML → ordered block list ──────────────────────────────────────────────────
// Each block is { kind:'heading', level, text } or { kind:'md', md }.
function htmlToBlocks(html) {
  const blocks = [];
  // Top-level block elements, in document order.
  const re = /<(h[1-6]|p|ul|ol|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    if (/^h[1-6]$/.test(tag)) {
      const text = stripTags(inner);
      if (text) blocks.push({ kind: 'heading', level: Number(tag[1]), text });
    } else if (tag === 'ul' || tag === 'ol') {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => htmlInlineToMd(li[1])).filter(Boolean);
      if (items.length) blocks.push({ kind: 'md', md: items.map((i) => `- ${i}`).join('\n') });
    } else if (tag === 'table') {
      const md = htmlTableToMd(m[0]);
      if (md) blocks.push({ kind: 'md', md });
    } else { // p
      const md = htmlInlineToMd(inner);
      if (md) blocks.push({ kind: 'md', md });
    }
  }
  return blocks;
}

// Plain text (pdf/txt) → ordered blocks, with heuristic headings.
function textToBlocks(text) {
  const blocks = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let level = 0;
    let title = null;
    const hashed = line.match(/^(#{1,6})\s+(.*)$/);
    if (hashed) { level = hashed[1].length; title = hashed[2]; }
    else if (/^\d+(\.\d+)*\.?\s+\S/.test(line) && line.length <= 80) {
      // "1 Intro" / "1.2 Scope Inclusions" — depth from the dotted number
      const num = line.match(/^(\d+(?:\.\d+)*)/)[1];
      level = num.split('.').length;
      title = line.replace(/^\d+(?:\.\d+)*\.?\s+/, '');
    } else if (/^[A-Z][A-Z0-9 &/-]{2,60}$/.test(line)) {
      level = 1; title = line; // ALL-CAPS heading
    }
    if (title) blocks.push({ kind: 'heading', level, text: title.replace(/\*\*/g, '').trim() });
    else blocks.push({ kind: 'md', md: line });
  }
  return blocks;
}

// ── Blocks → nested section tree ───────────────────────────────────────────────
function blocksToTree(blocks) {
  const root = { title: null, level: 0, bodyBlocks: [], children: [] };
  const stack = [root];
  for (const b of blocks) {
    if (b.kind === 'heading') {
      while (stack.length > 1 && stack[stack.length - 1].level >= b.level) stack.pop();
      const node = { title: b.text, level: b.level, bodyBlocks: [], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else {
      stack[stack.length - 1].bodyBlocks.push(b.md);
    }
  }
  // Finalise body markdown strings
  const finalise = (n) => {
    n.body = n.bodyBlocks.join('\n\n').trim();
    delete n.bodyBlocks;
    n.children.forEach(finalise);
  };
  finalise(root);
  return root;
}

// ── Public: parse an AI template (any file type) into a section tree ────────────
export async function extractTemplateTree(template) {
  if (!template) return { children: [] };
  const ext = (template.file_type || '').toLowerCase();
  try {
    if (ext === '.docx' && template.file_path && fs.existsSync(template.file_path)) {
      const { value: html } = await mammoth.convertToHtml({ path: template.file_path });
      return blocksToTree(htmlToBlocks(html));
    }
    if (ext === '.pdf' && template.file_path && fs.existsSync(template.file_path)) {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: fs.readFileSync(template.file_path) });
      const data = await parser.getText();
      await parser.destroy?.();
      return blocksToTree(textToBlocks(data.text || ''));
    }
    // txt or stored content
    const text = template.content || (template.file_path && fs.existsSync(template.file_path)
      ? fs.readFileSync(template.file_path, 'utf8') : '');
    return blocksToTree(textToBlocks(text));
  } catch (err) {
    console.warn('extractTemplateTree failed:', err.message);
    return { children: [] };
  }
}

// ── Outline rendering (for outline-first generation) ───────────────────────────
// Produce an indented, exact-title outline of the template's BODY sections
// (front matter excluded), e.g.
//   - Introduction
//     - Document Purpose
//     - Background
//   - Scope
// Used to instruct the AI to generate directly into the template's structure.
export function outlineToText(tree, exclude) {
  if (!tree || !tree.children) return '';
  const skip = exclude instanceof Set ? exclude : new Set(exclude || []);
  const lines = [];
  const walk = (node, depth) => {
    for (const child of node.children) {
      const norm = normalizeTitle(child.title);
      if (isFrontMatter(norm)) continue;
      if (skip.has(norm)) continue; // locked/intact → omit it AND its subtree
      lines.push(`${'  '.repeat(depth)}- ${child.title.replace(/\*\*/g, '').trim()}`);
      walk(child, depth + 1);
    }
  };
  walk(tree, 0);
  return lines.join('\n');
}

// Flat, ordered list of the template's BODY sections (front matter excluded)
// for the per-generation "keep intact" picker. Each entry carries its depth
// and normalised title (the stable key the generate call references).
export function flattenBodySections(tree) {
  const out = [];
  const walk = (node, depth) => {
    for (const child of (node.children || [])) {
      const norm = normalizeTitle(child.title);
      if (isFrontMatter(norm)) continue;
      out.push({ title: child.title.replace(/\*\*/g, '').trim(), norm, level: depth });
      walk(child, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

// ── Title normalisation + matching ─────────────────────────────────────────────
export function normalizeTitle(t) {
  return String(t || '')
    .replace(/\*\*/g, '').replace(/^#+\s*/, '')
    .replace(/^\d+(?:\.\d+)*\.?\s+/, '')   // strip leading numbering
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Front-matter / structural sections that belong to the document shell, not the
// SOW body — never merged in (the template shell already provides these).
const FRONT_MATTER = new Set([
  'document control', 'version history', 'revision history', 'approval',
  'approval acceptance', 'document classification', 'document information',
  'document history', 'contents', 'table of contents', 'list of tables',
  'list of figures', 'tables', 'figures', 'statement of work', 'project title',
  'cover', 'cover page',
]);
function isFrontMatter(norm) {
  return FRONT_MATTER.has(norm);
}

// Two titles match if normalised-equal or one clearly contains the other
// (length-guarded to avoid spurious substring hits).
function titlesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 6 && long.includes(short);
}

// ── AI markdown → ordered heading index (with offsets) ─────────────────────────
function parseAiHeadings(md) {
  const lines = md.split('\n');
  const headings = [];
  let offset = 0;
  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1; // +1 for the split newline
    const t = line.trim();
    let level = 0;
    let title = null;
    const hashed = t.match(/^(#{1,6})\s+(.*)$/);
    if (hashed) { level = hashed[1].length; title = hashed[2]; }
    else if (/^\*\*[^*].*\*\*$/.test(t)) { level = 3; title = t; } // bold-only line
    if (title != null) {
      headings.push({ level, title, norm: normalizeTitle(title), lineStart });
    }
  }
  // Compute each heading's end = start of the next heading whose level <= its own
  for (let i = 0; i < headings.length; i++) {
    let end = md.length;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= headings[i].level) { end = headings[j].lineStart; break; }
    }
    headings[i].end = end;
  }
  return headings;
}

// ── Serialise a template node (and its subtree) to markdown ────────────────────
// templateLevel L → markdown heading of (L+1) hashes, so a template top-level
// section becomes "##" — matching the AI SOW's top-level convention.
function serializeNode(node, baseHashes) {
  const hashes = '#'.repeat(Math.min(6, baseHashes));
  let out = `${hashes} ${node.title}\n\n`;
  if (node.body) out += `${node.body}\n\n`;
  for (const child of node.children) out += serializeNode(child, baseHashes + 1);
  return out;
}

// ── Merge ──────────────────────────────────────────────────────────────────────
/**
 * Insert any template sections/subsections missing from the AI SOW.
 * @param {string} aiMarkdown      the generated SOW (markdown)
 * @param {object} templateTree    root node from extractTemplateTree()
 * @returns {{ content: string, inserted: string[] }}
 */
export function mergeTemplateSections(aiMarkdown, templateTree) {
  if (!templateTree || !templateTree.children || templateTree.children.length === 0) {
    return { content: aiMarkdown, inserted: [] };
  }
  const aiHeadings = parseAiHeadings(aiMarkdown);
  const findAi = (norm) => aiHeadings.find((h) => titlesMatch(h.norm, norm));

  // Flatten the template into depth-first order with parent links. Skip
  // front-matter sections (and their subtrees) — they belong to the shell.
  const flat = [];
  const walk = (node, parent) => {
    for (const child of node.children) {
      const norm = normalizeTitle(child.title);
      if (isFrontMatter(norm)) continue; // skip this node and its subtree
      const entry = { node: child, parent, norm };
      flat.push(entry);
      walk(child, entry);
    }
  };
  walk(templateTree, null);

  // Decide insertions. Process in DFS order; when a node is a gap, insert its
  // whole subtree and mark descendants covered.
  const covered = new Set();
  const insertions = []; // { offset, text, title }
  const inserted = [];

  for (let i = 0; i < flat.length; i++) {
    const entry = flat[i];
    if (covered.has(entry)) continue;
    const aiMatch = findAi(entry.norm);
    if (aiMatch) continue; // present in AI → keep AI content, recurse naturally via DFS

    // This template node is missing → it's a gap root. Mark its subtree covered.
    const subtree = new Set([entry]);
    for (let j = i + 1; j < flat.length; j++) {
      // a descendant has this entry somewhere up its parent chain
      let p = flat[j].parent;
      while (p && p !== entry) p = p.parent;
      if (p === entry) { subtree.add(flat[j]); covered.add(flat[j]); }
    }

    // Insertion offset = AI position of the next template node (after this
    // subtree, in DFS order) that exists in the AI SOW; else end of doc.
    let offset = aiMarkdown.length;
    for (let j = i + 1; j < flat.length; j++) {
      if (subtree.has(flat[j])) continue;
      const m = findAi(flat[j].norm);
      if (m) { offset = m.lineStart; break; }
    }

    const baseHashes = (entry.node.level || 1) + 1; // template top-level → ##
    insertions.push({ offset, text: `${serializeNode(entry.node, baseHashes)}`, title: entry.node.title });
    inserted.push(entry.node.title);
  }

  if (insertions.length === 0) return { content: aiMarkdown, inserted: [] };

  // Apply insertions from the highest offset down so earlier offsets stay valid.
  insertions.sort((a, b) => b.offset - a.offset);
  let content = aiMarkdown;
  for (const ins of insertions) {
    const before = content.slice(0, ins.offset);
    const after = content.slice(ins.offset);
    const sep = before.endsWith('\n\n') || before === '' ? '' : (before.endsWith('\n') ? '\n' : '\n\n');
    content = `${before}${sep}${ins.text}\n${after}`;
  }
  return { content, inserted };
}

export default {
  extractTemplateTree, mergeTemplateSections, normalizeTitle, outlineToText, flattenBodySections,
};
