# 0002 — Allineamento allo stack di produzione · Tasks

> Stato: in corso

Deriva da [plan.md](plan.md). Si spunta man mano.

## Tasks

- [x] **T1. Riorganizzazione senza modifiche di comportamento.** File spostati in `server/{domain,transport}/` e
      `client/src/{components,hooks}/`, import e script aggiornati. Verificato: build e pesata STD identica (104 car.).
- [x] **T2. Configurazione e composizione.** `config/env.js` (`PORT`, `HOST`, `SIM_TOKEN`, controllo loopback/token),
      `app.js` con `createApp`, `index.js` lanciatore con messaggi leggibili per configurazione e porta occupata.
- [x] **T3. Storage.** `storage/jsonStore.js`: lettura con recupero (`.corrupt-*`, `.bak`, default), scrittura atomica
      con `.bak`. Il motore lo usa per `config.json` e `state.json`; config caricata solo con chiavi note e validata.
- [x] **T4. Logger.** `observability/logger.js`: JSON lines giornalieri, console leggibile, pulizia 14 giorni.
      Eventi del motore: `weighing`, `tx_error`, `printer_fault`, `end_batch`, `config_updated`, `receiver_*`,
      `storage_*`. Lanciatore: `uncaught_exception`, `unhandled_rejection`.
- [x] **T5. HTTP.** `api/http.js`: intestazioni di sicurezza e CSP, cache degli asset, `/api/health`,
      `/api/client-error`.
- [x] **T6. WebSocket.** `api/ws.js`: Origin, 16 KB, 10 connessioni, token con `authRequired`/`auth`/`4401`,
      errori al client, rate limiting (`api/rateLimit.js`).
- [x] **T7. Validazione.** `api/validate.js`: schema di tutti i comandi e del setup.
- [x] **T8. Disponibilità.** Nuovo tentativo dei ricevitori ogni 5 s, `getHealth()`, arresto con salvataggio sincrono e
      timer di sicurezza da 3 s.
- [x] **T9. Client.** `ErrorBoundary`, `Toast`, `TokenPrompt`, throttling del carico in `useEngine`; `setProgressive`
      ora invia un numero.
- [x] **T10. Test e CI.** 6 file di test (`format`, `validate`, `rateLimit`, `jsonStore`, `logger`, `app`),
      script `test` e `prod`, CI con build, test e audit.
- [ ] **T11. Prove manuali** elencate in [test-results.md](test-results.md).
  - [x] cursore del carico, assenza di violazioni CSP, richiesta del token dall'IP di rete
  - [x] errore React con `?crash` (ha richiesto la correzione del proxy di Vite)
  - [x] `npm run prod` da copia pulita
  - [ ] token giusto e sbagliato dalla UI (utente)
  - [ ] Ctrl+C su Windows (utente)
  - [ ] CI al primo push: workflow verde, poi ramo di prova con un test rotto che la fa fallire
- [x] **T12. Documentazione.** README: *Installazione su PC di collaudo*. Documenti vivi: `spec.md` § 8 e nuovo § 9
      *Operatività*; `tech-requirements.md` e `plan.md` in radice con la nuova architettura.
- [ ] **T13. Chiusura.** Tutti i file della change a `completato`.

## Note di implementazione

- T3: lo store espone solo la scrittura sincrona (il plan prevedeva anche quella asincrona): i file sono piccoli e il
  salvataggio resta differito di 300 ms nel motore, quindi non blocca il ciclo.
- T9: aggiunto `/api` al proxy di Vite in `vite.config.js` (non previsto nel plan, che considerava solo `/ws`).
- T8: il ricevitore emette `failure` invece di `error` (plan): un evento `error` senza ascoltatori farebbe terminare il
  processo, per esempio nel ricevitore da riga di comando.

## Registro

- 2026-10-02 — creato all'introduzione del passo *tasks* (emendamento della costituzione) dai passi del plan; stato e
  spunte riflettono il lavoro già svolto.
