'use strict';

/**
 * routes/payment.js  (Level 3)
 * PATTERN: BRIDGE — RealStripeProvider plugs into CreditCardPayment
 * exactly like the mock StripeProvider.  Route code is identical to
 * Level 2 — only the provider object changes (Bridge pattern payoff).
 */

const express = require('express');
const router  = express.Router();
const { requireCustomer }    = require('../middleware/auth');
const { httpError }          = require('../middleware/errorHandler');
const { RealStripeProvider } = require('../../integrations/RealStripeProvider');
const {
  CreditCardPayment, CryptoPayment, BuyNowPayLaterPayment,
  PayPalProvider, CoinbaseProvider,
  TaxCalculatorAdapter,
  FlatDiscountStrategy, PercentageDiscountStrategy,
  NullDiscount, PriceCalculator,
} = require('../../patterns/omni-market');

const taxAdapter = new TaxCalculatorAdapter();
const realStripe = new RealStripeProvider();

router.post('/', requireCustomer, async (req, res, next) => {
  try {
    const {
      orderId, amount, method = 'creditcard', provider = 'stripe',
      discountType = 'none', discountValue = 0,
      paymentMethodId = 'pm_card_visa',
    } = req.body;

    if (amount === undefined || isNaN(parseFloat(amount)))
      throw httpError(400, '`amount` (number) is required');

    const providerMap = { stripe:realStripe, paypal:new PayPalProvider(), coinbase:new CoinbaseProvider() };
    const bankProvider = providerMap[provider.toLowerCase()];
    if (!bankProvider) throw httpError(400, `Unknown provider "${provider}"`);

    const methodMap = { creditcard:CreditCardPayment, crypto:CryptoPayment, bnpl:BuyNowPayLaterPayment };
    const MethodCls = methodMap[method.toLowerCase()];
    if (!MethodCls) throw httpError(400, `Unknown method "${method}"`);

    const paymentMethod = new MethodCls(bankProvider);

    const strategyMap = {
      flat: new FlatDiscountStrategy(parseFloat(discountValue)),
      percentage: new PercentageDiscountStrategy(parseFloat(discountValue)),
      none: new NullDiscount(),
    };
    const strategy   = strategyMap[discountType.toLowerCase()] || new NullDiscount();
    const discounted = new PriceCalculator(strategy).calculate(parseFloat(amount));
    const taxResult  = taxAdapter.calculate({ amount: discounted, rate: 0.10 });
    const charged    = parseFloat(taxResult.total.toFixed(2));

    let receipt;
    if (provider.toLowerCase() === 'stripe' && !realStripe.isSimulation) {
      receipt = await realStripe.processPayment(charged, 'usd', paymentMethodId);
    } else {
      receipt = paymentMethod.pay(charged);
    }

    res.status(200).json({
      success:true, orderId:orderId||null,
      originalAmount:parseFloat(amount), discount:strategy.describe(),
      afterDiscount:discounted, tax:taxResult.tax, charged, method, provider,
      stripeMode: provider==='stripe' ? (realStripe.isSimulation?'simulation':'live-test') : 'mock',
      receipt,
    });
  } catch(e) { next(e); }
});

router.post('/refund', requireCustomer, async (req, res, next) => {
  try {
    const { amount, provider = 'stripe', paymentIntentId } = req.body;
    if (!amount) throw httpError(400, '`amount` required');
    const receipt = provider.toLowerCase() === 'stripe'
      ? await realStripe.refund(parseFloat(amount), paymentIntentId)
      : new PayPalProvider().refund(parseFloat(amount));
    res.json({ success:true, refunded:parseFloat(amount), provider, receipt });
  } catch(e) { next(e); }
});

module.exports = router;