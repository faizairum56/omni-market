import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

const S = {
  page:   { maxWidth:680, margin:'0 auto', padding:'32px 24px' },
  h2:     { fontSize:28, fontWeight:800, color:'#f1f5f9', marginBottom:28 },
  card:   { background:'#1e293b', border:'1px solid #334155', borderRadius:12, padding:24, marginBottom:20 },
  cardH:  { color:'#94a3b8', fontSize:12, fontWeight:700, textTransform:'uppercase',
            letterSpacing:'1px', marginBottom:16 },
  label:  { display:'block', color:'#94a3b8', fontSize:13, fontWeight:600, marginBottom:6 },
  input:  { width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#f1f5f9',
            borderRadius:8, padding:'11px 14px', fontSize:15, outline:'none',
            marginBottom:16, boxSizing:'border-box' },
  radioRow:{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' },
  radio:  { flex:1, minWidth:140, background:'#0f172a', border:'2px solid #334155',
            borderRadius:10, padding:'12px 16px', cursor:'pointer',
            transition:'border-color 0.15s, background 0.15s' },
  radioActive:{ borderColor:'#3b82f6', background:'#1e3a5f' },
  radioLabel:{ color:'#f1f5f9', fontWeight:600, fontSize:14 },
  radioSub:  { color:'#64748b', fontSize:12, marginTop:2 },
  lineItem:{ display:'flex', justifyContent:'space-between', color:'#94a3b8',
             fontSize:14, marginBottom:8 },
  totalLine:{ display:'flex', justifyContent:'space-between', color:'#f1f5f9',
              fontWeight:800, fontSize:18, marginTop:12, paddingTop:12,
              borderTop:'1px solid #334155' },
  btn:    { width:'100%', background:'#3b82f6', color:'#fff', border:'none',
            borderRadius:10, padding:'14px 0', fontSize:16, fontWeight:700,
            cursor:'pointer', transition:'opacity 0.15s' },
  error:  { background:'#450a0a', border:'1px solid #ef4444', color:'#fca5a5',
            borderRadius:8, padding:'12px 16px', fontSize:14, marginBottom:16 },
  success:{ background:'#052e16', border:'1px solid #16a34a', color:'#86efac',
            borderRadius:8, padding:'16px', fontSize:15, marginBottom:16 },
};

const PAYMENT_METHODS = [
  { id:'creditcard', label:'💳 Credit Card', sub:'via Stripe', provider:'stripe' },
  { id:'crypto',     label:'₿ Crypto',       sub:'-2% discount', provider:'coinbase' },
  { id:'bnpl',       label:'🔄 Buy Now Pay Later', sub:'4 installments', provider:'paypal' },
];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address,  setAddress]  = useState('');
  const [method,   setMethod]   = useState('creditcard');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(null);

  const tax   = subtotal * 0.10;
  const total = subtotal + tax;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!address.trim()) { setError('Please enter a shipping address.'); return; }
    if (items.length === 0) { setError('Your cart is empty.'); return; }

    setLoading(true); setError('');
    try {
      // BUILDER pattern: POST /orders builds Order step by step on backend
      const orderRes = await api.post('/orders', {
        items  : items.map(({ product, qty }) => ({ productId: product.id, qty })),
        address,
        paymentMethod: method,
        notes  : `Placed via Omni-Market web app by ${user.name}`,
      });

      // BRIDGE pattern: POST /payment processes with chosen method + provider
      const selected = PAYMENT_METHODS.find(m => m.id === method);
      await api.post('/payment', {
        orderId  : orderRes.data.id,
        amount   : orderRes.data.total,
        method   : method,
        provider : selected.provider,
      });

      clearCart();
      setSuccess(orderRes.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) return (
    <div style={S.page}>
      <div style={{ ...S.success, padding:32, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <div style={{ fontSize:20, fontWeight:800, color:'#86efac', marginBottom:8 }}>
          Order Placed!
        </div>
        <div style={{ color:'#4ade80', marginBottom:4 }}>Order ID: {success.id}</div>
        <div style={{ color:'#4ade80' }}>Total charged: ${Number(success.total).toFixed(2)}</div>
        <button style={{ ...S.btn, marginTop:24, width:'auto', padding:'11px 28px' }}
          onClick={() => navigate('/orders')}>
          View My Orders →
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <h2 style={S.h2}>Checkout</h2>
      <form onSubmit={handleSubmit}>
        {error && <div style={S.error}>⚠ {error}</div>}

        {/* Shipping address */}
        <div style={S.card}>
          <div style={S.cardH}>📍 Shipping Address</div>
          <label style={S.label}>Full address</label>
          <input style={S.input} value={address}
            placeholder="e.g. 42 Quaid Ave, Islamabad, Pakistan"
            onChange={e => setAddress(e.target.value)} required />
        </div>

        {/* Payment method */}
        <div style={S.card}>
          <div style={S.cardH}>💳 Payment Method</div>
          <div style={S.radioRow}>
            {PAYMENT_METHODS.map(m => (
              <div key={m.id}
                style={{ ...S.radio, ...(method === m.id ? S.radioActive : {}) }}
                onClick={() => setMethod(m.id)}>
                <div style={S.radioLabel}>{m.label}</div>
                <div style={S.radioSub}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div style={S.card}>
          <div style={S.cardH}>🧾 Order Summary</div>
          {items.map(({ product, qty }) => (
            <div key={product.id} style={S.lineItem}>
              <span>{product.name} × {qty}</span>
              <span>${(product.price * qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={S.lineItem}><span>Tax (10%)</span><span>${tax.toFixed(2)}</span></div>
          <div style={S.totalLine}><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
          {loading ? 'Placing order...' : `Place Order · $${total.toFixed(2)}`}
        </button>
      </form>
    </div>
  );
}