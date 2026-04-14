'use strict';

/**
 * integrations/ShippoService.js
 * ------------------------------
 * PATTERN  : TEMPLATE METHOD extension
 *            ShippoShipping extends ShippingProcess and overrides
 *            calculateShipping() to call the real Shippo API
 *            instead of a flat-rate formula.
 *
 *            All other steps (validate, pack, label, dispatch, notify)
 *            are inherited unchanged — only the one variable step changes.
 *            This is the core benefit of Template Method.
 *
 * PATTERN  : ADAPTER
 *            Shippo's response format (array of rates with carrier codes,
 *            amounts, estimated days) is wrapped into our standard
 *            { provider, service, amount, currency, estDays } shape.
 *
 * SOLID
 *   SRP : Only handles Shippo API communication.
 *         DB persistence of quotes is in ShippingQuoteRepository.
 *   OCP : Add new carriers by adding to the Shippo account — zero
 *         code changes here.
 *   DIP : Routes depend on ShippoService, not on the Shippo SDK.
 *
 * GRACEFUL DEGRADATION
 * If SHIPPO_API_KEY is missing or the API fails, returns mock rates
 * so the rest of the system keeps working.
 */

const https = require('https');
const { ShippingProcess } = require('../patterns/omni-market');

// ── Shippo Adapter helper ─────────────────────────────────────────

class ShippoService {
  constructor() {
    this._apiKey  = process.env.SHIPPO_API_KEY || '';
    this._simMode = !this._apiKey || this._apiKey.includes('your_key');
    if (this._simMode) {
      console.warn('  [Shippo] No SHIPPO_API_KEY — running in simulation mode');
    }
  }

  /**
   * Get shipping rates for a parcel.
   * @param {{ weight, fromZip, toZip, fromCountry, toCountry }} params
   * @returns {Promise<Array<{ provider, service, amount, currency, estDays }>>}
   */
  async getRates({ weight = 1, fromZip = '10001', toZip = '90001',
                   fromCountry = 'US', toCountry = 'US' }) {
    if (this._simMode) return this._mockRates(weight);

    const body = JSON.stringify({
      address_from : { zip: fromZip, country: fromCountry },
      address_to   : { zip: toZip,   country: toCountry   },
      parcels      : [{ weight: String(weight), mass_unit: 'kg',
                        length: '30', width: '20', height: '15', distance_unit: 'cm' }],
      async        : false,
    });

    try {
      const raw   = await this._post('/shipments', body);
      const rates = raw.rates || [];
      return rates.map(r => ({
        provider : r.provider,
        service  : r.servicelevel?.name || r.servicelevel_token,
        amount   : parseFloat(r.amount),
        currency : r.currency,
        estDays  : r.estimated_days,
      }));
    } catch (err) {
      console.warn(`  [Shippo] API error: ${err.message} — using mock rates`);
      return this._mockRates(weight);
    }
  }

  _mockRates(weight) {
    const base = 5 + weight * 2;
    return [
      { provider:'USPS',  service:'Priority Mail',    amount: parseFloat(base.toFixed(2)),         currency:'USD', estDays:3 },
      { provider:'UPS',   service:'Ground',           amount: parseFloat((base*1.3).toFixed(2)),   currency:'USD', estDays:5 },
      { provider:'FedEx', service:'2Day',             amount: parseFloat((base*2.1).toFixed(2)),   currency:'USD', estDays:2 },
      { provider:'DHL',   service:'Express Worldwide',amount: parseFloat((base*2.8).toFixed(2)),   currency:'USD', estDays:1 },
    ];
  }

  _post(path, body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname : 'api.goshippo.com',
        path,
        method  : 'POST',
        headers : {
          'Authorization' : `ShippoToken ${this._apiKey}`,
          'Content-Type'  : 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end',  ()    => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Invalid JSON from Shippo')); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  get isSimulation() { return this._simMode; }
}

// ── Template Method subclass using Shippo ─────────────────────────

class ShippoShipping extends ShippingProcess {
  constructor(shippoService) {
    super();
    this._shippo = shippoService;
  }

  /**
   * Override the single variable step — everything else is inherited
   * from ShippingProcess (validate, pack, label, dispatch, notify).
   */
  async calculateShipping(order) {
    // Extract total weight from order items
    const weight = order.items.reduce(
      (sum, { product, qty }) => sum + (product.weight || 0.5) * qty, 0
    );

    const rates = await this._shippo.getRates({ weight });
    if (!rates.length) return 9.99;

    // Pick cheapest rate
    const cheapest = rates.sort((a,b) => a.amount - b.amount)[0];
    console.log(`    [Shippo] ${cheapest.provider} ${cheapest.service} → $${cheapest.amount} (${cheapest.estDays}d)`);
    return cheapest.amount;
  }
}

module.exports = { ShippoService, ShippoShipping };