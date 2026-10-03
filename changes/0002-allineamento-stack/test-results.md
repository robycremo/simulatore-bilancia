# 0002 — Allineamento allo stack di produzione · Test results

> Stato: completato

Verifica dei criteri di [spec.md](spec.md) e dei requisiti di [tech-requirements.md](tech-requirements.md).
Legenda: ✅ superato · ❌ fallito · ⏳ da eseguire.

## Test automatici

| Data | Ambiente | Comando | Esito |
|---|---|---|---|
| 2026-10-02 | Windows 11, Node 26.7 | `npm test` | 42 superati, 0 falliti; 1 gruppo saltato (arresto con `SIGINT` reale: solo Linux) |
| 2026-10-02 | Windows 11, Node 26.7 | `npm run build && npm test` dopo la correzione del proxy di Vite | 42 superati, 0 falliti |
| 2026-10-02 | Windows 11, Node 26.7 | `npm audit --audit-level=high` | 0 vulnerabilità |
| 2026-10-02 | CI Linux (ubuntu-latest), Node 22 | workflow CI, prima esecuzione (`d646b9c`) | bloccata su `npm test`, annullata: vedi *Problemi* § 4 |
| 2026-10-02 | CI Linux (ubuntu-latest), Node 22 | workflow CI su `main` (`8c24cbd`, esecuzione 37023485291) | ✅ tutti i passi: check-flow, build, test (compreso `SIGINT` reale), audit |

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| **Configurazione e accesso** | | |
| Avvio senza variabili → solo `localhost` | `app.test` › di default ascolta solo su 127.0.0.1 | ✅ |
| `HOST=0.0.0.0` senza token → non parte, messaggio, codice ≠ 0 | `app.test` › errore di configurazione + lanciatore esce con 1 | ✅ |
| Token remoto: richiesto, sbagliato → chiusura e log, giusto → funziona | `app.test` › client remoto (connessione dall'IP di rete del PC) | ✅ |
| … dalla UI di un altro PC | manuale: browser su `http://<ip>:3000` con `HOST=0.0.0.0 SIM_TOKEN=…` → richiesta del token mostrata; prova dell'utente: token sbagliato → "Token non valido", token giusto → simulatore. Log: `auth_denied` da 192.0.2.10 alle 14:21:53, `auth_ok` alle 14:21:58 (UTC) | ✅ |
| **API e validazione** | | |
| `setLoad` non numerico → errore, carico invariato | `app.test` + `validate.test` | ✅ |
| Comando inesistente → errore, stato invariato | `app.test` + `validate.test` | ✅ |
| `updateConfig` con porta 70000 → rifiutato | `app.test` + `validate.test` | ✅ |
| Messaggio da 20 KB → scartato con errore | `app.test` (connessione resta aperta) | ✅ |
| `GET /api/health` | `app.test` | ✅ |
| **Storage e recovery** | | |
| `state.json` corrotto → `*.corrupt-*`, avvio, avviso | `app.test` + `jsonStore.test` | ✅ |
| `.bak` dopo un salvataggio | `jsonStore.test` + `app.test` | ✅ |
| Arresto con progressivo 7 → uscita ≤ 3 s, progressivo 7 al riavvio | `app.test` (`close()` e riavvio) | ✅ |
| … con segnale reale | manuale Windows (utente): Ctrl+C nel terminale PowerShell → `signal SIGINT` 14:46:17.224, `shutdown` 14:46:17.244 (20 ms). Conservazione dello stato al riavvio: stesso percorso di `close()`, verificato da `app.test`. Linux: `app.test` › SIGINT in CI, passato nell'esecuzione 37022088722 | ✅ Windows · ✅ Linux |
| Ricevitore su porta occupata → errore, poi riparte entro 5 s | `app.test` | ✅ |
| **Sicurezza, limiti e cache** | | |
| WebSocket da altro sito → rifiutato | `app.test` (403) | ✅ |
| Intestazioni di sicurezza | `app.test` | ✅ |
| Nessuna violazione CSP nella UI compilata | manuale: console del browser senza errori *Content Security Policy* | ✅ |
| 200 comandi in 1 s → max 50, avviso; 10 s → chiusura | `rateLimit.test` + `app.test` | ✅ |
| 11ª connessione → rifiutata | `app.test` (503) | ✅ |
| Trascinamento continuo del cursore → nessun avviso | manuale: 10 s a ~60 eventi/s → max 16 invii in 1 s, nessuna notifica | ✅ (dopo correzione, vedi *Problemi*) |
| Cache: asset immutabili, `index.html` no-cache | `app.test` | ✅ |
| Seconda istanza sulla stessa porta → messaggio chiaro, codice ≠ 0 | `app.test` (`EADDRINUSE` + lanciatore, nessuno stack trace) | ✅ |
| **Log ed errori** | | |
| Pesata STD con FOM in NAK → righe `weighing` e `tx_error` | `app.test` | ✅ |
| Errore React → pannello con Ricarica + riga nel log | manuale: `npm run dev`, `http://localhost:5173/?crash` → pannello "Errore dell'interfaccia" con **Ricarica**, riga `client_error` con messaggio e stack | ✅ (dopo correzione, vedi *Problemi*) |
| Log oltre 14 giorni eliminati all'avvio | `logger.test` | ✅ |
| **CI e documentazione** | | |
| CI con check:flow, test, build, audit; fallisce con un test rotto | CI verde su `main` (esecuzione 37023485291). Ramo `prova/ci-fallisce` con lunghezza attesa 105 invece di 104, PR [#1](https://github.com/robycremo/simulatore-bilancia/pull/1): CI rossa su `npm test` in 27 s (2 falliti, 41 superati; esecuzione 37023506175). PR chiusa senza merge, ramo cancellato | ✅ |
| Stringa dell'esempio di riferimento campo per campo | `format.test` | ✅ |
| `npm run prod` da clone pulito dopo `npm ci` | manuale: i 67 file versionati (`git ls-files`, senza `node_modules`, `client/dist`, `data`) copiati in una cartella temporanea → `npm ci` → `PORT=3100 npm run prod` → `/api/health` 200, `GET /` 200. Il repository non ha ancora commit, per questo copia al posto di `git clone` | ✅ |
| README con *Installazione su PC di collaudo* | revisione: requisiti, installazione, avvio, messaggi d'errore, variabili, accesso da un altro PC con nota sul firewall, dati e log, ricevitore da riga di comando | ✅ |
| **Nessuna regressione 0001** | `app.test`: soglia → 104 car., NAK FOM non totalizzato con OUT1, MPP, fine partita | ✅ |

## Requisiti tecnici

| ID | Verifica | Esito |
|---|---|---|
| TR-1 | CI su Node 22 (Linux), uso su Node 26 (Windows) | ✅ |
| TR-2 | `package.json`: dipendenze di runtime `express`, `ws` | ✅ |
| TR-3, TR-4 | `app.test` | ✅ |
| TR-5 | revisione di `api/auth.js` e dei log (`auth_denied` senza token) | ✅ |
| TR-6 | `app.test` (nessuno stato prima del token, 4401) | ✅ · timeout 30 s: revisione |
| TR-7, TR-8 | `app.test` | ✅ |
| TR-9, TR-10, TR-11 | `rateLimit.test` + `app.test` | ✅ |
| TR-12 | manuale cursore (max 16 invii/s) | ✅ |
| TR-13, TR-14, TR-16 | `app.test` | ✅ |
| TR-15 | `npm audit` | ✅ |
| TR-17, TR-18 | `jsonStore.test` + `app.test` | ✅ |
| TR-19 | `logger.test` | ✅ |
| TR-20 | revisione: `appendFileSync` prima di `process.exit(1)` | ✅ |
| TR-21 | `app.test` (`close()` < 3 s) · segnale reale: Windows Ctrl+C 20 ms, Linux `SIGINT` in CI | ✅ |
| TR-22, TR-23 | `app.test` | ✅ |
| TR-24 | `format.test` + `app.test` regressione 0001 | ✅ |

## Problemi trovati

1. **Rate limiting oltre la spec** (T6). Il token bucket del plan lasciava passare fino a 100 comandi nel primo secondo.
   Ritorno al plan: finestra scorrevole di 1 s. Annotato nel Registro del plan.
2. **Throttling del cursore** (T9), trovato nella prova manuale. Se il browser ritardava il timer partivano sia l'invio
   immediato sia quello differito: circa 31 invii/s invece di 20, e il server ha segnalato il limite superato.
   Corretto in `useEngine.js` (nessun nuovo invio se uno è già programmato); ripetuta la prova: max 16 invii/s.
3. **Proxy di Vite incompleto** (T9), trovato nella prova manuale dell'errore React. In sviluppo Vite inoltrava al server
   solo `/ws`: `POST /api/client-error` riceveva 404 da Vite e l'errore non arrivava nel log. In produzione il problema
   non c'è (la UI è servita dal server). Aggiunto `/api` al proxy in `vite.config.js`; ripetuta la prova: riga
   `client_error` presente.
4. **CI bloccata al primo push** (T10), trovato sulla CI Linux (esecuzioni 37022088722 e 37022248116, annullate dopo
   circa 5 minuti). Due difetti nei test, non nel simulatore:
   - il test "FOM in NAK" osservava OUT1 con un controllo ogni 20 ms, ma impulso e fine pesata avvengono nello stesso
     istante: su Linux il test ha visto prima il fine pesata e non l'impulso. Ora verifica che l'impulso sia stato
     emesso (scadenza di OUT1 ≥ avvio + 0,5 s);
   - un test fallito lasciava aperto il suo server di prova e il processo dei test non terminava più. Ora
     `afterEach(cleanup)` chiude server e client aperti anche in caso di errore; il test con `SIGINT` chiude il processo
     figlio in ogni caso; `npm test` usa `--test-timeout=60000 --test-force-exit`; il job CI ha `timeout-minutes: 10`.
   Verifica: con un test rotto apposta la suite termina in 15 s con esito di fallimento invece di bloccarsi; suite
   completa 42/42 in locale. Nello stesso log Linux tutti gli altri test, compreso l'arresto con `SIGINT` reale, sono passati.
5. **Script di test su Windows.** `node --test test/` non trova i file su Windows; usato il glob `"test/*.test.js"`.

## Registro

- 2026-10-02 — creato all'introduzione del passo *test-results* (emendamento della costituzione) con gli esiti delle
  verifiche già eseguite.
- 2026-10-02 — change chiusa su conferma dell'utente (T13).
