'use strict';

/**
 * routes/auth.js
 * --------------
 * PATTERN  : FACADE (AuthService) — hides bcrypt + JWT + DB behind
 *            simple register() / login() calls.
 * PATTERN  : OBSERVER — WelcomeEmailObserver fires after registration.
 * PATTERN  : PROXY    — requireAdmin protects the seed-admin route.
 *
 * SOLID
 *   SRP : Only handles /auth HTTP endpoints.
 *   DIP : Depends on AuthService, not on bcrypt or jwt directly.
 *
 * ENDPOINTS
 *   POST  /auth/register        — create account, get JWT
 *   POST  /auth/login           — verify credentials, get JWT
 *   GET   /auth/me              — return current user from JWT
 *   POST  /auth/change-password — update password (requires JWT)
 */

const express    = require('express');
const router     = express.Router();
const { AuthService }          = require('../../auth/AuthService');
const { attachIdentity, requireAdmin } = require('../middleware/auth');
const { httpError }            = require('../middleware/errorHandler');
const { WelcomeEmailObserver } = require('../../integrations/MailerService');

// ── POST /auth/register ──────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      throw httpError(400, 'name, email and password are required');

    const authSvc = new AuthService(req.app.locals.userRepo);
    const result  = await authSvc.register({ name, email, password, role });

    // OBSERVER — send welcome email (fire-and-forget, don't block response)
    new WelcomeEmailObserver(email, name).send().catch(() => {});

    res.status(201).json({
      success : true,
      message : 'Account created successfully',
      data    : {
        userId : result.userId,
        name   : result.name,
        email  : result.email,
        role   : result.role,
        token  : result.token,
      },
    });
  } catch(e) { next(e); }
});

// ── POST /auth/login ─────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      throw httpError(400, 'email and password are required');

    const authSvc = new AuthService(req.app.locals.userRepo);
    const result  = await authSvc.login({ email, password });

    res.json({
      success : true,
      message : 'Login successful',
      data    : {
        userId : result.userId,
        name   : result.name,
        email  : result.email,
        role   : result.role,
        token  : result.token,
      },
    });
  } catch(e) { next(e); }
});

// ── GET /auth/me ─────────────────────────────────────────────────
// Returns the user profile from the JWT without hitting the DB.
router.get('/me', attachIdentity, (req, res, next) => {
  try {
    if (!req.user?.id && req.user?.role === 'guest')
      throw httpError(401, 'Not authenticated — please login or register');

    const row = req.app.locals.userRepo.findById(req.user.id);
    if (!row) throw httpError(404, 'User not found');

    res.json({
      success : true,
      data    : {
        id             : row.id,
        name           : row.name,
        email          : row.email,
        role           : row.role,
        loyaltyPoints  : row.loyalty_points,
        createdAt      : row.created_at,
      },
    });
  } catch(e) { next(e); }
});

// ── POST /auth/change-password ────────────────────────────────────
router.post('/change-password', attachIdentity, async (req, res, next) => {
  try {
    if (!req.user?.id) throw httpError(401, 'Must be logged in');

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      throw httpError(400, 'currentPassword and newPassword required');

    const authSvc = new AuthService(req.app.locals.userRepo);
    const result  = await authSvc.changePassword(req.user.id, { currentPassword, newPassword });
    res.json({ success:true, message: result.message });
  } catch(e) { next(e); }
});

module.exports = router;