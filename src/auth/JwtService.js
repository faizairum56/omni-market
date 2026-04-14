'use strict';

/**
 * auth/JwtService.js
 * ------------------
 * PATTERN : SINGLETON — one JwtService instance manages all tokens.
 * SOLID
 *   SRP : Only responsibility is sign / verify / decode JWT tokens.
 *         Password hashing, DB lookups — all elsewhere.
 *   DIP : Auth middleware depends on JwtService (abstraction),
 *         not on the jsonwebtoken library directly.
 */

const jwt = require('jsonwebtoken');

class JwtService {
  constructor() {
    if (JwtService._instance) return JwtService._instance;
    this._secret  = process.env.JWT_SECRET  || 'omni-market-dev-secret-change-in-production';
    this._expires = process.env.JWT_EXPIRES_IN || '7d';
    JwtService._instance = this;
  }

  static getInstance() {
    if (!JwtService._instance) new JwtService();
    return JwtService._instance;
  }

  /**
   * Sign a payload and return a JWT string.
   * @param {{ id, email, role, name }} payload
   */
  sign(payload) {
    return jwt.sign(payload, this._secret, { expiresIn: this._expires });
  }

  /**
   * Verify a token. Returns the decoded payload or throws.
   * @param {string} token
   */
  verify(token) {
    return jwt.verify(token, this._secret);
  }

  /**
   * Decode without verifying — useful for extracting claims
   * from an expired token to decide on refresh logic.
   */
  decode(token) {
    return jwt.decode(token);
  }
}

module.exports = { JwtService };