'use strict';

/**
 * seed.js
 * Populates the database with starter data.
 * Safe to call on every startup — skips if data already exists.
 */

const { DatabaseAdapter }   = require('./DatabaseAdapter');
const { ProductRepository } = require('../repositories/ProductRepository');
const { OrderRepository }   = require('../repositories/OrderRepository');
const { UserRepository }    = require('../repositories/UserRepository');
const { ProductFactory, OrderBuilder, RegisteredUser } = require('../patterns/omni-market');
const bcrypt = require('bcryptjs');

async function seed(db) {
  const productRepo = new ProductRepository(db);
  const orderRepo   = new OrderRepository(db);
  const userRepo    = new UserRepository(db);

  // ── Skip if already seeded ────────────────────────────────────
  if (productRepo.count() > 0) {
    console.log('  [Seed] Database already has data — skipping.');
    return;
  }

  console.log('  [Seed] Seeding fresh database...');

  // ── Products ──────────────────────────────────────────────────
  const products = [
    ProductFactory.createProduct('physical', 'Laptop Pro',           1200,  2.5),
    ProductFactory.createProduct('physical', 'OmniPhone X',           999,  0.18),
    ProductFactory.createProduct('physical', 'Wireless Mouse',         35,  0.2),
    ProductFactory.createProduct('physical', 'Mechanical Keyboard',    89,  0.9),
    ProductFactory.createProduct('physical', 'USB-C Hub',              45,  0.15),
    ProductFactory.createProduct('digital',  'JS Design Patterns',   29.99, 'https://dl.omnimarket.io/jsdp'),
    ProductFactory.createProduct('digital',  'Node.js Masterclass',  49.99, 'https://dl.omnimarket.io/node'),
    ProductFactory.createProduct('digital',  'Cloud Architecture',   79.99, 'https://dl.omnimarket.io/cloud'),
    ProductFactory.createProduct('service',  '24h Tech Support',     49.99, 24),
    ProductFactory.createProduct('service',  'Setup & Installation', 79.99,  2),
  ];
  productRepo.saveAll(products);
  console.log(`  [Seed] ✔ ${products.length} products`);

  // ── Admin user (bcrypt hashed password) ───────────────────────
  const adminHash = await bcrypt.hash('admin123', 12);
  db.run(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role, loyalty_points, is_guest)
     VALUES (?, ?, ?, ?, ?, 0)`,
    ['Admin User', 'faizairum56@gmail.com', adminHash, 'superadmin', 500]
  );

  // ── Regular demo user ─────────────────────────────────────────
  const userHash = await bcrypt.hash('demo1234', 12);
  db.run(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role, loyalty_points, is_guest)
     VALUES (?, ?, ?, ?, ?, 0)`,
    ['Demo User', 'demo@omnimarket.com', userHash, 'customer', 50]
  );
  console.log('  [Seed] ✔ 2 users (admin@omnimarket.com / admin123)');

  console.log('  [Seed] ✔ Done!');
}

// ── Standalone mode: node src/db/seed.js ─────────────────────────
if (require.main === module) {
  (async () => {
    await DatabaseAdapter.init();
    const db = new DatabaseAdapter();
    db.connect();
    await seed(db);
    db.disconnect();
  })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { seed };