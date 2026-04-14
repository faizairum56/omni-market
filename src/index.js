'use strict';

/**
 * index.js  —  Omni-Market Global Engine  (Level 1: SQLite Persistence)
 * ======================================================================
 * Wires the DatabaseAdapter + Repositories into the existing 23-pattern
 * system without breaking any pattern.
 *
 * Key Level-1 changes vs the original omni-market.js:
 *   • DatabaseAdapter (new Adapter) wraps better-sqlite3
 *   • ProductRepository  → save / load products
 *   • OrderRepository    → replaces in-memory OrderService Map
 *   • UserRepository     → save / load registered users
 *   • PersistentOrderService → drop-in for OrderService (LSP)
 *   • CartSnapshotRepository → persists Mementos across restarts
 */

const { DatabaseAdapter }    = require('./db/DatabaseAdapter');
const { ProductRepository }  = require('./repositories/ProductRepository');
const { OrderRepository, PersistentOrderService } = require('./repositories/OrderRepository');
const { UserRepository, CartSnapshotRepository }  = require('./repositories/UserRepository');

const {
  GlobalConfig, ProductFactory, getRegionalFactory,
  OrderBuilder, ProductTemplateRegistry,
  DatabaseConnectionPool,
  TaxCalculatorAdapter,
  CreditCardPayment, CryptoPayment, BuyNowPayLaterPayment,
  StripeProvider, PayPalProvider, CoinbaseProvider,
  Box, PackageItem,
  ShippingBase, ExpressShippingDecorator, FragileHandlingDecorator, InsuranceDecorator,
  ProductIconFactory,
  AdminDashboardProxy,
  ApprovalHandler,
  CommandHistory, PlaceOrderCommand, CancelOrderCommand,
  SearchQueryParser,
  Inventory,
  ControlTower, Warehouse, Courier, CustomerHub,
  ShoppingCart, CartHistory, CartMemento,
  StockNotifier, EmailObserver, SMSObserver, AppPushObserver,
  FlatDiscountStrategy, PercentageDiscountStrategy,
  SeasonalDiscountStrategy, BuyOneGetOneStrategy,
  NullDiscount, PriceCalculator,
  DomesticShipping, InternationalShipping, DroneShipping,
  TaxReportVisitor, ShippingReportVisitor, RevenueReportVisitor,
  RegisteredUser, GuestUser,
} = require('./patterns/omni-market');

// ─────────────────────────────────────────────────────────────────
function banner(title) {
  const line = '═'.repeat(64);
  console.log(`\n${line}\n ▶  ${title}\n${line}`);
}

