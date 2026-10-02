# 0003 — Modalità server TCP · Spec

> Stato: completato

Deriva da [intent.md](intent.md). Descrive solo il comportamento osservabile. Ciclo di pesatura, formato delle stringhe
e funzionamento in modalità client TCP / UDP ([spec.md](../../spec.md) § 3–6) **non cambiano**.

## Comportamento

### 1. Modalità del canale

Nel setup, per ciascun canale (PC e FOM), il campo **Protocollo** ha tre valori:

| Valore | Comportamento |
|---|---|
| TCP client | come oggi: il simulatore apre una connessione verso *indirizzo:porta* per ogni stringa |
| UDP | come oggi |
| **TCP server** | il simulatore **ascolta** sulla *porta* e invia le stringhe ai client collegati |

In modalità server il campo *Indirizzo IP* non si usa. Compaiono due campi:
- **Accesso**: `solo questo PC` (default) oppure `rete`;
- **IP ammessi**: con accesso `rete`, l'elenco degli indirizzi IPv4 che possono collegarsi. Non può restare vuoto.

Porte di default in modalità server: **4001** (PC) e **4002** (FOM). Quando si passa a TCP server, il setup propone
queste porte; i ricevitori di test restano su 9100/9101.

### 2. Connessioni

- Un client (per esempio PuTTY in modalità *Raw* su `127.0.0.1:4001`) si collega e **resta collegato**.
- Riceve **solo le stringhe prodotte dopo** il collegamento, nello stesso formato di oggi (104/106 caratteri + CR).
  Nessun messaggio di benvenuto, nessun altro carattere.
- Più client sullo stesso canale ricevono **tutti** le stesse stringhe, fino a **5 client per canale**.
  Il sesto viene disconnesso subito.
- Un client con indirizzo non ammesso viene disconnesso subito.
- I dati inviati dal client vengono ignorati, tranne i caratteri ACK/NAK quando il protocollo ACK/NAK è attivo.
- Un client caduto senza chiudere la connessione (rete staccata, PC spento) viene rilevato e rimosso.
- Se la porta è occupata, il canale mostra l'errore e ritenta l'ascolto ogni **5 secondi**, come i ricevitori di test.
- Se nel setup cambiano modalità, porta o accesso, il canale riparte con le nuove impostazioni e i client collegati
  vengono disconnessi.

### 3. Esito della trasmissione

L'esito decide, come oggi, le uscite di errore (OUT1 / OUT2) e, per il FOM, la totalizzazione (parametro 4).

| Situazione | Esito |
|---|---|
| Nessun client collegato | **errore** `NESSUN CLIENT` |
| Senza ACK/NAK: almeno un client ha ricevuto la stringa | corretto |
| Con ACK/NAK: almeno un client risponde ACK entro il time-out | corretto |
| Con ACK/NAK: nessun ACK (NAK o silenzio da tutti) | nuovi invii fino a *tentativi*, poi **errore** `NAK` o `TIMEOUT ACK` |

- Con ACK/NAK la stringa viene reinviata a tutti i client collegati; vale il primo ACK ricevuto.
- La stringa di fine partita segue le stesse regole di invio, ma il suo esito non influisce sull'operazione (come oggi).

### 4. Visibilità

- **Setup**: per ogni canale in modalità server, stato dell'ascolto (`IN ASCOLTO TCP 4001`, `ERRORE: …`).
- **Scheda Trasmissioni**: per ogni invio anche il numero di client raggiunti (es. `2 client`).
- **Display**, riga di stato del canale: numero di client collegati a PC e FOM.
- **`/api/health`**: per ogni canale in modalità server, stato dell'ascolto, porta e numero di client.
- **Log**: `server_client_connect`, `server_client_disconnect`, `server_client_refused` (motivo: IP non ammesso o troppi
  client), `server_listen_error`, più il già esistente `tx_error` con motivo `NESSUN CLIENT`.

### 5. Accesso dalla rete

La costituzione (§ 2) chiede un token per esporre il simulatore in rete. Una connessione TCP grezza come quella di
PuTTY non può presentarlo. Per le porte server vale quindi una regola dedicata:
- accesso di default **solo dal PC locale**: la porta non è raggiungibile dalla rete, quindi una connessione da un altro
  PC viene rifiutata dal sistema operativo ("connection refused") e il simulatore non la vede né la registra;
