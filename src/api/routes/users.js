'use strict';

/**
 * routes/users.js  (Level 3)
 * PATTERN: NULL OBJECT  — GuestUser skips DB save automatically.
 * PATTERN: OBSERVER     — RealEmailObserver sends actual emails on restock.
 * PATTERN: MEMENTO      — Cart snapshots persisted to DB.
 * PATTERN: STRATEGY     — Discount based on loyalty tier.
 */

const express = require('express');
const router  = express.Router();

const { requireAdmin, requireCustomer, requireViewer, requireOwnerOrAdmin } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { RealEmailObserver } = require('../../integrations/MailerService');

const {
  RegisteredUser, GuestUser,
  ShoppingCart,
  StockNotifier, EmailObserver, SMSObserver, AppPushObserver,
  PercentageDiscountStrategy, NullDiscount,
} = require('../../patterns/omni-market');

// In-memory stock notifiers (shared across requests)
const stockNotifiers = new Map();
function getNotifier(productId) {
  if (!stockNotifiers.has(productId))
    stockNotifiers.set(productId, new StockNotifier(`Product#${productId}`));
  return stockNotifiers.get(productId);
}

// ── GET /users ───────────────────────────────────────────────────
router.get('/', requireViewer, (req, res, next) => {
  try {
    const rows = req.app.locals.userRepo.findAll();
    res.json({ success:true, count:rows.length, data:rows });
  } catch(e) { next(e); }
});

// ── GET /users/:id ───────────────────────────────────────────────
router.get('/:id', requireViewer, (req, res, next) => {
  try {
    const row = req.app.locals.userRepo.findById(parseInt(req.params.id));
    if (!row)  throw httpError(404, `User #${req.params.id} not found`);
    res.json({ success:true, data:row });
  } catch(e) { next(e); }
});

// ── POST /users ──────────────────────────────────────────────────
// NULL OBJECT — type="guest" returns GuestUser without DB write.
router.post('/', requireAdmin, (req, res, next) => {
  try {
    const { name, email, role='customer', loyaltyPoints=0, type='registered' } = req.body;
    if (type === 'guest') {
      const guest = new GuestUser();
      return res.status(200).json({
        success:true,
        message:'Guest user created (not persisted — Null Object pattern)',
        data:{ name:guest.getName(), loyaltyPoints:guest.getLoyaltyPoints(), isGuest:true },
      });
    }
    if (!name || !email) throw httpError(400, '`name` and `email` required');
    const user = new RegisteredUser(name, parseInt(loyaltyPoints), role, email);
    req.app.locals.userRepo.save(user);
    res.status(201).json({ success:true, message:'User created', data:{
      name:user.getName(), email:user.email, role:user.role,
      loyaltyPoints:user.getLoyaltyPoints(), isGuest:false,
    }});
  } catch(e) { next(e); }
});

// ── GET /users/:id/discount ──────────────────────────────────────
// STRATEGY — loyalty-tier discount
router.get('/:id/discount', requireCustomer, (req, res, next) => {
  try {
    const row = req.app.locals.userRepo.findById(parseInt(req.params.id));
    if (!row)  throw httpError(404, `User #${req.params.id} not found`);
    const { testPrice = 1000 } = req.query;
    const points   = row.loyalty_points;
    const pct      = points > 100 ? 15 : points > 0 ? 5 : 0;
    const strategy = pct > 0 ? new PercentageDiscountStrategy(pct) : new NullDiscount();
    const final    = strategy.calculate(parseFloat(testPrice));
    res.json({ success:true, data:{
      userId:row.id, name:row.name, loyaltyPoints:points,
      strategy:strategy.describe(), testPrice:parseFloat(testPrice),
      finalPrice:parseFloat(final.toFixed(2)),
    }});
  } catch(e) { next(e); }
});

// ── POST /users/:id/cart/save ────────────────────────────────────
// MEMENTO — snapshot cart to DB
router.post('/:id/cart/save', requireOwnerOrAdmin, (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const row    = req.app.locals.userRepo.findById(userId);
    if (!row)    throw httpError(404, `User #${userId} not found`);
    const { items=[], coupon=null } = req.body;
    const cart = new ShoppingCart();
    items.forEach(i => cart.addItem(i));
    if (coupon) cart.applyCoupon(coupon);
    const memento = cart.save();
    req.app.locals.cartRepo.save(userId, memento);
    res.json({ success:true, message:'Cart snapshot saved',
      data:{ userId, savedAt:memento.savedAt, total:cart.getTotal(), coupon, items:memento.items }
    });
  } catch(e) { next(e); }
});

// ── GET /users/:id/cart ──────────────────────────────────────────
// MEMENTO restore
router.get('/:id/cart', requireOwnerOrAdmin, (req, res, next) => {
  try {
    const userId   = parseInt(req.params.id);
    const snapshot = req.app.locals.cartRepo.loadLatest(userId);
    if (!snapshot)
      return res.json({ success:true, message:'No saved cart found', data:null });
    const items = JSON.parse(snapshot.items_json);
    const total = items.reduce((s,i)=>s+i.price*(i.qty||1),0);
    res.json({ success:true, data:{ userId, savedAt:snapshot.saved_at, coupon:snapshot.coupon, total, items }});
  } catch(e) { next(e); }
});

// ── POST /users/:id/subscribe ────────────────────────────────────
// OBSERVER — subscribe with real email (Level 3) or mock
router.post('/:id/subscribe', requireCustomer, (req, res, next) => {
  try {
    const { productId, channel='email', contact } = req.body;
    if (!productId) throw httpError(400, '`productId` required');
    if (!contact)   throw httpError(400, '`contact` required');

    const notifier = getNotifier(productId);

    // Level 3: use RealEmailObserver for email channel
    const observers = {
      email : new RealEmailObserver(contact),   // ← REAL email
      sms   : new SMSObserver(contact),          // ← still mock
      push  : new AppPushObserver(contact),
    };
    const observer = observers[channel.toLowerCase()];
    if (!observer) throw httpError(400, 'channel must be: email, sms, push');

    notifier.subscribe(observer);
    res.json({ success:true,
      message:`Subscribed via ${channel} to product#${productId}`,
      data:{ productId, channel, contact, subscriberCount:notifier._subscribers.size }
    });
  } catch(e) { next(e); }
});

// ── POST /users/stock/:productId ─────────────────────────────────
// OBSERVER trigger — admin fires restock event
router.post('/stock/:productId', requireAdmin, (req, res, next) => {
  try {
    const { inStock=true } = req.body;
    const notifier = getNotifier(req.params.productId);
    const logs = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    notifier.setStock(!!inStock);
    console.log = orig;
    res.json({ success:true, productId:req.params.productId, inStock:!!inStock, notifications:logs });
  } catch(e) { next(e); }
});

module.exports = router;