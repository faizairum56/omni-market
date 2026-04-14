import React, { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';

const typeColors = { physical:'#3b82f6', digital:'#10b981', service:'#f59e0b' };
const typeIcons  = { physical:'📦', digital:'💾', service:'🛠️' };

const S = {
  card: { background:'#1e293b', border:'1px solid #334155', borderRadius:12,
          padding:20, display:'flex', flexDirection:'column', gap:12,
          transition:'transform 0.15s, box-shadow 0.15s', cursor:'default' },
  badge: { display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px',
           borderRadius:20, fontSize:11, fontWeight:700, textTransform:'uppercase',
           letterSpacing:'0.5px', width:'fit-content' },
  name: { fontSize:16, fontWeight:700, color:'#f1f5f9', lineHeight:1.3 },
  price: { fontSize:22, fontWeight:800, color:'#38bdf8' },
  meta: { fontSize:12, color:'#64748b' },
  addBtn: { background:'#3b82f6', color:'#fff', border:'none', borderRadius:8,
            padding:'10px 0', cursor:'pointer', fontWeight:700, fontSize:14,
            transition:'background 0.15s', marginTop:'auto' },
  addedBtn: { background:'#10b981' },
};

export default function ProductCard({ product }) {
  const { addItem, items } = useCart();
  const [flash, setFlash]  = useState(false);

  const inCart = items.some(i => i.product.id === product.id);
  const color  = typeColors[product.type] || '#64748b';
  const icon   = typeIcons[product.type]  || '🔷';

  function handleAdd() {
    addItem(product);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  }

  return (
    <div style={S.card}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
    >
      <span style={{ ...S.badge, background:`${color}22`, color }}>
        {icon} {product.type}
      </span>

      <div style={S.name}>{product.name}</div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div style={S.price}>${Number(product.price).toFixed(2)}</div>
        {product.weight && <div style={S.meta}>⚖️ {product.weight} kg</div>}
        {product.duration && <div style={S.meta}>⏱️ {product.duration}h</div>}
      </div>

      <button
        style={{ ...S.addBtn, ...(flash || inCart ? S.addedBtn : {}) }}
        onClick={handleAdd}
      >
        {flash ? '✓ Added!' : inCart ? '✓ In Cart — Add More' : '+ Add to Cart'}
      </button>
    </div>
  );
}