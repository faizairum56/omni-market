import React, { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const S = {
  page:    { maxWidth:1300, margin:'0 auto', padding:'28px 24px' },
  header:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 },
  h2:      { fontSize:26, fontWeight:800, color:'#f1f5f9' },
  chip:    { background:'#1e3a5f', color:'#38bdf8', padding:'4px 12px',
             borderRadius:20, fontSize:12, fontWeight:700 },

  // Tabs
  tabs:    { display:'flex', gap:4, marginBottom:28, borderBottom:'1px solid #334155',
             paddingBottom:0, overflowX:'auto' },
  tab:     { padding:'10px 20px', border:'none', background:'transparent',
             color:'#64748b', fontWeight:600, fontSize:14, cursor:'pointer',
             borderBottom:'2px solid transparent', whiteSpace:'nowrap' },
  activeTab:{ color:'#38bdf8', borderBottomColor:'#38bdf8' },

  // Stat cards
  stats:   { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16, marginBottom:28 },
  statCard:{ background:'#1e293b', border:'1px solid #334155', borderRadius:12,
             padding:'20px 18px' },
  statN:   { fontSize:30, fontWeight:800, color:'#38bdf8', marginBottom:4 },
  statL:   { color:'#64748b', fontSize:12, textTransform:'uppercase', letterSpacing:'0.5px' },
  statSub: { color:'#10b981', fontSize:13, marginTop:4, fontWeight:600 },

  // Table
  table:   { width:'100%', borderCollapse:'collapse' },
  th:      { textAlign:'left', padding:'10px 14px', color:'#64748b', fontSize:12,
             fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px',
             borderBottom:'1px solid #334155' },
  td:      { padding:'12px 14px', color:'#e2e8f0', fontSize:14,
             borderBottom:'1px solid #1e293b', verticalAlign:'middle' },
  trow:    { transition:'background 0.1s' },

  // Buttons
  btn:     { padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer',
             fontWeight:600, fontSize:13, transition:'opacity 0.15s' },
  primaryBtn: { background:'#3b82f6', color:'#fff' },
  successBtn: { background:'#10b981', color:'#fff' },
  dangerBtn:  { background:'#ef4444', color:'#fff' },
  ghostBtn:   { background:'#334155', color:'#94a3b8' },
  warnBtn:    { background:'#f59e0b', color:'#0f172a' },

  // Modal / Form
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
             display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:24 },
  modal:   { background:'#1e293b', border:'1px solid #334155', borderRadius:16,
             padding:32, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' },
  modalH:  { color:'#f1f5f9', fontSize:18, fontWeight:800, marginBottom:20 },
  label:   { display:'block', color:'#94a3b8', fontSize:13, fontWeight:600, marginBottom:6, marginTop:14 },
  input:   { width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#f1f5f9',
             borderRadius:8, padding:'10px 13px', fontSize:14, outline:'none', boxSizing:'border-box' },
  select:  { width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#f1f5f9',
             borderRadius:8, padding:'10px 13px', fontSize:14, outline:'none', boxSizing:'border-box' },
  formRow: { display:'flex', gap:12 },
  formCol: { flex:1 },
  error:   { background:'#450a0a', border:'1px solid #ef4444', color:'#fca5a5',
             borderRadius:8, padding:'10px 14px', fontSize:13, margin:'12px 0' },
  success: { background:'#052e16', border:'1px solid #16a34a', color:'#86efac',
             borderRadius:8, padding:'10px 14px', fontSize:13, margin:'12px 0' },
  badge:   { padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 },

  // Search bar
  searchBar:{ background:'#1e293b', border:'1px solid #334155', color:'#f1f5f9',
              borderRadius:8, padding:'9px 14px', fontSize:14, outline:'none', width:240 },
  toolbar:  { display:'flex', justifyContent:'space-between', alignItems:'center',
              marginBottom:16, gap:12, flexWrap:'wrap' },

  // Section card
  section: { background:'#1e293b', border:'1px solid #334155', borderRadius:12, overflow:'hidden' },
};

