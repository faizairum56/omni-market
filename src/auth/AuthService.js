'use strict';

/**
 * auth/AuthService.js
 * -------------------
 * PATTERN : FACADE — exposes simple register() / login() methods
 *           that internally coordinate bcrypt, UserRepository,
 *           and JwtService. Callers don't need to know the details.
 *
 * SOLID
 *   SRP : Only handles user credential operations.
 *         Route handling is in routes/auth.js.
 *         Token logic is in JwtService.
 *   DIP : Depends on UserRepository + JwtService abstractions.
 *   OCP : New auth strategies (OAuth, magic link) can be added as
 *         new methods without changing existing ones.
 */

const bcrypt = require('bcryptjs');
const { JwtService } = require('./JwtService');

const SALT_ROUNDS = 12;

class AuthService {
  /**
   * @param {import('../repositories/UserRepository').UserRepository} userRepo
   */
  constructor(userRepo) {
    this._userRepo = userRepo;
    this._jwt      = JwtService.getInstance();
  }

  // ── Register ─────────────────────────────────────────────────────

  /**
   * Create a new registered user with a hashed password.
   * Returns the JWT token on success.
   *
   * @param {{ name, email, password, role? }} data
   */
  async register({ name, email, password, role = 'customer' }) {
    // 1. Check duplicate email
    const existing = this._userRepo.findByEmail(email);
    if (existing) throw Object.assign(new Error('Email already registered'), { status: 409 });

    // 2. Validate password strength
    if (!password || password.length < 8)
      throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });

    // 3. Hash password with bcrypt
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Persist user (with hash)
    const userId = this._userRepo.createWithHash({ name, email, role, hash });

    // 5. Issue JWT
    const token = this._jwt.sign({ id: userId, email, role, name });

    console.log(`  [AUTH] ✔ Registered "${email}" as ${role}`);
    return { userId, name, email, role, token };
  }

  // ── Login ────────────────────────────────────────────────────────

  /**
   * Verify credentials and return a JWT on success.
   * @param {{ email, password }} data
   */
  async login({ email, password }) {
    // 1. Find user
    const row = this._userRepo.findByEmail(email);
    if (!row) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

    // 2. Compare password with stored hash
    if (!row.password_hash)
      throw Object.assign(new Error('Account has no password set — use OAuth or reset'), { status: 401 });

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) throw Object.assign(new Error('Invalid email or password'), { status: 401 });

    // 3. Issue JWT
    const token = this._jwt.sign({
      id   : row.id,
      email: row.email,
      role : row.role,
      name : row.name,
    });

    console.log(`  [AUTH] ✔ Login "${email}" (${row.role})`);
    return { userId: row.id, name: row.name, email: row.email, role: row.role, token };
  }

  // ── Change password ──────────────────────────────────────────────

  /**
   * @param {number} userId
   * @param {{ currentPassword, newPassword }} data
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    const row = this._userRepo.findById(userId);
    if (!row) throw Object.assign(new Error('User not found'), { status: 404 });

    const match = await bcrypt.compare(currentPassword, row.password_hash || '');
    if (!match) throw Object.assign(new Error('Current password incorrect'), { status: 401 });

    if (!newPassword || newPassword.length < 8)
      throw Object.assign(new Error('New password must be at least 8 characters'), { status: 400 });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    this._userRepo.updatePasswordHash(userId, hash);
    return { message: 'Password changed successfully' };
  }
}

module.exports = { AuthService };