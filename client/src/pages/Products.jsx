import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';

const S = {
  page:    { maxWidth:1200, margin:'0 auto', padding:'32px 24px' },
  header:  { marginBottom:28 },
  h2:      { fontSize:28, fontWeight:800, color:'#f1f5f9', marginBottom:8 },
  sub:     { color:'#64748b', fontSize:15 },
  toolbar: { display:'flex', gap:12, marginBottom:28, flexWrap:'wrap', alignItems:'center' },
  search:  { flex:1, minWidth:220, background:'#1e293b', border:'1px solid #334155',
             color:'#f1f5f9', borderRadius:8, padding:'10px 14px', fontSize:14, outline:'none' },
  filter:  { background:'#1e293b', border:'1px solid #334155', color:'#94a3b8',
             borderRadius:8, padding:'10px 14px', fontSize:14, outline:'none', cursor:'pointer' },
  grid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 },
  empty:   { textAlign:'center', color:'#475569', padding:60, fontSize:16 },
  loading: { textAlign:'center', color:'#64748b', padding:60, fontSize:16 },
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search,   setSearch]   = useState('');
  const [type,     setType]     = useState('all');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    api.get('/products')
      .then(d => { setProducts(d.data); setFiltered(d.data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = products;
    if (type !== 'all') result = result.filter(p => p.type === type);
    if (search.trim())  result = result.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, type, products]);

  if (loading) return <div style={S.loading}>Loading products...</div>;
  if (error)   return <div style={{ color:'#ef4444' }}>Error: {error}</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h2 style={S.h2}>Products</h2>
        <p style={S.sub}>
          {filtered.length} of {products.length} products
          {type !== 'all' && ` · type: ${type}`}
          {search && ` · "${search}"`}
        </p>
      </div>

      <div style={S.toolbar}>
        <input
          style={S.search}
          placeholder="🔍  Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.filter} value={type} onChange={e => setType(e.target.value)}>
          <option value="all">All types</option>
          <option value="physical">📦 Physical</option>
          <option value="digital">💾 Digital</option>
          <option value="service">🛠️ Service</option>
        </select>
      </div>

      {filtered.length === 0
        ? <div style={S.empty}>No products found.</div>
        : <div style={S.grid}>
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
      }
    </div>
  );
}