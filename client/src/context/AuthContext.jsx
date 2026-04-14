import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client.js';

/**
 * AuthContext
 * -----------
 * PATTERN: SINGLETON-like context — one auth state for the whole app.
 * Stores the JWT in localStorage, attaches it to every API call
 * via api/client.js, and exposes login/logout/register helpers.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('omni_token');
    const saved = localStorage.getItem('omni_user');
    if (token && saved) {
      try { setUser(JSON.parse(saved)); } catch (_) {}
    }
    setLoading(false);
  }, []);

  async function register(name, email, password) {
    const res = await api.post('/auth/register', { name, email, password });
    _persist(res.data);
    return res.data;
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    _persist(res.data);
    return res.data;
  }

  function logout() {
    localStorage.removeItem('omni_token');
    localStorage.removeItem('omni_user');
    setUser(null);
  }

  function _persist(data) {
    localStorage.setItem('omni_token', data.token);
    localStorage.setItem('omni_user', JSON.stringify(data));
    setUser(data);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}