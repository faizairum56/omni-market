import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const STATUS_COLOR = {
  placed:'#3b82f6', shipped:'#10b981', delivered:'#22c55e',
  cancelled:'#ef4444', pending:'#f59e0b',
};

const S = {
  page:   { maxWidth:900, margin:'0 auto', padding:'32px 24px' },
  h2:     { fontSize:28, fontWeight:800, color:'#f1f5f9', marginBottom:24 },
  card:   { background:'#1e293b', border:'1px solid #334155', borderRadius:12,
            padding:20, marginBottom:16 },
  row:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap' },
  orderId:{ color:'#38bdf8', fontFamily:'monospace', fontSize:13, fontWeight:700 },
  status: { padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700 },
  meta:   { color:'#64748b', fontSize:13, marginTop:6 },
  total:  { color:'#f1f5f9', fontWeight:800, fontSize:20 },
  items:  { marginTop:14, borderTop:'1px solid #1e293b', paddingTop:14 },
  itemRow:{ display:'flex', justifyContent:'space-between', color:'#94a3b8',
            fontSize:13, marginBottom:4 },
  reportBtn:{ background:'#334155', border:'none', color:'#94a3b8', padding:'6px 14px',
              borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600, marginTop:10 },
  report:   { background:'#0f172a', border:'1px solid #334155', borderRadius:8,
              padding:14, marginTop:10, color:'#a3e635', fontSize:13,
              fontFamily:'monospace', lineHeight:1.7 },
  loading:  { textAlign:'center', color:'#64748b', padding:60 },
  empty:    { textAlign:'center', color:'#475569', padding:60 },
  tabs:     { display:'flex', gap:4, marginBottom:4 },
  tab:      { background:'#0f172a', border:'1px solid #334155', color:'#64748b',
              padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 },
  activeTab:{ background:'#1e3a5f', color:'#38bdf8', borderColor:'#3b82f6' },
};

function OrderCard({ order }) {
  const [items,      setItems]   = useState([]);
  const [report,     setReport]  = useState('');
  const [activeRep,  setActiveRep] = useState('');
  const [expanded,   setExpanded] = useState(false);

  async function loadItems() {
    if (expanded) { setExpanded(false); return; }
    try {
      const res = await api.get(`/orders/${order.id}`);
      setItems(res.data.items || []);
    } catch (_) {}
    setExpanded(true);
  }

  async function loadReport(type) {
    if (activeRep === type) { setReport(''); setActiveRep(''); return; }
    try {
      const res = await api.get(`/orders/${order.id}/report?type=${type}`);
      setReport(res.data); setActiveRep(type);
    } catch (e) { setReport(`Error: ${e.message}`); }
  }

  const color = STATUS_COLOR[order.status] || '#64748b';

  return (
    <div style={S.card}>
      <div style={S.row}>
        <div>
          <div style={S.orderId}>{order.id}</div>
          <div style={S.meta}>
            {new Date(order.created_at).toLocaleString()} · {order.address}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <span style={{ ...S.status, background:`${color}22`, color }}>{order.status}</span>
          <div style={{ ...S.total, marginTop:6 }}>${Number(order.total).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
        <button style={S.reportBtn} onClick={loadItems}>
          {expanded ? '▲ Hide Items' : '▼ Show Items'}
        </button>
        {['tax','shipping','revenue'].map(t => (
          <button key={t} style={{ ...S.reportBtn, ...(activeRep===t?{color:'#a3e635',borderColor:'#4d7c0f'}:{}) }}
            onClick={() => loadReport(t)}>
            {t} report
          </button>
        ))}
      </div>

      {expanded && items.length > 0 && (
        <div style={S.items}>
          {items.map((item, i) => (
            <div key={i} style={S.itemRow}>
              <span>{item.product_name} × {item.qty}</span>
              <span>${(item.unit_price * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {report && <div style={S.report}>{typeof report === 'string' ? report : JSON.stringify(report, null, 2)}</div>}
    </div>
  );
}

export default function Orders() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders')
      .then(d => setOrders(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={S.loading}>Loading orders...</div>;

  return (
    <div style={S.page}>
      <h2 style={S.h2}>My Orders ({orders.length})</h2>
      {orders.length === 0
        ? <div style={S.empty}>No orders yet. Go place one!</div>
        : orders.map(o => <OrderCard key={o.id} order={o} />)
      }
    </div>
  );
}