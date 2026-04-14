'use strict';

/**
 * routes/orders.js
 * ----------------
 * Patterns used:
 *   BUILDER                  — POST /orders assembles Order step-by-step
 *   COMMAND + UNDO           — PlaceOrderCommand / CancelOrderCommand
 *   CHAIN OF RESPONSIBILITY  — GET  /orders/:id/approve
 *   DECORATOR                — POST /orders/:id/shipping applies fee wrappers
 *   TEMPLATE METHOD          — POST /orders/:id/ship runs shipping process
 *   VISITOR                  — GET  /orders/:id/report
 *
 * SOLID
 *   SRP : Only handles HTTP for the /orders resource.
 *   OCP : New shipping types → new subclass; no route code changes.
 *   DIP : Routes depend on PersistentOrderService abstraction.
 */

const express = require('express');
const router  = express.Router();

const { requireAdmin, requireCustomer, openAccess } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');
const { MailerService } = require('../../integrations/MailerService');

const {
  OrderBuilder,
  CommandHistory, PlaceOrderCommand, CancelOrderCommand,
  ApprovalHandler,
  ShippingBase,
  ExpressShippingDecorator, FragileHandlingDecorator,
  InsuranceDecorator, ColdChainDecorator,
  DomesticShipping, InternationalShipping, DroneShipping,
  TaxReportVisitor, ShippingReportVisitor, RevenueReportVisitor,
  ProductFactory,
} = require('../../patterns/omni-market');

// Per-server command history (undo stack lives in memory)
const cmdHistory = new CommandHistory();

// Approval chain — built once
const manager  = new ApprovalHandler('Manager',  500);
const director = new ApprovalHandler('Director', 5_000);
const ceo      = new ApprovalHandler('CEO',      50_000);
manager.setNext(director).setNext(ceo);

// ── GET /orders ──────────────────────────────────────────────────
router.get('/', requireCustomer, (req, res, next) => {
  try {
    const { status } = req.query;
    const repo  = req.app.locals.orderRepo;
    const rows  = status ? repo.findByStatus(status) : repo.findAll();
    res.json({ success:true, count:rows.length, data:rows });
  } catch(e) { next(e); }
});

// ── GET /orders/:id ──────────────────────────────────────────────
router.get('/:id', requireCustomer, (req, res, next) => {
  try {
    const repo  = req.app.locals.orderRepo;
    const order = repo.findById(req.params.id);
    if (!order) throw httpError(404, `Order "${req.params.id}" not found`);
    const items = repo.getItems(req.params.id);
    res.json({ success:true, data:{ ...order, items } });
  } catch(e) { next(e); }
});

