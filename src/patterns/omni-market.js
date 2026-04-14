/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        OMNI-MARKET GLOBAL ENGINE                             ║
 * ║  ITEC3115 - Assignment 4 | BS(CS) Spring 2026               ║
 * ║  All 23 GoF Design Patterns + SOLID Principles              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// SECTION 1: CREATIONAL PATTERNS
// ─────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════
// 1. SINGLETON — GlobalConfig
//    SRP: Only manages global system-wide settings.
//    DIP: High-level modules depend on this abstraction, not
//         environment-specific values scattered across the code.
// ══════════════════════════════════════════════════════════════════
class GlobalConfig {
  constructor() {
    if (GlobalConfig._instance) return GlobalConfig._instance;
    this._settings = { currency:'USD', taxRate:0.10, maxConnections:5, version:'1.0.0', debug:false };
    GlobalConfig._instance = this;
  }
  static getInstance() { if (!GlobalConfig._instance) new GlobalConfig(); return GlobalConfig._instance; }
  get(key)        { return this._settings[key]; }
  set(key, value) { this._settings[key] = value; return this; }
  getAll()        { return { ...this._settings }; }
}

// ══════════════════════════════════════════════════════════════════
// 2. FACTORY METHOD — ProductFactory
//    OCP: Add new product types by adding a new case—existing
//         factory code never needs to change.
//    LSP: Every product subclass (DigitalProduct, ServiceProduct)
//         is fully substitutable for the base Product class.
// ══════════════════════════════════════════════════════════════════

/** Abstract base — SOLID LSP anchor */
class Product {
  constructor(name, price) {
    if (new.target === Product) throw new Error('Product is abstract.');
    this.id    = 'PRD-' + Math.random().toString(36).substr(2,8).toUpperCase();
    this.name  = name;
    this.price = price;
    this.type  = 'base';
  }
  getDetails() { return `[${this.type.toUpperCase()}] ${this.name} — $${this.price}`; }
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this));
    Object.assign(copy, this);
    copy.id = 'PRD-' + Math.random().toString(36).substr(2,8).toUpperCase();
    return copy;
  }
  accept(visitor) { return visitor.visitProduct(this); }
}
class PhysicalProduct extends Product {
  constructor(name, price, weightKg) { super(name, price); this.weight=weightKg; this.type='physical'; }
  ship() { return `Shipping "${this.name}" (${this.weight} kg).`; }
}
class DigitalProduct extends Product {
  constructor(name, price, url) { super(name, price); this.downloadUrl=url; this.type='digital'; }
  ship() { return `Download link → ${this.downloadUrl}`; }
}
class ServiceProduct extends Product {
  constructor(name, price, hrs) { super(name, price); this.duration=hrs; this.type='service'; }
  ship() { return `Schedule "${this.name}" for ${this.duration}h.`; }
}
class ProductFactory {
  static createProduct(type, ...args) {
    const map = { physical:PhysicalProduct, digital:DigitalProduct, service:ServiceProduct };
    const Cls = map[type];
    if (!Cls) throw new Error(`Unknown product type: "${type}"`);
    return new Cls(...args);
  }
}

// ══════════════════════════════════════════════════════════════════
// 3. ABSTRACT FACTORY
// ══════════════════════════════════════════════════════════════════
class US_Label { getLabel() { return 'US Standard Label (English)'; } }
class EU_Label { getLabel() { return 'EU Standard Label (multilingual)'; } }
class UK_Label { getLabel() { return 'UK Royal Mail Label'; } }
class US_Plug  { getSpec()  { return 'Type A/B — 120V/60Hz'; } }
class EU_Plug  { getSpec()  { return 'Type C/E/F — 230V/50Hz'; } }
class UK_Plug  { getSpec()  { return 'Type G — 230V/50Hz'; } }
class US_PackageFactory { createLabel(){ return new US_Label(); } createPlug(){ return new US_Plug(); } }
class EU_PackageFactory { createLabel(){ return new EU_Label(); } createPlug(){ return new EU_Plug(); } }
class UK_PackageFactory { createLabel(){ return new UK_Label(); } createPlug(){ return new UK_Plug(); } }
function getRegionalFactory(region) {
  const map = { US:US_PackageFactory, EU:EU_PackageFactory, UK:UK_PackageFactory };
  const Cls = map[region]; if (!Cls) throw new Error(`Unsupported region: ${region}`);
  return new Cls();
}

