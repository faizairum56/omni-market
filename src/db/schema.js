'use strict';

const SCHEMA_SQL = `

  CREATE TABLE IF NOT EXISTS products (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    price        REAL NOT NULL CHECK(price >= 0),
    type         TEXT NOT NULL CHECK(type IN ('physical','digital','service')),
    weight       REAL,
    download_url TEXT,
    duration     REAL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    email          TEXT    NOT NULL UNIQUE,
    password_hash  TEXT,
    role           TEXT    NOT NULL DEFAULT 'customer'
                                   CHECK(role IN ('customer','viewer','admin','superadmin')),
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    is_guest       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             TEXT    PRIMARY KEY,
    user_id        INTEGER REFERENCES users(id),
    address        TEXT    NOT NULL,
    payment_method TEXT,
    payment_intent TEXT,
    notes          TEXT    DEFAULT '',
    status         TEXT    NOT NULL DEFAULT 'pending'
                                   CHECK(status IN ('pending','placed','cancelled','shipped','delivered')),
    subtotal       REAL    NOT NULL DEFAULT 0,
    discount_total REAL    NOT NULL DEFAULT 0,
    total          REAL    NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT    NOT NULL REFERENCES products(id),
    qty        INTEGER NOT NULL DEFAULT 1 CHECK(qty > 0),
    unit_price REAL    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_snapshots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    items_json TEXT    NOT NULL,
    coupon     TEXT,
    saved_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stock_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   TEXT    NOT NULL,
    in_stock     INTEGER NOT NULL,
    triggered_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shipping_quotes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    TEXT    NOT NULL,
    provider    TEXT    NOT NULL,
    service     TEXT    NOT NULL,
    amount      REAL    NOT NULL,
    currency    TEXT    NOT NULL DEFAULT 'USD',
    est_days    INTEGER,
    raw_json    TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

`;

module.exports = { SCHEMA_SQL };