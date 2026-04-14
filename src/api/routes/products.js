'use strict';

/**
 * routes/products.js
 * ------------------
 * Patterns used in this route file:
 *   FACTORY METHOD  — POST /products  creates any product type
 *   PROTOTYPE       — POST /products/clone/:key  clones a template
 *   ITERATOR        — GET  /products/search  uses Inventory filter iterator
 *   INTERPRETER     — GET  /products/search?q=  parses query strings
 *   FLYWEIGHT       — GET  /products/:id/icon  returns shared icon data
 *   VISITOR         — GET  /products/:id/report  runs Tax/Shipping/Revenue report
 *
 * SOLID
 *   SRP : This file only handles HTTP for the /products resource.
 *   OCP : New product types → just pass a new "type" in the request body.
 */

const express = require('express');
const router  = express.Router();

const { requireAdmin, requireCustomer, openAccess } = require('../middleware/auth');
const { httpError } = require('../middleware/errorHandler');

const {
  ProductFactory, ProductTemplateRegistry,
  Inventory, SearchQueryParser,
  ProductIconFactory,
  TaxReportVisitor, ShippingReportVisitor, RevenueReportVisitor,
} = require('../../patterns/omni-market');

// Module-level singletons (shared across requests)
const templateRegistry = new ProductTemplateRegistry();
const iconFactory      = new ProductIconFactory();
const queryParser      = new SearchQueryParser();
const colorMap         = { physical:'#3B82F6', digital:'#10B981', service:'#F59E0B' };

// Called once at startup by server.js to seed default templates
function seedTemplates(productRepo) {
  const physicals = productRepo.findByType('physical');
  physicals.forEach(row => {
    try {
      const p = ProductFactory.createProduct('physical', row.name, row.price, row.weight || 1);
      p.id    = row.id;
      templateRegistry.register(row.name.toLowerCase().replace(/\s+/g,'-'), p);
    } catch(_) {}
  });
}

// ── GET /products ───────────────────────────────────────────────
// Returns all products from the DB.
// Optional ?type=physical|digital|service filter.
router.get('/', openAccess, (req, res, next) => {
  try {
    const { type } = req.query;
    const repo     = req.app.locals.productRepo;
    const rows     = type ? repo.findByType(type) : repo.findAll();
    res.json({ success:true, count:rows.length, data:rows });
  } catch(e) { next(e); }
});

// ── GET /products/search ─────────────────────────────────────────
// Uses INTERPRETER + ITERATOR patterns.
// ?q=price < 100 AND category == 'digital'
router.get('/search', openAccess, (req, res, next) => {
  try {
    const { q, keyword } = req.query;
    const repo = req.app.locals.productRepo;

    // Keyword search (DB LIKE query)
    if (keyword) {
      const rows = repo.search(keyword);
      return res.json({ success:true, count:rows.length, data:rows });
    }

    // Interpreter + Iterator search
    if (q) {
      const allRows = repo.findAll();
      // Reconstruct Product objects so interpret() works
      const products = allRows.map(row =>
        ({ id:row.id, name:row.name, price:row.price, type:row.type,
           weight:row.weight, downloadUrl:row.download_url, duration:row.duration })
      );
      const inventory = new Inventory();
      products.forEach(p => inventory.addProduct(p));

      const expr    = queryParser.parse(q);
      const results = [...inventory].filter(p => expr.interpret(p));
      return res.json({ success:true, count:results.length, query:q, data:results });
    }

    throw httpError(400, 'Provide ?q= (interpreter query) or ?keyword= (text search)');
  } catch(e) { next(e); }
});

// ── GET /products/:id ───────────────────────────────────────────
router.get('/:id', openAccess, (req, res, next) => {
  try {
    const row = req.app.locals.productRepo.findById(req.params.id);
    if (!row) throw httpError(404, `Product "${req.params.id}" not found`);
    res.json({ success:true, data:row });
  } catch(e) { next(e); }
});

