# 0003 — Modalità server TCP · Requisiti tecnici

> Stato: approvato

Vincoli tecnici misurabili. Derivano da [spec.md](spec.md) e dalla [costituzione](../../constitution.md).
Presuppongono la change 0002 chiusa (validazione, log, health, test end-to-end).

## Requisiti

### Configurazione

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-1 | Valori del protocollo di canale | `tcp` (client), `udp`, `tcp-server` |
| TR-2 | Nuovi campi di canale | `access`: `local` \| `network`; `allowedIps`: lista di indirizzi IPv4 in notazione puntata, 0–20 elementi, senza duplicati |
| TR-3 | Validazione del setup | rifiutato se: `tcp-server` + `network` con `allowedIps` vuota; indirizzo IPv4 non valido; porta server uguale a quella dell'altro canale in `tcp-server` o di un ricevitore di test |
| TR-4 | Compatibilità dei file esistenti | `config.json` senza i nuovi campi viene letto con `access: local`, `allowedIps: []`; canali `tcp`/`udp` invariati |
| TR-5 | Porte proposte | passando a `tcp-server` la UI propone 4001 (PC) e 4002 (FOM) se la porta attuale è quella di un ricevitore di test |

### Ascolto e connessioni

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-6 | Interfaccia di ascolto | `local` → `127.0.0.1`; `network` → `0.0.0.0` (solo IPv4) |
| TR-7 | Controllo dell'indirizzo | `network`: indirizzo remoto (normalizzato da `::ffff:a.b.c.d`) uguale a un elemento di `allowedIps`, altrimenti chiusura immediata; `local`: solo loopback |
| TR-8 | Client per canale | ≤ 5; il sesto viene chiuso immediatamente |
| TR-9 | Dati in arrivo dal client | letti e scartati senza accumulo (memoria costante); si cercano solo i byte `06h`/`15h` durante un'attesa ACK |
| TR-10 | Client lento | se i dati in attesa di invio verso un client superano 64 KB, il client viene disconnesso |
| TR-11 | Client caduto | keep-alive TCP attivo (ritardo iniziale 10 s); rimozione entro 60 s su Windows e Linux |
| TR-12 | Invio | `noDelay` attivo (nessun accorpamento); stringa in latin1, identica byte per byte a quella in modalità client |
| TR-13 | Porta occupata | nuovo tentativo di ascolto ogni 5 s finché non riesce |
| TR-14 | Cambio di setup | listener chiuso e client disconnessi entro 1 s; vecchia porta libera; nuova porta in ascolto |
| TR-15 | Arresto del simulatore | listener e client chiusi entro il limite di 3 s della 0002 |

### Esito e tempi

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-16 | Esito senza ACK/NAK | corretto se la scrittura verso almeno un client è completata entro `timeoutMs`; nessun client → `NESSUN CLIENT` |
| TR-17 | Esito con ACK/NAK | primo `06h` da un qualsiasi client entro `timeoutMs` → corretto; altrimenti nuovo invio a tutti fino a `retries`, poi `NAK` (se almeno un `15h`) o `TIMEOUT ACK` |
| TR-18 | Latenza | stringa sul socket di ogni client entro 100 ms dalla validazione della pesata (su loopback) |
| TR-19 | Tempi del ciclo invariati | uscite di errore 0,5 s (STD) / circa 1 s (MPP) come in TR-M4 |

### Osservabilità

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-20 | Log | eventi `server_listen`, `server_listen_error`, `server_client_connect`, `server_client_disconnect`, `server_client_refused` (campo `reason`: `ip` \| `max_clients`), con canale, porta e IP remoto |
| TR-21 | Health | per ogni canale in `tcp-server`: `mode`, `listening`, `port`, `access`, `clients` |
| TR-22 | Stato alla UI | per canale: stato dell'ascolto e numero di client, nello stato a 10 Hz; per ogni trasmissione `clients` raggiunti |

## Dipendenze

Nessuna nuova dipendenza. Server TCP con `node:net`.

## Compatibilità

- Nessun cambio al formato delle stringhe né al protocollo WebSocket esistente, oltre ai campi aggiunti allo stato.
- I ricevitori di test integrati sono server che ascoltano le trasmissioni in modalità client: restano come sono e
  non servono per la modalità server. Per i test automatici della modalità server si usa un client `node:net`;
  per le prove manuali PuTTY in modalità *Raw*.
- Windows e Linux; solo IPv4 in modalità `network`.

## Controlli della costituzione

- [x] Principi di architettura: il server TCP dei canali sta in `transport/`; il dominio chiede "invia" e riceve un esito,
      senza sapere se il canale è client o server.
- [x] Sicurezza e conformità: locale per default; rete solo con IP ammessi (emendamento § 2); dati in arrivo scartati senza
      accumulo; limite di client e di buffer; ogni rifiuto nel log.
- [x] Vincoli tecnologici: nessuna nuova dipendenza.
- [x] Guardrail di business: formato delle stringhe invariato (TR-12).

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritta dopo l'approvazione della spec.
- 2026-10-02 — approvati dall'utente.
