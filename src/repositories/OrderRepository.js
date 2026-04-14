'use strict';

/**
 * OrderRepository.js
 * ------------------
 * PATTERN : Replaces the in-memory OrderService Map from the original
 *           omni-market.js with real SQLite persistence.
 *           The COMMAND pattern (PlaceOrderCommand / CancelOrderCommand)
 *           now calls this repository instead of the Map — zero changes
 *           to the Command classes themselves (OCP preserved).
 *
 * SOLID
 *   SRP : Sole responsibility — persist and retrieve Order + OrderItem
 *         rows.  Discount calculation, shipping, tax — all elsewhere.
 *   DIP : Depends on DatabaseAdapter, not on better-sqlite3.
 *   LSP : PersistentOrderService (below) satisfies the same interface
 *         as the original in-memory OrderService; commands work with
 *         either interchangeably.
 */

class OrderRepository {
  /**
   * @param {import('../db/DatabaseAdapter').DatabaseAdapter} db
   */
  constructor(db) {
    this._db = db;
  }

  // ── Write ───────────────────────────────────────────────────────

  /**
   * Persist a fully-built Order object (from OrderBuilder).
   * Writes the order header + all line items in one transaction.
   */
  save(order) {
    this._db.transaction(() => {
      // 1. Upsert the order header
      this._db.run(
        `INSERT OR REPLACE INTO orders
           (id, address, payment_method, notes, status,
            subtotal, discount_total, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.address,
          order.paymentMethod ?? null,
          order.notes         ?? '',
          order.status        ?? 'placed',
          order.getSubtotal(),
          order.getDiscountTotal(),
          order.getTotal(),
        ]
      );

      // 2. Replace line items (delete old, insert new)
      this._db.run('DELETE FROM order_items WHERE order_id = ?', [order.id]);
      for (const { product, qty } of order.items) {
        this._db.run(
          `INSERT INTO order_items (order_id, product_id, qty, unit_price)
           VALUES (?, ?, ?, ?)`,
          [order.id, product.id, qty, product.price]
        );
      }
    });
    return order;
  }

  /** Update only the status column. */
  updateStatus(orderId, status) {
    const info = this._db.run(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );
    return info.changes > 0;
  }

  // ── Read ────────────────────────────────────────────────────────

  /** Fetch order header row by primary key. */
  findById(id) {
    return this._db.get('SELECT * FROM orders WHERE id = ?', [id]);
  }

  /** Fetch all order headers. */
  findAll() {
    return this._db.all('SELECT * FROM orders ORDER BY created_at DESC');
  }

  /** Fetch orders with a specific status. */
  findByStatus(status) {
    return this._db.all(
      'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
  }

  /** Fetch all line items for one order. */
  getItems(orderId) {
    return this._db.all(
      `SELECT oi.*, p.name AS product_name, p.type AS product_type
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );
  }

  /** Total revenue across all placed/delivered orders. */
  totalRevenue() {
    const row = this._db.get(
      `SELECT COALESCE(SUM(total),0) AS revenue
       FROM orders WHERE status IN ('placed','shipped','delivered')`
    );
    return row.revenue;
  }

  count() {
    const row = this._db.get('SELECT COUNT(*) AS n FROM orders');
    return row.n;
  }
}

// ══════════════════════════════════════════════════════════════════
//  PersistentOrderService
//  ──────────────────────
//  Drop-in replacement for the original in-memory OrderService.
//  PlaceOrderCommand and CancelOrderCommand accept either one —
//  LSP / DIP in action.
// ══════════════════════════════════════════════════════════════════
class PersistentOrderService {
  /**
   * @param {OrderRepository} repo
   */
  constructor(repo) {
    this._repo = repo;
  }

  placeOrder(order) {
    order.status = 'placed';
    this._repo.save(order);
    return `  ▶ Placed & persisted  ${order.id}`;
  }

  cancelOrder(order) {
    this._repo.updateStatus(order.id, 'cancelled');
    return `  ▶ Cancelled & persisted ${order.id}`;
  }

  /** Returns all placed order ids (mirrors original API). */
  getOrders() {
    return this._repo.findByStatus('placed').map(r => r.id);
  }
}

module.exports = { OrderRepository, PersistentOrderService };