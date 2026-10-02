# 0003 — Modalità server TCP · Test results

> Stato: in corso

Verifica dei criteri di [spec.md](spec.md) e dei requisiti di [tech-requirements.md](tech-requirements.md).
Legenda: ✅ superato · ❌ fallito · ⏳ da eseguire.

## Test automatici

| Data | Ambiente | Comando | Esito |
|---|---|---|---|
| 2026-10-02 | Windows 11, Node 26.7 | `npm run build && npm test` | 75 superati, 0 falliti (42 di 0001/0002 invariati + 33 nuovi: 22 `serverChannel.test`, 5 `validate.test`, 6 `app.test`); il gruppo `SIGINT` gira solo su Linux |
| — | CI Linux, Node 22 | workflow CI sulla PR | ⏳ |

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| **Modalità e connessioni** | | |
| PC in TCP server su 4001, pesata a soglia → il client riceve la stringa di 104 caratteri identica a quella del log | `app.test` › pesata STD con PC in TCP server; manuale nel browser con un client TCP grezzo su `127.0.0.1:4001`: ricevuti 104 caratteri, uguali alla stringa della scheda Trasmissioni | ✅ |
| … con PuTTY *Raw* | manuale (utente) | ⏳ |
| Client collegato dopo una pesata riceve solo le successive | `serverChannel.test` | ✅ |
| Due client ricevono la stringa; il sesto viene disconnesso | `serverChannel.test` | ✅ |
| Testo scritto dal client non cambia lo stato né causa errori | `serverChannel.test` (20 KB di testo dal client) · PuTTY manuale | ✅ · ⏳ |
| Client terminato bruscamente → rimosso; poi `NESSUN CLIENT` | `serverChannel.test` (chiusura del socket) · chiusura della finestra di PuTTY | ✅ · ⏳ |
| Porta occupata → errore visibile, poi in ascolto entro 5 s | `serverChannel.test` | ✅ |
| Cambio porta nel setup → vecchia porta chiusa, nuova attiva | `serverChannel.test` (ChannelManager) + `app.test` | ✅ |
| **Esiti** | | |
| FOM senza client, *totalizza solo con FOM corretta* → OUT1 0,5 s, `tx_error` `NESSUN CLIENT`, non totalizzato | `app.test` | ✅ |
| ACK/NAK: ACK → corretto; NAK → nuovi invii poi `NAK` | `serverChannel.test` (anche: NAK+ACK da due client, nessuna risposta → `TIMEOUT ACK`) | ✅ |
| MPP con PC in TCP server → stringa MPP al client | `app.test` | ✅ |
| Fine partita → stringa al client; senza client operazione completata | `app.test` | ✅ |
| MPP senza client → contatto `ERRORE TRASM PC` circa 1 s | stesso percorso d'esito di STD (`NESSUN CLIENT` = errore) già coperto; revisione di `executeMpp` | ✅ |
| **Accesso** | | |
| Accesso `solo questo PC` → connessione dall'IP di rete rifiutata | `serverChannel.test` (porta non raggiungibile dall'IP di rete) | ✅ |
| Accesso `rete`: IP ammesso accettato; IP non in elenco rifiutato e registrato | `serverChannel.test` (IP di rete del PC) · PuTTY da un secondo PC | ✅ · ⏳ |
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
| TR-11 | revisione: `setKeepAlive(true, 10000)` · prova manuale con rete staccata | ⏳ |
| TR-12 | `serverChannel.test` (byte per byte) + `app.test` | ✅ |
| TR-13 | `serverChannel.test` | ✅ |
| TR-14 | `serverChannel.test` (cambio porta < 1 s, nessun riavvio per `timeoutMs`/`ackNak`) | ✅ |
| TR-15 | `app.test` (arresto con client collegati < 3 s) | ✅ |
| TR-16, TR-17 | `serverChannel.test` | ✅ |
| TR-18 | `serverChannel.test` (latenza < 100 ms) | ✅ |
| TR-19 | `app.test` (OUT1 0,5 s) | ✅ |
| TR-20 | `serverChannel.test` + `app.test` (eventi nel log) | ✅ |
| TR-21, TR-22 | `app.test` + manuale nel browser | ✅ |

## Problemi trovati

1. **Rifiuto lento su Windows** (T4). Una connessione verso una porta non in ascolto sul proprio IP di rete viene
   ritentata dal sistema per circa 2 s prima del rifiuto: il test con attesa di 2 s falliva. Comportamento del canale
   corretto (0 client); attesa del test portata a 6 s.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — esiti di T1–T12 (test automatici e verifiche nel browser).
