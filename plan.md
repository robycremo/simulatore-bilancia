# Plan — Simulatore bilancia

> Documento vivo: descrive **come** è costruito il sistema per soddisfare [spec.md](spec.md) e
> [tech-requirements.md](tech-requirements.md).
> Si aggiorna solo tramite una change in `changes/`, quando la change passa a *completato*.

## Architettura

```text
 Browser (React)                    server/
   client/src  ──WebSocket /ws──►  api/ws.js ──(validate)──►  domain/engine.js
               ◄── stato 10 Hz ──                                │
               ──HTTP──────────►  api/http.js (UI, health)       ├─► transport/channels.js ─┬─► net.js ──────────► PC / FOM (client TCP, UDP)
                                                                 │                          └─► serverChannel.js ◄── PC / FOM / PuTTY (TCP server)
                                                                 ├─► transport/receiver.js ◄── (ricevitori di test)
                                                                 ├─► storage/jsonStore.js    data/*.json
                                                                 └─► observability/logger.js data/logs/
 app.js compone i livelli (createApp); index.js legge le variabili d'ambiente e gestisce i segnali.
```

- Il **motore** è l'unica fonte di verità: modello del peso, ciclo STD/MPP, stampante, totali, uscite. Gira a tick di 100 ms.
- La **UI** è solo una vista: riceve lo stato e invia comandi (`{type:'cmd', cmd, args}`), non contiene logica di pesatura.
- **Livelli separati** (costituzione § 1): accesso, validazione e limiti stanno in `api/`; il motore riceve solo comandi
  già validati, un logger e lo store.
- Le trasmissioni sono asincrone; il ciclo resta in fase `TRASMISSIONE` finché non arrivano tutti gli esiti.

## Moduli

| File | Livello | Responsabilità |
|---|---|---|
| `server/index.js` | Hosting | avvio da variabili d'ambiente, messaggi di errore leggibili, segnali, errori non gestiti |
| `server/app.js` | — | `createApp()`: compone storage, log, motore, HTTP e WebSocket; `close()` |
| `server/config/env.js` | Auth | `PORT`, `HOST`, `SIM_TOKEN`; loopback e obbligo del token |
| `server/api/http.js` | APIs, Security, Caching | intestazioni di sicurezza e CSP, cache, `/api/health`, `/api/client-error` |
| `server/api/ws.js` | APIs, Auth, Rate limiting | Origin, dimensione messaggi, numero connessioni, token, errori al client |
| `server/api/validate.js` | APIs, Security | schema di comandi e setup |
| `server/api/rateLimit.js` | Rate limiting | finestra scorrevole di 1 s |
| `server/api/auth.js` | Auth | confronto del token a tempo costante |
| `server/domain/engine.js` | — | stato del terminale, ciclo di pesatura, comandi `cmd_*`, health, arresto |
| `server/domain/format.js` | — | stringhe 104/106, template, checksum |
| `server/transport/channels.js` | — | canali PC e FOM: interfaccia unica `send()` per il motore; crea client o server in base al protocollo; riparte solo se cambiano modalità, porta o accesso |
| `server/transport/serverChannel.js` | Auth, Rate limiting | TCP server: accesso locale o IP ammessi, max 5 client, ACK/NAK, client lenti, keep-alive, nuovo tentativo di ascolto |
| `server/transport/net.js` | — | invio TCP client/UDP, ACK/NAK, ritentativi |
| `server/transport/receiver.js` | — | ricevitori di test TCP/UDP |
| `server/transport/listen.js` | — | ricevitore da riga di comando |
| `server/storage/jsonStore.js` | Storage | lettura con recupero, scrittura atomica con `.bak` |
| `server/observability/logger.js` | Logs | JSON lines giornalieri, console, pulizia 14 giorni |
| `client/src/hooks/useEngine.js` | Frontend | WebSocket con riconnessione, token, errori, invii del carico limitati |
| `client/src/components/*` | Frontend | display, comandi, pannelli, setup, `ErrorBoundary`, `Toast`, `TokenPrompt` |
| `test/*.test.js` | CI | unitari ed end-to-end su istanze reali (`createApp`) |
| `scripts/check-flow.mjs` | CI | struttura e stati delle change |
| `scripts/check-public.mjs` | CI, Security | contenuti pubblicabili: IP solo di loopback o di documentazione (RFC 5737), nessun rimando al documento d'origine del formato, elenco locale dei valori riservati (`scripts/public-check.local.txt`, ignorato da git) |

## Fasi del ciclo

`PRONTO` → (innesco) → `ATTESA` → (stabile o time-out, validazione) → `TRASMISSIONE` → `PRONTO` (disarmato fino al riarmo).

## Comandi e build

| Comando | Effetto |
|---|---|
| `npm run dev` | server con `--watch` + Vite su :5173 (proxy `/ws` → :3000) |
| `npm run build` | compila la UI in `client/dist` |
| `npm start` | server su :3000 con la UI compilata |
| `npm run prod` | `build` + `start` |
| `npm test` | test automatici (`node:test`) |
| `npm run check:flow` | verifica la struttura e gli stati delle change |
| `npm run check:public` | verifica che i file siano pubblicabili; `-- --history` controlla anche tutti i commit con l'elenco locale |

## Storico delle change

| Change | Stato |
|---|---|
| [0001-simulatore-iniziale](changes/0001-simulatore-iniziale/plan.md) | completato |
| [0002-allineamento-stack](changes/0002-allineamento-stack/test-results.md) | completato |
| [0003-modalita-server-tcp](changes/0003-modalita-server-tcp/test-results.md) | completato |
| [0004-pubblicazione-open-source](changes/0004-pubblicazione-open-source/tasks.md) | in corso |
