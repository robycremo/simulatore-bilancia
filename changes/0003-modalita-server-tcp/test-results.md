# 0003 — Modalità server TCP · Test results

> Stato: completato

Verifica dei criteri di [spec.md](spec.md) e dei requisiti di [tech-requirements.md](tech-requirements.md).
Legenda: ✅ superato · ❌ fallito · ⏳ da eseguire.

## Test automatici

| Data | Ambiente | Comando | Esito |
|---|---|---|---|
| 2026-10-02 | Windows 11, Node 26.7 | `npm run build && npm test` | 75 superati, 0 falliti (42 di 0001/0002 invariati + 33 nuovi: 22 `serverChannel.test`, 5 `validate.test`, 6 `app.test`); il gruppo `SIGINT` gira solo su Linux |
| 2026-10-02 | CI Linux (ubuntu-latest), Node 22 | workflow CI sulla PR #2: `7de21bb` (37026937784), `6c1960b` (37028330830), `2c24312` (37028937804) | ✅ tutti verdi: check-flow, build, test, audit |

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| **Modalità e connessioni** | | |
| PC in TCP server su 4001, pesata a soglia → il client riceve la stringa di 104 caratteri identica a quella del log | `app.test` › pesata STD con PC in TCP server; manuale nel browser con un client TCP grezzo su `127.0.0.1:4001`: ricevuti 104 caratteri, uguali alla stringa della scheda Trasmissioni | ✅ |
| … con PuTTY *Raw* | manuale (utente): PuTTY su questo PC (log: connessioni da 127.0.0.1 alle 15:18, 15:23 e 15:27 UTC), stringa ricevuta | ✅ |
| Client collegato dopo una pesata riceve solo le successive | `serverChannel.test` | ✅ |
| Due client ricevono la stringa; il sesto viene disconnesso | `serverChannel.test` | ✅ |
| Testo scritto dal client non cambia lo stato né causa errori | `serverChannel.test` (20 KB di testo dal client) | ✅ |
| Client terminato bruscamente → rimosso; poi `NESSUN CLIENT` | `serverChannel.test` (chiusura del socket); prove dell'utente: chiusure di PuTTY registrate come `server_client_disconnect` (es. 15:47:21 da `192.0.2.20`), seguite da `tx_error` `NESSUN CLIENT` alle pesate senza client | ✅ |
| Porta occupata → errore visibile, poi in ascolto entro 5 s | `serverChannel.test` | ✅ |
| Cambio porta nel setup → vecchia porta chiusa, nuova attiva | `serverChannel.test` (ChannelManager) + `app.test` | ✅ |
| **Esiti** | | |
| FOM senza client, *totalizza solo con FOM corretta* → OUT1 0,5 s, `tx_error` `NESSUN CLIENT`, non totalizzato | `app.test` | ✅ |
| ACK/NAK: ACK → corretto; NAK → nuovi invii poi `NAK` | `serverChannel.test` (anche: NAK+ACK da due client, nessuna risposta → `TIMEOUT ACK`) | ✅ |
| MPP con PC in TCP server → stringa MPP al client | `app.test` | ✅ |
| Fine partita → stringa al client; senza client operazione completata | `app.test` | ✅ |
| MPP senza client → contatto `ERRORE TRASM PC` circa 1 s | stesso percorso d'esito di STD (`NESSUN CLIENT` = errore) già coperto; revisione di `executeMpp` | ✅ |
| **Accesso** | | |
| Accesso `solo questo PC` → connessione dall'IP di rete rifiutata, nessuna riga nel log (criterio corretto, vedi *Problemi* § 2) | `serverChannel.test` (rifiuto e assenza di `server_client_refused`); prova dell'utente da un secondo PC: "connection refused" | ✅ |
| Accesso `rete`: IP ammesso accettato; IP non in elenco rifiutato e registrato | `serverChannel.test` (IP di rete del PC); prova dell'utente con PuTTY dal secondo PC `192.0.2.20`: prima di inserirlo negli IP ammessi tre tentativi chiusi subito con `server_client_refused` motivo `ip` (15:45:26–15:45:51 UTC); dopo l'inserimento connessione accettata (15:46:49) e stringhe ricevute. Accettato anche `192.0.2.10` in elenco | ✅ |
| Accesso `rete` con elenco vuoto o IP non valido → setup rifiutato | `validate.test`; manuale nel browser: notifica "con accesso "rete" serve almeno un IP ammesso" | ✅ |
| **Visibilità** | | |
| Display, setup, scheda Trasmissioni e `/api/health` | manuale nel browser: display `PC: 1 client`, setup `IN ASCOLTO TCP 4001 · 0 client collegati`, Trasmissioni `INVIATO · 1 client`; `app.test` per `/api/health` | ✅ |
| **Nessuna regressione** 0001 e 0002 | 42 test esistenti invariati e verdi | ✅ |

