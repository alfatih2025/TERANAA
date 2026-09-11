// Unified API Router — satu-satunya Serverless Function di Vercel
// Semua logic handler ada di src/api-routes/

import sensorHandler from '../src/api-routes/sensor.js';
import alertsHandler from '../src/api-routes/alerts.js';
import chatHandler from '../src/api-routes/chat.js';
import chatDailyHistoryHandler from '../src/api-routes/chat-daily-history.js';
import controlHandler from '../src/api-routes/control.js';
import deviceStatusHandler from '../src/api-routes/device-status.js';
import exportHandler from '../src/api-routes/export.js';
import logsHandler from '../src/api-routes/logs.js';
import openrouterHandler from '../src/api-routes/openrouter.js';
import airouterHandler from '../src/api-routes/airouter.js';
import settingsHandler from '../src/api-routes/settings.js';
import weatherHandler from '../src/api-routes/weather.js';
import weatherLocationsHandler from '../src/api-routes/weather-locations.js';

const routes = {
  'sensor': sensorHandler,
  'sensor-data': sensorHandler,
  'alerts': alertsHandler,
  'chat': chatHandler,
  'chat-daily-history': chatDailyHistoryHandler,
  'control': controlHandler,
  'device-status': deviceStatusHandler,
  'export': exportHandler,
  'logs': logsHandler,
  'openrouter': openrouterHandler,
  'airouter': airouterHandler,
  'settings': settingsHandler,
  'weather': weatherHandler,
  'weather-locations': weatherLocationsHandler,
};

export default async function handler(req, res) {
  // Parse route name from URL or query
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Ensure query params are parsed
  if (!req.query || Object.keys(req.query).length === 0) {
    const query = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    req.query = query;
  }

  // 1. Try from path: /api/sensor -> "sensor"
  const pathAfterApi = url.pathname.replace(/^\/api\/?/, '');
  let routeName = pathAfterApi ? pathAfterApi.split('/')[0] : '';

  // Vercel rewrites /api/weather to /api/index?path=weather.
  // Treat the function filename as a router marker, not as the route name.
  if (routeName === 'index') routeName = '';

  // 2. If rewritten to /api/index, check query parameters: ?path=sensor or ?route=sensor
  if (!routeName && req.query) {
    if (typeof req.query.path === 'string' && req.query.path.trim()) {
      routeName = req.query.path.trim().split('/')[0];
    } else if (Array.isArray(req.query.path) && req.query.path.length > 0) {
      routeName = String(req.query.path[0]).split('/')[0];
    } else if (typeof req.query.route === 'string' && req.query.route.trim()) {
      routeName = req.query.route.trim().split('/')[0];
    }
  }

  const routedPath = typeof req.query?.path === 'string' ? req.query.path.split('/').filter(Boolean) : [];
  if (routeName === 'weather' && !req.query.location && routedPath[1]) {
    req.query.location = routedPath[1];
  }

  // 3. Check Vercel routing headers as fallback
  if (!routeName) {
    const matchedPath = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || '';
    if (matchedPath.startsWith('/api/')) {
      routeName = matchedPath.replace(/^\/api\/?/, '').split('/')[0];
    }
  }

  const routeHandler = routes[routeName];

  if (!routeHandler) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ error: `API route /api/${routeName} not found` });
  }

  try {
    await routeHandler(req, res);
  } catch (err) {
    console.error(`[API Router] Error in /api/${routeName}:`, err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal Server Error' });
    }
  }
}
