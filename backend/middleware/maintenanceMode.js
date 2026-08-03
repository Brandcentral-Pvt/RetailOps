/**
 * Maintenance-mode middleware.
 * When MAINTENANCE_MODE=true, all /api/* requests return 503 except the
 * health endpoints (so load balancers / uptime checks still work).
 */
function maintenanceMode(req, res, next) {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
  if (!isMaintenance) return next();

  const isHealth = req.path === '/health' || req.path === '/api/health' || req.path.startsWith('/api/health');
  if (isHealth) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(503).json({
      success: false,
      error: 'Service is currently under maintenance. Please try again later.',
      code: 'MAINTENANCE_MODE',
    });
  }

  next();
}

module.exports = maintenanceMode;
