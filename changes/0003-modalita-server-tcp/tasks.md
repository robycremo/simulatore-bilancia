# 0003 — Modalità server TCP · Tasks

> Stato: approvato

Deriva da [plan.md](plan.md). Ordine di esecuzione: ogni task si chiude con i suoi test verdi prima del successivo.
Tra parentesi i requisiti tecnici coperti.

## Prerequisito

- [ ] **T0. Change 0002 chiusa** (test-results completato, documenti vivi aggiornati). Si lavora su un ramo
      `0003-modalita-server-tcp`.

## Validazione e configurazione

- [ ] **T1. Default di configurazione.** In `DEFAULT_CONFIG` aggiungere `access: 'local'` e `allowedIps: []` a `pc` e
      `fom`. Test: un `config.json` della 0002, senza i nuovi campi, viene caricato con i default (TR-4).
- [ ] **T2. Schema dei canali.** In `api/validate.js`: `proto` con `tcp-server`, `access`, `allowedIps` con un nuovo
      `arrOf(item, { max })` a lunghezza variabile, controllo IPv4 (quattro ottetti 0–255) e duplicati (TR-1, TR-2).
- [ ] **T3. Controlli tra campi.** Dopo la validazione per campo: `tcp-server` + `network` con elenco vuoto; porta
      server uguale a quella dell'altro canale in `tcp-server` o di un ricevitore di test. Messaggi d'errore espliciti.
      Test in `validate.test.js` per ogni caso valido e non valido (TR-3).

## Trasporto

- [ ] **T4. `ServerChannel`: ascolto e accettazione.** `start()` su `127.0.0.1` o `0.0.0.0`; normalizzazione
      dell'indirizzo; controllo loopback / `allowedIps`; massimo 5 client; `setNoDelay`, `setKeepAlive(true, 10000)`;
      dati in arrivo scartati; log `server_listen`, `server_client_connect`, `server_client_disconnect`,
      `server_client_refused`; `status()`. Test: accesso `local` e `network`, sesto client, testo dal client
      ignorato (TR-6, TR-7, TR-8, TR-9, TR-11, TR-20).
- [ ] **T5. `ServerChannel`: invio ed esito.** `send(payload, { ackNak, timeoutMs, retries })`: `NESSUN CLIENT`,
      scrittura a tutti, prima scrittura completata; con ACK/NAK primo `06h`, fine anticipata se tutti NAK, nuovi invii,
      `NAK` / `TIMEOUT ACK`; `clients` raggiunti. Test: nessun client, due client, client collegato dopo l'invio,
      ACK, NAK con ritentativi, tutti NAK, latenza < 100 ms (TR-12, TR-16, TR-17, TR-18).
- [ ] **T6. `ServerChannel`: client lento.** Funzione separata che dopo la scrittura disconnette il client con
      `writableLength` > 64 KB. Test con socket finto (TR-10).
- [ ] **T7. `ServerChannel`: errori di ascolto e arresto.** Porta occupata → stato `ERRORE: …`, `server_listen_error`,
      nuovo tentativo ogni 5 s; `close()` chiude listener e client. Test: porta occupata poi liberata; `close()` con
      client collegati (TR-13, TR-15).
- [ ] **T8. `ChannelManager`.** `ClientChannel` attorno a `transmit` (stesso esito, `clients: null`);
      `ChannelManager` con `send`, `reconfigure` (riavvio solo se cambiano `proto`, `port`, `access`, `allowedIps`),
      `close`, `status`. Test: cambio porta → vecchia porta rifiutata, nuova accettata entro 1 s; cambio di `timeoutMs`
      senza riavvio (TR-14).

## Dominio

- [ ] **T9. Motore.** Sostituire le tre chiamate a `transmit` con `channels.send`; `reconfigure` in `cmd_updateConfig`;
      `channels.close()` in `close()`; canali in `getState()` (stato, client) e `getHealth()`; `clients` nel log delle
      trasmissioni. Tutti i test di 0001 e 0002 devono restare verdi senza modifiche (TR-19, TR-21, TR-22).

## Interfaccia

- [ ] **T10. Setup.** Opzione *TCP server*; con `tcp-server`, *Indirizzo IP* nascosto, *Accesso* e *IP ammessi* (testo
      separato da virgole ↔ lista) visibili; porta proposta 4001/4002 se quella attuale è di un ricevitore di test;
      stato dell'ascolto (TR-5).
- [ ] **T11. Display e Trasmissioni.** `PC: n client` / `FOM: n client` sul display per i canali in `tcp-server`;
      `· n client` nella scheda Trasmissioni.

## Verifica end-to-end

- [ ] **T12. `app.test.js`.** Pesata STD con PC in `tcp-server` → il client riceve la stessa stringa del log; FOM senza
      client con totalizzazione condizionata (OUT1, `NESSUN CLIENT`, non totalizzato); MPP; fine partita senza client
      completata; cambio porta dal setup; health; arresto con client collegati.
- [ ] **T13. Prove manuali** (in [test-results.md](test-results.md)): PuTTY *Raw* su `127.0.0.1:4001` (stringa
      visibile e identica, testo digitato ignorato, chiusura della finestra); PuTTY da un secondo PC con accesso `rete`
      e con IP non ammesso; client caduto per rete staccata entro 60 s (TR-11).

## Chiusura

- [ ] **T14. Documentazione.** README: uso con PuTTY, nota sul firewall di Windows in accesso `rete`. Documenti vivi:
      `spec.md` § 2, § 6, § 7, § 8; `tech-requirements.md` con TR-1…TR-22; `plan.md` con i nuovi moduli.
- [ ] **T15. Chiusura.** `npm run check:flow`, `npm run build`, `npm test`, `npm audit` verdi; test-results completato;
      tutti i file della change a `completato`; PR con il modello.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritti dopo l'approvazione del plan.
- 2026-10-02 — approvati dall'utente.
