# 0002 — Allineamento allo stack di produzione · Requisiti tecnici

> Stato: approvato

Vincoli tecnici misurabili. Derivano da [spec.md](spec.md) e dalla [costituzione](../../constitution.md).

## Requisiti

| ID | Livello | Requisito | Misura / soglia |
|---|---|---|---|
| TR-1 | Tutti | Runtime | Node.js ≥ 22; uso su Windows, CI su Linux |
| TR-2 | Tutti | Nessuna nuova dipendenza di runtime | runtime: solo `express`, `ws` |
| TR-3 | Auth | Interfaccia di ascolto di default | `127.0.0.1`, porta `3000` (`HOST`, `PORT`) |
| TR-4 | Auth | Token obbligatorio fuori da loopback | avvio rifiutato, codice di uscita 1 |
| TR-5 | Auth | Confronto del token | a tempo costante; il token non compare mai nei log |
| TR-6 | Auth | Client non autenticato | nessuno stato prima del token; chiusura `4401` su token errato, dopo 30 s senza token |
| TR-7 | API | Dimensione massima dei messaggi WebSocket | 16 KB (errore al client, connessione aperta) |
| TR-8 | API | Corpo di `/api/client-error` | JSON ≤ 4 KB, ≤ 10 segnalazioni/minuto per IP |
| TR-9 | Rate limiting | Comandi per connessione | ≤ 50 in qualsiasi intervallo di 1 s; avviso ≤ 1/s |
| TR-10 | Rate limiting | Chiusura per abuso | 10 s consecutivi oltre il limite → codice `1008` |
| TR-11 | Rate limiting | Connessioni WebSocket contemporanee | ≤ 10 (l'11ª riceve `503`) |
| TR-12 | Frontend | Invii del carico dal cursore | ≤ 20/s, ultimo valore sempre inviato |
| TR-13 | Security | Origine WebSocket | se presente, host di `Origin` = `Host`, altrimenti `403` |
| TR-14 | Security | Intestazioni HTTP | `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, CSP solo `'self'`, niente `X-Powered-By` |
| TR-15 | Security | Vulnerabilità delle dipendenze | 0 di gravità *high* o superiore |
| TR-16 | Caching | `Cache-Control` | `/assets/*`: `public, max-age=31536000, immutable`; `index.html`: `no-cache`; `/api/health`: `no-store` |
| TR-17 | Storage | Scrittura dei file JSON | file temporaneo + `fsync` + rename; versione precedente in `.bak` |
| TR-18 | Storage | Recupero all'avvio | file illeggibile → `*.corrupt-<data-ora>`, poi `.bak`, poi default |
| TR-19 | Logs | Formato e conservazione | JSON lines in `data/logs/simulatore-AAAA-MM-GG.log`; file oltre 14 giorni eliminati all'avvio |
| TR-20 | Logs | Errori fatali | registrati prima dell'uscita (scrittura sincrona) |
| TR-21 | Availability | Tempo di arresto | ≤ 3 s, stato salvato |
| TR-22 | Availability | Nuovo tentativo dei ricevitori | ogni 5 s finché non ripartono |
| TR-23 | Scaling | Seconda istanza sulla stessa porta | messaggio chiaro, codice di uscita 1, nessuno stack trace |
| TR-24 | Tutti | Invarianti | formato stringhe e stato a 10 Hz invariati rispetto alla 0001 |

## Dipendenze

Nessuna nuova dipendenza di runtime. Validazione, log, rate limiting e intestazioni di sicurezza sono moduli interni.
I test usano `node:test` (incluso in Node).

## Compatibilità

- `config.json` e `state.json` della 0001 vengono letti senza conversioni; le chiavi sconosciute sono ignorate.
- Senza variabili d'ambiente il comportamento per l'uso locale è identico alla 0001.
- Su Windows `SIGTERM` da un altro processo non è gestito (limite di Node); Ctrl+C e chiusura della console sì.

## Controlli della costituzione

- [x] Principi di architettura: validazione, accesso e limiti nello strato API; il dominio riceve comandi già validati.
- [x] Sicurezza e conformità: locale per default, token, input validati, token mai nei log, audit in CI.
- [x] Vincoli tecnologici: nessuna nuova dipendenza di runtime, JSON su file.
- [x] Guardrail di business: formato delle stringhe invariato (TR-24).

## Registro

- 2026-10-02 — creato all'introduzione del passo *tech-requirements* (emendamento della costituzione) estraendo i vincoli
  dalla spec e dal plan già approvati: nessun requisito nuovo, per questo nasce come approvato.
