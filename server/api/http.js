// Livello HTTP: intestazioni di sicurezza, cache dei file della UI, salute, errori del client.
import path from 'node:path';
import express from 'express';
import { isLoopbackAddress } from '../config/env.js';
import { tokenMatches } from './auth.js';

const SAFE_HOST = /^[A-Za-z0-9.\-:[\]]+$/;
const CLIENT_ERRORS_PER_MINUTE = 10;

function securityHeaders(req, res, next) {
  const host = SAFE_HOST.test(req.headers.host || '') ? req.headers.host : null;
  const connect = host ? `'self' ws://${host} wss://${host}` : `'self'`;
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': `default-src 'self'; connect-src ${connect}; img-src 'self' data:; frame-ancestors 'none'`,
  });
  next();
}

function staticCacheHeaders(res, file) {
  if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
  else if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache');
}

// Limite semplice a finestra fissa per IP.
function perMinuteLimiter(max) {
  const hits = new Map();
  return (ip) => {
    const minute = Math.floor(Date.now() / 60000);
    const h = hits.get(ip);
    if (!h || h.minute !== minute) {
      hits.set(ip, { minute, count: 1 });
      return true;
    }
    return ++h.count <= max;
  };
}

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);

export function createHttpApp({ engine, logger, distDir, token }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store').json(engine.getHealth());
  });

  const allowClientError = perMinuteLimiter(CLIENT_ERRORS_PER_MINUTE);
  app.post('/api/client-error', express.json({ limit: '4kb' }), (req, res) => {
    const ip = req.socket.remoteAddress;
    if (!isLoopbackAddress(ip) && !tokenMatches(req.get('x-sim-token'), token)) {
      logger.warn('auth_denied', { ip, via: 'client-error' });
      return res.status(401).json({ error: 'token non valido' });
    }
    if (!allowClientError(ip)) return res.status(429).json({ error: 'troppe segnalazioni' });
    const b = req.body || {};
    logger.error('client_error', {
      ip,
      message: clip(b.message, 500),
      stack: clip(b.stack, 4000),
      componentStack: clip(b.componentStack, 4000),
    });
    res.status(204).end();
  });

  app.use(express.static(distDir, { setHeaders: staticCacheHeaders }));

  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) logger.error('http_error', { path: req.path, message: err.message, stack: err.stack });
    res.status(status).json({ error: status >= 500 ? 'errore interno' : err.message });
  });

  return app;
}
