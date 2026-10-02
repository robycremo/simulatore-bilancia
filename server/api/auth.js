// Confronto del token a tempo costante (Auth & permissions).
import crypto from 'node:crypto';

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function tokenMatches(given, expected) {
  if (!expected || typeof given !== 'string' || !given) return false;
  return crypto.timingSafeEqual(digest(given), digest(expected));
}
