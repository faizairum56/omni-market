import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const S = {
  wrap:  { minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24 },
  card:  { background:'#1e293b', border:'1px solid #334155', borderRadius:16, padding:36,
           width:'100%', maxWidth:420 },
  logo:  { textAlign:'center', fontSize:32, marginBottom:8 },
  h2:    { textAlign:'center', color:'#f1f5f9', fontSize:22, fontWeight:800, marginBottom:4 },
  sub:   { textAlign:'center', color:'#64748b', fontSize:14, marginBottom:28 },
  label: { display:'block', color:'#94a3b8', fontSize:13, fontWeight:600, marginBottom:6 },
  input: { width:'100%', background:'#0f172a', border:'1px solid #334155', color:'#f1f5f9',
           borderRadius:8, padding:'11px 14px', fontSize:15, outline:'none',
           marginBottom:16, boxSizing:'border-box' },
  btn:   { width:'100%', background:'#3b82f6', color:'#fff', border:'none',
           borderRadius:10, padding:'13px 0', fontSize:15, fontWeight:700,
           cursor:'pointer', marginTop:4 },
  error: { background:'#450a0a', border:'1px solid #ef4444', color:'#fca5a5',
           borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:16 },
  link:  { textAlign:'center', marginTop:20, color:'#64748b', fontSize:14 },
  a:     { color:'#38bdf8', textDecoration:'none', fontWeight:600 },
};

export function Login() {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const navigate              = useNavigate();
  const [params]              = useSearchParams();

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate(params.get('next') || '/products');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>⚡</div>
        <h2 style={S.h2}>Welcome back</h2>
        <p style={S.sub}>Sign in to your Omni-Market account</p>
        {error && <div style={S.error}>⚠ {error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email}
            placeholder="you@example.com" onChange={e=>setEmail(e.target.value)} required />
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={password}
            placeholder="••••••••" onChange={e=>setPass(e.target.value)} required />
          <button style={{ ...S.btn, opacity:loading?0.6:1 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div style={S.link}>
          Don't have an account? <Link to="/register" style={S.a}>Register</Link>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { register }          = useAuth();
  const navigate              = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await register(name, email, password);
      navigate('/products');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>⚡</div>
        <h2 style={S.h2}>Create account</h2>
        <p style={S.sub}>Join Omni-Market — it's free</p>
        {error && <div style={S.error}>⚠ {error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Full name</label>
          <input style={S.input} value={name}
            placeholder="Enter Full Name" onChange={e=>setName(e.target.value)} required />
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" value={email}
            placeholder="you@example.com" onChange={e=>setEmail(e.target.value)} required />
          <label style={S.label}>Password (min 8 chars)</label>
          <input style={S.input} type="password" value={password}
            placeholder="••••••••" onChange={e=>setPass(e.target.value)} required minLength={8} />
          <button style={{ ...S.btn, background:'#10b981', opacity:loading?0.6:1 }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div style={S.link}>
          Already have an account? <Link to="/login" style={S.a}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}