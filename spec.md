# Spec — Simulatore bilancia

> Documento vivo: descrive **cosa** fa il sistema, osservabile dall'esterno. Deriva da [intent.md](intent.md).
> I vincoli misurabili sono in [tech-requirements.md](tech-requirements.md).
> Si aggiorna solo tramite una change in `changes/`, quando la change passa a *completato*.

## 1. Bilancia

| Parametro | Default | Note |
|---|---|---|
| Portata | 1500 | sovraccarico oltre portata + 9 divisioni → `-OL-` |
| Divisione | 0,1 | determina i decimali |
| Unità | kg | 3 caratteri nella stringa (` kg`) |
| Separatore decimale | `,` | |

- Il peso è **stabile** se non varia per *finestra di stabilità* decimi di secondo (default 5).
- Tasti ZERO e TARA come un terminale reale; il carico è impostato da cursore, campo numerico o valori rapidi.
- Opzione "peso instabile" per simulare oscillazioni.

## 2. Setup del terminale

| # | Parametro | Valori |
|---|---|---|
| 1 | Funzionamento | con **soglia** / con **input-fotocellula** |
| 2 | Peso di soglia | 0 = nessun controllo |
| 3 | Time-out attesa peso stabile | decimi di s, 0 = attende sempre lo stabile |
| 4 | Totalizza solo con trasmissione FOM corretta | sì / no (opz.) |
| 5 | Progressivo a 1 dopo fine partita | sì / no (opz.) |
| 6 | Controlli stampante prima della stampa | sì / no (dopo la stampa vengono fatti sempre) |
| 7 | Stringhe a PC e a FOM | ogni canale abilitabile, protocollo **TCP client / UDP / TCP server**, IP, porta, ACK/NAK, time-out, tentativi; in TCP server *accesso* (solo questo PC / rete) e *IP ammessi* |
| 8 | Uscite errore trasmissione FOM / PC | sì / no (opz.) |
| 9 | Input di fine partita | sì / no (opz.) |
| 10 | Stampante | presente, nastro / cartellino, stampa ridotta |
| 11 | Tasto rapido abilita/disabilita stampante | F5 |
| 12 | Rettangolo stato in basso a sinistra | `STD` / `MPP` (tasto F6) |

## 3. Ciclo di pesatura STD (senza MPP)

Innesco:
- peso lordo **>** soglia (solo con funzionamento a soglia);
- fotocellula oscurata o input di stampa (solo con funzionamento a input);
- tasto STAMPA (sempre).

Dopo l'innesco:
1. Attesa del peso stabile; allo scadere del time-out (se impostato) il peso è accettato anche se instabile.
2. Il peso deve essere valido (> 0, non in sovraccarico) e, se impostata una soglia, **≥ soglia**; altrimenti messaggio e fine ciclo.
3. Stampa, se stampante presente e abilitata:
   - con controlli pre-stampa attivi e stampante non collegata o senza carta → `STAMPANTE IN AVARIA`, pesata annullata;
   - senza controlli pre-stampa → la pesata prosegue; il controllo a fine stampa mostra comunque `STAMPANTE IN AVARIA`.
   - Intestazione (data, ora, codice merce se ≠ 0 e descrizione, codice generico se impostato, diciture N.PROG. e NETTO)
     dopo l'accensione, dopo la fine partita, dopo la stampa dei totali; su cartellino a ogni stampa.
   - Riga per pesata: progressivo + netto (stampa ridotta) oppure lordo/tara/netto.
4. Trasmissione a FOM e a PC su canali distinti, indipendentemente dall'esito della stampa.
5. Totalizzazione; con parametro 4 attivo solo se la trasmissione a FOM è corretta.
6. Trasmissione fallita → impulso di **0,5 s** sull'uscita dedicata (OUT1 = FOM, OUT2 = PC).
7. Progressivo + 1. Riarmo: peso sotto soglia oppure fotocellula liberata.

## 4. Ciclo di pesatura MPP (da tasto, trasmissione a fine pesatura)

Innesco e validazione come STD (punti 1–2). Poi:
- memorizzazione della pesata nell'**archivio MPP**;
- trasmissione a PC della stringa con **codice MPP e peso**;
- trasmissione fallita → contatto `ERRORE TRASM PC` di circa **1 s**.

