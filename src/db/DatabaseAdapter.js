'use strict';

/**
 * DatabaseAdapter.js
 * ------------------
 * PATTERN : ADAPTER
 * WHY HERE : better-sqlite3 exposes a raw, driver-specific API
 *            (db.prepare(sql).run(...), db.prepare(sql).all(), etc.).
 *            The rest of the application should never depend on that
 *            concrete API — if we swap to PostgreSQL tomorrow only
 *            this file changes.
 *            The adapter translates our simple { run, get, all, exec }
 *            interface into whatever the underlying driver needs.
 *
 * SOLID
 *   SRP : Only responsibility is translating between our interface and
 *         the driver.  Schema creation, pooling, and business logic
 *         are all elsewhere.
 *   DIP : Repositories depend on DatabaseAdapter (abstraction), never
 *         on better-sqlite3 directly.
 *   OCP : To swap drivers, extend this adapter or create a new one —
 *         no repository or service code changes.
 */

const initSqlJs    = require('sql.js');
const fs           = require('fs');
const path         = require('path');
const { SCHEMA_SQL } = require('./schema');

class DatabaseAdapter {
  /**
   * @param {string} dbPath  Filesystem path for the SQLite file,
   *                         defaults to project-root/omni-market.db
   */
  constructor(dbPath) {
    this._path = dbPath || path.resolve(__dirname, '../../omni-market.db');
    this._db   = null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /**
   * Open / create the SQLite database and apply schema.
   * sql.js is synchronous but initialises via a Promise once —
   * we handle that with a static cache so callers can stay sync.
   */
  connect() {
    if (this._db) return this;

    // Load existing file if present, otherwise start fresh
    let fileBuffer = null;
    if (fs.existsSync(this._path)) {
      fileBuffer = fs.readFileSync(this._path);
    }

    // sql.js SQL class must be initialised synchronously via the
    // cached constructor (we call connectAsync() first in run()).
    if (!DatabaseAdapter._SQL) {
      throw new Error('Call await DatabaseAdapter.init() before connect().');
    }

    this._db = fileBuffer
      ? new DatabaseAdapter._SQL.Database(fileBuffer)
      : new DatabaseAdapter._SQL.Database();

    this._applySchema();
    console.log(`  [DB] Connected → ${this._path}`);
    return this;
  }

  /** Must be awaited once at startup to load the sql.js WASM. */
  static async init() {
    if (!DatabaseAdapter._SQL) {
      DatabaseAdapter._SQL = await initSqlJs();
    }
  }

  /** Flush in-memory DB to disk and close. */
  disconnect() {
    if (this._db) {
      this._persist();
      this._db.close();
      this._db = null;
      console.log('  [DB] Disconnected & saved.');
    }
  }

  /** Write the in-memory DB to disk. */
  _persist() {
    const data = this._db.export();
    fs.writeFileSync(this._path, Buffer.from(data));
  }

  _applySchema() {
    // sql.js exec() runs multiple statements at once (same as better-sqlite3)
    this._db.exec(SCHEMA_SQL);
  }

  // ── Public Interface (same surface as before) ───────────────────

  /**
   * run(sql, params) — INSERT / UPDATE / DELETE
   * Returns { changes, lastInsertRowid }
   */
  run(sql, params = []) {
    this._ensureConnected();
    this._db.run(sql, this._flatten(params));
    const changes = this._db.exec('SELECT changes() AS c')[0]?.values[0][0] ?? 0;
    const rowid   = this._db.exec('SELECT last_insert_rowid() AS r')[0]?.values[0][0] ?? null;
    // Only persist immediately when NOT inside a transaction
    // (transactions call _persist once after COMMIT)
    if (!this._inTransaction) this._persist();
    return { changes, lastInsertRowid: rowid };
  }

  /**
   * get(sql, params) — Fetch first row or undefined
   */
  get(sql, params = []) {
    this._ensureConnected();
    const result = this._db.exec(sql, this._flatten(params));
    if (!result.length || !result[0].values.length) return undefined;
    return this._rowToObject(result[0].columns, result[0].values[0]);
  }

  /**
   * all(sql, params) — Fetch all rows
   */
  all(sql, params = []) {
    this._ensureConnected();
    const result = this._db.exec(sql, this._flatten(params));
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => this._rowToObject(columns, row));
  }

  /**
   * exec(sql) — Raw multi-statement SQL (schema, migrations)
   */
  exec(sql) {
    this._ensureConnected();
    this._db.exec(sql);
    this._persist();
  }

  /**
   * transaction(fn) — Atomic block
   */
  transaction(fn) {
    this._ensureConnected();
    this._inTransaction = this._inTransaction || false;

    // sql.js does not support nested transactions — skip BEGIN/COMMIT
    // if we are already inside one (e.g. saveAll calling save repeatedly)
    if (this._inTransaction) {
      return fn(this);
    }

    this._inTransaction = true;
    this._db.run('BEGIN');
    try {
      const result = fn(this);
      this._db.run('COMMIT');
      this._persist();
      this._inTransaction = false;
      return result;
    } catch (e) {
      try { this._db.run('ROLLBACK'); } catch (_) { /* already rolled back */ }
      this._inTransaction = false;
      throw e;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _ensureConnected() {
    if (!this._db)
      throw new Error('[DatabaseAdapter] Not connected. Call connect() first.');
  }

  _flatten(params) {
    return Array.isArray(params) ? params : [params];
  }

  /** Convert parallel columns/values arrays → plain object. */
  _rowToObject(columns, values) {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = values[i]; });
    return obj;
  }

  get isConnected() { return !!this._db; }
  get filePath()    { return this._path; }
}

module.exports = { DatabaseAdapter };