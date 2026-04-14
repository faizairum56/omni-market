import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const S = {
  hero: { textAlign:'center', padding:'80px 24px 48px', maxWidth:700, margin:'0 auto' },
  badge: { display:'inline-block', background:'#1e3a5f', color:'#38bdf8', padding:'4px 14px',
           borderRadius:20, fontSize:13, fontWeight:600, marginBottom:20 },
  h1: { fontSize:'clamp(32px,5vw,56px)', fontWeight:900, lineHeight:1.1,
        background:'linear-gradient(135deg,#38bdf8,#818cf8)', WebkitBackgroundClip:'text',
        WebkitTextFillColor:'transparent', marginBottom:16 },
  sub: { color:'#94a3b8', fontSize:18, lineHeight:1.6, marginBottom:36 },
  btnRow: { display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' },
  btn: { padding:'13px 28px', borderRadius:10, fontWeight:700, fontSize:15,
         textDecoration:'none', transition:'opacity 0.15s' },
  stats: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',
           gap:16, maxWidth:700, margin:'48px auto', padding:'0 24px' },
  stat: { background:'#1e293b', border:'1px solid #334155', borderRadius:12,
          padding:'20px 16px', textAlign:'center' },
  statN: { fontSize:28, fontWeight:800, color:'#38bdf8' },
  statL: { fontSize:12, color:'#64748b', marginTop:4, textTransform:'uppercase', letterSpacing:'0.5px' },
  patterns: { maxWidth:900, margin:'0 auto 60px', padding:'0 24px' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 },
  pCard: { background:'#1e293b', border:'1px solid #334155', borderRadius:10,
           padding:'14px 16px', fontSize:13 },
  pTitle: { color:'#f1f5f9', fontWeight:700, marginBottom:4 },
  pDesc: { color:'#64748b', lineHeight:1.5 },
};

const PATTERNS = [
  { name:'Singleton',    desc:'GlobalConfig — one system-wide settings instance' },
  { name:'Factory',      desc:'ProductFactory — creates Physical, Digital, Service products' },
  { name:'Abstract Factory', desc:'Regional kits — US/EU/UK labels & plugs' },
  { name:'Builder',      desc:'OrderBuilder — step-by-step order assembly' },
  { name:'Prototype',    desc:'Template registry — clone products instantly' },
  { name:'Object Pool',  desc:'DB connection pool — reuse limited connections' },
  { name:'Adapter',      desc:'XML Tax + DatabaseAdapter wrapping sql.js' },
  { name:'Bridge',       desc:'PaymentMethod × BankProvider — mix any combination' },
  { name:'Composite',    desc:'Recursive Box packaging — boxes within boxes' },
  { name:'Decorator',    desc:'Express / Fragile / Insurance fee wrappers' },
  { name:'Flyweight',    desc:'Shared ProductIcon objects across thousands of renders' },
  { name:'Proxy',        desc:'AdminDashboard — role-based auth layer' },
  { name:'Chain of Resp',desc:'Order approval — Manager → Director → CEO' },
  { name:'Command',      desc:'PlaceOrder / CancelOrder with full undo stack' },
  { name:'Interpreter',  desc:'Search query parser — price < 100 AND category == digital' },
  { name:'Iterator',     desc:'Inventory — custom filter iterator without exposing array' },
  { name:'Mediator',     desc:'ControlTower — Warehouse ↔ Courier ↔ Customer' },
  { name:'Memento',      desc:'Cart snapshots — save & restore cart state' },
  { name:'Observer',     desc:'Back-in-stock emails via RealEmailObserver' },
  { name:'Strategy',     desc:'Flat / Percentage / BOGO discount algorithms' },
  { name:'Template Method', desc:'ShippingProcess — fixed pipeline, variable cost step' },
  { name:'Visitor',      desc:'Tax / Shipping / Revenue reports without touching Order' },
  { name:'Null Object',  desc:'GuestUser — no null checks anywhere in the code' },
];

export default function Home() {
  const { user }          = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/').then(d => setStats(d)).catch(() => {});
  }, []);

  return (
    <div>
      <div style={S.hero}>
        <span style={S.badge}>⚡ All 23 GoF Design Patterns · SOLID Principles</span>
        <h1 style={S.h1}>Omni-Market<br />Global Engine</h1>
        <p style={S.sub}>
          A full-stack e-commerce platform demonstrating every Gang of Four design pattern,
          real Stripe payments, JWT authentication, and SQLite persistence.
        </p>
        <div style={S.btnRow}>
          <Link to="/products" style={{ ...S.btn, background:'#3b82f6', color:'#fff' }}>
            Browse Products →
          </Link>
          {!user && (
            <Link to="/register" style={{ ...S.btn, background:'#1e293b', color:'#94a3b8', border:'1px solid #334155' }}>
              Create Account
            </Link>
          )}
        </div>
      </div>

      {stats && (
        <div style={S.stats}>
          {[
            { n: stats.patterns,          l: 'Design Patterns' },
            { n: '5',                     l: 'SOLID Principles' },
            { n: stats.integrations ? Object.keys(stats.integrations).length : 4, l: 'Integrations' },
            { n: stats.endpoints?.length ?? 28, l: 'API Endpoints' },
          ].map(({ n, l }) => (
            <div key={l} style={S.stat}>
              <div style={S.statN}>{n}</div>
              <div style={S.statL}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={S.patterns}>
        <h2 style={{ textAlign:'center', color:'#f1f5f9', marginBottom:24, fontSize:22, fontWeight:700 }}>
          All 23 Patterns — Live in This App
        </h2>
        <div style={S.grid}>
          {PATTERNS.map(p => (
            <div key={p.name} style={S.pCard}>
              <div style={S.pTitle}>{p.name}</div>
              <div style={S.pDesc}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}