## 5. Fine partita

Solo a ciclo terminato e con input abilitato (parametro 9):
- progressivo a 1 (se parametro 5);
- nuova intestazione alla stampa successiva;
- trasmissione a PC di una stringa speciale, con ACK/NAK opzionale; **l'esito non influisce sull'operazione**.

## 6. Stringhe trasmesse

### Stringa pesata (STD)

| Campo | Lunghezza | Formato |
|---|---|---|
| Inizio | 1 | `$` (configurabile) |
| Data | 10 | `gg/mm/aaaa` |
| Ora | 8 | `hh:mm:ss` |
| Progressivo | 6 | allineato a destra |
| Codice merce | 6 | allineato a destra |
| Descrizione | 20 | allineata a sinistra |
| Codice generico | 8 | allineato a sinistra |
| Risultato | 8 | allineato a destra |
| Lordo | 9 + 3 | numero a destra + ` kg` |
| Tara | 9 + 3 | |
| Netto | 9 + 3 | |
| Checksum | 0 / 2 | nessuno, XOR esadecimale o somma mod 256 esadecimale, calcolato sul corpo senza il carattere di inizio |
| Fine | 1 | CR (0Dh) |

Totale: **104** caratteri, **106** con checksum.

### Stringa MPP e stringa di fine partita

Modelli configurabili con i campi `{data} {ora} {prog} {codice} {desc} {cgen} {risultato} {lordo} {tara} {netto} {mpp}`
(fine partita anche `{npesate} {totnetto}`). Inizio, checksum e CR sono aggiunti automaticamente.
*Da concordare con i sistemi riceventi (domanda aperta in intent.md).*

### Protocollo

- **TCP client**: il simulatore apre una connessione verso *IP:porta* per ogni stringa.
- **UDP**: un datagramma per stringa.
- **TCP server** (change 0003): il simulatore ascolta sulla *porta* (proposte 4001 per PC e 4002 per FOM) e invia ogni
  stringa a tutti i client collegati, fino a 5 per canale (il sesto viene disconnesso). I client ricevono solo le
  stringhe successive al collegamento, senza altri caratteri; i dati che inviano vengono ignorati, tranne ACK/NAK.
  - Esito: nessun client → errore `NESSUN CLIENT`; senza ACK/NAK corretto se almeno un client ha ricevuto la stringa;
    con ACK/NAK vale il primo ACK, altrimenti nuovi invii fino a *tentativi*, poi `NAK` o `TIMEOUT ACK`.
    L'esito decide uscite di errore e totalizzazione come nelle altre modalità.
  - Accesso *solo questo PC* (default): la porta non è raggiungibile dalla rete; da un altro PC si ottiene
    "connection refused" e nel log non resta nulla.
  - Accesso *rete*: solo gli IP dell'elenco *IP ammessi* (obbligatorio, al massimo 20); un IP non in elenco viene
    chiuso subito e registrato nel log.
  - L'accesso alla porta del canale è indipendente da `HOST`, che riguarda solo l'interfaccia web.
  - Porta occupata: errore visibile e nuovo tentativo ogni 5 s; cambio di porta o accesso nel setup: il canale riparte
    e i client vengono disconnessi.
- ACK/NAK: `06h` = ricevuto, `15h` = errore; ritrasmissione su NAK o mancata risposta fino a *tentativi*.

## 7. Strumenti di collaudo

- Due ricevitori integrati (PC 9100, FOM 9101) con risposta ACK / NAK / nessuna, modificabile a caldo.
- Log delle stringhe trasmesse e ricevute con caratteri di controllo visibili; per i canali in TCP server anche il
  numero di client raggiunti.
- Ricevitore da riga di comando `npm run listen -- <porta> <tcp|udp> <ack|nak|none>`.
- Con un canale in TCP server: **PuTTY** (o un altro terminale TCP) in modalità *Raw* sulla porta del canale. Display
  e setup mostrano quanti client sono collegati.

## 8. Stack

Ogni livello dello stack di produzione ha un requisito esplicito, anche quando la decisione è "non applicabile".
Le misure sono in [tech-requirements.md](tech-requirements.md); l'analisi è nella change
[0002-allineamento-stack](changes/0002-allineamento-stack/intent.md).