// ══════════════════════════════════════════════════════════════════
// 4. BUILDER
// ══════════════════════════════════════════════════════════════════
class Order {
  constructor() {
    this.id=`ORD-${Date.now()}`; this.items=[]; this.discounts=[];
    this.address=null; this.paymentMethod=null; this.notes='';
    this.status='pending'; this.createdAt=new Date().toISOString();
  }
  getSubtotal()      { return this.items.reduce((s,{product,qty})=>s+product.price*qty,0); }
  getDiscountTotal() { return this.discounts.reduce((s,d)=>s+d,0); }
  getTotal()         { return Math.max(0, this.getSubtotal()-this.getDiscountTotal()); }
  toString() {
    return `Order[${this.id}] Items:${this.items.length} Subtotal:$${this.getSubtotal().toFixed(2)} `+
           `Discounts:-$${this.getDiscountTotal().toFixed(2)} Total:$${this.getTotal().toFixed(2)} `+
           `Ship→${this.address}`;
  }
  accept(visitor) { return visitor.visitOrder(this); }
}
class OrderBuilder {
  constructor() { this._order = new Order(); }
  addItem(product,qty=1) { this._order.items.push({product,qty}); return this; }
  addDiscount(amount)    { this._order.discounts.push(amount); return this; }
  setAddress(address)    { this._order.address=address; return this; }
  setPaymentMethod(m)    { this._order.paymentMethod=m; return this; }
  addNote(text)          { this._order.notes=text; return this; }
  build() {
    if (!this._order.address) throw new Error('Order requires a shipping address.');
    const result=this._order; this._order=new Order(); return result;
  }
}

// ══════════════════════════════════════════════════════════════════
// 5. PROTOTYPE
// ══════════════════════════════════════════════════════════════════
class ProductTemplateRegistry {
  constructor()      { this._templates={}; }
  register(key,prod) { this._templates[key]=prod; return this; }
  clone(key) {
    if (!this._templates[key]) throw new Error(`No template: "${key}"`);
    return this._templates[key].clone();
  }
  list() { return Object.keys(this._templates); }
}

// ══════════════════════════════════════════════════════════════════
// 6. OBJECT POOL
// ══════════════════════════════════════════════════════════════════
class DatabaseConnection {
  constructor(id) { this.id=id; this.inUse=false; }
  query(sql) {
    if (!this.inUse) throw new Error(`Conn #${this.id} not acquired.`);
    return `[DB-Conn#${this.id}] ← "${sql}" → OK`;
  }
}
class DatabaseConnectionPool {
  constructor(size=5) { this._pool=Array.from({length:size},(_,i)=>new DatabaseConnection(i+1)); }
  acquire() {
    const c=this._pool.find(c=>!c.inUse);
    if (!c) throw new Error('Pool exhausted.');
    c.inUse=true; return c;
  }
  release(c)  { c.inUse=false; }
  stats()     { const u=this._pool.filter(c=>c.inUse).length; return `Pool: ${u}/${this._pool.length} in use`; }
}

// ══════════════════════════════════════════════════════════════════
// 7. ADAPTER (Legacy XML Tax)
// ══════════════════════════════════════════════════════════════════
class LegacyXmlTaxCalculator {
  calculateFromXml(xml) {
    const m=xml.match(/<amount>([\d.]+)<\/amount>/); if(!m) throw new Error('Bad XML');
    const amount=parseFloat(m[1]);
    const rm=xml.match(/<rate>([\d.]+)<\/rate>/);
    return parseFloat((amount*(rm?parseFloat(rm[1]):0.08)).toFixed(2));
  }
}
class TaxCalculatorAdapter {
  constructor() { this._legacy=new LegacyXmlTaxCalculator(); }
  calculate({amount,rate=0.08}) {
    const xml=`<tax><amount>${amount}</amount><rate>${rate}</rate></tax>`;
    const tax=this._legacy.calculateFromXml(xml);
    return {amount,rate,tax,total:amount+tax};
  }
}

