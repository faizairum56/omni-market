'use strict';

/**
 * routes/shipping.js  (Level 3)
 * ------------------------------
 * PATTERN : TEMPLATE METHOD — ShippoShipping overrides calculateShipping()
 *           while inheriting all other pipeline steps unchanged.
 * PATTERN : ADAPTER        — ShippoService adapts Shippo API response
 *           to our standard rate shape.
 *
 * ENDPOINTS
 *   GET  /shipping/rates?weight=&fromZip=&toZip=   — get live rates
 *   POST /shipping/:orderId/quote                   — save best rate to DB
 *   POST /shipping/:orderId/ship                    — run full pipeline
 */

const express = require('express');
const router  = express.Router();

const { requireCustomer, requireAdmin } = require('../middleware/auth');
const { httpError }                     = require('../middleware/errorHandler');
const { ShippoService, ShippoShipping } = require('../../integrations/ShippoService');
const { DomesticShipping, InternationalShipping, DroneShipping } = require('../../patterns/omni-market');

const shippo = new ShippoService();

// ── GET /shipping/rates ──────────────────────────────────────────
// Returns live or simulated shipping rates for a parcel.
router.get('/rates', requireCustomer, async (req, res, next) => {
  try {
    const { weight=1, fromZip='10001', toZip='90001',
            fromCountry='US', toCountry='US' } = req.query;

    const rates = await shippo.getRates({
      weight: parseFloat(weight), fromZip, toZip, fromCountry, toCountry,
    });

    res.json({
      success    : true,
      simulation : shippo.isSimulation,
      count      : rates.length,
      data       : rates,
    });
  } catch(e) { next(e); }
});

// ── POST /shipping/:orderId/quote ────────────────────────────────
// Get rates for an order's actual weight and save best quote to DB.
router.post('/:orderId/quote', requireCustomer, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const repo  = req.app.locals.orderRepo;
    const order = repo.findById(orderId);
    if (!order) throw httpError(404, `Order "${orderId}" not found`);

    const items  = repo.getItems(orderId);
    const weight = items.reduce((s,i) => s + (i.weight||0.5) * i.qty, 0) || 1;

    const { fromZip='10001', toZip='90001' } = req.body;
    const rates = await shippo.getRates({ weight, fromZip, toZip });
    const best  = [...rates].sort((a,b) => a.amount - b.amount)[0];

    // Persist quote to DB
    req.app.locals.db.run(
      `INSERT INTO shipping_quotes (order_id, provider, service, amount, currency, est_days, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, best.provider, best.service, best.amount,
       best.currency, best.estDays, JSON.stringify(rates)]
    );

    res.json({
      success    : true,
      orderId,
      simulation : shippo.isSimulation,
      bestRate   : best,
      allRates   : rates,
    });
  } catch(e) { next(e); }
});

// ── POST /shipping/:orderId/ship ─────────────────────────────────
// TEMPLATE METHOD — run the full shipping pipeline.
// method: "shippo" | "domestic" | "international" | "drone"
router.post('/:orderId/ship', requireAdmin, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const repo  = req.app.locals.orderRepo;
    const order = repo.findById(orderId);
    if (!order) throw httpError(404, `Order "${orderId}" not found`);

    const { method = 'shippo' } = req.body;
    const items = repo.getItems(orderId);

    const fakeOrder = {
      id            : order.id,
      address       : order.address,
      items         : items.map(i => ({ product:{ weight:0.5 }, qty:i.qty })),
      getTotal()    { return order.total; },
      getSubtotal() { return order.subtotal; },
      getDiscountTotal() { return order.discount_total; },
    };

    const processors = {
      shippo        : new ShippoShipping(shippo),
      domestic      : new DomesticShipping(),
      international : new InternationalShipping(),
      drone         : new DroneShipping(),
    };

    const processor = processors[method.toLowerCase()];
    if (!processor) throw httpError(400, `Unknown method. Use: shippo, domestic, international, drone`);

    const logs = [];
    const orig = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); orig(...args); };

    // ShippoShipping.process() is async (real API call)
    const cost = await Promise.resolve(processor.process(fakeOrder));
    console.log = orig;

    repo.updateStatus(orderId, 'shipped');

    res.json({
      success      : true,
      orderId,
      method,
      shippingCost : cost,
      simulation   : shippo.isSimulation,
      steps        : logs,
    });
  } catch(e) { next(e); }
});

module.exports = router;