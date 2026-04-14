'use strict';

/**
 * integrations/RealStripeProvider.js
 * ------------------------------------
 * PATTERN  : BRIDGE — Implementor
 *            RealStripeProvider extends BankProvider and plugs straight
 *            into CreditCardPayment / CryptoPayment / BuyNowPayLaterPayment
 *            without touching any of those classes.
 *
 * SOLID
 *   OCP : The existing PaymentMethod hierarchy never changes — we just
 *         swap the mock StripeProvider for this real one.
 *   SRP : Only responsibility is calling the Stripe API.
 *   DIP : PaymentMethod depends on BankProvider abstraction — it cannot
 *         tell whether it is talking to the mock or this real provider.
 *
 * HOW STRIPE TEST MODE WORKS
 * ─────────────────────────────────────────────────────────────────
 * 1. Set STRIPE_SECRET_KEY=sk_test_... in your .env
 * 2. Use test card numbers (never real cards in test mode):
 *    Success : 4242 4242 4242 4242  exp: any future date  cvc: any 3 digits
 *    Decline : 4000 0000 0000 0002
 * 3. All transactions appear in https://dashboard.stripe.com/test/payments
 *
 * This provider creates a PaymentIntent (the modern Stripe approach)
 * and immediately confirms it using a test payment method token.
 */

const { BankProvider } = require('../patterns/omni-market');

class RealStripeProvider extends BankProvider {
  constructor() {
    super();
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !key.startsWith('sk_')) {
      // Graceful degradation — fall back to simulation if key missing
      this._stripe  = null;
      this._simMode = true;
      console.warn('  [Stripe] No valid STRIPE_SECRET_KEY — running in simulation mode');
    } else {
      this._stripe  = require('stripe')(key);
      this._simMode = false;
    }
  }

  /**
   * Charge a customer.
   * amount is in dollars — we convert to cents for Stripe.
   * Returns a human-readable receipt string (same interface as mock).
   */
  async processPayment(amount, currency = 'usd', paymentMethodId = 'pm_card_visa') {
    const cents = Math.round(parseFloat(amount) * 100);

    if (this._simMode) {
      return `[Stripe SIM] Charged $${amount.toFixed(2)} — no API key configured`;
    }

    try {
      const intent = await this._stripe.paymentIntents.create({
        amount              : cents,
        currency,
        payment_method      : paymentMethodId,
        confirm             : true,
        return_url          : 'https://omni-market.io/payment/complete',
        description         : 'Omni-Market order payment',
      });

      return `[Stripe LIVE] PaymentIntent ${intent.id} status=${intent.status} $${amount.toFixed(2)} ${currency.toUpperCase()}`;
    } catch (err) {
      throw Object.assign(
        new Error(`Stripe payment failed: ${err.message}`),
        { status: 402, stripeCode: err.code }
      );
    }
  }

  /**
   * Refund a previous payment intent.
   * @param {number} amount  Dollar amount to refund
   * @param {string} paymentIntentId  The intent ID returned from processPayment
   */
  async refund(amount, paymentIntentId) {
    if (this._simMode) {
      return `[Stripe SIM] Refunded $${amount.toFixed(2)}`;
    }

    try {
      const cents  = Math.round(parseFloat(amount) * 100);
      const refund = await this._stripe.refunds.create({
        payment_intent : paymentIntentId,
        amount         : cents,
      });

      return `[Stripe LIVE] Refund ${refund.id} status=${refund.status} $${amount.toFixed(2)}`;
    } catch (err) {
      throw Object.assign(
        new Error(`Stripe refund failed: ${err.message}`),
        { status: 402 }
      );
    }
  }

  get isSimulation() { return this._simMode; }
}

module.exports = { RealStripeProvider };