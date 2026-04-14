'use strict';

/**
 * integrations/MailerService.js
 * ------------------------------
 * PATTERN  : OBSERVER — RealEmailObserver implements the same
 *            onStockAvailable(productName) interface as the mock
 *            EmailObserver, but sends a real email via Nodemailer.
 *
 *            StockNotifier.subscribe(new RealEmailObserver(email))
 *            works identically — StockNotifier never knows the
 *            difference.  That is LSP in action.
 *
 * PATTERN  : SINGLETON — one transporter instance is reused across
 *            all notification sends (expensive to recreate).
 *
 * SOLID
 *   OCP : New notification channels (Slack, WhatsApp) are new
 *         observer classes — StockNotifier never changes.
 *   SRP : MailerService only creates/manages the SMTP connection.
 *         Message formatting is in each observer subclass.
 *   DIP : StockNotifier depends on the observer interface
 *         { onStockAvailable }, not on Nodemailer.
 *
 * SETUP (Gmail)
 * ─────────────────────────────────────────────────────────────────
 * 1. Enable 2-Step Verification on your Google account.
 * 2. Google Account → Security → App passwords → create one.
 * 3. Set MAIL_USER and MAIL_PASS in .env.
 * 4. MAIL_HOST=smtp.gmail.com  MAIL_PORT=587
 *
 * GRACEFUL DEGRADATION
 * If credentials are missing, logs to console instead of sending.
 */

const nodemailer = require('nodemailer');

// ── MailerService (Singleton) ─────────────────────────────────────

class MailerService {
  constructor() {
    if (MailerService._instance) return MailerService._instance;

    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    const host = process.env.MAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.MAIL_PORT || '587');

    this._simMode = !user || !pass || user.includes('your_email');

    if (this._simMode) {
      this._transport = null;
      console.warn('  [Mailer] No MAIL_USER/MAIL_PASS — running in simulation mode');
    } else {
      this._transport = nodemailer.createTransport({
        host,
        port,
        secure : port === 465,
        auth   : { user, pass },
      });
    }

    this._from = process.env.MAIL_FROM || `"Omni-Market" <${user || 'noreply@omni.market'}>`;
    MailerService._instance = this;
  }

  static getInstance() {
    if (!MailerService._instance) new MailerService();
    return MailerService._instance;
  }

  /**
   * Send an email.
   * @param {{ to, subject, text, html }} options
   */
  async send({ to, subject, text, html }) {
    if (this._simMode) {
      console.log(`  [Mailer SIM] → ${to} | ${subject}`);
      console.log(`    ${text}`);
      return { simulated: true, to, subject };
    }

    try {
      const info = await this._transport.sendMail({
        from: this._from, to, subject,
        text : text || '',
        html : html || `<p>${text}</p>`,
      });
      console.log(`  [Mailer] ✔ Sent to ${to} | messageId: ${info.messageId}`);
      return { messageId: info.messageId, to, subject };
    } catch (err) {
      console.error(`  [Mailer] ✘ Failed to send to ${to}: ${err.message}`);
      throw err;
    }
  }

  get isSimulation() { return this._simMode; }
}

// ── RealEmailObserver (Observer pattern) ──────────────────────────

class RealEmailObserver {
  /**
   * @param {string} email  Subscriber's email address
   */
  constructor(email) {
    this._email  = email;
    this._mailer = MailerService.getInstance();
  }

  /**
   * Called by StockNotifier when an item comes back in stock.
   * Exact same interface as the mock EmailObserver — fully substitutable (LSP).
   */
  async onStockAvailable(productName) {
    await this._mailer.send({
      to      : this._email,
      subject : `🛒 Back in Stock: ${productName}`,
      text    : `Good news! "${productName}" is back in stock on Omni-Market. Shop now before it sells out again.`,
      html    : `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#3B82F6">🛒 Back in Stock!</h2>
          <p>Good news — <strong>${productName}</strong> is available again on Omni-Market.</p>
          <a href="https://omni-market.io/products" 
             style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">
            Shop Now
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px">
            You're receiving this because you subscribed to restock alerts.
          </p>
        </div>
      `,
    });
  }
}

// ── WelcomeEmailObserver — sent after registration ────────────────

class WelcomeEmailObserver {
  constructor(email, name) { this._email = email; this._name = name; }

  async send() {
    const mailer = MailerService.getInstance();
    await mailer.send({
      to      : this._email,
      subject : `Welcome to Omni-Market, ${this._name}!`,
      text    : `Hi ${this._name}, your account has been created. Start shopping at omni-market.io`,
      html    : `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#10B981">Welcome to Omni-Market!</h2>
          <p>Hi <strong>${this._name}</strong>, your account is ready.</p>
          <a href="https://omni-market.io" 
             style="background:#10B981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">
            Start Shopping
          </a>
        </div>
      `,
    });
  }
}

module.exports = { MailerService, RealEmailObserver, WelcomeEmailObserver };