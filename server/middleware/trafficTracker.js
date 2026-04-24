/**
 * ============================================
 * RutaQuilla - Traffic Tracker Middleware
 * ============================================
 *
 * In-memory middleware that counts API requests per hour
 * for the real-time traffic chart in the admin dashboard.
 *
 * Stores last 24 hours of data. Resets on server restart.
 */

// Map<hourKey, count> where hourKey = "YYYY-MM-DDTHH"
const trafficData = new Map();

// Keep only last 24h of data
function cleanOldData() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h for safety
  const cutoffKey = cutoff.toISOString().slice(0, 13);

  for (const key of trafficData.keys()) {
    if (key < cutoffKey) {
      trafficData.delete(key);
    }
  }
}

/**
 * Express middleware that increments the request counter
 * for the current hour. Only counts API requests.
 */
function trafficTracker(req, res, next) {
  // Only track /api/ requests, skip health checks
  if (req.path.startsWith('/api/') && req.path !== '/api/health') {
    const hourKey = new Date().toISOString().slice(0, 13); // "2026-04-24T16"
    trafficData.set(hourKey, (trafficData.get(hourKey) || 0) + 1);
  }
  next();
}

/**
 * Get traffic data for the last 24 hours.
 * Returns an array of { hour, count } objects.
 */
function getTrafficData() {
  cleanOldData();

  const now = new Date();
  const result = [];

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 13);
    result.push({
      hour: key,
      label: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
      count: trafficData.get(key) || 0,
    });
  }

  return result;
}

module.exports = { trafficTracker, getTrafficData };
