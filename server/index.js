// Lanciatore: variabili d'ambiente → createApp; segnali di arresto; errori non gestiti.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, ConfigError } from './config/env.js';
import { createLogger, errorInfo } from './observability/logger.js';
import { createApp } from './app.js';

const SHUTDOWN_TIMEOUT_MS = 3000;
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const logger = createLogger({ dir: path.join(dataDir, 'logs') });

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', errorInfo(err));
  process.exit(1);
});
process.on('unhandledRejection', (reason) => logger.error('unhandled_rejection', errorInfo(reason)));

let env;
let app;
try {
  env = loadEnv();
  app = await createApp({ ...env, dataDir, logger });
} catch (e) {
  if (e instanceof ConfigError) {
    logger.error('config_error', { message: e.message });
    console.error(`\nErrore di configurazione: ${e.message}\n`);
  } else if (e.code === 'EADDRINUSE') {
    logger.error('port_in_use', { port: env.port });
    console.error(`\nLa porta ${env.port} è già in uso: probabilmente il simulatore è già avviato. Usare PORT per sceglierne un'altra.\n`);
  } else {
    logger.error('start_failed', errorInfo(e));
    console.error(`\nAvvio non riuscito: ${e.message}\n`);
  }
  process.exit(1);
}

const shown = env.host === '0.0.0.0' || env.host === '::' ? 'localhost' : env.host;
console.log(`\nSimulatore bilancia: http://${shown}:${app.address.port}\n`);

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info('signal', { signal });
  setTimeout(() => {
    logger.warn('shutdown_forced', { afterMs: SHUTDOWN_TIMEOUT_MS });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  app.close().then(() => process.exit(0));
}
for (const s of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(s, () => shutdown(s));
