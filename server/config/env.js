// Configurazione di avvio da variabili d'ambiente (Auth & permissions).

export class ConfigError extends Error {}

export function isLoopbackHost(host) {
  return host === 'localhost' || host === '::1' || /^127\./.test(host);
}

export function isLoopbackAddress(addr) {
  return !!addr && (addr === '::1' || /^127\./.test(addr) || /^::ffff:127\./.test(addr));
}

// Il simulatore esposto in rete deve essere protetto da token.
export function checkAccess(host, token) {
  if (!isLoopbackHost(host) && !token) {
    throw new ConfigError(
      `HOST=${host} rende il simulatore raggiungibile da altri PC: impostare anche SIM_TOKEN con un token di accesso.`
    );
  }
}

export function loadEnv(env = process.env) {
  const port = env.PORT === undefined || env.PORT === '' ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`PORT=${env.PORT} non valida: usare un numero tra 0 e 65535.`);
  }
  const host = env.HOST || '127.0.0.1';
  const token = env.SIM_TOKEN || null;
  checkAccess(host, token);
  return { port, host, token };
}