// ─────────────────────────────────────────────────────────────────
async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  OMNI-MARKET GLOBAL ENGINE  —  Level 1: SQLite Persistence ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // ── SETUP: Connect to SQLite ────────────────────────────────────
  await DatabaseAdapter.init();                // load WASM once
  const db = new DatabaseAdapter();            // ADAPTER pattern
  db.connect();

  const productRepo = new ProductRepository(db);
  const orderRepo   = new OrderRepository(db);
  const userRepo    = new UserRepository(db);
  const cartRepo    = new CartSnapshotRepository(db);

  // Persistent order service — drop-in for the original in-memory one
  const persistentOrderSvc = new PersistentOrderService(orderRepo);

  // ── 1. SINGLETON ────────────────────────────────────────────────
  banner('1. SINGLETON — GlobalConfig');
  const cfg = GlobalConfig.getInstance();
  cfg.set('currency','USD').set('taxRate',0.10);
  console.log('  Settings:', cfg.getAll());
  console.log('  Same instance?', cfg === GlobalConfig.getInstance());

  // ── 2. FACTORY METHOD + DB SAVE ─────────────────────────────────
  banner('2. FACTORY METHOD + DB PERSISTENCE — ProductFactory');
  const laptop   = ProductFactory.createProduct('physical', 'Laptop Pro',          1200,  2.5);
  const ebook    = ProductFactory.createProduct('digital',  'JS Design Patterns',  29.99, 'https://dl.omnimarket.io/jsdp');
  const support  = ProductFactory.createProduct('service',  '24h Tech Support',    49.99, 24);
  const phone    = ProductFactory.createProduct('physical', 'OmniPhone X',          999,  0.18);

  productRepo.saveAll([laptop, ebook, support, phone]);
  console.log(`  Saved 4 products.  DB total: ${productRepo.count()}`);
  [laptop, ebook, support, phone].forEach(p => console.log(' ', p.getDetails()));

  // ── 3. ABSTRACT FACTORY ──────────────────────────────────────────
  banner('3. ABSTRACT FACTORY — Regional Package Kits');
  ['US','EU','UK'].forEach(region => {
    const f = getRegionalFactory(region);
    console.log(`  ${region}: ${f.createLabel().getLabel()} | ${f.createPlug().getSpec()}`);
  });

  // ── 4. BUILDER + DB SAVE ─────────────────────────────────────────
  banner('4. BUILDER + DB PERSISTENCE — Complex Order Assembly');
  const order = new OrderBuilder()
    .addItem(laptop, 1)
    .addItem(ebook,  2)
    .addItem(phone,  1)
    .addDiscount(100)
    .addDiscount(50)
    .setAddress('42 Quaid Ave, Islamabad, PK')
    .setPaymentMethod('Credit Card')
    .addNote('Leave at reception.')
    .build();

  orderRepo.save(order);
  console.log(' ', order.toString());
  console.log(`  DB order count: ${orderRepo.count()}`);

  // ── 5. PROTOTYPE ─────────────────────────────────────────────────
  banner('5. PROTOTYPE — Clone & Persist Product Templates');
  const registry    = new ProductTemplateRegistry();
  registry.register('laptop-template', laptop);
  const gamingLaptop = registry.clone('laptop-template');
  gamingLaptop.name  = 'Gaming Beast Pro';
  gamingLaptop.price = 2499;
  productRepo.save(gamingLaptop);
  console.log('  Original :', laptop.getDetails());
  console.log('  Clone    :', gamingLaptop.getDetails(), '← persisted to DB');
  console.log('  Same obj?', laptop === gamingLaptop);

  // ── 6. OBJECT POOL ───────────────────────────────────────────────
  banner('6. OBJECT POOL — DatabaseConnection Pool');
  const pool = new DatabaseConnectionPool(3);
  const c1   = pool.acquire();
  const c2   = pool.acquire();
  console.log(' ', c1.query('SELECT * FROM orders LIMIT 10'));
  console.log(' ', c2.query('SELECT * FROM products WHERE active=1'));
  console.log(' ', pool.stats());
  pool.release(c1);
  const c3 = pool.acquire();
  console.log(`  Reacquired slot: conn#${c3.id}`);

  // ── 7. ADAPTER (XML Tax + DB Adapter) ───────────────────────────
  banner('7. ADAPTER — Legacy XML Tax + DatabaseAdapter');
  console.log('  [XML Tax Adapter]');
  const taxAdapter = new TaxCalculatorAdapter();
  const r1 = taxAdapter.calculate({ amount: 1200,  rate: 0.10 });
  const r2 = taxAdapter.calculate({ amount: 29.99, rate: 0.05 });
  console.log(`    Laptop tax:  $${r1.tax}  → total $${r1.total.toFixed(2)}`);
  console.log(`    eBook tax:   $${r2.tax}  → total $${r2.total.toFixed(2)}`);
  console.log(`  [DatabaseAdapter] File: ${db.filePath}`);

  // ── 8. BRIDGE ────────────────────────────────────────────────────
  banner('8. BRIDGE — PaymentMethod × BankProvider');
  [
    new CreditCardPayment(new StripeProvider()),
    new CryptoPayment(new CoinbaseProvider()),
    new BuyNowPayLaterPayment(new PayPalProvider()),
  ].forEach(p => console.log(' ', p.pay(order.getTotal())));

  // ── 9. COMPOSITE ─────────────────────────────────────────────────
  banner('9. COMPOSITE — Recursive Packaging');
  const masterBox = new Box('Master Carton', 8);
  const elecBox   = new Box('Electronics', 3);
  elecBox.add(new PackageItem('Laptop Pro', 1200)).add(new PackageItem('Adapter', 35));
  const mediaBox  = new Box('Media', 2);
  mediaBox.add(new PackageItem('JS Patterns', 29.99)).add(new PackageItem('OmniPhone', 999));
  masterBox.add(elecBox).add(mediaBox).add(new PackageItem('Bubble Wrap', 2.5));
  console.log(masterBox.describe());
  console.log(`  ► Total: $${masterBox.getPrice()}`);

  // ── 10. DECORATOR ────────────────────────────────────────────────
  banner('10. DECORATOR — Dynamic Shipping Fees');
  let shipping = new ShippingBase(order);
  shipping = new ExpressShippingDecorator(shipping);
  shipping = new FragileHandlingDecorator(shipping);
  shipping = new InsuranceDecorator(shipping);
  console.log('  Description:', shipping.getDescription());
  console.log(`  Final Cost : $${shipping.getCost().toFixed(2)}`);

  // ── 11. FLYWEIGHT ────────────────────────────────────────────────
  banner('11. FLYWEIGHT — Shared Product Icons');
  const iconFactory = new ProductIconFactory();
  const items = [
    {id:'p001',type:'electronics',x:0},{id:'p002',type:'books',x:50},
    {id:'p003',type:'electronics',x:100},{id:'p004',type:'clothing',x:150},
    {id:'p005',type:'electronics',x:200},{id:'p006',type:'books',x:250},
  ];
  const colorMap = {electronics:'#3B82F6',books:'#10B981',clothing:'#F59E0B'};
  items.forEach(i => {
    const icon = iconFactory.getIcon(i.type, colorMap[i.type]);
    console.log(' ', icon.render(i.id, i.x, 0));
  });
  console.log(`  Unique icon objects: ${iconFactory.uniqueIconCount} (shared across ${items.length} renders)`);

  // ── 12. PROXY ────────────────────────────────────────────────────
  banner('12. PROXY — Admin Dashboard Auth');
  const adminProxy  = new AdminDashboardProxy({ name:'Alice',  role:'admin' });
  const viewerProxy = new AdminDashboardProxy({ name:'Bob',    role:'viewer' });
  const superProxy  = new AdminDashboardProxy({ name:'Carlos', role:'superadmin' });
  console.log(' ', adminProxy.getRevenue());
  try { viewerProxy.resetPassword(42); } catch(e){ console.log(' ', e.message); }
  console.log(' ', superProxy.deleteUser(99));

  // ── 13. CHAIN OF RESPONSIBILITY ──────────────────────────────────
  banner('13. CHAIN OF RESPONSIBILITY — Order Approval');
  const manager  = new ApprovalHandler('Manager',  500);
  const director = new ApprovalHandler('Director', 5_000);
  const ceo      = new ApprovalHandler('CEO',      50_000);
  manager.setNext(director).setNext(ceo);
  const smallOrd = new OrderBuilder().addItem({name:'USB Hub',price:30,type:'physical'},3).setAddress('NYC').build();
  const largeOrd = new OrderBuilder().addItem({name:'Enterprise License',price:40000,type:'service'},1).setAddress('London').build();
  const hugeOrd  = new OrderBuilder().addItem({name:'Data Centre',price:100000,type:'service'},1).setAddress('Dubai').build();
  [smallOrd, order, largeOrd, hugeOrd].forEach(o => console.log(' ', manager.handle(o)));

  // ── 14. COMMAND + PERSISTENT SERVICE ────────────────────────────
  banner('14. COMMAND — PlaceOrder/CancelOrder with Undo (DB-backed)');
  const cmdHist = new CommandHistory();
  console.log(cmdHist.execute(new PlaceOrderCommand(persistentOrderSvc, order)));
  console.log('  Placed orders in DB:', persistentOrderSvc.getOrders());
  console.log('  Undo:', cmdHist.undo());
  console.log('  Orders after undo:', persistentOrderSvc.getOrders());
  console.log(cmdHist.execute(new PlaceOrderCommand(persistentOrderSvc, order)));
  console.log('  Final DB order count:', orderRepo.count());

  // ── 15. INTERPRETER ──────────────────────────────────────────────
  banner('15. INTERPRETER — Search Query Parser');
  const parser    = new SearchQueryParser();
  const inventory = new Inventory();
  [laptop, ebook, support, phone, gamingLaptop].forEach(p => inventory.addProduct(p));
  const q1 = "price < 100 AND category == 'digital'";
  const q2 = "price >= 500 AND category == 'physical'";
  [q1, q2].forEach(q => {
    const expr    = parser.parse(q);
    const results = [...inventory].filter(p => expr.interpret(p));
    console.log(`  Query: "${q}"`);
    console.log(`  → ${results.map(p=>p.name).join(', ')||'No results'}\n`);
  });

  // ── 16. ITERATOR ─────────────────────────────────────────────────
  banner('16. ITERATOR — Inventory Traversal');
  console.log('  All products:');
  for(const p of inventory) console.log(`    ${p.getDetails()}`);
  console.log('\n  Physical only:');
  for(const p of inventory.filter(p=>p.type==='physical')) console.log(`    ${p.getDetails()}`);

  // ── 17. MEDIATOR ─────────────────────────────────────────────────
  banner('17. MEDIATOR — ControlTower');
  const tower     = new ControlTower();
  const warehouse = new Warehouse();
  const courier   = new Courier();
  const custHub   = new CustomerHub();
  tower.register('Warehouse',warehouse).register('Courier',courier).register('CustomerHub',custHub);
  warehouse.send('ORDER_PACKED',   { orderId:order.id, boxes:2 });
  courier.send('PICKUP_CONFIRMED', { driver:'Raza', eta:'2h' });

  // ── 18. MEMENTO + DB PERSISTENCE ─────────────────────────────────
  banner('18. MEMENTO — Shopping Cart Undo (persisted to DB)');
  const cart    = new ShoppingCart();
  const cartHis = new CartHistory();
  const FAKE_USER_ID = 1;

  cart.addItem({ name:'Laptop Pro', price:1200, qty:1 });
  const snap1 = cart.save();
  cartHis.push(snap1);
  cartRepo.save(FAKE_USER_ID, snap1);         // ← persisted!
  console.log('  After laptop  :', cart.toString());

  cart.addItem({ name:'Mouse', price:35, qty:2 });
  cart.applyCoupon('SAVE10');
  const snap2 = cart.save();
  cartHis.push(snap2);
  cartRepo.save(FAKE_USER_ID, snap2);         // ← persisted!
  console.log('  After mouse   :', cart.toString());

  cart.restore(cartHis.pop());
  console.log('  After undo    :', cart.toString());

  const dbSnap = cartRepo.loadLatest(FAKE_USER_ID);
  console.log(`  Latest DB snapshot saved at: ${dbSnap?.saved_at||'(none)'}`);

  // ── 19. OBSERVER ─────────────────────────────────────────────────
  banner('19. OBSERVER — Back-in-Stock Notifications');
  const ps5  = new StockNotifier('PlayStation 5');
  const obs1 = new EmailObserver('ali@omni.pk');
  const obs2 = new SMSObserver('+92-300-1234567');
  const obs3 = new AppPushObserver('u_9921');
  ps5.subscribe(obs1).subscribe(obs2).subscribe(obs3);
  ps5.unsubscribe(obs2);
  ps5.setStock(true);    // fires obs1 & obs3
  ps5.setStock(true);    // no duplicate fire

  // ── 20. STRATEGY ─────────────────────────────────────────────────
  banner('20. STRATEGY — Discount Algorithms');
  const calculator = new PriceCalculator(new FlatDiscountStrategy());
  const testPrice  = 200;
  [
    new FlatDiscountStrategy(20),
    new PercentageDiscountStrategy(30),
    new SeasonalDiscountStrategy(),
    new BuyOneGetOneStrategy(),
  ].forEach(s => {
    calculator.setStrategy(s);
    console.log(`  ${s.describe().padEnd(24)} $${testPrice} → $${calculator.calculate(testPrice)}`);
  });

  // ── 21. TEMPLATE METHOD ──────────────────────────────────────────
  banner('21. TEMPLATE METHOD — Shipping Process');
  [
    { label:'Domestic',      p:new DomesticShipping() },
    { label:'International', p:new InternationalShipping() },
    { label:'Drone',         p:new DroneShipping() },
  ].forEach(({label,p}) => {
    console.log(`\n  ── ${label} ──`);
    p.process(order);
  });

  // ── 22. VISITOR ──────────────────────────────────────────────────
  banner('22. VISITOR — System Reports');
  [new TaxReportVisitor(), new ShippingReportVisitor(), new RevenueReportVisitor()].forEach(v => {
    console.log(' ', order.accept(v));
    console.log(' ', laptop.accept(v));
  });

  // ── 23. NULL OBJECT ──────────────────────────────────────────────
  banner('23. NULL OBJECT — Guest User / NullDiscount');
  const testUsers = [
    new RegisteredUser('Bilal', 250),
    new GuestUser(),
    new RegisteredUser('Sara', 40),
    new GuestUser(),
  ];
  testUsers.forEach(user => {
    userRepo.save(user);  // GuestUser skipped automatically — Null Object!
    const strategy = user.getDiscountPct() > 0
      ? new PercentageDiscountStrategy(user.getDiscountPct())
      : new NullDiscount();
    console.log(
      `  ${user.getName().padEnd(10)} | Points:${user.getLoyaltyPoints()} | `+
      `Strategy:${strategy.describe().padEnd(14)} | Final:$${strategy.calculate(1000)}`
    );
  });

  // ── DB SUMMARY ───────────────────────────────────────────────────
  banner('DATABASE SUMMARY');
  console.log(`  Products   : ${productRepo.count()}`);
  console.log(`  Users      : ${userRepo.count()}`);
  console.log(`  Orders     : ${orderRepo.count()}`);
  console.log(`  Revenue    : $${orderRepo.totalRevenue().toFixed(2)}`);

  console.log('\n  Physical products from DB:');
  productRepo.findByType('physical').forEach(r =>
    console.log(`    [${r.id}] ${r.name} — $${r.price}`)
  );

  console.log('\n  All orders from DB:');
  orderRepo.findAll().forEach(r =>
    console.log(`    [${r.id}] status=${r.status} total=$${r.total}`)
  );

  db.disconnect();

  const line = '═'.repeat(64);
  console.log(`\n${line}`);
  console.log(' ✔  ALL 23 PATTERNS DEMONSTRATED  |  LEVEL 1 COMPLETE');
  console.log(line);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});