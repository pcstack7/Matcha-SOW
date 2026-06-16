import { useState, useEffect, useRef } from 'react';
import { accountApi, templateApi, sowApi, exportApi, scopeSetApi, extractionApi } from '../services/api';
import { formatContent } from '../utils/formatContent';
import TemplateGenerator from './TemplateGenerator';

function SOWGenerator() {
  // v3 — mode toggle: 'ai' (existing flow) | 'template' (Fixed SOW Template flow)
  const [mode, setMode] = useState('ai');

  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [products, setProducts] = useState([]);
  const [engagementTypes, setEngagementTypes] = useState([]);
  const [assumptionSets, setAssumptionSets] = useState([]);
  const [outOfScopeSets, setOutOfScopeSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [generatedSOW, setGeneratedSOW] = useState(null);

  // Template "keep intact" picker — sections of the selected template the user
  // wants taken verbatim from the template instead of AI-generated.
  const [templateSections, setTemplateSections] = useState([]); // [{title, norm, level}]
  const [templateSectionsLoading, setTemplateSectionsLoading] = useState(false);
  const [intactSections, setIntactSections] = useState(() => new Set()); // norms locked intact

  // Document extraction state
  const [extractionFiles, setExtractionFiles] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractionOpen, setExtractionOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Scope set dropdown + hover preview
  const [openDropdown, setOpenDropdown] = useState(null); // 'assumption' | 'outofscope' | null
  const [hoveredSetId, setHoveredSetId] = useState(null);
  const [hoveredSetItems, setHoveredSetItems] = useState({});
  const assumptionDropdownRef = useRef(null);
  const oosDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdown === 'assumption' && assumptionDropdownRef.current && !assumptionDropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
      if (openDropdown === 'outofscope' && oosDropdownRef.current && !oosDropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const [formData, setFormData] = useState({
    account_id: '',
    template_id: '',
    product_id: '',
    engagement_type_id: '',
    project_notes: '',
    deliverables: '',
    assumption_set_ids: [],
    out_of_scope_set_ids: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  // Load the selected template's section outline for the "keep intact" picker.
  useEffect(() => {
    const id = formData.template_id;
    if (!id) { setTemplateSections([]); setIntactSections(new Set()); return; }
    let cancelled = false;
    setTemplateSectionsLoading(true);
    templateApi.getOutline(id)
      .then((data) => { if (!cancelled) { setTemplateSections(data.sections || []); setIntactSections(new Set()); } })
      .catch(() => { if (!cancelled) setTemplateSections([]); })
      .finally(() => { if (!cancelled) setTemplateSectionsLoading(false); });
    return () => { cancelled = true; };
  }, [formData.template_id]);

  // Toggle a section by its index; cascade the same state to its sub-sections
  // (the following contiguous entries with a deeper level). So ticking a main
  // header selects all its sub-sections, and unticking clears them.
  const toggleIntact = (index) => {
    const node = templateSections[index];
    if (!node) return;
    const target = !intactSections.has(node.norm);
    const affected = [node.norm];
    for (let j = index + 1; j < templateSections.length && templateSections[j].level > node.level; j++) {
      affected.push(templateSections[j].norm);
    }
    setIntactSections((prev) => {
      const next = new Set(prev);
      affected.forEach((n) => (target ? next.add(n) : next.delete(n)));
      return next;
    });
  };

  const loadData = async () => {
    try {
      const [accountsData, templatesData, productsData, engagementTypesData, assumptionSetsData, outOfScopeSetsData] = await Promise.all([
        accountApi.getAll(),
        templateApi.getAll(),
        fetch('/api/products', { credentials: 'include' }).then(res => res.json()),
        fetch('/api/engagement-types', { credentials: 'include' }).then(res => res.json()),
        scopeSetApi.getAll('assumption', 'active'),
        scopeSetApi.getAll('out_of_scope', 'active'),
      ]);
      setAccounts(accountsData);
      setTemplates(templatesData);
      setProducts(productsData);
      setEngagementTypes(engagementTypesData);
      setAssumptionSets(assumptionSetsData);
      setOutOfScopeSets(outOfScopeSetsData);
    } catch (err) {
      setError('Failed to load data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setGeneratedSOW(null);

    if (!formData.account_id || !formData.project_notes || !formData.deliverables) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      // Send the titles of sections the user locked as "keep intact" so the
      // backend takes them verbatim from the template instead of AI-generating.
      const intact_sections = templateSections
        .filter((s) => intactSections.has(s.norm))
        .map((s) => s.title);
      const sow = await sowApi.generate({ ...formData, intact_sections });
      setGeneratedSOW(sow);
      setSuccess('SOW generated successfully!');

      setFormData({
        account_id: '',
        template_id: '',
        product_id: '',
        engagement_type_id: '',
        project_notes: '',
        deliverables: '',
        assumption_set_ids: [],
        out_of_scope_set_ids: [],
      });
    } catch (err) {
      setError(err.message || 'Failed to generate SOW');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format) => {
    if (!generatedSOW) return;
    switch (format) {
      case 'pdf': exportApi.downloadPdf(generatedSOW.id); break;
      case 'docx': exportApi.downloadDocx(generatedSOW.id); break;
      case 'txt': exportApi.downloadTxt(generatedSOW.id); break;
    }
  };

  const toggleSetSelection = (setId, field) => {
    const current = formData[field];
    const updated = current.includes(setId)
      ? current.filter(id => id !== setId)
      : [...current, setId];
    setFormData({ ...formData, [field]: updated });
  };

  // Lazy-load items for a set on first hover; cache results to avoid repeat calls
  const handleSetHover = async (setId) => {
    setHoveredSetId(setId);
    if (hoveredSetItems[setId] === undefined) {
      try {
        const data = await scopeSetApi.getById(setId);
        setHoveredSetItems(prev => ({ ...prev, [setId]: data.items || [] }));
      } catch {
        setHoveredSetItems(prev => ({ ...prev, [setId]: [] }));
      }
    }
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setExtractionFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...files.filter(f => !names.has(f.name))];
    });
  };

  const removeExtractionFile = (index) => {
    setExtractionFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtract = async () => {
    if (extractionFiles.length === 0) return;
    setExtracting(true);
    setExtractionError(null);
    try {
      const result = await extractionApi.extractFromDocuments(extractionFiles);
      if (result.project_notes || result.deliverables) {
        setFormData(prev => ({
          ...prev,
          project_notes: result.project_notes
            ? (prev.project_notes ? prev.project_notes + '\n\n' + result.project_notes : result.project_notes)
            : prev.project_notes,
          deliverables: result.deliverables
            ? (prev.deliverables ? prev.deliverables + '\n' + result.deliverables : result.deliverables)
            : prev.deliverables,
        }));
        setExtractionFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      setExtractionError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === parseInt(formData.account_id));

  const selectedAssumptionSets = assumptionSets.filter(s => formData.assumption_set_ids.includes(s.id));
  const selectedOutOfScopeSets = outOfScopeSets.filter(s => formData.out_of_scope_set_ids.includes(s.id));

  return (
    <div>
      <div className="content-header">
        <h2>Generate Statement of Work</h2>
        <p>
          {mode === 'ai'
            ? 'Create professional SOW documents with AI assistance'
            : 'Generate a SOW from a fixed Word template by filling in dynamic fields'}
        </p>
      </div>

      <ModeToggle mode={mode} onChange={setMode} />

      {mode === 'template' && <TemplateGenerator />}

      {mode === 'ai' && (
      <>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Account */}
          <div className="form-group">
            <label>Select Account *</label>
            <select
              className="form-control"
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              required
            >
              <option value="">Choose an account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.account_contact ? `(Contact: ${account.account_contact})` : ''}
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                No accounts available. Please create an account first.
              </p>
            )}
          </div>

          {selectedAccount && (
            <div className="alert alert-info">
              <strong>Account Details:</strong><br />
              Name: {selectedAccount.name}
              {selectedAccount.account_contact && <><br />Contact: {selectedAccount.account_contact}</>}
              {selectedAccount.email && <><br />Email: {selectedAccount.email}</>}
              {selectedAccount.phone && <><br />Phone: {selectedAccount.phone}</>}
            </div>
          )}

          {/* Template */}
          <div className="form-group">
            <label>Select Template (Optional)</label>
            <select
              className="form-control"
              value={formData.template_id}
              onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
            >
              <option value="">No template (Generate from scratch)</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              Templates help guide the AI to generate SOWs in your preferred format
            </p>

            {/* Keep-intact picker — choose which template sections are used
                verbatim (not AI-generated), e.g. a standard "Approach" section. */}
            {formData.template_id && (
              <div style={{
                marginTop: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 8,
                background: '#fafafa', padding: '0.75rem 0.9rem',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                  Keep sections intact (optional)
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem' }}>
                  Tick any section that should be taken <strong>verbatim from the template</strong> rather than
                  generated by AI (e.g. a standard Approach). Unticked sections are AI-generated.
                </p>
                {templateSectionsLoading ? (
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>Loading sections…</p>
                ) : templateSections.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
                    No sections detected in this template.
                  </p>
                ) : (
                  <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {templateSections.map((s, idx) => (
                      <label key={`${s.norm}_${idx}`} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        paddingLeft: `${s.level * 1.1}rem`, fontSize: '0.82rem',
                        color: intactSections.has(s.norm) ? '#1e40af' : '#374151', cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={intactSections.has(s.norm)}
                          onChange={() => toggleIntact(idx)}
                        />
                        <span style={{ fontWeight: s.level === 0 ? 600 : 400 }}>{s.title}</span>
                        {intactSections.has(s.norm) && (
                          <span style={{ fontSize: '0.68rem', color: '#1e40af', background: '#eff6ff', padding: '1px 6px', borderRadius: 8 }}>
                            intact
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product */}
          <div className="form-group">
            <label>Select Product (Optional)</label>
            <select
              className="form-control"
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
            >
              <option value="">No product selected</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.portfolio ? `- ${product.portfolio}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Engagement Type */}
          <div className="form-group">
            <label>Select Engagement Type (Optional)</label>
            <select
              className="form-control"
              value={formData.engagement_type_id}
              onChange={(e) => setFormData({ ...formData, engagement_type_id: e.target.value })}
            >
              <option value="">No engagement type selected</option>
              {engagementTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} {type.category ? `- ${type.category}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Assumption Sets + Out of Scope Sets — side-by-side compact dropdowns */}
          {(assumptionSets.length > 0 || outOfScopeSets.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

              {/* ── Assumption Sets dropdown ── */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Assumption Sets <span style={{ fontWeight: 400, color: '#999' }}>(Optional)</span></label>
                <div ref={assumptionDropdownRef} style={{ position: 'relative' }}>
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'assumption' ? null : 'assumption')}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid', borderColor: openDropdown === 'assumption' ? '#707CF1' : '#e0e0e0', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: formData.assumption_set_ids.length > 0 ? '#333' : '#999' }}
                  >
                    <span>{formData.assumption_set_ids.length > 0 ? `${formData.assumption_set_ids.length} set${formData.assumption_set_ids.length > 1 ? 's' : ''} selected` : 'Select assumption sets…'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#999' }}>{openDropdown === 'assumption' ? '▲' : '▼'}</span>
                  </button>

                  {/* Dropdown panel — split layout */}
                  {openDropdown === 'assumption' && (
                    <div
                      style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300, background: '#fff', border: '1px solid #707CF1', borderRadius: '6px', boxShadow: '0 6px 20px rgba(112,124,241,0.15)', display: 'flex', height: '240px' }}
                      onMouseLeave={() => setHoveredSetId(null)}
                    >
                      {/* Left column — scrollable set list */}
                      <div style={{ width: '45%', overflowY: 'auto', borderRight: '1px solid #ebebff', flexShrink: 0 }}>
                        {assumptionSets.length === 0 ? (
                          <p style={{ padding: '0.75rem 1rem', margin: 0, fontSize: '0.85rem', color: '#999' }}>No assumption sets available.</p>
                        ) : assumptionSets.map(set => (
                          <label
                            key={set.id}
                            onMouseEnter={() => handleSetHover(set.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.85rem', cursor: 'pointer', background: hoveredSetId === set.id ? '#f5f5ff' : formData.assumption_set_ids.includes(set.id) ? '#f0f0ff' : 'transparent', borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' }}
                          >
                            <input
                              type="checkbox"
                              checked={formData.assumption_set_ids.includes(set.id)}
                              onChange={() => toggleSetSelection(set.id, 'assumption_set_ids')}
                              style={{ flexShrink: 0 }}
                            />
                            <span style={{ flex: 1, fontSize: '0.875rem' }}>
                              {set.name}
                              {!!set.is_locked && <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', color: '#e67e22' }}>🔒</span>}
                              {set.item_count > 0 && <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: '#aaa' }}>({set.item_count})</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                      {/* Right column — static item preview */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 0.85rem', background: '#fafbff' }}>
                        {hoveredSetId === null ? (
                          <p style={{ fontSize: '0.78rem', color: '#bbb', margin: 0, marginTop: '0.5rem' }}>Hover over a set to preview its items.</p>
                        ) : hoveredSetItems[hoveredSetId] === undefined ? (
                          <p style={{ fontSize: '0.78rem', color: '#aaa', margin: 0 }}>Loading…</p>
                        ) : hoveredSetItems[hoveredSetId].length === 0 ? (
                          <p style={{ fontSize: '0.78rem', color: '#aaa', margin: 0 }}>No items in this set.</p>
                        ) : (
                          <>
                            <strong style={{ fontSize: '0.75rem', color: '#383392', display: 'block', marginBottom: '0.4rem' }}>
                              {assumptionSets.find(s => s.id === hoveredSetId)?.name}
                            </strong>
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {hoveredSetItems[hoveredSetId].map(item => (
                                <li key={item.id} style={{ fontSize: '0.75rem', color: '#444', padding: '0.15rem 0' }}>{item.text}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected chips */}
                {formData.assumption_set_ids.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {formData.assumption_set_ids.map(id => {
                      const set = assumptionSets.find(s => s.id === id);
                      return set ? (
                        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', background: '#f0f0ff', border: '1px solid #707CF1', borderRadius: '20px', fontSize: '0.78rem', color: '#383392' }}>
                          {set.name}
                          <button type="button" onClick={() => toggleSetSelection(id, 'assumption_set_ids')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#707CF1', fontSize: '0.75rem', padding: 0, lineHeight: 1 }}>✕</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* ── Out of Scope Sets dropdown ── */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Out of Scope Sets <span style={{ fontWeight: 400, color: '#999' }}>(Optional)</span></label>
                <div ref={oosDropdownRef} style={{ position: 'relative' }}>
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'outofscope' ? null : 'outofscope')}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '1px solid', borderColor: openDropdown === 'outofscope' ? '#707CF1' : '#e0e0e0', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: formData.out_of_scope_set_ids.length > 0 ? '#333' : '#999' }}
                  >
                    <span>{formData.out_of_scope_set_ids.length > 0 ? `${formData.out_of_scope_set_ids.length} set${formData.out_of_scope_set_ids.length > 1 ? 's' : ''} selected` : 'Select out of scope sets…'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#999' }}>{openDropdown === 'outofscope' ? '▲' : '▼'}</span>
                  </button>

                  {/* Dropdown panel — split layout */}
                  {openDropdown === 'outofscope' && (
                    <div
                      style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300, background: '#fff', border: '1px solid #707CF1', borderRadius: '6px', boxShadow: '0 6px 20px rgba(112,124,241,0.15)', display: 'flex', height: '240px' }}
                      onMouseLeave={() => setHoveredSetId(null)}
                    >
                      {/* Left column — scrollable set list */}
                      <div style={{ width: '45%', overflowY: 'auto', borderRight: '1px solid #ebebff', flexShrink: 0 }}>
                        {outOfScopeSets.length === 0 ? (
                          <p style={{ padding: '0.75rem 1rem', margin: 0, fontSize: '0.85rem', color: '#999' }}>No out of scope sets available.</p>
                        ) : outOfScopeSets.map(set => (
                          <label
                            key={set.id}
                            onMouseEnter={() => handleSetHover(set.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.85rem', cursor: 'pointer', background: hoveredSetId === set.id ? '#f5f5ff' : formData.out_of_scope_set_ids.includes(set.id) ? '#f0f0ff' : 'transparent', borderBottom: '1px solid #f0f0f0', transition: 'background 0.1s' }}
                          >
                            <input
                              type="checkbox"
                              checked={formData.out_of_scope_set_ids.includes(set.id)}
                              onChange={() => toggleSetSelection(set.id, 'out_of_scope_set_ids')}
                              style={{ flexShrink: 0 }}
                            />
                            <span style={{ flex: 1, fontSize: '0.875rem' }}>
                              {set.name}
                              {!!set.is_locked && <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', color: '#e67e22' }}>🔒</span>}
                              {set.item_count > 0 && <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: '#aaa' }}>({set.item_count})</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                      {/* Right column — static item preview */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 0.85rem', background: '#fafbff' }}>
                        {hoveredSetId === null ? (
                          <p style={{ fontSize: '0.78rem', color: '#bbb', margin: 0, marginTop: '0.5rem' }}>Hover over a set to preview its items.</p>
                        ) : hoveredSetItems[hoveredSetId] === undefined ? (
                          <p style={{ fontSize: '0.78rem', color: '#aaa', margin: 0 }}>Loading…</p>
                        ) : hoveredSetItems[hoveredSetId].length === 0 ? (
                          <p style={{ fontSize: '0.78rem', color: '#aaa', margin: 0 }}>No items in this set.</p>
                        ) : (
                          <>
                            <strong style={{ fontSize: '0.75rem', color: '#383392', display: 'block', marginBottom: '0.4rem' }}>
                              {outOfScopeSets.find(s => s.id === hoveredSetId)?.name}
                            </strong>
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {hoveredSetItems[hoveredSetId].map(item => (
                                <li key={item.id} style={{ fontSize: '0.75rem', color: '#444', padding: '0.15rem 0' }}>{item.text}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected chips */}
                {formData.out_of_scope_set_ids.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {formData.out_of_scope_set_ids.map(id => {
                      const set = outOfScopeSets.find(s => s.id === id);
                      return set ? (
                        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', background: '#f0f0ff', border: '1px solid #707CF1', borderRadius: '20px', fontSize: '0.78rem', color: '#383392' }}>
                          {set.name}
                          <button type="button" onClick={() => toggleSetSelection(id, 'out_of_scope_set_ids')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#707CF1', fontSize: '0.75rem', padding: 0, lineHeight: 1 }}>✕</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Document Intelligence / Extraction Panel */}
          <div className="form-group">
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0', marginBottom: extractionOpen ? '0' : '0' }}
              onClick={() => setExtractionOpen(!extractionOpen)}
            >
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Extract from Documents</strong>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#888' }}>Upload files to auto-populate Project Notes and Deliverables</span>
              </div>
              <span style={{ fontSize: '1.2rem', color: '#666' }}>{extractionOpen ? '▲' : '▼'}</span>
            </div>

            {extractionOpen && (
              <div style={{ padding: '1rem', border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 6px 6px', background: '#fafafa' }}>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.75rem' }}>
                  Upload meeting notes, solution documentation, transcripts, or any project documents. The AI will extract relevant project notes and deliverables and pre-populate the fields below.
                </p>

                {extractionError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{extractionError}</div>}

                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.xlsx"
                    onChange={handleFilesChange}
                    style={{ display: 'none' }}
                    id="extraction-file-input"
                  />
                  <label
                    htmlFor="extraction-file-input"
                    style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#fff', border: '2px dashed #c0c0c0', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', color: '#666' }}
                  >
                    + Click to add files (PDF, DOCX, TXT, XLSX — max 5 files, 10MB each)
                  </label>
                </div>

                {extractionFiles.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Files to process:</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                      {extractionFiles.map((file, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '0.875rem' }}>
                          <span style={{ flex: 1 }}>{file.name}</span>
                          <span style={{ color: '#888', fontSize: '0.8rem' }}>({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', padding: '0 0.25rem' }}
                            onClick={() => removeExtractionFile(i)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="action-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleExtract}
                    disabled={extractionFiles.length === 0 || extracting}
                  >
                    {extracting ? (
                      <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> Extracting...</>
                    ) : (
                      'Extract Project Notes & Deliverables'
                    )}
                  </button>
                  {(formData.project_notes || formData.deliverables) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => setFormData(prev => ({ ...prev, project_notes: '', deliverables: '' }))}
                    >
                      Clear Extracted Content
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Project Notes */}
          <div className="form-group">
            <label>Project Notes *</label>
            <textarea
              className="form-control"
              value={formData.project_notes}
              onChange={(e) => setFormData({ ...formData, project_notes: e.target.value })}
              placeholder="Describe the project scope, objectives, requirements, and any specific details..."
              rows="6"
              required
            />
          </div>

          {/* Deliverables */}
          <div className="form-group">
            <label>Deliverables *</label>
            <textarea
              className="form-control"
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              placeholder="List all project deliverables (one per line or comma-separated)..."
              rows="6"
              required
            />
          </div>

          <div className="sow-actions">
            <div className="sow-actions-buttons">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></div>
                    Generating SOW...
                  </>
                ) : (
                  'Generate SOW'
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={loading}
                onClick={() => {
                  setFormData({
                    account_id: '',
                    template_id: '',
                    product_id: '',
                    engagement_type_id: '',
                    project_notes: '',
                    deliverables: '',
                    assumption_set_ids: [],
                    out_of_scope_set_ids: [],
                  });
                  setGeneratedSOW(null);
                  setError(null);
                  setSuccess(null);
                  setExtractionFiles([]);
                  setExtractionError(null);
                  setExtractionOpen(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Reset Form
              </button>
            </div>
            <p className="ai-disclaimer">
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
              <span><strong>AI-Generated Content — Review Required:</strong> This document was drafted with the assistance of AI and should be treated as a preliminary output. Please carefully review all content for accuracy, completeness, and contextual appropriateness before use, distribution, or execution.</span>
            </p>
          </div>
        </form>
      </div>

      {generatedSOW && (
        <div className="card">
          <div className="card-header">
            <h3>Generated SOW</h3>
            <div className="action-buttons">
              <button className="btn btn-secondary btn-small" onClick={() => handleExport('pdf')}>Export PDF</button>
              <button className="btn btn-secondary btn-small" onClick={() => handleExport('docx')}>Export DOCX</button>
              <button className="btn btn-outline btn-small" onClick={() => handleExport('txt')}>Export TXT</button>
            </div>
          </div>
          <div className="sow-preview">
            {formatContent(generatedSOW.content)}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode toggle — pill-style switcher between AI Generated and From Template
// ─────────────────────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }) {
  const modes = [
    { key: 'ai',       icon: '🤖', label: 'AI Generated',  desc: 'Generate from scratch with AI assistance' },
    { key: 'template', icon: '📄', label: 'From Template', desc: 'Fill placeholders in a pre-built Word template' },
  ];

  return (
    <div style={{
      display: 'inline-flex',
      background: '#f3f4f6',
      borderRadius: 10,
      padding: 4,
      marginBottom: '1rem',
      gap: 2,
      border: '1px solid #e5e7eb',
    }}>
      {modes.map((m) => {
        const isActive = mode === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            title={m.desc}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0.55rem 1.1rem',
              border: 'none',
              borderRadius: 8,
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? '#111827' : '#6b7280',
              fontWeight: isActive ? 600 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease-out',
            }}
          >
            <span style={{ fontSize: '1.05rem' }}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SOWGenerator;
