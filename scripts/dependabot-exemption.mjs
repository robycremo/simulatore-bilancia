// Eccezione al percorso SDD per gli aggiornamenti di Dependabot (change 0005, costituzione § 3).
// Funzioni pure: non leggono git, file o rete; check-flow passa loro i dati già letti.

export const DEPENDABOT = 'dependabot[bot]';
export const ALLOWED_FILES = ['package.json', 'package-lock.json'];
const DEP_SECTIONS = ['dependencies', 'devDependencies'];

// Versione "maggiore" di un intervallo npm: la prima versione numerica, ignorando i prefissi ^ ~ >= <= > < = v.
// Per la serie 0.x conta anche la minore (in semver è lei a rompere la compatibilità): "0.3.1" → "0.3".
// Restituisce null se il valore non è interpretabile (URL git, percorsi, alias npm:, *, latest, 1.x…).
export function majorOf(range) {
  if (typeof range !== 'string') return null;
  const m = range.match(/^\s*(?:\^|~|>=|<=|>|<|=)?\s*v?(\d+)\.(\d+)(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?(?=\s|$|\|)/);
  if (!m) return null;
  const [, major, minor] = m;
  return major === '0' ? `0.${minor}` : major;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Confronta due package.json già interpretati. Ammessi solo cambi di versione di dipendenze esistenti, senza
// cambi di versione maggiore. Restituisce { updates, reasons }: reasons vuoto = confronto superato.
export function compareManifests(base, head) {
  const reasons = [];
  const updates = [];
  if (!isObject(base) || !isObject(head)) return { updates, reasons: ['package.json non leggibile come oggetto JSON'] };

  const keys = new Set([...Object.keys(base), ...Object.keys(head)]);
  for (const k of keys) {
    if (DEP_SECTIONS.includes(k)) continue;
    if (JSON.stringify(base[k]) !== JSON.stringify(head[k])) reasons.push(`campo "${k}" di package.json modificato`);
  }

  for (const section of DEP_SECTIONS) {
    const b = isObject(base[section]) ? base[section] : {};
    const h = isObject(head[section]) ? head[section] : {};
    for (const name of Object.keys(h)) if (!(name in b)) reasons.push(`dipendenza aggiunta in ${section}: ${name}`);
    for (const name of Object.keys(b)) {
      if (!(name in h)) {
        reasons.push(`dipendenza tolta da ${section}: ${name}`);
        continue;
      }
      const [from, to] = [b[name], h[name]];
      if (from === to) continue;
      const [mf, mt] = [majorOf(from), majorOf(to)];
      if (mf === null || mt === null) reasons.push(`versione non interpretabile per ${name}: ${from} → ${to}`);
      else if (mf !== mt) reasons.push(`versione maggiore per ${name}: ${from} → ${to} (serve una change)`);
      else updates.push(`${name}: ${from} → ${to}`);
    }
  }
  return { updates, reasons };
}

// Applica le quattro condizioni della spec § 1 e restituisce tutti i motivi di rifiuto, non solo il primo.
// author: autore della PR registrato da GitHub; changedFiles: file modificati rispetto alla base;
// base/head: package.json della base e della PR (necessari solo se package.json è modificato).
export function evaluateExemption({ author, changedFiles, base, head }) {
  const reasons = [];
  let updates = [];
  if (author !== DEPENDABOT) reasons.push(`autore della PR "${author ?? ''}" diverso da ${DEPENDABOT}`);
  const extra = changedFiles.filter((f) => !ALLOWED_FILES.includes(f));
  if (extra.length) reasons.push(`file diversi da ${ALLOWED_FILES.join(' e ')}: ${extra.join(', ')}`);
  if (changedFiles.includes('package.json')) {
    const r = compareManifests(base, head);
    reasons.push(...r.reasons);
    updates = r.updates;
  }
  return { exempt: reasons.length === 0, reasons, updates };
}