- accesso dalla rete solo con un **elenco esplicito di IP ammessi**: una connessione da un IP non in elenco viene
  accettata e chiusa subito dal simulatore, e registrata nel log;
- l'accesso alla porta del canale è indipendente da `HOST`, che riguarda solo l'interfaccia web.

Serve un **emendamento della costituzione** § 2, da applicare quando questa spec viene approvata:

> L'esposizione in rete richiede un token per la UI e le API; per le porte TCP server dei canali, che non possono
> presentare un token, un elenco esplicito di IP ammessi.

## Criteri di accettazione

**Modalità e connessioni**
- [ ] Canale PC in TCP server sulla porta 4001: PuTTY *Raw* su `127.0.0.1:4001`, pesata a soglia → PuTTY mostra la
      stringa di 104 caratteri, identica a quella che riceve il ricevitore di test in modalità client.
- [ ] Il client che si collega dopo una pesata non riceve quella pesata, solo le successive.
- [ ] Due client sullo stesso canale ricevono entrambi la stringa; il sesto client viene disconnesso subito.
- [ ] Testo scritto in PuTTY non cambia lo stato del simulatore e non causa errori.
- [ ] Client terminato bruscamente: rimosso dal conteggio; la pesata successiva senza altri client dà `NESSUN CLIENT`.
- [ ] Porta occupata → errore visibile; liberata la porta, entro 5 s il canale torna in ascolto.
- [ ] Cambio porta nel setup → la vecchia porta non accetta più connessioni, la nuova sì.

**Esiti**
- [ ] Nessun client sul canale FOM con *totalizza solo con FOM corretta* → OUT1 per 0,5 s, `tx_error` con
      `NESSUN CLIENT`, pesata non totalizzata.
- [ ] ACK/NAK attivo, client che risponde ACK → esito corretto; client che risponde NAK → nuovi invii, poi errore `NAK`.
- [ ] MPP con canale PC in TCP server → la stringa MPP arriva al client; senza client → contatto `ERRORE TRASM PC` di circa 1 s.
- [ ] Fine partita con canale PC in TCP server → la stringa speciale arriva al client; senza client l'operazione si completa comunque.

**Accesso**
- [ ] Accesso `solo questo PC` → connessione dall'IP di rete del PC rifiutata ("connection refused"); nessuna
      riga nel log, perché la connessione non raggiunge il simulatore.
- [ ] Accesso `rete` con IP ammesso → connessione accettata; con IP non in elenco → rifiutata e registrata.
- [ ] Setup con accesso `rete` ed elenco IP vuoto o con un indirizzo non valido → rifiutato con errore.

**Visibilità**
- [ ] Display, setup, scheda Trasmissioni e `/api/health` mostrano stato e numero di client come descritto.

**Nessuna regressione**
- [ ] I criteri di accettazione di 0001 e 0002 restano soddisfatti; i canali in TCP client e UDP si comportano come prima.

## Impatto sui documenti vivi

- `spec.md` § 2 (parametro 7: modalità TCP server), § 6 *Protocollo*, § 7 (PuTTY come strumento di collaudo),
  § 8 *Stack* (Auth & permissions, Rate limiting: 5 client per canale).
- `constitution.md` § 2: emendamento sull'accesso alle porte TCP server.
- `intent.md`: nessuna modifica.

## Registro

- 2026-10-02 — creata vuota, in attesa dell'intent.
- 2026-10-02 — scritta dopo l'approvazione dell'intent. Le sei domande aperte dell'intent sono chiuse qui con proposte
  da confermare in approvazione: errore senza client; ACK/NAK sulla connessione aperta; tutti i client fino a 5;
  porte 4001/4002; rete solo con elenco di IP ammessi; solo stringhe successive al collegamento.
- 2026-10-02 — approvata dall'utente, con le sei proposte; emendamento della costituzione § 2 applicato.
- 2026-10-02 — **ritorno alla spec** (T13, prova dell'utente): il criterio "accesso solo questo PC → rifiutata e
  registrata nel log" era in contrasto con TR-6 (ascolto su 127.0.0.1: il rifiuto lo fa il sistema operativo e il
  simulatore non vede la connessione). Scelta dell'utente (opzione A): si corregge la spec, TR-6 resta. Il rifiuto
  registrato vale per l'accesso "rete" con IP non in elenco. Aggiunto che l'accesso al canale è indipendente da `HOST`.
- 2026-10-02 — change chiusa su conferma dell'utente (T15); TR-11 verificato con revisione, senza prova a rete staccata.