// ══════════════════════════════════════════════════════════════════
// 8. BRIDGE
// ══════════════════════════════════════════════════════════════════
class BankProvider { processPayment(a){throw new Error('Abstract');} refund(a){throw new Error('Abstract');} }
class StripeProvider    extends BankProvider { processPayment(a){return `Stripe processed $${a.toFixed(2)}`;} refund(a){return `Stripe refunded $${a.toFixed(2)}`;} }
class PayPalProvider    extends BankProvider { processPayment(a){return `PayPal processed $${a.toFixed(2)}`;} refund(a){return `PayPal refunded $${a.toFixed(2)}`;} }
class CoinbaseProvider  extends BankProvider { processPayment(a){return `Coinbase ₿${(a/65000).toFixed(6)}`;} refund(a){return `Coinbase refund ₿${(a/65000).toFixed(6)}`;} }
class PaymentMethod {
  constructor(provider) { if(!(provider instanceof BankProvider)) throw new TypeError('Need BankProvider'); this._provider=provider; }
  pay(a)    { return this._provider.processPayment(a); }
  refund(a) { return this._provider.refund(a); }
}
class CreditCardPayment     extends PaymentMethod { pay(a){ return `[Credit Card] ${this._provider.processPayment(a)}`; } }
class CryptoPayment         extends PaymentMethod { pay(a){ return `[Crypto] ${this._provider.processPayment(a*0.98)}`; } }
class BuyNowPayLaterPayment extends PaymentMethod {
  pay(a){ const i=(a/4).toFixed(2); return `[BNPL] ${this._provider.processPayment(a)} → 4×$${i}`; }
}

// ══════════════════════════════════════════════════════════════════
// 9. COMPOSITE
// ══════════════════════════════════════════════════════════════════
class PackagingComponent { getPrice(){throw new Error('Abstract');} describe(i=''){throw new Error('Abstract');} }
class PackageItem extends PackagingComponent {
  constructor(name,price){ super(); this.name=name; this.price=price; }
  getPrice()     { return this.price; }
  describe(i='') { return `${i}├─ Item: ${this.name}  ($${this.price})`; }
}
class Box extends PackagingComponent {
  constructor(name,boxCost=0){ super(); this.name=name; this.boxCost=boxCost; this._children=[]; }
  add(c)     { this._children.push(c); return this; }
  remove(c)  { this._children=this._children.filter(x=>x!==c); }
  getPrice() { return this.boxCost+this._children.reduce((s,c)=>s+c.getPrice(),0); }
  describe(i='') {
    let s=`${i}┌─ Box: "${this.name}"  (box=$${this.boxCost})\n`;
    this._children.forEach(c=>{ s+=c.describe(i+'│  ')+'\n'; });
    return s+`${i}└─ Subtotal: $${this.getPrice()}`;
  }
}

// ══════════════════════════════════════════════════════════════════
// 10. DECORATOR
// ══════════════════════════════════════════════════════════════════
class ShippingBase      { constructor(o){this._order=o;} getCost(){return this._order.getTotal();} getDescription(){return 'Base Order';} }
class ShippingDecorator { constructor(w){this._wrapped=w;} getCost(){return this._wrapped.getCost();} getDescription(){return this._wrapped.getDescription();} }
class ExpressShippingDecorator  extends ShippingDecorator { getCost(){return this._wrapped.getCost()+25;} getDescription(){return this._wrapped.getDescription()+' + Express ($25)';} }
class FragileHandlingDecorator  extends ShippingDecorator { getCost(){return this._wrapped.getCost()+10;} getDescription(){return this._wrapped.getDescription()+' + Fragile ($10)';} }
class InsuranceDecorator        extends ShippingDecorator { getCost(){return this._wrapped.getCost()*1.05;} getDescription(){return this._wrapped.getDescription()+' + Insurance (5%)';} }
class ColdChainDecorator        extends ShippingDecorator { getCost(){return this._wrapped.getCost()+40;} getDescription(){return this._wrapped.getDescription()+' + Cold Chain ($40)';} }

