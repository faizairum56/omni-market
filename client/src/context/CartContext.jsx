import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * CartContext
 * -----------
 * PATTERN: MEMENTO — cart history array lets us undo the last action,
 *          mirroring the backend CartHistory + CartMemento classes.
 *
 * The cart lives in React state (fast, instant UI updates).
 * Users can optionally save it to the DB via /users/:id/cart/save.
 */

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items,   setItems]   = useState([]);   // { product, qty }
  const [history, setHistory] = useState([]);   // undo stack (Memento)

  // ── Snapshot helpers (Memento) ────────────────────────────────
  function _snapshot(current) {
    setHistory(h => [...h, JSON.parse(JSON.stringify(current))]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setItems(prev);
  }

  // ── Cart operations ───────────────────────────────────────────
  function addItem(product) {
    _snapshot(items);
    setItems(prev => {
      const exists = prev.find(i => i.product.id === product.id);
      if (exists) {
        return prev.map(i =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function removeItem(productId) {
    _snapshot(items);
    setItems(prev => prev.filter(i => i.product.id !== productId));
  }

  function updateQty(productId, qty) {
    if (qty < 1) { removeItem(productId); return; }
    _snapshot(items);
    setItems(prev =>
      prev.map(i => i.product.id === productId ? { ...i, qty } : i)
    );
  }

  function clearCart() {
    _snapshot(items);
    setItems([]);
  }

  // ── Derived values ────────────────────────────────────────────
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const subtotal  = items.reduce((s, i) => s + i.product.price * i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, itemCount, subtotal,
      addItem, removeItem, updateQty, clearCart,
      undo, canUndo: history.length > 0,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}