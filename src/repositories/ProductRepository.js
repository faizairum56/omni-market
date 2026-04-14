'use strict';

/**
 * ProductRepository.js
 * --------------------
 * PATTERN : REPOSITORY  (not a GoF pattern, but standard DDD)
 *           Uses ADAPTER  (DatabaseAdapter) for storage.
 *           Uses PROTOTYPE (product.clone()) for template seeding.
 *           Uses FACTORY METHOD result objects as the entities it saves.
 *
 * SOLID
 *   SRP : Only concerns — persist and retrieve Product entities.
 *         No business logic, no shipping calculations, no pricing.
 *   DIP : Depends on DatabaseAdapter abstraction, not on
 *         better-sqlite3 directly.
 *   OCP : New product types (BundleProduct) only need a new row in
 *         the `type` CHECK constraint — no repository code changes.
 */

class ProductRepository {
  /**
   * @param {import('../db/DatabaseAdapter').DatabaseAdapter} db
   */
  constructor(db) {
    this._db = db;
  }

  // ── Write ───────────────────────────────────────────────────────

  /**
   * Persist a Product instance (any subclass).
   * Idempotent: uses INSERT OR REPLACE so clones & re-saves work fine.
   */
  save(product) {
    this._db.run(
      `INSERT OR REPLACE INTO products
         (id, name, price, type, weight, download_url, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id,
        product.name,
        product.price,
        product.type,
        product.weight        ?? null,
        product.downloadUrl   ?? null,
        product.duration      ?? null,
      ]
    );
    return product;
  }

  /** Persist an array of products in a single transaction. */
  saveAll(products) {
    this._db.transaction(db => {
      products.forEach(p => this.save(p));
    });
    return products;
  }

  /** Hard-delete a product by id. */
  delete(id) {
    const info = this._db.run('DELETE FROM products WHERE id = ?', [id]);
    return info.changes > 0;
  }

  // ── Read ────────────────────────────────────────────────────────

  /** Load one product by primary key. Returns plain row object. */
  findById(id) {
    return this._db.get('SELECT * FROM products WHERE id = ?', [id]);
  }

  /** Load all products. */
  findAll() {
    return this._db.all('SELECT * FROM products ORDER BY created_at DESC');
  }

  /** Load products filtered by type ('physical'|'digital'|'service'). */
  findByType(type) {
    return this._db.all(
      'SELECT * FROM products WHERE type = ? ORDER BY name',
      [type]
    );
  }

  /** Simple search by name substring (case-insensitive). */
  search(keyword) {
    return this._db.all(
      `SELECT * FROM products WHERE name LIKE ? ORDER BY name`,
      [`%${keyword}%`]
    );
  }

  /** Products whose price falls within [min, max]. */
  findByPriceRange(min, max) {
    return this._db.all(
      'SELECT * FROM products WHERE price BETWEEN ? AND ? ORDER BY price',
      [min, max]
    );
  }

  /** Total count of stored products. */
  count() {
    const row = this._db.get('SELECT COUNT(*) AS n FROM products');
    return row.n;
  }
}

module.exports = { ProductRepository };