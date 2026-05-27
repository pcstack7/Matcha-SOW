/**
 * TemplateGenerator — the "From Template" flow inside the SOW Generator page.
 *
 * Flow:
 *   1. Pick a fixed template (cards/dropdown)
 *   2. Pick an account (auto-populates data-source placeholders)
 *   3. Fill any remaining placeholders (smart fields based on input_type)
 *   4. Click Generate — backend returns a filled .docx as a download
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';

function TemplateGenerator() {
  const [templates, setTemplates] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [values, setValues] = useState({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Ad-hoc find/replace pairs the user adds at generation time
  const [adHocReplacements, setAdHocReplacements] = useState([]);
  // Plain-text preview of the selected template — used for live match counts
  const [previewText, setPreviewText] = useState('');

  // Phase 4 — one-step undo for the ad-hoc list.  Every transition captures
  // the *previous* array as `lastSnapshot`; the Undo button restores it.
  // Covers: popover saves, row edits, row removes, AND the wipe that fires
  // when the user switches templates (which is the most painful case).
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const previousAdHocRef = useRef([]);
  const isUndoingRef = useRef(false);

  // D-Lite preview pane
  const [previewRendering, setPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const previewContainerRef = useRef(null);
  // Track a counter so we can debounce preview refreshes
  const previewVersionRef = useRef(0);

  // D-Visual click-to-edit
  const [previewSelection, setPreviewSelection] = useState(null); // {text, rect, paraText}
  const [editPopover, setEditPopover] = useState(null);           // {findText, replaceText, matchCount, replaceAll, paraText, position}

  // Scale the rendered .docx-wrapper so the natural Word page width
  // (~8.5in) fits inside the preview pane. Preserving the original
  // page dimensions keeps cover-page image+text positioning accurate.
  const applyPreviewScale = () => {
    const container = previewContainerRef.current;
    if (!container) return;
    const wrapper = container.querySelector('.docx-wrapper');
    if (!wrapper) return;

    // Reset any prior transform/box so we can measure natural size
    wrapper.style.transform = '';
    wrapper.style.transformOrigin = '';
    wrapper.style.height = '';
    wrapper.style.width = '';
    wrapper.style.marginBottom = '';

    const naturalWidth = wrapper.scrollWidth;
    const naturalHeight = wrapper.scrollHeight;
    const containerWidth = container.clientWidth - 8; // small padding allowance

    if (naturalWidth > 0 && containerWidth > 0 && naturalWidth > containerWidth) {
      const scale = containerWidth / naturalWidth;
      wrapper.style.width = `${naturalWidth}px`;
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.transformOrigin = 'top left';
      // Compensate for transform not shrinking the layout box
      wrapper.style.height = `${naturalHeight * scale}px`;
    }
  };

  // ── Initial data load ──────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/fixed-templates', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/placeholder-definitions', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/accounts?filter=active', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([t, d, a]) => {
        setTemplates(Array.isArray(t) ? t : []);
        setDefinitions(Array.isArray(d) ? d : []);
        setAccounts(Array.isArray(a) ? a : []);
      })
      .catch((e) => setError(e.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived data ───────────────────────────────────────────────────
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === Number(selectedTemplateId)) || null,
    [templates, selectedTemplateId]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === Number(selectedAccountId)) || null,
    [accounts, selectedAccountId]
  );

  // The set of placeholder keys actually present in this template,
  // joined with their full definition (input type, label, source, etc.)
  const templateFields = useMemo(() => {
    if (!selectedTemplate) return [];
    const keys = selectedTemplate.placeholders.map((p) => p.key);
    const defByKey = new Map(definitions.map((d) => [d.key, d]));

    return keys
      .map((key) => {
        const def = defByKey.get(key);
        if (!def) {
          // Custom placeholder not in the library — render as a generic text field
          return { key, label: key, input_type: 'text', data_source: null, description: '', sort_order: 999 };
        }
        return def;
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [selectedTemplate, definitions]);

  const fieldsRequiringInput = templateFields.filter(
    (f) => !f.data_source && f.input_type !== 'account'
  );

  // ── Account selection auto-fill ────────────────────────────────────
  useEffect(() => {
    if (!selectedAccount) return;
    const next = { ...values };
    for (const field of templateFields) {
      if (field.input_type === 'account') {
        next[field.key] = selectedAccount.name || '';
      } else if (field.data_source) {
        const [table, col] = field.data_source.split('.');
        if (table === 'accounts' && selectedAccount[col] != null) {
          next[field.key] = String(selectedAccount[col]);
        }
      }
    }
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, selectedTemplateId]);

  // Reset values when template changes
  useEffect(() => {
    setValues({});
    setSelectedAccountId('');
    setError(null);
    setSuccess(null);
    setAdHocReplacements([]);
    setPreviewText('');
  }, [selectedTemplateId]);

  // Fetch the plain-text preview of the selected template so the ad-hoc
  // panel can show live match counts as the user types.
  useEffect(() => {
    if (!selectedTemplateId) return;
    let cancelled = false;
    fetch(`/api/fixed-templates/${selectedTemplateId}/preview-text`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => { if (!cancelled) setPreviewText(data.text || ''); })
      .catch(() => { if (!cancelled) setPreviewText(''); });
    return () => { cancelled = true; };
  }, [selectedTemplateId]);

  // ── Preview render (debounced 600ms) ──────────────────────────────
  useEffect(() => {
    if (!selectedTemplate || !selectedAccount) return;

    const version = ++previewVersionRef.current;
    const timer = setTimeout(async () => {
      if (version !== previewVersionRef.current) return; // stale
      if (!previewContainerRef.current) return;

      setPreviewRendering(true);
      setPreviewError(null);

      const validReplacements = adHocReplacements
        .filter((r) => r.find && r.find.trim())
        .map(({ find, replace, caseSensitive, wholeWord }) => ({ find, replace, caseSensitive, wholeWord }));

      try {
        const r = await fetch(`/api/fixed-templates/${selectedTemplate.id}/render-preview`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeholder_values: values, ad_hoc_replacements: validReplacements }),
        });
        if (!r.ok) throw new Error('Preview failed');
        if (version !== previewVersionRef.current) return; // stale by the time response arrived

        const blob = await r.blob();
        const arrayBuffer = await blob.arrayBuffer();

        // Clear the container before rendering to avoid stacking
        previewContainerRef.current.innerHTML = '';
        await renderAsync(arrayBuffer, previewContainerRef.current, undefined, {
          className: 'docx-preview-doc',
          inWrapper: true,
          ignoreWidth: false,    // preserve natural Word page width
          ignoreHeight: false,   // preserve natural page height
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
        });

        // Fit the page width to the available pane width via CSS scale.
        // Wait a frame so docx-preview's layout settles before measuring.
        await new Promise((r) => requestAnimationFrame(r));
        applyPreviewScale();
      } catch (err) {
        if (version !== previewVersionRef.current) return;
        setPreviewError('Preview could not be generated. The downloaded file will still be correct.');
      } finally {
        if (version === previewVersionRef.current) setPreviewRendering(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, selectedAccount, values, adHocReplacements]);

  // Re-fit the preview when the pane width changes (sidebar collapse, window resize)
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => applyPreviewScale());
    ro.observe(container);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, selectedAccount]);

  // ── Click-to-edit: capture text selections within the preview ─────
  const handlePreviewMouseUp = () => {
    // Defer one tick so window.getSelection() reflects the final selection
    setTimeout(() => {
      if (editPopover) return; // don't replace selection while editing
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPreviewSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = previewContainerRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setPreviewSelection(null);
        return;
      }
      const text = sel.toString();
      const trimmed = text.trim();
      if (!trimmed || trimmed.length < 1) {
        setPreviewSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPreviewSelection(null);
        return;
      }
      // Find the parent paragraph (or closest block element) for disambiguation context
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentElement; // text node → element
      const para = node?.closest?.('p, li, td, h1, h2, h3, h4, h5, h6, div') || node;
      const paraText = (para?.textContent || '').replace(/\s+/g, ' ').trim();

      // Phase 3 — record which occurrence (0-based) was actually selected so
      // the preview can pulse a target-coloured highlight on exactly that one
      // when the user opens the edit popover.
      const occurrenceIndex = getOccurrenceIndexFromSelection(container, range, trimmed);

      setPreviewSelection({ text: trimmed, rect, paraText, occurrenceIndex });
    }, 0);
  };

  // Open the inline edit popover from the current selection
  const openEditFromSelection = () => {
    if (!previewSelection) return;
    const { text, rect, paraText, occurrenceIndex } = previewSelection;

    // Use the DOM's textContent for match-counting so the count agrees with
    // what we'll visually highlight (the two are derived from the same source).
    const container = previewContainerRef.current;
    const domText = container?.textContent || '';
    const matchCount = countLiteralOccurrences(domText, text);

    // Position popover below the selection if there's room, else above
    const viewportH = window.innerHeight;
    const popoverHeight = 260; // approx (slightly taller w/ disambiguation hint)
    const top = rect.bottom + popoverHeight < viewportH
      ? rect.bottom + 10
      : Math.max(8, rect.top - popoverHeight - 10);
    const left = Math.min(window.innerWidth - 360, Math.max(8, rect.left));

    setEditPopover({
      findText: text,
      replaceText: text,
      matchCount,
      occurrenceIndex: occurrenceIndex >= 0 ? occurrenceIndex : 0,
      replaceAll: true,
      paraText,
      position: { top, left },
      conflictDetected: null,
      conflictAcknowledged: false,
    });
    setPreviewSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  // Save edit → append to adHocReplacements (preview re-renders automatically)
  // Empty `replaceText` is valid — it deletes the selected text from the doc.
  // Pass `skipConflictCheck=true` from the "Save anyway" path so the second
  // click commits without re-tripping the duplicate detection.
  const saveEditPopover = (skipConflictCheck = false) => {
    if (!editPopover) return;
    const { findText, replaceText } = editPopover;

    // No-op if the replacement is identical to the original
    if (replaceText === findText) {
      setEditPopover(null);
      return;
    }

    // Build the actual find/replace strings (with paragraph-context
    // disambiguation when "Replace this one only" is selected).
    const { actualFind, actualReplace } = buildActualFindReplace(editPopover);

    // Phase 3 — surface conflicts BEFORE adding. First click of Save shows
    // the warning; the user then clicks "Save anyway" which calls this with
    // skipConflictCheck=true.
    if (!skipConflictCheck) {
      const conflict = findConflictForNewFind(adHocReplacements, actualFind);
      if (conflict) {
        setEditPopover({ ...editPopover, conflictDetected: conflict });
        return;
      }
    }

    setAdHocReplacements((prev) => [
      ...prev,
      {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        find: actualFind,
        replace: actualReplace,
        caseSensitive: true,
        wholeWord: false,
      },
    ]);
    setEditPopover(null);
  };

  // Escape + outside-click handlers for the popover
  useEffect(() => {
    if (!editPopover) return;
    const handleEsc = (e) => { if (e.key === 'Escape') setEditPopover(null); };
    const handleOutside = (e) => {
      if (e.target.closest?.('.preview-edit-popover')) return;
      if (e.target.closest?.('.preview-edit-fab')) return;
      setEditPopover(null);
    };
    document.addEventListener('keydown', handleEsc);
    // Delay so the click that opened the popover doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handleOutside), 100);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleOutside);
      clearTimeout(t);
    };
  }, [editPopover]);

  // ── Phase 3 — paint occurrence highlights inside the preview ─────
  // Runs whenever the popover opens, switches "Replace all" mode, or its
  // find-text shifts. Also re-runs after a preview re-render (which nukes
  // the DOM) so highlights stay visible. Cleanup removes the <mark>
  // wrappers so the next render (and the eventual download) sees clean DOM.
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    if (editPopover && !previewRendering) {
      // Defer one frame so we paint AFTER React commits any popover-related DOM
      const id = requestAnimationFrame(() => {
        highlightOccurrencesInPreview(
          container,
          editPopover.findText,
          editPopover.occurrenceIndex ?? 0,
          !!editPopover.replaceAll
        );
      });
      return () => {
        cancelAnimationFrame(id);
        clearPreviewHighlights(container);
      };
    }
    clearPreviewHighlights(container);
  }, [
    editPopover?.findText,
    editPopover?.replaceAll,
    editPopover?.occurrenceIndex,
    editPopover,
    previewRendering,
  ]);

  // Compute conflict map for the current ad-hoc list (used by the panel rows)
  const conflictMap = useMemo(() => detectConflicts(adHocReplacements), [adHocReplacements]);

  // Phase 4 — track ad-hoc list transitions so the Undo button always has the
  // previous state available.  Runs *after* every render where the array
  // identity changed.  The `isUndoingRef` flag prevents the undo action
  // itself from being captured as a new snapshot (which would let the user
  // accidentally "redo" by clicking Undo twice).
  useEffect(() => {
    if (previousAdHocRef.current === adHocReplacements) return;
    if (isUndoingRef.current) {
      // We just undid — clear the snapshot so the button disables itself
      // until the next genuine edit.
      isUndoingRef.current = false;
      setLastSnapshot(null);
    } else if (previousAdHocRef.current.length > 0 || adHocReplacements.length > 0) {
      // Skip pure empty→empty transitions (e.g. switching between two
      // templates that both had no replacements).
      setLastSnapshot(previousAdHocRef.current);
    }
    previousAdHocRef.current = adHocReplacements;
  }, [adHocReplacements]);

  const undoLastAdHocChange = () => {
    if (lastSnapshot === null) return;
    isUndoingRef.current = true;
    setAdHocReplacements(lastSnapshot);
  };

  // ── Field updates ──────────────────────────────────────────────────
  const setValue = (key) => (e) => {
    const v = e?.target?.type === 'date' ? formatHumanDate(e.target.value) : e.target.value;
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  // ── Generate ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);

    // Only send replacements that have a non-empty find AND replace pair.
    // Strip the client-side `id` field — the API expects {find, replace, ...}.
    const validReplacements = adHocReplacements
      .filter((r) => r.find && r.find.trim() !== '' && r.replace !== undefined && r.replace !== null)
      .map(({ find, replace, caseSensitive, wholeWord }) => ({
        find, replace, caseSensitive, wholeWord,
      }));

    try {
      const r = await fetch(`/api/fixed-templates/${selectedTemplate.id}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeholder_values: values,
          ad_hoc_replacements: validReplacements,
        }),
      });

      if (!r.ok) {
        const errPayload = await r.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Generation failed');
      }

      // Stream the .docx to a download
      const blob = await r.blob();
      const cdHeader = r.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cdHeader);
      const fileName = m ? m[1] : `${selectedTemplate.name}.docx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`Downloaded ${fileName}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p>No Fixed SOW Templates have been uploaded yet.</p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Ask an administrator to upload a template via the "Fixed SOW Templates" page.
          </p>
        </div>
      </div>
    );
  }

  // ── 2-pane layout when a template is selected ─────────────────────
  const hasPreview = !!(selectedTemplate && selectedAccount);

  return (
    <div className={`tg-layout ${hasPreview ? 'tg-layout-split' : ''}`}>

      {/* ── LEFT PANE — controls ────────────────────────────────── */}
      <div className="tg-controls-pane" style={{ flex: hasPreview ? '0 0 380px' : '1', minWidth: 0 }}>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Template selector */}
        <div className="card">
          <div className="card-header">
            <h3>1. Choose a Template</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            {templates.map((t) => {
              const isSelected = Number(selectedTemplateId) === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(String(t.id))}
                  style={{
                    textAlign: 'left',
                    background: isSelected ? '#eff6ff' : '#fff',
                    border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: 8,
                    padding: '0.75rem 0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: 7, right: 7,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#2563eb', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.88rem', paddingRight: 22 }}>{t.name}</div>
                  {t.description && (
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 3, lineHeight: 1.4 }}>
                      {t.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {t.product_name && (
                      <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>{t.product_name}</span>
                    )}
                    {t.engagement_type_name && (
                      <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>{t.engagement_type_name}</span>
                    )}
                    <span style={{
                      background: '#eff6ff', color: '#1e40af',
                      padding: '2px 7px', borderRadius: 10,
                      fontSize: '0.68rem', fontWeight: 600,
                    }}>
                      {t.placeholders.length} field{t.placeholders.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account + field panel */}
        {selectedTemplate && (
          <div className="card" style={{ marginTop: '0.75rem' }}>
            <div className="card-header">
              <h3>2. Fill in Details</h3>
            </div>

            <div className="form-group">
              <label>Account <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                className="form-control"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="">Choose an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.short_name ? ` (${a.short_name})` : ''}
                  </option>
                ))}
              </select>
              <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                Account fields auto-fill from this selection.
              </small>
            </div>

            {selectedAccount && (
              <AutoFilledSummary account={selectedAccount} templateFields={templateFields} />
            )}

            {fieldsRequiringInput.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{
                  fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: '#6b7280', marginBottom: '0.6rem',
                }}>
                  Document Fields
                </p>
                <DynamicFieldPanel
                  fields={fieldsRequiringInput}
                  values={values}
                  onChange={setValue}
                />
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <AdHocReplacementsPanel
                replacements={adHocReplacements}
                onChange={setAdHocReplacements}
                previewText={previewText}
                conflictMap={conflictMap}
                canUndo={lastSnapshot !== null}
                onUndo={undoLastAdHocChange}
              />
            </div>

            <div className="modal-footer" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!selectedAccount || generating}
                style={{ minWidth: 180 }}
              >
                {generating ? 'Generating…' : '⬇  Download .docx'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANE — live preview ───────────────────────────── */}
      {hasPreview && (
        <div className="tg-preview-pane" style={{
          flex: 1,
          minWidth: 0,
          position: 'sticky',
          top: '1rem',
          maxHeight: 'calc(100vh - 5rem)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div className="card" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '1rem',
            position: 'relative', /* Phase 4 — for the centred spinner overlay */
          }}>
            {/* Preview header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '0.75rem', paddingBottom: '0.75rem',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                  Live Preview
                </span>
                {previewRendering && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
                    Updating…
                  </span>
                )}
              </div>
              <span style={{
                fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic',
              }}>
                Approximate — open .docx for final layout
              </span>
            </div>

            {previewError && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: 6, padding: '0.6rem 0.8rem',
                fontSize: '0.78rem', color: '#92400e', marginBottom: '0.5rem',
              }}>
                ⚠ {previewError}
              </div>
            )}

            {/* Inline help — only when no selection / popover yet */}
            {!previewSelection && !editPopover && (
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 6, padding: '0.4rem 0.7rem',
                fontSize: '0.72rem', color: '#1e40af', marginBottom: '0.5rem',
              }}>
                💡 <strong>Tip:</strong> drag to highlight any text in the preview, then click <strong>Edit</strong> to change it.
              </div>
            )}

            {/* docx-preview renders here — kept as a normal flex child so its
                natural content height drives the pane size. */}
            <div
              ref={previewContainerRef}
              onMouseUp={handlePreviewMouseUp}
              className="docx-preview-host"
              style={{
                flex: 1,
                overflowY: 'auto',
                background: '#f9fafb',
                borderRadius: 6,
                padding: '0.5rem',
                opacity: previewRendering ? 0.4 : 1,
                transition: 'opacity 0.2s',
                cursor: 'text',
              }}
            />

            {/* Phase 4 — centred floating indicator while the preview re-renders.
                Anchored to the card (position: relative) so it sits over the
                preview without needing its own sized wrapper. */}
            {previewRendering && (
              <div className="preview-loading-overlay" aria-live="polite" aria-busy="true">
                <div className="preview-loading-spinner" />
                <span className="preview-loading-label">Updating preview…</span>
              </div>
            )}
          </div>

          {/* Floating "Edit" button next to the current selection */}
          {previewSelection && !editPopover && (
            <button
              type="button"
              className="preview-edit-fab"
              style={{
                position: 'fixed',
                top: previewSelection.rect.top > 50
                  ? previewSelection.rect.top - 38
                  : previewSelection.rect.bottom + 8,
                left: Math.min(
                  window.innerWidth - 220,
                  Math.max(8, previewSelection.rect.left + previewSelection.rect.width / 2 - 75)
                ),
              }}
              onMouseDown={(e) => e.preventDefault()} /* don't lose selection */
              onClick={openEditFromSelection}
            >
              <span style={{ fontSize: '0.95rem' }}>✏️</span>
              Edit "{previewSelection.text.length > 16 ? previewSelection.text.slice(0, 16) + '…' : previewSelection.text}"
            </button>
          )}

          {/* Inline edit popover */}
          {editPopover && (
            <div
              className="preview-edit-popover"
              style={{
                position: 'fixed',
                top: editPopover.position.top,
                left: editPopover.position.left,
              }}
            >
              <div className="preview-edit-popover-header">
                <span>Edit text</span>
                <button
                  type="button"
                  className="preview-edit-popover-close"
                  onClick={() => setEditPopover(null)}
                  aria-label="Cancel"
                >×</button>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 4, marginTop: 8 }}>
                ORIGINAL
              </div>
              <div style={{
                background: '#f3f4f6',
                padding: '0.45rem 0.65rem',
                borderRadius: 5,
                fontSize: '0.83rem',
                marginBottom: 10,
                fontFamily: 'ui-monospace, Menlo, monospace',
                wordBreak: 'break-word',
                color: '#1f2937',
              }}>
                {editPopover.findText}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>REPLACE WITH</span>
                <button
                  type="button"
                  onClick={() => setEditPopover({ ...editPopover, replaceText: '' })}
                  title="Clear field to delete the selected text"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0 4px',
                    textDecoration: 'underline',
                  }}
                >
                  Clear (delete text)
                </button>
              </div>
              <input
                type="text"
                className="form-control"
                value={editPopover.replaceText}
                onChange={(e) => setEditPopover({ ...editPopover, replaceText: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditPopover();
                }}
                autoFocus
                placeholder="(empty = delete this text)"
                style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.85rem' }}
              />

              {/* Deletion hint — only when the field is empty AND the user changed something */}
              {editPopover.replaceText === '' && editPopover.findText !== '' && (
                <div style={{
                  fontSize: '0.72rem',
                  color: '#dc2626',
                  marginTop: 6,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 5,
                  padding: '0.4rem 0.55rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                }}>
                  <span>🗑️</span>
                  <span>
                    Saving with an empty field will <strong>remove the selected text</strong> from the document
                    {editPopover.matchCount > 1 && editPopover.replaceAll && ` (all ${editPopover.matchCount} occurrences)`}.
                  </span>
                </div>
              )}

              {editPopover.matchCount > 1 && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 10, fontSize: '0.78rem', color: '#374151',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={editPopover.replaceAll}
                    onChange={(e) => setEditPopover({
                      ...editPopover,
                      replaceAll: e.target.checked,
                      conflictDetected: null,
                      conflictAcknowledged: false,
                    })}
                  />
                  Replace all <strong style={{ color: '#1f2937' }}>{editPopover.matchCount}</strong> matches in the document
                </label>
              )}
              {editPopover.matchCount === 1 && (
                <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: 8 }}>
                  ✓ This text appears only once in the document.
                </div>
              )}
              {editPopover.matchCount === 0 && (
                <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 8 }}>
                  ⚠ No matches found in the document text — replacement may not apply.
                </div>
              )}

              {/* Phase 3 — disambiguation hint for "just this one" on multi-match selections */}
              {editPopover.matchCount > 1 && !editPopover.replaceAll && (() => {
                const { contextChars } = buildActualFindReplace(editPopover);
                const occLabel = (editPopover.occurrenceIndex ?? 0) + 1;
                return (
                  <div style={{
                    fontSize: '0.72rem',
                    color: '#92400e',
                    marginTop: 8,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 5,
                    padding: '0.4rem 0.55rem',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      🎯 Targeting occurrence <strong>#{occLabel} of {editPopover.matchCount}</strong> (highlighted in orange)
                    </div>
                    {contextChars > 0 ? (
                      <div>Using {contextChars} characters of surrounding paragraph text to lock in this exact instance.</div>
                    ) : (
                      <div style={{ color: '#dc2626' }}>
                        ⚠ Couldn&apos;t isolate this occurrence — the text may have moved. Try re-selecting it.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Phase 3 — conflict warning when saving would duplicate or overlap an existing row */}
              {editPopover.conflictDetected && (
                <div className="preview-edit-conflict">
                  <span style={{ fontSize: '0.95rem' }}>⚠</span>
                  <span>
                    <strong>
                      {editPopover.conflictDetected.type === 'duplicate'
                        ? 'You already added a replacement for this exact text.'
                        : 'This replacement overlaps with an existing one.'}
                    </strong>
                    <div style={{ marginTop: 3, fontSize: '0.7rem', opacity: 0.9 }}>
                      Existing find:{' '}
                      <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>
                        {editPopover.conflictDetected.withFind.length > 50
                          ? editPopover.conflictDetected.withFind.slice(0, 50) + '…'
                          : editPopover.conflictDetected.withFind}
                      </code>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Click <strong>Save anyway</strong> to add this one too, or Cancel to skip.
                    </div>
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-small"
                  onClick={() => setEditPopover(null)}
                >Cancel</button>
                <button
                  type="button"
                  className={`btn btn-small ${
                    editPopover.conflictDetected
                      ? 'btn-warning'
                      : editPopover.replaceText === '' ? 'btn-danger' : 'btn-primary'
                  }`}
                  onClick={() => {
                    if (editPopover.conflictDetected) {
                      // 2nd click — commit, bypassing the dup check
                      saveEditPopover(true);
                    } else {
                      saveEditPopover(false);
                    }
                  }}
                  disabled={editPopover.replaceText === editPopover.findText}
                >
                  {editPopover.conflictDetected
                    ? 'Save anyway'
                    : editPopover.replaceText === '' ? '🗑️ Delete text' : 'Save edit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-fill summary — shows what was filled from the account record
// ═══════════════════════════════════════════════════════════════════════════

function AutoFilledSummary({ account, templateFields }) {
  const filled = templateFields
    .filter((f) => f.data_source || f.input_type === 'account')
    .map((f) => {
      const value = f.input_type === 'account'
        ? account.name
        : account[f.data_source?.split('.')[1] || ''];
      return { key: f.key, label: f.label, value };
    });

  if (filled.length === 0) return null;

  return (
    <div style={{
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      marginTop: '0.5rem',
    }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#15803d', marginBottom: 8,
      }}>
        ✨ Auto-filled from account
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
        {filled.map((f) => (
          <div key={f.key} style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#15803d', fontWeight: 500 }}>{f.label}: </span>
            <span style={{ color: '#111827' }}>
              {f.value || <em style={{ color: '#9ca3af' }}>(blank)</em>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic field panel — renders the right input control per placeholder type
// ═══════════════════════════════════════════════════════════════════════════

function DynamicFieldPanel({ fields, values, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
      {fields.map((f) => (
        <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
          <label>{f.label}</label>
          {renderInputForField(f, values[f.key] || '', onChange(f.key))}
          {f.description && (
            <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>{f.description}</small>
          )}
        </div>
      ))}
    </div>
  );
}

function renderInputForField(field, value, onChange) {
  switch (field.input_type) {
    case 'number':
      return (
        <input
          type="number"
          className="form-control"
          value={value}
          onChange={onChange}
          placeholder={field.description || ''}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          className="form-control"
          value={parseHumanDateForInput(value)}
          onChange={onChange}
        />
      );

    case 'dropdown': {
      const opts = Array.isArray(field.input_options) ? field.input_options : [];
      return (
        <select className="form-control" value={value} onChange={onChange}>
          <option value="">— Select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    case 'textarea':
      return (
        <textarea
          className="form-control"
          value={value}
          onChange={onChange}
          rows={3}
          placeholder={field.description || ''}
        />
      );

    case 'text':
    case 'account':
    default:
      return (
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={onChange}
          placeholder={field.description || ''}
        />
      );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ad-hoc replacements panel — find/replace for anything not pre-marked
// ═══════════════════════════════════════════════════════════════════════════

function AdHocReplacementsPanel({ replacements, onChange, previewText, conflictMap, canUndo, onUndo }) {
  const addRow = () => {
    onChange([
      ...replacements,
      {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        find: '',
        replace: '',
        caseSensitive: true,
        wholeWord: false,
      },
    ]);
  };

  const updateRow = (id, patch) => {
    onChange(replacements.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id) => {
    onChange(replacements.filter((r) => r.id !== id));
  };

  const conflictCount = conflictMap ? conflictMap.size : 0;

  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <p style={{
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: '#6b7280', margin: 0,
          }}>
            Additional Replacements (optional)
          </p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
            Replace any literal text in the template — environment names, hostnames, project codes — that isn't a defined placeholder.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Phase 4 — one-step undo for the most recent ad-hoc list change */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={canUndo ? 'Undo the most recent change to this list' : 'Nothing to undo yet'}
            style={{
              background: canUndo ? '#fff' : '#f3f4f6',
              color: canUndo ? '#374151' : '#9ca3af',
              border: `1px solid ${canUndo ? '#d1d5db' : '#e5e7eb'}`,
              borderRadius: 6,
              padding: '0.4rem 0.65rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: canUndo ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={addRow}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Add replacement
          </button>
        </div>
      </div>

      {/* Phase 3 — global conflict banner */}
      {conflictCount > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 6,
          padding: '0.45rem 0.7rem',
          marginTop: '0.5rem',
          marginBottom: '0.1rem',
          fontSize: '0.75rem',
          color: '#92400e',
        }}>
          ⚠ <strong>{conflictCount}</strong> replacement{conflictCount === 1 ? '' : 's'} overlap with others —
          highlighted in amber below. Later rows can silently no-op when an earlier row already swapped the text.
        </div>
      )}

      {replacements.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.5rem 0 0', fontStyle: 'italic' }}>
          No additional replacements. Click "Add replacement" if you need to swap out text on the fly.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
          {replacements.map((r) => (
            <AdHocRow
              key={r.id}
              row={r}
              previewText={previewText}
              conflict={conflictMap?.get(r.id) || null}
              onUpdate={(patch) => updateRow(r.id, patch)}
              onRemove={() => removeRow(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdHocRow({ row, previewText, conflict, onUpdate, onRemove }) {
  // Live match count against the template's plain text.
  const matchCount = useMemo(() => {
    if (!row.find || !previewText) return 0;
    return countMatches(previewText, row.find, {
      caseSensitive: row.caseSensitive,
      wholeWord: row.wholeWord,
    });
  }, [row.find, row.caseSensitive, row.wholeWord, previewText]);

  const countTone =
    !row.find ? '#9ca3af'
    : matchCount === 0 ? '#dc2626'
    : matchCount === 1 ? '#d97706'
    : '#059669';
  const countLabel =
    !row.find ? '— enter find text —'
    : matchCount === 0 ? 'No matches'
    : matchCount === 1 ? '1 match'
    : `${matchCount} matches`;

  // Auto-size textareas so long contextualized strings (find/replace pairs
  // from the click-to-edit popover often have ~15 chars of paragraph context
  // wrapped around the core text) become fully visible without scrolling.
  // Cap rows so a single very long replacement can't dominate the panel.
  const findRows = Math.min(4, Math.max(1, Math.ceil((row.find || '').length / 40)));
  const replaceRows = Math.min(4, Math.max(1, Math.ceil((row.replace || '').length / 40)));

  const isDeletion = !!row.find && row.replace === '';

  return (
    <div
      className={conflict ? 'adhoc-row-conflict' : ''}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '0.7rem 0.85rem',
      }}
    >
      {conflict && (
        <div style={{
          fontSize: '0.7rem',
          color: '#92400e',
          marginBottom: 8,
          display: 'flex',
          gap: 4,
          alignItems: 'flex-start',
        }}>
          <span>⚠</span>
          <span>
            {conflict.type === 'duplicate' ? 'Duplicate of' : 'Overlaps with'}:{' '}
            <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 3, wordBreak: 'break-all' }}>
              {conflict.withFind.length > 60 ? conflict.withFind.slice(0, 60) + '…' : conflict.withFind}
            </code>
          </span>
        </div>
      )}

      {/* ── Header bar: match-count chip + delete ───────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: countTone,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          background: row.find
            ? (matchCount === 0 ? '#fef2f2' : matchCount === 1 ? '#fffbeb' : '#ecfdf5')
            : '#f3f4f6',
          padding: '3px 8px',
          borderRadius: 10,
        }}>
          {countLabel}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove replacement"
          title="Remove this replacement"
          style={{
            background: 'transparent',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            color: '#6b7280',
            width: 26, height: 26,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.05rem', lineHeight: 1, padding: 0,
          }}
        >×</button>
      </div>

      {/* ── FIND field ──────────────────────────────────────────────── */}
      <label style={{
        display: 'block',
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#6b7280',
        marginBottom: 3,
      }}>
        Find
      </label>
      <textarea
        className="form-control"
        placeholder="Literal text to search for in the template"
        value={row.find}
        title={row.find || ''}
        onChange={(e) => onUpdate({ find: e.target.value })}
        rows={findRows}
        style={{
          width: '100%',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.82rem',
          lineHeight: 1.45,
          resize: 'vertical',
          marginBottom: 8,
          padding: '0.4rem 0.55rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />

      {/* ── REPLACE WITH field ──────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 3,
      }}>
        <label style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#6b7280',
        }}>
          Replace with
        </label>
        {isDeletion && (
          <span style={{
            fontSize: '0.65rem',
            color: '#dc2626',
            fontWeight: 600,
          }}>
            🗑️ empty = deletes text
          </span>
        )}
      </div>
      <textarea
        className="form-control"
        placeholder="(leave empty to remove the found text)"
        value={row.replace}
        title={row.replace || ''}
        onChange={(e) => onUpdate({ replace: e.target.value })}
        rows={replaceRows}
        style={{
          width: '100%',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.82rem',
          lineHeight: 1.45,
          resize: 'vertical',
          marginBottom: 8,
          padding: '0.4rem 0.55rem',
          background: isDeletion ? '#fef2f2' : '#fff',
          borderColor: isDeletion ? '#fecaca' : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />

      {/* ── Options row ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        fontSize: '0.72rem',
        color: '#6b7280',
        paddingTop: 4,
        borderTop: '1px dashed #f3f4f6',
        marginTop: 2,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={row.caseSensitive}
            onChange={(e) => onUpdate({ caseSensitive: e.target.checked })}
          />
          Case-sensitive
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={row.wholeWord}
            onChange={(e) => onUpdate({ wholeWord: e.target.checked })}
          />
          Match whole word
        </label>
      </div>
    </div>
  );
}

// Count non-overlapping matches in `text` using the same matching semantics
// as the server-side replacer.
function countMatches(text, find, { caseSensitive, wholeWord }) {
  if (!find) return 0;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = caseSensitive ? 'g' : 'gi';
  let regex;
  try { regex = new RegExp(pattern, flags); } catch { return 0; }
  let count = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m[0].length === 0) { regex.lastIndex++; continue; }
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3 — preview highlighting + conflict detection helpers
// ═══════════════════════════════════════════════════════════════════════════

// Plain count of `findText` occurrences in a string (case-sensitive literal).
function countLiteralOccurrences(text, findText) {
  if (!findText || !text) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(findText, idx)) !== -1) {
    count++;
    idx += findText.length;
  }
  return count;
}

// Compute the 0-based occurrence index of the user's selection within the
// preview DOM, by counting how many copies of `findText` start before the
// selection's start position in document order.
function getOccurrenceIndexFromSelection(container, range, findText) {
  if (!container || !range || !findText) return -1;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let charOffset = 0;
  let n;
  let startGlobal = -1;
  while ((n = walker.nextNode())) {
    if (n === range.startContainer) {
      startGlobal = charOffset + range.startOffset;
      break;
    }
    charOffset += n.textContent.length;
  }
  if (startGlobal < 0) return -1;

  const fullText = container.textContent || '';
  let count = 0;
  let idx = 0;
  while ((idx = fullText.indexOf(findText, idx)) !== -1) {
    if (idx >= startGlobal) break;
    count++;
    idx += findText.length;
  }
  return count;
}

// Wrap every occurrence of `findText` inside the preview container with a
// <mark> element. The match whose index equals `targetIndex` gets the strong
// "target" highlight; the others get a lighter highlight ONLY when
// `replaceAll` is true. Cross-text-node matches are intentionally skipped
// (rare in docx-preview output, and would require splitting siblings).
function highlightOccurrencesInPreview(container, findText, targetIndex, replaceAll) {
  if (!container || !findText) return;
  clearPreviewHighlights(container);

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip already-wrapped marks and empty / whitespace-only nodes
      if (node.parentElement?.tagName === 'MARK') return NodeFilter.FILTER_REJECT;
      if (!node.textContent || !node.textContent.includes(findText)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  let occurrenceCounter = 0;
  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const parent = textNode.parentNode;
    if (!parent) continue;

    const fragments = [];
    let cursor = 0;
    let idx = text.indexOf(findText);
    while (idx !== -1) {
      if (idx > cursor) {
        fragments.push(document.createTextNode(text.substring(cursor, idx)));
      }
      const isTarget = occurrenceCounter === targetIndex;
      const matchText = text.substring(idx, idx + findText.length);

      if (isTarget || replaceAll) {
        const mark = document.createElement('mark');
        mark.className = isTarget ? 'preview-target-highlight' : 'preview-other-highlight';
        mark.dataset.previewHighlight = 'true';
        mark.textContent = matchText;
        fragments.push(mark);
      } else {
        // Plain text — this occurrence won't be touched (replaceAll off, not target)
        fragments.push(document.createTextNode(matchText));
      }

      cursor = idx + findText.length;
      occurrenceCounter++;
      idx = text.indexOf(findText, cursor);
    }
    if (cursor < text.length) {
      fragments.push(document.createTextNode(text.substring(cursor)));
    }

    const frag = document.createDocumentFragment();
    fragments.forEach((f) => frag.appendChild(f));
    parent.replaceChild(frag, textNode);
  }
}

// Undo the DOM mutations made by highlightOccurrencesInPreview.
function clearPreviewHighlights(container) {
  if (!container) return;
  const marks = container.querySelectorAll('mark[data-preview-highlight="true"]');
  marks.forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent), m);
  });
  // Normalize merges adjacent text nodes that were split during highlighting.
  if (marks.length > 0) container.normalize();
}

// Inspect the current ad-hoc list and return a Map of id -> { type, withId }
// flagging any rows whose `find` strings duplicate or overlap each other.
// "duplicate" = same find text with same options.
// "overlap"   = one find string contains the other (potential silent stomp).
function detectConflicts(replacements) {
  const conflicts = new Map();
  for (let i = 0; i < replacements.length; i++) {
    const a = replacements[i];
    if (!a.find) continue;
    for (let j = 0; j < replacements.length; j++) {
      if (i === j) continue;
      const b = replacements[j];
      if (!b.find) continue;

      if (
        a.find === b.find &&
        a.caseSensitive === b.caseSensitive &&
        a.wholeWord === b.wholeWord
      ) {
        conflicts.set(a.id, { type: 'duplicate', withFind: b.find });
        break;
      }
      if (a.find.length !== b.find.length && (a.find.includes(b.find) || b.find.includes(a.find))) {
        conflicts.set(a.id, { type: 'overlap', withFind: b.find });
        break;
      }
    }
  }
  return conflicts;
}

// Check whether a NEW find/replace pair conflicts with anything already
// staged. Used by the popover save flow to surface a "looks like a dupe"
// warning before appending.
function findConflictForNewFind(replacements, newFind) {
  for (const existing of replacements) {
    if (!existing.find) continue;
    if (existing.find === newFind) {
      return { type: 'duplicate', withFind: existing.find };
    }
    if (existing.find.length !== newFind.length && (existing.find.includes(newFind) || newFind.includes(existing.find))) {
      return { type: 'overlap', withFind: existing.find };
    }
  }
  return null;
}

// Compute the actual find/replace strings that will be sent to the server,
// applying paragraph-context disambiguation when the user opted out of
// "Replace all" on a multi-occurrence selection.
function buildActualFindReplace(editPopover) {
  const { findText, replaceText, matchCount, replaceAll, paraText } = editPopover;
  let actualFind = findText;
  let actualReplace = replaceText;
  let contextChars = 0;
  if (matchCount > 1 && !replaceAll && paraText) {
    const idx = paraText.indexOf(findText);
    if (idx >= 0) {
      const before = paraText.substring(Math.max(0, idx - 15), idx);
      const after = paraText.substring(idx + findText.length, Math.min(paraText.length, idx + findText.length + 15));
      actualFind = before + findText + after;
      actualReplace = before + replaceText + after;
      contextChars = before.length + after.length;
    }
  }
  return { actualFind, actualReplace, contextChars };
}

// ── Date helpers ────────────────────────────────────────────────────────────
// Stored format: "23 February 2026" (what SOW docs naturally use)
// Input format: "2026-02-23" (the HTML5 date input)
function formatHumanDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y}`;
}

function parseHumanDateForInput(humanDate) {
  if (!humanDate) return '';
  const months = { January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12 };
  const m = /^(\d{1,2})\s+(\w+)\s+(\d{4})$/.exec(humanDate);
  if (!m) return '';
  const [, d, mon, y] = m;
  const monthNum = months[mon];
  if (!monthNum) return '';
  return `${y}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default TemplateGenerator;