// ── POST /orders ─────────────────────────────────────────────────
// BUILDER — constructs the Order step-by-step from the request body.
// COMMAND — wraps the placement in a PlaceOrderCommand (supports undo).
//
// Body: {
//   items        : [{ productId, qty }],
//   discounts    : [10, 20],          // optional flat amounts
//   address      : "42 Quaid Ave",
//   paymentMethod: "Credit Card",
//   notes        : "Leave at door"
// }
router.post('/', requireCustomer, (req, res, next) => {
  try {
    const { items, discounts=[], address, paymentMethod, notes='' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      throw httpError(400, '`items` array is required');
    if (!address)
      throw httpError(400, '`address` is required');

    const productRepo = req.app.locals.productRepo;
    const builder     = new OrderBuilder();

    // Resolve each product from DB and add to builder
    for (const { productId, qty=1 } of items) {
      const row = productRepo.findById(productId);
      if (!row) throw httpError(404, `Product "${productId}" not found`);

      // Re-hydrate a minimal product object compatible with Order
      const product = {
        id: row.id, name:row.name, price:row.price,
        type:row.type, weight:row.weight||0,
      };
      builder.addItem(product, parseInt(qty));
    }

    discounts.forEach(d => builder.addDiscount(parseFloat(d)));
    builder
      .setAddress(address)
      .setPaymentMethod(paymentMethod || 'Unpaid')
      .addNote(notes);

    const order = builder.build();

    // COMMAND — execute and push to undo stack
    const svc    = req.app.locals.persistentOrderSvc;
    const result = cmdHistory.execute(new PlaceOrderCommand(svc, order));

    const mailer = MailerService.getInstance();
    mailer.send({
      to      : req.user.email,
      subject : `✅ Order Confirmed — ${order.id}`,
      text    : `Hi ${req.user.name}, your order ${order.id} has been placed. Total: $${order.getTotal().toFixed(2)}. Shipping to: ${order.address}`,
      html    : `
        <div style="font-family:sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#3B82F6">✅ Order Confirmed!</h2>
          <p>Hi <strong>${req.user.name}</strong>,</p>
          <p>Your order has been placed successfully.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;color:#888">Order ID</td><td style="padding:8px"><strong>${order.id}</strong></td></tr>
            <tr><td style="padding:8px;color:#888">Total</td><td style="padding:8px"><strong>$${order.getTotal().toFixed(2)}</strong></td></tr>
            <tr><td style="padding:8px;color:#888">Ship to</td><td style="padding:8px">${order.address}</td></tr>
          </table>
          <p style="color:#888;font-size:12px">Thank you for shopping with Omni-Market!</p>
        </div>
      `,
    }).catch(() => {});
    
    res.status(201).json({
      success  : true,
      message  : result.trim(),
      undoStack: cmdHistory.size,
      data     : {
        id            : order.id,
        address       : order.address,
        paymentMethod : order.paymentMethod,
        status        : order.status,
        subtotal      : order.getSubtotal(),
        discountTotal : order.getDiscountTotal(),
        total         : order.getTotal(),
        items         : order.items.map(({product,qty}) =>
                          ({productId:product.id, name:product.name, qty, unitPrice:product.price})),
      },
    });
  } catch(e) { next(e); }
});

// ── POST /orders/undo ────────────────────────────────────────────
// COMMAND UNDO — reverses the most recent order action.
router.post('/undo', requireAdmin, (req, res, next) => {
  try {
    const result = cmdHistory.undo();
    res.json({ success:true, message:result.trim(), remainingStack:cmdHistory.size });
  } catch(e) { next(e); }
});

// ── PATCH /orders/:id/status ─────────────────────────────────────
// COMMAND — wraps cancel in CancelOrderCommand.
router.patch('/:id/status', requireAdmin, (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) throw httpError(400, '`status` field required');

    const repo  = req.app.locals.orderRepo;
    const row   = repo.findById(req.params.id);
    if (!row)   throw httpError(404, `Order "${req.params.id}" not found`);

    if (status === 'cancelled') {
      // Use CancelOrderCommand so it's undoable
      const fakeOrder = { id:row.id,
        getTotal(){ return row.total; },
        getSubtotal(){ return row.subtotal; },
        getDiscountTotal(){ return row.discount_total; },
        items:[], address:row.address, paymentMethod:row.payment_method,
        notes:row.notes, status:row.status,
      };
      const result = cmdHistory.execute(
        new CancelOrderCommand(req.app.locals.persistentOrderSvc, fakeOrder)
      );
      return res.json({ success:true, message:result.trim() });
    }

    repo.updateStatus(req.params.id, status);
    res.json({ success:true, message:`Order ${req.params.id} status → ${status}` });
  } catch(e) { next(e); }
});

// ── GET /orders/:id/approve ──────────────────────────────────────
// CHAIN OF RESPONSIBILITY — runs the approval chain on the order total.
router.get('/:id/approve', requireAdmin, (req, res, next) => {
  try {
    const repo = req.app.locals.orderRepo;
    const row  = repo.findById(req.params.id);
    if (!row)  throw httpError(404, `Order "${req.params.id}" not found`);

    // Build a minimal object the ApprovalHandler can use
    const fakeOrder = { id:row.id, getTotal(){ return row.total; } };
    const decision  = manager.handle(fakeOrder);

    res.json({ success:true, orderId:row.id, total:row.total, decision });
  } catch(e) { next(e); }
});

