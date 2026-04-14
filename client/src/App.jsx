import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar      from './components/Navbar.jsx';
import Home        from './pages/Home.jsx';
import Products    from './pages/Products.jsx';
import Cart        from './pages/Cart.jsx';
import Checkout    from './pages/Checkout.jsx';
import Orders      from './pages/Orders.jsx';
import Admin       from './pages/Admin.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { useAuth } from './context/AuthContext.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div style={{ minHeight:'100vh', background:'#0f172a' }}>
      <Navbar />
      <Routes>
        <Route path="/"         element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/cart"     element={<Cart />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/admin"    element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}