const STATUS_COLORS = {
  placed:'#3b82f6', shipped:'#10b981', delivered:'#22c55e',
  cancelled:'#ef4444', pending:'#f59e0b',
};
const TYPE_COLORS = { physical:'#3b82f6', digital:'#10b981', service:'#f59e0b' };
const ROLE_COLORS = { superadmin:'#ef4444', admin:'#f59e0b', customer:'#10b981', viewer:'#64748b' };

// ─────────────────────────────────────────────────────────────────
// Small reusable components
// ─────────────────────────────────────────────────────────────────
function Badge({ label, color = '#64748b' }) {
  return (
    <span style={{ ...S.badge, background:`${color}22`, color }}>
      {label}
    </span>
  );
}

function Confirm({ message, onConfirm, onCancel }) {
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth:380, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
        <div style={{ color:'#f1f5f9', fontSize:16, fontWeight:600, marginBottom:8 }}>{message}</div>
        <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:20 }}>
          <button style={{ ...S.btn, ...S.ghostBtn }} onClick={onCancel}>Cancel</button>
          <button style={{ ...S.btn, ...S.dangerBtn }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────
function Overview({ stats }) {
  if (!stats) return <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading stats...</div>;
  return (
    <div>
      <div style={S.stats}>
        <div style={S.statCard}>
          <div style={S.statN}>{stats.products}</div>
          <div style={S.statL}>Products</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statN}>{stats.orders}</div>
          <div style={S.statL}>Total Orders</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statN}>{stats.users}</div>
          <div style={S.statL}>Registered Users</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statN, color:'#10b981' }}>${stats.revenue?.toFixed(2) ?? '0.00'}</div>
          <div style={S.statL}>Total Revenue</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statN, color:'#f59e0b' }}>{stats.pendingOrders}</div>
          <div style={S.statL}>Pending Orders</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statN, color:'#a78bfa' }}>{stats.placedOrders}</div>
          <div style={S.statL}>Placed Orders</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={S.statCard}>
          <div style={{ color:'#f1f5f9', fontWeight:700, marginBottom:14 }}>📦 Products by Type</div>
          {['physical','digital','service'].map(t => (
            <div key={t} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <Badge label={t} color={TYPE_COLORS[t]} />
              <span style={{ color:'#f1f5f9', fontWeight:600 }}>{stats.productsByType?.[t] ?? 0}</span>
            </div>
          ))}
        </div>
        <div style={S.statCard}>
          <div style={{ color:'#f1f5f9', fontWeight:700, marginBottom:14 }}>📋 Orders by Status</div>
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <div key={s} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <Badge label={s} color={c} />
              <span style={{ color:'#f1f5f9', fontWeight:600 }}>{stats.ordersByStatus?.[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PRODUCTS TAB
// ─────────────────────────────────────────────────────────────────
function ProductModal({ product, onClose, onSaved }) {
  const editing = !!product?.id;
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price || '',
    type: product?.type || 'physical',
    weight: product?.weight || '',
    downloadUrl: product?.download_url || '',
    duration: product?.duration || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name || !form.price) { setError('Name and price are required.'); return; }
    setSaving(true); setError('');
    try {
      const body = {
        type: form.type, name: form.name, price: parseFloat(form.price),
        weight: form.type === 'physical' ? parseFloat(form.weight) || 0 : undefined,
        downloadUrl: form.type === 'digital' ? form.downloadUrl : undefined,
        duration: form.type === 'service' ? parseFloat(form.duration) || 1 : undefined,
      };
      if (editing) await api.put(`/products/${product.id}`, body);
      else         await api.post('/products', body);
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalH}>{editing ? '✏️ Edit Product' : '➕ New Product'}</div>
        {error && <div style={S.error}>{error}</div>}

        <label style={S.label}>Product Name</label>
        <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Gaming Laptop" />

        <div style={S.formRow}>
          <div style={S.formCol}>
            <label style={S.label}>Price ($)</label>
            <input style={S.input} type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          </div>
          <div style={S.formCol}>
            <label style={S.label}>Type</label>
            <select style={S.select} value={form.type} onChange={e => set('type', e.target.value)} disabled={editing}>
              <option value="physical">📦 Physical</option>
              <option value="digital">💾 Digital</option>
              <option value="service">🛠️ Service</option>
            </select>
          </div>
        </div>

        {form.type === 'physical' && (
          <>
            <label style={S.label}>Weight (kg)</label>
            <input style={S.input} type="number" min="0" step="0.01" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="e.g. 1.5" />
          </>
        )}
        {form.type === 'digital' && (
          <>
            <label style={S.label}>Download URL</label>
            <input style={S.input} value={form.downloadUrl} onChange={e => set('downloadUrl', e.target.value)} placeholder="https://..." />
          </>
        )}
        {form.type === 'service' && (
          <>
            <label style={S.label}>Duration (hours)</label>
            <input style={S.input} type="number" min="0.5" step="0.5" value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 2" />
          </>
        )}

        <div style={{ display:'flex', gap:12, marginTop:24 }}>
          <button style={{ ...S.btn, ...S.ghostBtn, flex:1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn, ...S.primaryBtn, flex:2, opacity:saving?0.6:1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [search,   setSearch]   = useState('');
  const [typeFilter, setType]   = useState('all');
  const [modal,    setModal]    = useState(null);  // null | 'new' | product object
  const [confirm,  setConfirm]  = useState(null);  // product to delete
  const [msg,      setMsg]      = useState('');
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/products');
    setProducts(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(product) {
    try {
      await api.delete(`/products/${product.id}`);
      setMsg(`✓ "${product.name}" deleted`);
      load();
    } catch(e) { setMsg(`✗ ${e.message}`); }
    setConfirm(null);
    setTimeout(() => setMsg(''), 3000);
  }

  function handleSaved() {
    setModal(null);
    setMsg('✓ Product saved successfully');
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  const visible = products.filter(p => {
    const matchType   = typeFilter === 'all' || p.type === typeFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div>
      {msg && <div style={msg.startsWith('✓') ? S.success : S.error}>{msg}</div>}

      <div style={S.toolbar}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input style={S.searchBar} placeholder="🔍 Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...S.searchBar, width:'auto' }} value={typeFilter} onChange={e => setType(e.target.value)}>
            <option value="all">All types</option>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
            <option value="service">Service</option>
          </select>
        </div>
        <button style={{ ...S.btn, ...S.successBtn }} onClick={() => setModal('new')}>
          + New Product
        </button>
      </div>

      <div style={S.section}>
        <table style={S.table}>
          <thead>
            <tr>
              {['ID','Name','Type','Price','Extra','Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#64748b', padding:32 }}>Loading...</td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#64748b', padding:32 }}>No products found.</td></tr>
            )}
            {visible.map(p => (
              <tr key={p.id} style={S.trow}
                onMouseEnter={e => e.currentTarget.style.background='#0f172a'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={S.td}><span style={{ fontFamily:'monospace', color:'#64748b', fontSize:12 }}>{p.id}</span></td>
                <td style={S.td}><strong>{p.name}</strong></td>
                <td style={S.td}><Badge label={p.type} color={TYPE_COLORS[p.type]} /></td>
                <td style={S.td}><strong style={{ color:'#38bdf8' }}>${Number(p.price).toFixed(2)}</strong></td>
                <td style={S.td}>
                  <span style={{ color:'#64748b', fontSize:12 }}>
                    {p.weight   ? `⚖ ${p.weight}kg`    : ''}
                    {p.duration ? `⏱ ${p.duration}h`   : ''}
                    {p.download_url ? '🔗 URL set' : ''}
                  </span>
                </td>
                <td style={{ ...S.td }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button style={{ ...S.btn, ...S.ghostBtn, padding:'5px 12px' }} onClick={() => setModal(p)}>Edit</button>
                    <button style={{ ...S.btn, ...S.dangerBtn, padding:'5px 12px' }} onClick={() => setConfirm(p)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ProductModal
          product={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {confirm && (
        <Confirm
          message={`Delete "${confirm.name}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ORDERS TAB
// ─────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders,   setOrders]   = useState([]);
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('all');
  const [loading,  setLoading]  = useState(true);
  const [report,   setReport]   = useState({});  // orderId → string
  const [msg,      setMsg]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get('/orders');
    setOrders(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(orderId, status) {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      setMsg(`✓ Order ${orderId} → ${status}`);
      load();
    } catch(e) { setMsg(`✗ ${e.message}`); }
    setTimeout(() => setMsg(''), 3000);
  }

  async function approve(orderId) {
    try {
      const res = await api.get(`/orders/${orderId}/approve`);
      setMsg(`✓ ${res.decision}`);
    } catch(e) { setMsg(`✗ ${e.message}`); }
    setTimeout(() => setMsg(''), 4000);
  }

  async function loadReport(orderId, type) {
    const key = `${orderId}-${type}`;
    if (report[key]) { setReport(r => ({ ...r, [key]: undefined })); return; }
    try {
      const res = await api.get(`/orders/${orderId}/report?type=${type}`);
      setReport(r => ({ ...r, [key]: res.data }));
    } catch(e) { setReport(r => ({ ...r, [key]: `Error: ${e.message}` })); }
  }

  const visible = orders.filter(o => {
    const matchStatus = statusF === 'all' || o.status === statusF;
    const matchSearch = !search || o.id.includes(search) || o.address?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div>
      {msg && <div style={msg.startsWith('✓') ? S.success : S.error}>{msg}</div>}

      <div style={S.toolbar}>
        <div style={{ display:'flex', gap:8 }}>
          <input style={S.searchBar} placeholder="🔍 Search by ID or address..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...S.searchBar, width:'auto' }} value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="all">All statuses</option>
            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span style={{ color:'#64748b', fontSize:13 }}>{visible.length} orders</span>
      </div>

      <div style={S.section}>
        <table style={S.table}>
          <thead>
            <tr>
              {['Order ID','Address','Status','Total','Actions','Reports'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#64748b', padding:32 }}>Loading...</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#64748b', padding:32 }}>No orders found.</td></tr>}
            {visible.map(o => {
              const color = STATUS_COLORS[o.status] || '#64748b';
              return (
                <React.Fragment key={o.id}>
                  <tr style={S.trow}
                    onMouseEnter={e => e.currentTarget.style.background='#0f172a'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={S.td}><span style={{ fontFamily:'monospace', fontSize:12, color:'#38bdf8' }}>{o.id}</span></td>
                    <td style={{ ...S.td, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.address}</td>
                    <td style={S.td}><Badge label={o.status} color={color} /></td>
                    <td style={S.td}><strong style={{ color:'#38bdf8' }}>${Number(o.total).toFixed(2)}</strong></td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {o.status === 'pending' && <button style={{ ...S.btn, ...S.primaryBtn, padding:'4px 10px', fontSize:12 }} onClick={() => updateStatus(o.id,'placed')}>Place</button>}
                        {o.status === 'placed'  && <button style={{ ...S.btn, ...S.warnBtn,   padding:'4px 10px', fontSize:12 }} onClick={() => updateStatus(o.id,'shipped')}>Ship</button>}
                        {o.status === 'shipped' && <button style={{ ...S.btn, ...S.successBtn,padding:'4px 10px', fontSize:12 }} onClick={() => updateStatus(o.id,'delivered')}>Deliver</button>}
                        {!['cancelled','delivered'].includes(o.status) && <button style={{ ...S.btn, ...S.dangerBtn, padding:'4px 10px', fontSize:12 }} onClick={() => updateStatus(o.id,'cancelled')}>Cancel</button>}
                        <button style={{ ...S.btn, ...S.ghostBtn, padding:'4px 10px', fontSize:12 }} onClick={() => approve(o.id)}>Approve</button>
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:4 }}>
                        {['tax','shipping','revenue'].map(t => (
                          <button key={t} style={{ ...S.btn, padding:'4px 9px', fontSize:11,
                            background: report[`${o.id}-${t}`] ? '#1e3a5f' : '#334155',
                            color: report[`${o.id}-${t}`] ? '#38bdf8' : '#94a3b8' }}
                            onClick={() => loadReport(o.id, t)}>{t}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {/* Show any open report rows inline */}
                  {['tax','shipping','revenue'].map(t => {
                    const r = report[`${o.id}-${t}`];
                    if (!r) return null;
                    return (
                      <tr key={`${o.id}-${t}-row`}>
                        <td colSpan={6} style={{ ...S.td, background:'#0f172a', padding:'10px 14px' }}>
                          <div style={{ fontFamily:'monospace', fontSize:12, color:'#a3e635', lineHeight:1.6 }}>
                            {typeof r === 'string' ? r : JSON.stringify(r, null, 2)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// USERS TAB
// ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users,   setUsers]  = useState([]);
  const [search,  setSearch] = useState('');
  const [loading, setLoading]= useState(true);

  useEffect(() => {
    api.get('/users')
      .then(d => setUsers(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={S.toolbar}>
        <input style={S.searchBar} placeholder="🔍 Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ color:'#64748b', fontSize:13 }}>{users.length} registered users</span>
      </div>
      <div style={S.section}>
        <table style={S.table}>
          <thead>
            <tr>
              {['ID','Name','Email','Role','Loyalty Pts','Joined'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#64748b', padding:32 }}>Loading...</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#64748b', padding:32 }}>No users found.</td></tr>}
            {visible.map(u => (
              <tr key={u.id} style={S.trow}
                onMouseEnter={e => e.currentTarget.style.background='#0f172a'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td style={{ ...S.td, color:'#64748b', fontFamily:'monospace', fontSize:12 }}>{u.id}</td>
                <td style={S.td}><strong>{u.name}</strong></td>
                <td style={{ ...S.td, color:'#64748b' }}>{u.email}</td>
                <td style={S.td}><Badge label={u.role} color={ROLE_COLORS[u.role] || '#64748b'} /></td>
                <td style={{ ...S.td, color:'#38bdf8', fontWeight:700 }}>{u.loyalty_points} pts</td>
                <td style={{ ...S.td, color:'#64748b', fontSize:12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────────
const TABS = ['Overview','Products','Orders','Users'];

export default function Admin() {
  const { user }          = useAuth();
  const [tab, setTab]     = useState('Overview');
  const [stats, setStats] = useState(null);

  // Guard — only admin/superadmin
  if (!user) return <Navigate to="/login" replace />;
  if (!['admin','superadmin'].includes(user.role)) {
    return (
      <div style={{ textAlign:'center', padding:80 }}>
        <div style={{ fontSize:48 }}>🚫</div>
        <div style={{ color:'#ef4444', fontSize:18, fontWeight:700, marginTop:12 }}>Access Denied</div>
        <div style={{ color:'#64748b', marginTop:8 }}>You need admin or superadmin role.</div>
      </div>
    );
  }

  useEffect(() => {
    async function loadStats() {
      const [prodRes, ordersRes, usersRes] = await Promise.all([
        api.get('/products'),
        api.get('/orders'),
        api.get('/users').catch(() => ({ data: [] })),
      ]);
      const orders = ordersRes.data;
      const products = prodRes.data;
      const byType   = {};
      products.forEach(p => { byType[p.type] = (byType[p.type] || 0) + 1; });
      const byStatus = {};
      orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      const revenue = orders
        .filter(o => ['placed','shipped','delivered'].includes(o.status))
        .reduce((s, o) => s + Number(o.total), 0);
      setStats({
        products      : products.length,
        orders        : orders.length,
        users         : usersRes.data.length,
        revenue,
        pendingOrders : byStatus.pending || 0,
        placedOrders  : byStatus.placed  || 0,
        productsByType: byType,
        ordersByStatus: byStatus,
      });
    }
    loadStats().catch(() => {});
  }, [tab]);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h2 style={S.h2}>🛠️ Admin Dashboard</h2>
        <span style={S.chip}>Logged in as {user.name} ({user.role})</span>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.activeTab : {}) }} onClick={() => setTab(t)}>
            {t === 'Overview'  && '📊 '}
            {t === 'Products'  && '📦 '}
            {t === 'Orders'    && '🧾 '}
            {t === 'Users'     && '👥 '}
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <Overview stats={stats} />}
      {tab === 'Products' && <ProductsTab />}
      {tab === 'Orders'   && <OrdersTab />}
      {tab === 'Users'    && <UsersTab />}
    </div>
  );
}