## Requisiti tecnici

| ID | Verifica | Esito |
|---|---|---|
| TR-1, TR-2 | `validate.test` | ✅ |
| TR-3 | `validate.test` (rete senza IP, porta di un ricevitore, stessa porta PC/FOM) | ✅ |
| TR-4 | `app.test` (config della 0002 senza nuovi campi) | ✅ |
| TR-5 | manuale nel browser: passando a TCP server la porta 9100 diventa 4001 | ✅ |
| TR-6 | `serverChannel.test` (`127.0.0.1` in locale, `0.0.0.0` in rete) | ✅ |
| TR-7 | `serverChannel.test` (normalizzazione `::ffff:`, elenco) | ✅ |
| TR-8 | `serverChannel.test` (sesto client) | ✅ |
| TR-9 | `serverChannel.test` (testo dal client) + revisione: nessun buffer dei dati in arrivo | ✅ |
| TR-10 | `serverChannel.test` con socket finto (soglia 64 KB) + revisione di `writeTo` | ✅ |
| TR-11 | revisione: `setKeepAlive(true, 10000)` su ogni client; rimozione su chiusura del socket coperta da `serverChannel.test`. Prova con rete staccata **non eseguita** per scelta dell'utente (vedi *Problemi* § 3) | ✅ revisione |
| TR-12 | `serverChannel.test` (byte per byte) + `app.test` | ✅ |
| TR-13 | `serverChannel.test` | ✅ |
| TR-14 | `serverChannel.test` (cambio porta < 1 s, nessun riavvio per `timeoutMs`/`ackNak`) | ✅ |
| TR-15 | `app.test` (arresto con client collegati < 3 s) | ✅ |
| TR-16, TR-17 | `serverChannel.test` | ✅ |
| TR-18 | `serverChannel.test` (latenza < 100 ms) | ✅ |
| TR-19 | `app.test` (OUT1 0,5 s) | ✅ |
| TR-20 | `serverChannel.test` + `app.test` (eventi nel log) | ✅ |
| TR-21, TR-22 | `app.test` + manuale nel browser | ✅ |

## Documentazione (T14)

| Verifica | Esito |
|---|---|
| README: sezione *Uso con PuTTY* (setup, PuTTY Raw, comportamento, accesso dalla rete, firewall, `HOST` vs accesso del canale), porte e struttura aggiornate | ✅ revisione |
| Documenti vivi: `spec.md` § 2, § 6 *Protocollo*, § 7, § 8, § 9; `tech-requirements.md` TR-T1…T10; `plan.md` architettura e moduli | ✅ revisione |

## Problemi trovati

1. **Rifiuto lento su Windows** (T4). Una connessione verso una porta non in ascolto sul proprio IP di rete viene
   ritentata dal sistema per circa 2 s prima del rifiuto: il test con attesa di 2 s falliva. Comportamento del canale
   corretto (0 client); attesa del test portata a 6 s.
2. **Criterio della spec in contrasto con TR-6** (T13), trovato nella prova dell'utente. Con accesso "solo questo PC"
   il canale ascolta su `127.0.0.1`: da un altro PC si ottiene "connection refused" dal sistema operativo e nel log
   non resta nulla, mentre la spec chiedeva il rifiuto *registrato*. Il test controllava il rifiuto ma non il log.
   **Ritorno alla spec** (scelta dell'utente, opzione A): il criterio ora dice che in accesso locale il rifiuto non è
   registrato; il rifiuto registrato vale per l'accesso "rete" con IP non in elenco. TR-6 invariato; il test verifica
   anche l'assenza della riga di log. Dalla stessa prova: l'accesso alla porta del canale è indipendente da `HOST`
   (che apre solo l'interfaccia web), da chiarire nel README (T14).
3. **TR-11 verificato solo con revisione.** La rimozione di un client caduto senza chiusura (rete staccata) dipende dal
   keep-alive TCP del sistema operativo e non si riproduce in modo affidabile su loopback. L'utente ha scelto di
   chiudere la change senza la prova manuale con rete staccata. Rischio residuo: su Windows il tempo di rilevamento
   potrebbe superare i 60 s; in quel caso il client resta nel conteggio più a lungo, ma le stringhe agli altri client
   e l'esito delle trasmissioni non cambiano. Se servisse, va verificato in una change successiva.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — esiti di T1–T12 (test automatici e verifiche nel browser).
- 2026-10-02 — change chiusa su conferma dell'utente (T15); TR-11 verificato con revisione, senza prova a rete staccata.