| Livello | Comportamento |
|---|---|
| Frontend | React + Vite; UI del terminale, setup, log; tasti rapidi F2–F8. Un errore di rendering mostra un pannello con **Ricarica** e viene registrato nel log; i comandi rifiutati dal server compaiono come notifica |
| APIs & backend logic | WebSocket `/ws` per stato (10 Hz) e comandi; solo comandi noti con argomenti validi, gli altri vengono rifiutati con un errore senza toccare lo stato; `GET /api/health` |
| Database & storage | file JSON in `data/`, salvati in modo atomico con copia `.bak`; file danneggiati rinominati e recuperati all'avvio. Nessun database: i volumi non lo giustificano |
| Auth & permissions | di default solo dal PC locale; dalla rete solo con `SIM_TOKEN`, chiesto dalla UI una volta per sessione. Porte dei canali in TCP server: solo locale, oppure dalla rete con un elenco di IP ammessi (costituzione § 2). Nessun utente o ruolo |
| Hosting & deployment | `npm run prod` sul PC di collaudo; procedura nel README |
| Cloud & compute | non applicabile: il simulatore deve stare nella rete dei software da collaudare |
| CI/CD & version control | git + GitHub Actions con permessi di sola lettura: verifica del percorso, controllo dei contenuti pubblicabili, test, build, controllo delle vulnerabilità. Repository pubblico con licenza MIT; `main` protetto (solo PR con CI verde) |
| Security & RLS | origine del WebSocket controllata, intestazioni di sicurezza e CSP, limite di dimensione dei messaggi. RLS non applicabile (nessun database) |
| Rate limiting | al massimo 50 comandi al secondo per connessione, chiusura dopo 10 s di abuso, al massimo 10 connessioni; canali in TCP server: al massimo 5 client, dati in arrivo scartati, client che non leggono disconnessi |
| Caching & CDN | file della UI con cache lunga e immutabile, `index.html` sempre rivalidato. CDN non applicabile |
| Load balancing & scaling | non applicabile: istanza singola con stato; una seconda istanza sulla stessa porta termina con un messaggio chiaro |
| Error tracking & logs | log JSON giornalieri in `data/logs/`, conservati 14 giorni: pesate, errori di trasmissione e stampa, accessi negati, errori della UI ed errori non gestiti |
| Availability & recovery | stato persistente; arresto pulito entro 3 s; ricevitori di test e canali in TCP server che ripartono da soli se la porta era occupata; client caduti rimossi; riconnessione automatica della UI |

## 9. Operatività

### Avvio e variabili d'ambiente

| Variabile | Default | Significato |
|---|---|---|
| `PORT` | `3000` | porta HTTP/WebSocket |
| `HOST` | `127.0.0.1` | interfaccia di ascolto dell'interfaccia web; `0.0.0.0` per l'accesso da altri PC. Non riguarda le porte dei canali in TCP server, che hanno l'impostazione *Accesso* nel setup |
| `SIM_TOKEN` | — | token di accesso, obbligatorio se `HOST` non è un indirizzo di loopback |

Configurazione non valida o porta occupata → messaggio leggibile e codice di uscita 1. Procedura completa nel README,
sezione *Installazione su PC di collaudo*.

### Accesso remoto

I client non locali ricevono `authRequired` e nessuno stato finché non presentano il token; token errato → chiusura
della connessione (codice 4401) ed evento `auth_denied` nel log.

### Salute

`GET /api/health` → `status`, `version`, `uptime`, fase del ciclo, modo STD/MPP, stato dei ricevitori di test e, per i
canali in TCP server, `mode`, `listening`, `port`, `access`, `clients`.

### Log

`data/logs/simulatore-AAAA-MM-GG.log`, una riga JSON per evento (`ts`, `level`, `event` e campi). Eventi principali:
`start`, `shutdown`, `weighing`, `tx_error`, `printer_fault`, `end_batch`, `config_updated`,
`storage_recovered`, `receiver_error`, `receiver_retry`, `ws_connect`, `ws_disconnect`,
`command_rejected`, `rate_limited`, `auth_denied`, `client_error`, `uncaught_exception`; canali in TCP server:
`server_listen`, `server_listen_error`, `server_client_connect`, `server_client_disconnect`, `server_client_refused`
(motivo `ip` o `max_clients`).