// ── POST /orders/:id/shipping ────────────────────────────────────
// DECORATOR — wraps the base order cost with chosen fee decorators.
// Body: { decorators: ["express","fragile","insurance","coldchain"] }
router.post('/:id/shipping', requireCustomer, (req, res, next) => {
  try {
    const repo = req.app.locals.orderRepo;
    const row  = repo.findById(req.params.id);
    if (!row)  throw httpError(404, `Order "${req.params.id}" not found`);

    const { decorators = [] } = req.body;

    // Base — wraps raw order total
    const fakeOrder = { getTotal(){ return row.total; } };
    let wrapped     = new ShippingBase(fakeOrder);
    const applied   = [];

    const decoratorMap = {
      express   : ExpressShippingDecorator,
      fragile   : FragileHandlingDecorator,
      insurance : InsuranceDecorator,
      coldchain : ColdChainDecorator,
    };

    for (const name of decorators) {
      const Cls = decoratorMap[name.toLowerCase()];
      if (!Cls) throw httpError(400, `Unknown decorator "${name}". Use: express, fragile, insurance, coldchain`);
      wrapped = new Cls(wrapped);
      applied.push(name);
    }

    res.json({
      success    : true,
      orderId    : row.id,
      baseTotal  : row.total,
      description: wrapped.getDescription(),
      finalCost  : parseFloat(wrapped.getCost().toFixed(2)),
      applied,
    });
  } catch(e) { next(e); }
});

// ── POST /orders/:id/ship ────────────────────────────────────────
// TEMPLATE METHOD — runs the full shipping pipeline.
// Body: { method: "domestic" | "international" | "drone" }
router.post('/:id/ship', requireAdmin, (req, res, next) => {
  try {
    const repo = req.app.locals.orderRepo;
    const row  = repo.findById(req.params.id);
    if (!row)  throw httpError(404, `Order "${req.params.id}" not found`);

    const { method = 'domestic' } = req.body;
    const processors = {
      domestic      : DomesticShipping,
      international : InternationalShipping,
      drone         : DroneShipping,
    };
    const Cls = processors[method.toLowerCase()];
    if (!Cls) throw httpError(400, `Unknown method "${method}". Use: domestic, international, drone`);

    // Reconstruct minimal Order object for the template method
    const items = repo.getItems(row.id);
    const fakeOrder = {
      id             : row.id,
      address        : row.address,
      items          : items.map(i => ({ product:{ weight:0 }, qty:i.qty })),
      getTotal()     { return row.total; },
      getSubtotal()  { return row.subtotal; },
      getDiscountTotal(){ return row.discount_total; },
    };

    const logs = [];
    // Capture console.log output from template steps
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    const cost = new Cls().process(fakeOrder);
    console.log = origLog;

    repo.updateStatus(row.id, 'shipped');
    res.json({ success:true, orderId:row.id, method, shippingCost:cost, steps:logs });
  } catch(e) { next(e); }
});

// ── GET /orders/:id/report?type=tax|shipping|revenue ─────────────
// VISITOR — run a report on an order without modifying the order.
router.get('/:id/report', requireCustomer, (req, res, next) => {
  try {
    const repo = req.app.locals.orderRepo;
    const row  = repo.findById(req.params.id);
    if (!row)  throw httpError(404, `Order "${req.params.id}" not found`);

    const items = repo.getItems(row.id);
    const fakeOrder = {
      id             : row.id,
      items          : items.map(i => ({ product:{ weight:0, price:i.unit_price }, qty:i.qty })),
      getTotal()     { return row.total; },
      getSubtotal()  { return row.subtotal; },
      getDiscountTotal(){ return row.discount_total; },
      accept(visitor){ return visitor.visitOrder(this); },
    };

    const visitors = {
      tax      : new TaxReportVisitor(),
      shipping : new ShippingReportVisitor(),
      revenue  : new RevenueReportVisitor(),
    };
    const reportType = req.query.type || 'tax';
    const visitor    = visitors[reportType];
    if (!visitor) throw httpError(400, 'Use: ?type=tax | shipping | revenue');

    res.json({ success:true, reportType, data: fakeOrder.accept(visitor) });
  } catch(e) { next(e); }
});

module.exports = router;