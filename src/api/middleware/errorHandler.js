'use strict';

/**
 * errorHandler.js
 * ---------------
 * SOLID SRP: The sole responsibility of this middleware is to catch
 * any error thrown anywhere in the route chain and return a clean
 * JSON response — no error-handling logic lives in the routes.
 *
 * Express identifies error-handling middleware by the 4-argument
 * signature (err, req, res, next).
 */

function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Only log stack traces in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`  [ERROR] ${req.method} ${req.path} → ${status}: ${message}`);
  }

  res.status(status).json({
    success : false,
    error   : message,
    path    : req.path,
    method  : req.method,
  });
}

/**
 * notFound — called when no route matched.
 * Placed AFTER all routes in server.js.
 */
function notFound(req, res) {
  res.status(404).json({
    success : false,
    error   : `Route not found: ${req.method} ${req.path}`,
  });
}

/**
 * Small helper used inside route handlers to throw
 * HTTP errors cleanly:  throw httpError(400, 'Bad input')
 */
function httpError(status, message) {
  const err    = new Error(message);
  err.status   = status;
  return err;
}

module.exports = { errorHandler, notFound, httpError };