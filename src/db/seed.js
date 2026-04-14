'use strict';

/**
 * seed.js — run once to populate test data
 * Usage: node src/db/seed.js
 */

const { DatabaseAdapter }   = require('./DatabaseAdapter');
const { ProductRepository } = require('../repositories/ProductRepository');
const { OrderRepository }   = require('../repositories/OrderRepository');
const { UserRepository }    = require('../repositories/UserRepository');
const { ProductFactory, OrderBuilder, RegisteredUser } = require('../patterns/omni-market');

async function seed() {
  await DatabaseAdapter.init();
  const db = new DatabaseAdapter();
  db.connect();

  const productRepo = new ProductRepository(db);
  const orderRepo   = new OrderRepository(db);
  const userRepo    = new UserRepository(db);

  console.log('\n🌱  Seeding Omni-Market database...\n');

  const products = [
    ProductFactory.createProduct('physical', 'Laptop Pro',           1200,  2.5),
    ProductFactory.createProduct('physical', 'OmniPhone X',           999,  0.18),
    ProductFactory.createProduct('physical', 'Wireless Mouse',         35,  0.2),
    ProductFactory.createProduct('physical', 'Mechanical Keyboard',    89,  0.9),
    ProductFactory.createProduct('digital',  'JS Design Patterns',   29.99, 'https://dl.omnimarket.io/jsdp'),
    ProductFactory.createProduct('digital',  'Node.js Masterclass',  49.99, 'https://dl.omnimarket.io/node'),
    ProductFactory.createProduct('service',  '24h Tech Support',     49.99, 24),
    ProductFactory.createProduct('service',  'Setup & Installation', 79.99,  2),
  ];
  productRepo.saveAll(products);
  console.log(`  ✔  ${products.length} products seeded`);

  const users = [
    new RegisteredUser('Bilal Ahmed', 250, 'superadmin', 'bilal@omni.pk'),
    new RegisteredUser('Sara Khan',    40, 'admin',      'sara@omni.pk'),
    new RegisteredUser('Ali Raza',    110, 'customer',   'ali@omni.pk'),
  ];
  users.forEach(u => userRepo.save(u));
  console.log(`  ✔  ${users.length} users seeded`);

  const [laptop, phone, mouse] = products;
  const order = new OrderBuilder()
    .addItem(laptop, 1).addItem(mouse, 2)
    .addDiscount(50)
    .setAddress('42 Quaid Ave, Islamabad, PK')
    .setPaymentMethod('Credit Card')
    .build();
  order.status = 'placed';
  orderRepo.save(order);
  console.log(`  ✔  1 order seeded`);

  console.log('\n📊  Summary:');
  console.log(`     Products : ${productRepo.count()}`);
  console.log(`     Users    : ${userRepo.count()}`);
  console.log(`     Orders   : ${orderRepo.count()}`);

  db.disconnect();
  console.log('\n✅  Done.\n');
}

seed().catch(e => { console.error(e); process.exit(1); });