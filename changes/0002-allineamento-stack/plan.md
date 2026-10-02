# 0002 — Allineamento allo stack di produzione · Plan

> Stato: completato

Deriva da [spec.md](spec.md) e [tech-requirements.md](tech-requirements.md).

## Approccio

1. **Cartelle per livello dello stack.** Il server viene diviso in cartelle che corrispondono ai livelli dello stack,
   così ogni livello ha un posto preciso nel codice. Lo spostamento avviene in un passo separato, senza modifiche
   di comportamento, per tenerlo distinto dalle modifiche vere.
2. **Server avviabile da codice.** `server/app.js` espone `createApp({ port, host, token, dataDir })`, che restituisce
   il server avviato e una funzione `close()`; `server/index.js` resta un lanciatore che legge le variabili d'ambiente.
   Così i test avviano istanze reali su porte e cartelle temporanee e verificano i criteri di accettazione end-to-end.
3. **Nessuna nuova dipendenza di runtime.** Validazione, log, intestazioni di sicurezza e rate limiting sono scritti a
   mano in moduli piccoli: il bisogno è limitato e ogni dipendenza in più è superficie per `npm audit`.
   I test usano `node:test`, già incluso in Node.
4. **Il motore resta l'unica fonte di verità.** Il motore non sa nulla di rete, accesso o limiti: riceve solo comandi
   già validati e un logger. Validazione, accesso e limiti stanno nel livello API.

### Struttura risultante

```text
server/
  index.js                    lanciatore: variabili d'ambiente → createApp, segnali, errori non gestiti
  app.js                      composizione: HTTP + WebSocket + motore + logger + store
  config/env.js               PORT, HOST, SIM_TOKEN, controllo loopback/token        (Auth & permissions)
  api/http.js                 express: intestazioni sicurezza, cache, /api/health,    (APIs, Security, Caching)
                              /api/client-error
  api/ws.js                   WebSocket: Origin, 16 KB, max 10 conn., token,          (APIs, Auth, Rate limiting)
                              validazione, errori al client
  api/validate.js             schema dei comandi e degli argomenti                   (APIs, Security)
  api/rateLimit.js            finestra scorrevole di 1 s, max 50 comandi             (Rate limiting)
  domain/engine.js            motore (spostato, invariato salvo logger e store)
  domain/format.js            stringhe (spostato, invariato)
  transport/net.js            TCP/UDP + ACK/NAK (spostato, invariato)
  transport/receiver.js       ricevitori di test (+ evento di errore)
  transport/listen.js         ricevitore da riga di comando (spostato)
  storage/jsonStore.js        lettura con recupero, scrittura atomica, .bak            (Database & storage)
  observability/logger.js     JSON lines giornalieri, console leggibile, pulizia 14 g  (Error tracking & logs)
client/src/
  main.jsx, App.jsx, styles.css
  hooks/useEngine.js          + gestione token, errori dal server, throttling comandi
  components/                 Display, Controls, Panels, Setup (spostati)
                              + ErrorBoundary, Toast, TokenPrompt
test/                         node:test
```

## File toccati

| File | Modifica |
|---|---|
| `server/*.js` → `server/{domain,transport}/` | spostati (passo 1) |
| `client/src/*.jsx` → `client/src/{components,hooks}/` | spostati (passo 1) |
| `server/index.js` | riscritto come lanciatore |
| `server/app.js` | nuovo |
| `server/config/env.js` | nuovo |
| `server/api/http.js`, `ws.js`, `validate.js`, `rateLimit.js` | nuovi |
| `server/storage/jsonStore.js` | nuovo |
| `server/observability/logger.js` | nuovo |
| `server/domain/engine.js` | logger e store iniettati, eventi di log, ritentativo ricevitori, `getHealth`, salvataggio sincrono |
| `server/transport/receiver.js` | evento `error` |
| `client/src/hooks/useEngine.js` | token, errori, throttling |
| `client/src/components/ErrorBoundary.jsx`, `Toast.jsx`, `TokenPrompt.jsx` | nuovi |
| `client/src/App.jsx`, `main.jsx`, `styles.css` | collegamento dei nuovi componenti |
| `test/format.test.js` | nuovo |
| `test/validate.test.js` | nuovo |
| `test/rateLimit.test.js` | nuovo |
| `test/jsonStore.test.js` | nuovo |
| `test/logger.test.js` | nuovo |
| `test/app.test.js` | nuovo: istanze reali su porte e cartelle temporanee |
| `package.json` | script `test`, `prod`; percorsi di `start`, `listen`, `dev` |
| `.github/workflows/ci.yml` | test e audit |
| `README.md`, `spec.md`, `plan.md` | documentazione (passo 11) |

## Strategia di verifica

Quasi tutti i criteri di accettazione si verificano con test end-to-end su istanze reali (`test/app.test.js`), il resto
con test unitari e cinque prove manuali (UI da un secondo PC, trascinamento del cursore, errore React forzato, CI fatta
fallire apposta, `npm run prod` da clone pulito). Dettaglio ed esiti in [test-results.md](test-results.md);
i compiti in [tasks.md](tasks.md).

## Rischi

- **CSP e React.** React applica gli stili inline via CSSOM, che la CSP non blocca. Se la UI compilata mostrasse
  violazioni in console, si torna alla spec per decidere se ammettere `style-src 'unsafe-inline'`.
- **Segnali su Windows.** Node su Windows gestisce Ctrl+C (`SIGINT`) e la chiusura della console (`SIGBREAK`), ma non
  `SIGTERM` inviato da un altro processo. È accettabile per uno strumento avviato a mano; se servisse come servizio
  Windows sarebbe una nuova change.
- **Spostamento dei file.** Il passo 1 tocca tutti gli import. Il rischio è contenuto perché quel passo non cambia
  il comportamento e viene verificato da solo.

## Registro

- 2026-10-02 — creata vuota, in attesa della spec.
- 2026-10-02 — scritto dopo l'approvazione della spec.
- 2026-10-02 — approvato dall'utente; inizio implementazione.
- 2026-10-02 — **ritorno al plan** (passo 6): il token bucket (riserva 50 + ricarica 50/s) lasciava passare fino a
  100 comandi nel primo secondo, contro il criterio della spec "200 comandi in 1 secondo → al massimo 50 eseguiti".
  Sostituito con una finestra scorrevole di 1 s. La spec non cambia.
- 2026-10-02 — adeguato al percorso SDD (emendamento della costituzione): i passi sono diventati
  [tasks.md](tasks.md), la tabella di verifica [test-results.md](test-results.md), i vincoli numerici
  [tech-requirements.md](tech-requirements.md). Stato da "in corso" ad "approvato": l'avanzamento ora sta in tasks.md.
- 2026-10-02 — change chiusa su conferma dell'utente (T13).
