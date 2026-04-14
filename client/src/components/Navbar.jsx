import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const S = {
  nav: { background:'#1e293b', borderBottom:'1px solid #334155', padding:'0 24px',
         display:'flex', alignItems:'center', justifyContent:'space-between', height:60, position:'sticky', top:0, zIndex:100 },
  logo: { color:'#38bdf8', fontWeight:700, fontSize:20, textDecoration:'none', letterSpacing:'-0.5px' },
  links: { display:'flex', alignItems:'center', gap:8 },
  link: { color:'#94a3b8', textDecoration:'none', padding:'6px 14px', borderRadius:8,
          fontSize:14, fontWeight:500, transition:'all 0.15s' },
  activeLink: { color:'#f1f5f9', background:'#334155' },
  cartBtn: { position:'relative', background:'#3b82f6', color:'#fff', border:'none',
             padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:14,
             fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:6 },
  badge: { background:'#ef4444', color:'#fff', borderRadius:'50%', width:18, height:18,
           fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' },
  userChip: { background:'#0f172a', border:'1px solid #334155', borderRadius:8,
              padding:'5px 12px', fontSize:13, color:'#94a3b8', display:'flex', alignItems:'center', gap:8 },
  logoutBtn: { background:'transparent', border:'none', color:'#ef4444', cursor:'pointer',
               fontSize:13, fontWeight:600, padding:'2px 6px' },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount }    = useCart();
  const navigate         = useNavigate();
  const { pathname }     = useLocation();

  function navLink(to, label) {
    const active = pathname === to || pathname.startsWith(to + '/');
    return <Link to={to} style={{ ...S.link, ...(active ? S.activeLink : {}) }}>{label}</Link>;
  }

  return (
    <nav style={S.nav}>
      <Link to="/" style={S.logo}>⚡ Omni-Market</Link>

      <div style={S.links}>
        {navLink('/products', 'Products')}
        {user && navLink('/orders', 'My Orders')}
        {user?.role === 'admin' || user?.role === 'superadmin'
          ? navLink('/admin', 'Admin') : null}
      </div>

      <div style={S.links}>
        {user ? (
          <>
            <div style={S.userChip}>
              👤 {user.name}
              <span style={{ color:'#475569' }}>|</span>
              <button style={S.logoutBtn} onClick={() => { logout(); navigate('/'); }}>
                Logout
              </button>
            </div>
            <Link to="/cart" style={S.cartBtn}>
              🛒 Cart
              {itemCount > 0 && <span style={S.badge}>{itemCount}</span>}
            </Link>
          </>
        ) : (
          <>
            <Link to="/login"    style={S.link}>Login</Link>
            <Link to="/register" style={{ ...S.cartBtn, background:'#10b981' }}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}