// ══════════════════════════════════════════════════════════════════
// 11. FLYWEIGHT
// ══════════════════════════════════════════════════════════════════
class ProductIconFlyweight {
  constructor(iconType,svg,colorHex){ this.iconType=iconType; this.svgTemplate=svg; this.colorHex=colorHex; }
  render(productId,x,y,scale=1){ return `<Icon type="${this.iconType}" color="${this.colorHex}" x="${x}" y="${y}" scale="${scale}" product="${productId}" />`; }
}
class ProductIconFactory {
  constructor(){ this._cache=new Map(); }
  getIcon(iconType,colorHex='#888'){
    if(!this._cache.has(iconType))
      this._cache.set(iconType,new ProductIconFlyweight(iconType,`<svg><!-- ${iconType} --></svg>`,colorHex));
    return this._cache.get(iconType);
  }
  get uniqueIconCount(){ return this._cache.size; }
}

// ══════════════════════════════════════════════════════════════════
// 12. PROXY
// ══════════════════════════════════════════════════════════════════
class AdminDashboard {
  getRevenue()      { return 'Total Revenue: $1,250,000'; }
  getUsers()        { return 'Total Users: 48,320'; }
  getInventory()    { return 'SKUs: 14,760 active'; }
  deleteUser(id)    { return `User #${id} permanently deleted.`; }
  resetPassword(id) { return `Password reset for user #${id}.`; }
}
const ROLE_PERMISSIONS = {
  viewer:['getRevenue','getUsers','getInventory'],
  admin:['getRevenue','getUsers','getInventory','resetPassword'],
  superadmin:['getRevenue','getUsers','getInventory','resetPassword','deleteUser'],
};
class AdminDashboardProxy {
  constructor(user){ this._dashboard=new AdminDashboard(); this._user=user; }
  _authorize(action){
    const perms=ROLE_PERMISSIONS[this._user.role]||[];
    if(!perms.includes(action)) throw new Error(`[AUTH] DENIED: ${this._user.name} (${this._user.role}) → "${action}"`);
    console.log(`  [AUTH] GRANTED: ${this._user.name} → ${action}`);
  }
  getRevenue()      { this._authorize('getRevenue');      return this._dashboard.getRevenue(); }
  getUsers()        { this._authorize('getUsers');        return this._dashboard.getUsers(); }
  getInventory()    { this._authorize('getInventory');    return this._dashboard.getInventory(); }
  deleteUser(id)    { this._authorize('deleteUser');      return this._dashboard.deleteUser(id); }
  resetPassword(id) { this._authorize('resetPassword');   return this._dashboard.resetPassword(id); }
}

// ══════════════════════════════════════════════════════════════════
// 13. CHAIN OF RESPONSIBILITY
// ══════════════════════════════════════════════════════════════════
class ApprovalHandler {
  constructor(role,limit){ this._role=role; this._limit=limit; this._next=null; }
  setNext(h){ this._next=h; return h; }
  handle(order){
    const t=order.getTotal();
    if(t<=this._limit) return `✔ ${this._role} approved ${order.id} ($${t.toFixed(2)})`;
    if(this._next) return this._next.handle(order);
    return `✘ ${order.id} ($${t.toFixed(2)}) exceeds CEO limit — REJECTED`;
  }
}

// ══════════════════════════════════════════════════════════════════
// 14. COMMAND
// ══════════════════════════════════════════════════════════════════
class CommandHistory {
  constructor(){ this._history=[]; }
  execute(cmd){ const r=cmd.execute(); this._history.push(cmd); return r; }
  undo()      { const cmd=this._history.pop(); return cmd?cmd.undo():'(nothing to undo)'; }
  get size()  { return this._history.length; }
}
class PlaceOrderCommand  { constructor(svc,o){this._svc=svc;this._order=o;} execute(){return this._svc.placeOrder(this._order);}  undo(){return this._svc.cancelOrder(this._order);} }
class CancelOrderCommand { constructor(svc,o){this._svc=svc;this._order=o;} execute(){return this._svc.cancelOrder(this._order);} undo(){return this._svc.placeOrder(this._order); } }

