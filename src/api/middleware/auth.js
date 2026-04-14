'use strict';

/**
 * middleware/auth.js  (Level 3 — JWT version)
 * PATTERN: PROXY — intercepts every request before the real route handler.
 * Level 2 read role from X-User-Role header (easy to fake).
 * Level 3 reads a real signed JWT from the Authorization header.
 * Falls back to X-User-Role for backwards-compatible dev/testing.
 */

const { JwtService } = require('../../auth/JwtService');

const ROLE_HIERARCHY = ['guest', 'customer', 'viewer', 'admin', 'superadmin'];

function getRoleLevel(role) {
  const idx = ROLE_HIERARCHY.indexOf((role || 'guest').toLowerCase());
  return idx === -1 ? 0 : idx;
}

function attachIdentity(req, res, next) {
  const authHeader = req.headers['authorization'];
  const jwtSvc     = JwtService.getInstance();

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token   = authHeader.slice(7);
      const payload = jwtSvc.verify(token);
      req.user = { id:payload.id, name:payload.name||'Unknown', email:payload.email||'', role:payload.role||'customer' };
      return next();
    } catch (err) {
      return res.status(401).json({ success:false, error:`Invalid or expired token: ${err.message}` });
    }
  }

  // Fallback to X-User-Role header for dev convenience
  req.user = {
    id    : null,
    name  : req.headers['x-user-name'] || 'Anonymous',
    email : '',
    role  : (req.headers['x-user-role'] || 'guest').toLowerCase(),
  };
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role || 'guest';
    if (role === 'superadmin' || allowedRoles.includes(role)) {
      console.log(`  [AUTH] ✔ ${req.user?.name} (${role}) → ${req.method} ${req.path}`);
      return next();
    }
    console.log(`  [AUTH] ✘ ${req.user?.name} (${role}) denied`);
    return res.status(403).json({ success:false, error:`Forbidden: role "${role}" cannot ${req.method} ${req.path}` });
  };
}

function requireMinRole(minRole) {
  const minLevel = getRoleLevel(minRole);
  return (req, res, next) => {
    const level = getRoleLevel(req.user?.role || 'guest');
    if (level >= minLevel) return next();
    return res.status(403).json({ success:false, error:`Requires at least role "${minRole}"` });
  };
}

function requireOwnerOrAdmin(req, res, next) {
  const role    = req.user?.role || 'guest';
  const isAdmin = getRoleLevel(role) >= getRoleLevel('admin');
  const isOwner = req.user?.id && req.user.id === parseInt(req.params.id);
  if (isAdmin || isOwner) return next();
  return res.status(403).json({ success:false, error:'Access denied: you can only access your own data' });
}

const requireAdmin    = requireRole('admin', 'superadmin');
const requireCustomer = requireMinRole('customer');
const requireViewer   = requireMinRole('viewer');
const openAccess      = (req, res, next) => next();

module.exports = {
  attachIdentity, attachRole: attachIdentity,
  requireRole, requireMinRole, requireOwnerOrAdmin,
  requireAdmin, requireCustomer, requireViewer, openAccess,
};