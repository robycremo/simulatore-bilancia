// Composizione dell'applicazione: storage + log + motore + HTTP + WebSocket.
// createApp è usato sia dal lanciatore (server/index.js) sia dai test.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkAccess } from './config/env.js';
import { createLogger } from './observability/logger.js';
import { Engine } from './domain/engine.js';
import { createHttpApp } from './api/http.js';
import { attachWs } from './api/ws.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

export async function createApp({
  port = 3000,
  host = '127.0.0.1',
  token = null,
  dataDir = path.join(ROOT, 'data'),
  distDir = path.join(ROOT, 'client', 'dist'),
  logger,
  wsOptions = {},
} = {}) {
  checkAccess(host, token);
  logger ??= createLogger({ dir: path.join(dataDir, 'logs') });

  const engine = new Engine(dataDir, { logger, version: VERSION });
  const server = http.createServer(createHttpApp({ engine, logger, distDir, token }));
  const ws = attachWs({ server, engine, logger, token, ...wsOptions });

  engine.on('tick', () => ws.broadcast({ type: 'state', state: engine.getState() }));
  engine.on('lists', () => ws.broadcast({ type: 'lists', lists: engine.getLists() }));
  engine.on('config', () => ws.broadcast({ type: 'config', config: engine.config }));

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (e) {
    ws.close();
    engine.close();
    throw e;
  }

  const address = server.address();
  logger.info('start', { version: VERSION, host: address.address, port: address.port });

  let closing;
  const close = () =>
    (closing ??= (async () => {
      ws.close();
      engine.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(() => resolve()));
      logger.info('shutdown');
    })());

  return { server, engine, address, logger, close };
}