// ── POST /products ──────────────────────────────────────────────
// FACTORY METHOD — type in body determines which class is created.
// Body: { type, name, price, weight?, downloadUrl?, duration? }
router.post('/', requireAdmin, (req, res, next) => {
  try {
    const { type, name, price, weight, downloadUrl, duration } = req.body;
    if (!type || !name || price === undefined)
      throw httpError(400, 'Fields required: type, name, price');

    const extra =
      type === 'physical' ? weight     || 0    :
      type === 'digital'  ? downloadUrl|| ''   :
      type === 'service'  ? duration   || 1    : null;

    if (extra === null) throw httpError(400, `Unknown type: "${type}"`);

    const product = ProductFactory.createProduct(type, name, parseFloat(price), extra);
    req.app.locals.productRepo.save(product);

    res.status(201).json({ success:true, message:'Product created', data:{
      id:product.id, name:product.name, price:product.price, type:product.type,
    }});
  } catch(e) { next(e); }
});

// ── PUT /products/:id ───────────────────────────────────────────
// Simple update — price and name only for now.
router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const repo = req.app.locals.productRepo;
    const row  = repo.findById(req.params.id);
    if (!row) throw httpError(404, `Product "${req.params.id}" not found`);

    const { name, price } = req.body;
    const updated = { ...row, name: name||row.name, price: price!==undefined ? parseFloat(price) : row.price };

    // Re-use save() which does INSERT OR REPLACE
    const product = ProductFactory.createProduct(
      row.type, updated.name, updated.price,
      row.weight || row.download_url || row.duration
    );
    product.id = row.id;
    repo.save(product);

    res.json({ success:true, message:'Product updated', data:updated });
  } catch(e) { next(e); }
});

// ── DELETE /products/:id ─────────────────────────────────────────
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const deleted = req.app.locals.productRepo.delete(req.params.id);
    if (!deleted) throw httpError(404, `Product "${req.params.id}" not found`);
    res.json({ success:true, message:`Product ${req.params.id} deleted` });
  } catch(e) { next(e); }
});

// ── POST /products/clone/:key ────────────────────────────────────
// PROTOTYPE — clone a registered template, optionally override name/price.
router.post('/clone/:key', requireAdmin, (req, res, next) => {
  try {
    const { name, price } = req.body;
    let clone;
    try {
      clone = templateRegistry.clone(req.params.key);
    } catch(_) {
      throw httpError(404, `No template registered under key "${req.params.key}". `+
        `Available: ${templateRegistry.list().join(', ')||'none'}`);
    }
    if (name)  clone.name  = name;
    if (price) clone.price = parseFloat(price);
    req.app.locals.productRepo.save(clone);
    res.status(201).json({ success:true, message:'Product cloned from template', data:{
      id:clone.id, name:clone.name, price:clone.price, type:clone.type,
    }});
  } catch(e) { next(e); }
});

// ── GET /products/:id/icon ───────────────────────────────────────
// FLYWEIGHT — returns shared icon object for a product type.
router.get('/:id/icon', openAccess, (req, res, next) => {
  try {
    const row = req.app.locals.productRepo.findById(req.params.id);
    if (!row) throw httpError(404, `Product "${req.params.id}" not found`);
    const icon = iconFactory.getIcon(row.type, colorMap[row.type] || '#888');
    res.json({ success:true, data:{
      productId  : row.id,
      iconType   : icon.iconType,
      colorHex   : icon.colorHex,
      rendered   : icon.render(row.id, 0, 0),
      sharedPool : iconFactory.uniqueIconCount,
    }});
  } catch(e) { next(e); }
});

// ── GET /products/:id/report?type=tax|shipping|revenue ──────────
// VISITOR — run a report visitor on a product without changing it.
router.get('/:id/report', openAccess, (req, res, next) => {
  try {
    const row = req.app.locals.productRepo.findById(req.params.id);
    if (!row) throw httpError(404, `Product "${req.params.id}" not found`);

    // Reconstruct minimal product object so visitor works
    const product = {
      id: row.id, name:row.name, price:row.price,
      type:row.type, weight:row.weight,
      accept(visitor){ return visitor.visitProduct(this); }
    };

    const visitors = {
      tax      : new TaxReportVisitor(),
      shipping : new ShippingReportVisitor(),
      revenue  : new RevenueReportVisitor(),
    };
    const reportType = req.query.type || 'tax';
    const visitor    = visitors[reportType];
    if (!visitor) throw httpError(400, `Unknown report type. Use: tax, shipping, revenue`);

    res.json({ success:true, reportType, data: product.accept(visitor) });
  } catch(e) { next(e); }
});

module.exports = { router, seedTemplates };