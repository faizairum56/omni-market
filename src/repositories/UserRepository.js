'use strict';

class UserRepository {
  constructor(db) { this._db = db; }

  save(user) {
    if (user.isGuest()) return user;
    this._db.run(
      `INSERT OR IGNORE INTO users (name, email, role, loyalty_points, is_guest)
       VALUES (?, ?, ?, ?, 0)`,
      [user.getName(), user.email ?? `${user.getName().toLowerCase()}@omni.market`,
       user.role ?? 'customer', user.getLoyaltyPoints()]
    );
    return user;
  }

  createWithHash({ name, email, role = 'customer', hash }) {
    const info = this._db.run(
      `INSERT INTO users (name, email, password_hash, role, loyalty_points, is_guest)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [name, email, hash, role]
    );
    return info.lastInsertRowid;
  }

  updatePasswordHash(userId, hash) {
    this._db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
  }

  addLoyaltyPoints(userId, points) {
    this._db.run('UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?', [points, userId]);
  }

  findById(id)       { return this._db.get('SELECT * FROM users WHERE id = ?',   [id]);    }
  findByEmail(email) { return this._db.get('SELECT * FROM users WHERE email = ?', [email]); }
  findAll()          { return this._db.all('SELECT * FROM users ORDER BY name');            }
  findByRole(role)   { return this._db.all('SELECT * FROM users WHERE role = ? ORDER BY name', [role]); }
  count() {
    const row = this._db.get('SELECT COUNT(*) AS n FROM users WHERE is_guest = 0');
    return row ? row.n : 0;
  }
}

class CartSnapshotRepository {
  constructor(db) { this._db = db; }
  save(userId, memento) {
    this._db.run(
      `INSERT INTO cart_snapshots (user_id, items_json, coupon) VALUES (?, ?, ?)`,
      [userId, JSON.stringify(memento.items), memento.coupon ?? null]
    );
  }
  loadLatest(userId) {
    return this._db.get(
      `SELECT * FROM cart_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
  }
  loadHistory(userId) {
    return this._db.all(`SELECT * FROM cart_snapshots WHERE user_id = ? ORDER BY id ASC`, [userId]);
  }
  clearHistory(userId) {
    this._db.run('DELETE FROM cart_snapshots WHERE user_id = ?', [userId]);
  }
}

module.exports = { UserRepository, CartSnapshotRepository };