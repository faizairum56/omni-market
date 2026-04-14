'use strict';
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const { DatabaseAdapter }    = require('./db/DatabaseAdapter');
const { ProductRepository }  = require('./repositories/ProductRepository');
const { OrderRepository, PersistentOrderService } = require('./repositories/OrderRepository');
const { UserRepository, CartSnapshotRepository }  = require('./repositories/UserRepository');

const { router: productsRouter, seedTemplates } = require('./api/routes/products');
const ordersRouter   = require('./api/routes/orders');
const paymentRouter  = require('./api/routes/payment');
const usersRouter    = require('./api/routes/users');
const authRouter     = require('./api/routes/auth');
const shippingRouter = require('./api/routes/shipping');

const { errorHandler, notFound } = require('./api/middleware/errorHandler');
const { attachIdentity }         = require('./api/middleware/auth');

const PORT = process.env.PORT || 3000;

async function startServer() {
  await DatabaseAdapter.init();
  const db = new DatabaseAdapter(process.env.DB_PATH || undefined);
  db.connect();

  const productRepo        = new ProductRepository(db);
  const orderRepo          = new OrderRepository(db);
  const userRepo           = new UserRepository(db);
  const cartRepo           = new CartSnapshotRepository(db);
  const persistentOrderSvc = new PersistentOrderService(orderRepo);

  seedTemplates(productRepo);

  const app = express();

  // CORS — allow React dev server (port 5173) to call the API
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }));
  app.use(express.json());

  app.locals.productRepo        = productRepo;
  app.locals.orderRepo          = orderRepo;
  app.locals.userRepo           = userRepo;
  app.locals.cartRepo           = cartRepo;
  app.locals.persistentOrderSvc = persistentOrderSvc;
  app.locals.db                 = db;

  app.use(attachIdentity);

  // ── API routes ───────────────────────────────────────────────
  app.use('/api/auth',     authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders',   ordersRouter);
  app.use('/api/payment',  paymentRouter);
  app.use('/api/shipping', shippingRouter);
  app.use('/api/users',    usersRouter);

  // Health / info endpoint
  app.get('/api/health', (req, res) => res.json({
    name:'Omni-Market Global Engine', version:'4.0.0',
    patterns:23, status:'ok',
    integrations:{
      stripe  : process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'TEST MODE' : 'simulation',
      shippo  : process.env.SHIPPO_API_KEY && !process.env.SHIPPO_API_KEY.includes('your_key') ? 'LIVE' : 'simulation',
      email   : process.env.MAIL_USER && !process.env.MAIL_USER.includes('your_email') ? 'LIVE' : 'simulation',
      jwt     : 'ACTIVE',
    },
    endpoints:[
      'POST /auth/register', 'POST /auth/login', 'GET /auth/me',
      'GET /products', 'POST /products', 'GET /products/search',
      'GET /orders', 'POST /orders', 'POST /orders/undo',
      'GET /orders/:id/approve', 'POST /orders/:id/shipping',
      'POST /orders/:id/ship', 'GET /orders/:id/report',
      'POST /payment', 'POST /payment/refund',
      'GET /shipping/rates', 'POST /shipping/:id/quote',
      'GET /users', 'GET /users/:id/discount',
      'POST /users/:id/cart/save', 'GET /users/:id/cart',
      'POST /users/:id/subscribe',
    ],
  }));

  // ── Serve React build in production ─────────────────────────
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // Any non-API route serves index.html (client-side routing)
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   OMNI-MARKET  —  Level 4 (Full-Stack)                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`  ✔  API Server  →  http://localhost:${PORT}`);
    console.log(`  ✔  Database    →  ${db.filePath}`);
    console.log(`  ✔  Products    →  ${productRepo.count()}`);
    console.log(`  ✔  Stripe      →  ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'TEST MODE ✔' : 'simulation'}`);
    console.log('');
    if (fs.existsSync(publicDir)) {
      console.log(`  ✔  React UI    →  http://localhost:${PORT}  (built)`);
    } else {
      console.log(`  ℹ  React UI    →  Run "npm run dev:client" in /client`);
      console.log(`                    then open http://localhost:5173`);
    }
    console.log('');
  });

  process.on('SIGINT', () => { db.disconnect(); process.exit(0); });
}

startServer().catch(err => { console.error(err); process.exit(1); });