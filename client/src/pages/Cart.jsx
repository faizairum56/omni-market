import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const S = {
  page:    { maxWidth:860, margin:'0 auto', padding:'32px 24px' },
  h2:      { fontSize:28, fontWeight:800, color:'#f1f5f9', marginBottom:24 },
  empty:   { textAlign:'center', color:'#475569', padding:60 },
  emptyBtn:{ display:'inline-block', marginTop:16, background:'#3b82f6', color:'#fff',
             textDecoration:'none', padding:'11px 24px', borderRadius:8, fontWeight:700 },
  item:    { background:'#1e293b', border:'1px solid #334155', borderRadius:12,
             padding:'16px 20px', marginBottom:12, display:'flex',
             alignItems:'center', gap:16 },
  name:    { flex:1, color:'#f1f5f9', fontWeight:600, fontSize:15 },
  price:   { color:'#64748b', fontSize:13, marginTop:2 },
  qtyRow:  { display:'flex', alignItems:'center', gap:8 },
  qtyBtn:  { background:'#334155', border:'none', color:'#f1f5f9', width:28, height:28,
             borderRadius:6, cursor:'pointer', fontSize:16, fontWeight:700 },
  qty:     { color:'#f1f5f9', fontWeight:700, minWidth:24, textAlign:'center' },
  lineTotal:{ color:'#38bdf8', fontWeight:700, minWidth:70, textAlign:'right' },
  removeBtn:{ background:'transparent', border:'none', color:'#ef4444',
              cursor:'pointer', fontSize:18, padding:'0 4px' },
  summary: { background:'#1e293b', border:'1px solid #334155', borderRadius:12,
             padding:24, marginTop:8 },
  row:     { display:'flex', justifyContent:'space-between', marginBottom:10,
             color:'#94a3b8', fontSize:15 },
  totalRow:{ display:'flex', justifyContent:'space-between', marginTop:16,
             paddingTop:16, borderTop:'1px solid #334155' },
  total:   { color:'#f1f5f9', fontWeight:800, fontSize:22 },
  actions: { display:'flex', gap:12, marginTop:20, flexWrap:'wrap' },
  checkoutBtn:{ flex:1, background:'#3b82f6', color:'#fff', border:'none',
                padding:'13px 0', borderRadius:10, fontSize:16, fontWeight:700,
                cursor:'pointer', textDecoration:'none', textAlign:'center' },
  undoBtn: { background:'#334155', color:'#94a3b8', border:'none',
             padding:'13px 20px', borderRadius:10, fontSize:14,
             fontWeight:600, cursor:'pointer' },
  clearBtn:{ background:'transparent', color:'#ef4444', border:'1px solid #ef4444',
             padding:'13px 20px', borderRadius:10, fontSize:14,
             fontWeight:600, cursor:'pointer' },
};

export default function Cart() {
  const { items, itemCount, subtotal, removeItem, updateQty, clearCart, undo, canUndo } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const tax      = subtotal * 0.10;
  const total    = subtotal + tax;

  if (items.length === 0) return (
    <div style={S.page}>
      <h2 style={S.h2}>Shopping Cart</h2>
      <div style={S.empty}>
        <div style={{ fontSize:48, marginBottom:12 }}>🛒</div>
        <div style={{ color:'#f1f5f9', fontSize:18, fontWeight:600 }}>Your cart is empty</div>
        <Link to="/products" style={S.emptyBtn}>Browse Products</Link>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <h2 style={S.h2}>Shopping Cart ({itemCount} item{itemCount !== 1 ? 's' : ''})</h2>

      {items.map(({ product, qty }) => (
        <div key={product.id} style={S.item}>
          <div style={{ flex:1 }}>
            <div style={S.name}>{product.name}</div>
            <div style={S.price}>${Number(product.price).toFixed(2)} each · {product.type}</div>
          </div>
          <div style={S.qtyRow}>
            <button style={S.qtyBtn} onClick={() => updateQty(product.id, qty - 1)}>−</button>
            <span style={S.qty}>{qty}</span>
            <button style={S.qtyBtn} onClick={() => updateQty(product.id, qty + 1)}>+</button>
          </div>
          <div style={S.lineTotal}>${(product.price * qty).toFixed(2)}</div>
          <button style={S.removeBtn} onClick={() => removeItem(product.id)} title="Remove">✕</button>
        </div>
      ))}

      <div style={S.summary}>
        <div style={S.row}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
        <div style={S.row}><span>Tax (10%)</span><span>${tax.toFixed(2)}</span></div>
        <div style={S.totalRow}>
          <span style={S.total}>Total</span>
          <span style={S.total}>${total.toFixed(2)}</span>
        </div>
        <div style={S.actions}>
          {canUndo && (
            <button style={S.undoBtn} onClick={undo}>↩ Undo</button>
          )}
          <button style={S.clearBtn} onClick={clearCart}>Clear Cart</button>
          {user
            ? <Link to="/checkout" style={S.checkoutBtn}>Checkout →</Link>
            : <Link to="/login?next=/checkout" style={S.checkoutBtn}>Login to Checkout →</Link>
          }
        </div>
      </div>
    </div>
  );
}