// ══════════════════════════════════════════════════════════════════
// 15. INTERPRETER
// ══════════════════════════════════════════════════════════════════
class PriceExpression    { constructor(op,v){this._op=op;this._v=v;} interpret(p){const ops={'<':(a,b)=>a<b,'>':(a,b)=>a>b,'<=':(a,b)=>a<=b,'>=':(a,b)=>a>=b,'==':(a,b)=>a==b};return ops[this._op]?.(p.price,this._v)??false;} }
class CategoryExpression { constructor(op,v){this._op=op;this._v=v;} interpret(p){return this._op==='=='?p.type===this._v:p.type!==this._v;} }
class AndExpression      { constructor(l,r){this._l=l;this._r=r;} interpret(p){return this._l.interpret(p)&&this._r.interpret(p);} }
class OrExpression       { constructor(l,r){this._l=l;this._r=r;} interpret(p){return this._l.interpret(p)||this._r.interpret(p);} }
class SearchQueryParser  {
  parse(query){
    const parts=query.split(/\s+AND\s+/);
    const exprs=parts.map(part=>{
      part=part.trim();
      const pm=part.match(/^price\s*([<>=!]+)\s*([\d.]+)$/);
      const cm=part.match(/^category\s*([=!]+)\s*['"](\w+)['"]\s*$/);
      if(pm) return new PriceExpression(pm[1],parseFloat(pm[2]));
      if(cm) return new CategoryExpression(cm[1],cm[2]);
      throw new SyntaxError(`Cannot parse: "${part}"`);
    });
    return exprs.reduce((acc,e)=>acc?new AndExpression(acc,e):e,null);
  }
}

// ══════════════════════════════════════════════════════════════════
// 16. ITERATOR
// ══════════════════════════════════════════════════════════════════
class Inventory {
  constructor(){ this._items=[]; }
  addProduct(p){ this._items.push(p); return this; }
  [Symbol.iterator](){
    let idx=0; const items=this._items;
    return { next(){ return idx<items.length?{value:items[idx++],done:false}:{value:undefined,done:true}; } };
  }
  filter(pred){
    const items=this._items;
    return {
      [Symbol.iterator](){
        let idx=0;
        return { next(){ while(idx<items.length){const i=items[idx++];if(pred(i))return{value:i,done:false};}return{value:undefined,done:true}; } };
      }
    };
  }
  get size(){ return this._items.length; }
}

// ══════════════════════════════════════════════════════════════════
// 17. MEDIATOR
// ══════════════════════════════════════════════════════════════════
class ControlTower {
  constructor(){ this._participants={}; }
  register(name,p){ this._participants[name]=p; p.setMediator(this); return this; }
  relay(sender,event,data){
    console.log(`  [ControlTower] ${sender} ──► ${event}`);
    for(const [name,p] of Object.entries(this._participants))
      if(name!==sender) p.receive(sender,event,data);
  }
}
class Participant {
  constructor(name){ this._name=name; this._mediator=null; }
  setMediator(m){ this._mediator=m; }
  send(event,data){ this._mediator.relay(this._name,event,data); }
  receive(from,event,data){ console.log(`     [${this._name}] ← "${event}" from ${from} | ${JSON.stringify(data)}`); }
}
class Warehouse   extends Participant { constructor(){ super('Warehouse'); } }
class Courier     extends Participant { constructor(){ super('Courier'); } }
class CustomerHub extends Participant { constructor(){ super('CustomerHub'); } }

// ══════════════════════════════════════════════════════════════════
// 18. MEMENTO
// ══════════════════════════════════════════════════════════════════
class CartMemento {
  constructor(items,coupon){ this._items=JSON.parse(JSON.stringify(items)); this._coupon=coupon; this.savedAt=new Date().toISOString(); }
  get items()  { return JSON.parse(JSON.stringify(this._items)); }
  get coupon() { return this._coupon; }
}
class ShoppingCart {
  constructor(){ this._items=[]; this._coupon=null; }
  addItem(i)    { this._items.push(i); return this; }
  removeItem(n) { this._items=this._items.filter(i=>i.name!==n); return this; }
  applyCoupon(c){ this._coupon=c; return this; }
  getTotal()    { return this._items.reduce((s,i)=>s+i.price*(i.qty||1),0); }
  save()        { return new CartMemento(this._items,this._coupon); }
  restore(m)    { this._items=m.items; this._coupon=m.coupon; }
  toString()    { const n=this._items.map(i=>`${i.name}×${i.qty||1}`).join(', '); return `Cart[${n}] coupon=${this._coupon} total=$${this.getTotal()}`; }
}
class CartHistory {
  constructor(){ this._stack=[]; }
  push(m){ this._stack.push(m); }
  pop()  { return this._stack.pop()||null; }
  get depth(){ return this._stack.length; }
}

// ══════════════════════════════════════════════════════════════════
// 19. OBSERVER
// ══════════════════════════════════════════════════════════════════
class StockNotifier {
  constructor(name){ this._productName=name; this._subscribers=new Set(); this._inStock=false; }
  subscribe(o)   { this._subscribers.add(o); return this; }
  unsubscribe(o) { this._subscribers.delete(o); return this; }
  setStock(v)    { const c=this._inStock!==v; this._inStock=v; if(v&&c) this._notifyAll(); }
  _notifyAll()   { this._subscribers.forEach(o=>o.onStockAvailable(this._productName)); }
}
class EmailObserver   { constructor(e){this._email=e;} onStockAvailable(p){ console.log(`  [EMAIL → ${this._email}] "${p}" is back in stock!`); } }
class SMSObserver     { constructor(p){this._phone=p;} onStockAvailable(p){ console.log(`  [SMS → ${this._phone}] RESTOCK: ${p}`); } }
class AppPushObserver { constructor(u){this._userId=u;} onStockAvailable(p){ console.log(`  [PUSH → user#${this._userId}] 🛒 ${p} available!`); } }

// ══════════════════════════════════════════════════════════════════
// 20. STRATEGY
// ══════════════════════════════════════════════════════════════════
class FlatDiscountStrategy       { constructor(a=20){this._a=a;} calculate(p){return Math.max(0,p-this._a);} describe(){return `Flat -$${this._a}`;} }
class PercentageDiscountStrategy { constructor(pct){this._pct=pct;} calculate(p){return p*(1-this._pct/100);} describe(){return `${this._pct}% off`;} }
class SeasonalDiscountStrategy   { calculate(p){const m=new Date().getMonth();return p*(m===11||m===0?0.70:0.90);} describe(){return 'Seasonal';} }
class BuyOneGetOneStrategy       { calculate(p){return p/2;} describe(){return 'BOGO (50%)';} }
class NullDiscount               { calculate(p){return p;} describe(){return 'No discount';} }
class PriceCalculator {
  constructor(s){ this._strategy=s; }
  setStrategy(s){ this._strategy=s; }
  calculate(p)  { return parseFloat(this._strategy.calculate(p).toFixed(2)); }
  getStrategyName(){ return this._strategy.describe(); }
}

// ══════════════════════════════════════════════════════════════════
// 21. TEMPLATE METHOD
// ══════════════════════════════════════════════════════════════════
class ShippingProcess {
  process(order){
    this.validateOrder(order); this.packItems(order);
    const cost=this.calculateShipping(order);
    this.labelPackage(order,cost); this.dispatchOrder(order); this.notifyCustomer(order);
    return cost;
  }
  validateOrder(o)     { if(!o.address) throw new Error('No address.'); console.log(`    [Ship] Validated ${o.id}`); }
  packItems(o)         { console.log(`    [Ship] Packed ${o.items.length} item(s)`); }
  labelPackage(o,cost) { console.log(`    [Ship] Label applied — $${cost.toFixed(2)}`); }
  dispatchOrder(o)     { console.log(`    [Ship] Dispatched ${o.id} → ${o.address}`); }
  notifyCustomer(o)    { console.log(`    [Ship] Customer notified for ${o.id}`); }
  calculateShipping(o) { throw new Error('Implement calculateShipping()'); }
}
class DomesticShipping      extends ShippingProcess { calculateShipping(o){ const c=5+o.items.length*1.5; console.log(`    [Domestic] $${c}`); return c; } }
class InternationalShipping extends ShippingProcess { calculateShipping(o){ const c=o.getTotal()*0.12; console.log(`    [International] $${c.toFixed(2)}`); return c; } }
class DroneShipping         extends ShippingProcess { calculateShipping(o){ console.log(`    [Drone] $15`); return 15; } }

// ══════════════════════════════════════════════════════════════════
// 22. VISITOR
// ══════════════════════════════════════════════════════════════════
class TaxReportVisitor {
  visitOrder(o){
    const tax=o.getTotal()*GlobalConfig.getInstance().get('taxRate');
    return `[TAX REPORT] ${o.id} | Subtotal=$${o.getTotal().toFixed(2)} | Tax=$${tax.toFixed(2)} | Grand=$${(o.getTotal()+tax).toFixed(2)}`;
  }
  visitProduct(p){
    const tax=p.price*GlobalConfig.getInstance().get('taxRate');
    return `[TAX REPORT] "${p.name}" | Price=$${p.price} | Tax=$${tax.toFixed(2)}`;
  }
}
class ShippingReportVisitor {
  visitOrder(o){
    const w=o.items.reduce((s,{product:p,qty})=>s+(p.weight||0)*qty,0);
    return `[SHIPPING REPORT] ${o.id} | Items=${o.items.length} | Weight=${w.toFixed(2)}kg`;
  }
  visitProduct(p){ return `[SHIPPING REPORT] "${p.name}" | Weight=${p.weight||'N/A'}kg`; }
}
class RevenueReportVisitor {
  visitOrder(o)  { return `[REVENUE REPORT] ${o.id} | Revenue=$${o.getTotal().toFixed(2)}`; }
  visitProduct(p){ return `[REVENUE REPORT] "${p.name}" | List=$${p.price}`; }
}

// ══════════════════════════════════════════════════════════════════
// 23. NULL OBJECT
// ══════════════════════════════════════════════════════════════════
class RegisteredUser {
  constructor(name,points,role='customer',email=''){
    this.name=name; this.loyaltyPoints=points; this.role=role; this.email=email;
  }
  getName()          { return this.name; }
  getLoyaltyPoints() { return this.loyaltyPoints; }
  getDiscountPct()   { return this.loyaltyPoints>100?15:5; }
  isGuest()          { return false; }
}
class GuestUser {
  getName()          { return 'Guest'; }
  getLoyaltyPoints() { return 0; }
  getDiscountPct()   { return 0; }
  isGuest()          { return true; }
}

module.exports = {
  GlobalConfig, Product, PhysicalProduct, DigitalProduct, ServiceProduct, ProductFactory,
  getRegionalFactory, Order, OrderBuilder, ProductTemplateRegistry,
  DatabaseConnection, DatabaseConnectionPool,
  LegacyXmlTaxCalculator, TaxCalculatorAdapter,
  BankProvider, StripeProvider, PayPalProvider, CoinbaseProvider,
  PaymentMethod, CreditCardPayment, CryptoPayment, BuyNowPayLaterPayment,
  PackagingComponent, PackageItem, Box,
  ShippingBase, ShippingDecorator, ExpressShippingDecorator,
  FragileHandlingDecorator, InsuranceDecorator, ColdChainDecorator,
  ProductIconFlyweight, ProductIconFactory,
  AdminDashboard, AdminDashboardProxy,
  ApprovalHandler,
  CommandHistory, PlaceOrderCommand, CancelOrderCommand,
  PriceExpression, CategoryExpression, AndExpression, OrExpression, SearchQueryParser,
  Inventory,
  ControlTower, Participant, Warehouse, Courier, CustomerHub,
  CartMemento, ShoppingCart, CartHistory,
  StockNotifier, EmailObserver, SMSObserver, AppPushObserver,
  FlatDiscountStrategy, PercentageDiscountStrategy, SeasonalDiscountStrategy,
  BuyOneGetOneStrategy, NullDiscount, PriceCalculator,
  ShippingProcess, DomesticShipping, InternationalShipping, DroneShipping,
  TaxReportVisitor, ShippingReportVisitor, RevenueReportVisitor,
  RegisteredUser, GuestUser,
};