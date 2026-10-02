# 0003 — Modalità server TCP · Plan

> Stato: approvato

Deriva da [spec.md](spec.md) e [tech-requirements.md](tech-requirements.md).
**Prerequisito:** change 0002 chiusa. Il codice si appoggia a validazione, log, health e test end-to-end della 0002.

## Approccio

1. **Un'interfaccia unica per i canali.** Oggi il motore chiama direttamente `transmit(ch, payload)` in tre punti
   (pesata STD, MPP, fine partita). Al suo posto chiamerà `channels.send(key, payload, { ackNak })`, che restituisce lo
   stesso esito di oggi (`ok`, `reason`, `attempts`) più `clients`. Dietro c'è un oggetto per canale:
   - `ClientChannel`: incapsula l'attuale `transmit` (TCP client e UDP), senza cambiarne il comportamento;
   - `ServerChannel`: nuovo, server TCP con i client collegati.

   Così il dominio non sa se il canale è client o server (costituzione § 1) e il ciclo di pesatura, la totalizzazione
   e le uscite di errore restano identici. Basta che l'esito sia corretto o in errore.
2. **`ServerChannel` autonomo e testabile.** Classe in `server/transport/serverChannel.js` con `start()`, `send()`,
   `close()`, `status()`. Non dipende dal motore: riceve opzioni (porta, accesso, IP ammessi, limiti) e un logger.
   Si prova da sola con client `node:net` reali.
   - **Accettazione**: indirizzo normalizzato (`::ffff:a.b.c.d` → `a.b.c.d`), confrontato con loopback (`local`) o con
     `allowedIps` (`network`); oltre 5 client → `destroy()` immediato con log `server_client_refused`.
   - **Per client**: `setNoDelay(true)`, `setKeepAlive(true, 10000)`; i dati in arrivo vengono letti e scartati, salvo
     durante un'attesa ACK, in cui si cercano `06h`/`15h`.
   - **Invio**: scrittura a tutti i client; dopo ogni scrittura, se `socket.writableLength` supera 64 KB, il client
     viene disconnesso (logica in una funzione separata, provabile con un socket finto).
   - **Esito**: senza ACK/NAK, corretto alla prima scrittura completata entro `timeoutMs`. Con ACK/NAK, attesa del primo
     `06h` da qualsiasi client entro `timeoutMs`; se rispondono tutti NAK l'attesa finisce subito; poi nuovo invio fino a
     `retries`. Nessun client → `NESSUN CLIENT` senza attese.
   - **Ascolto**: errore di `listen` → stato `ERRORE: …`, log `server_listen_error`, nuovo tentativo ogni 5 s
     (stesso schema dei ricevitori di test della 0002).
3. **`ChannelManager` per configurazione e ciclo di vita.** In `server/transport/channels.js` crea il canale giusto
   per PC e FOM in base a `proto`. Con `reconfigure(config)` ricrea solo i canali i cui campi rilevanti sono cambiati
   (`proto`, `port`, `access`, `allowedIps`): chiude listener e client, poi riparte. Gli altri campi (`ackNak`,
   `timeoutMs`, `retries`) si leggono a ogni invio senza ripartire. `close()` per l'arresto. `status()` per stato e health.
4. **Validazione al confine.** In `api/validate.js`:
   - `proto` con tre valori; `access`; `allowedIps` come lista di IPv4 (0–20, senza duplicati, ciascun ottetto 0–255);
   - controlli tra campi dopo la validazione per campo: `network` senza IP, porta server uguale all'altro canale in
     `tcp-server` o a un ricevitore di test → setup rifiutato con errore esplicito.
5. **Interfaccia.** Nel setup, per il canale in `tcp-server`, si nasconde *Indirizzo IP* e compaiono *Accesso* e
   *IP ammessi* (testo separato da virgole, convertito in lista); al passaggio a `tcp-server`, se la porta è quella di un
   ricevitore di test, viene proposta 4001/4002 (TR-5). Il display mostra `PC: n client` / `FOM: n client`; la scheda
   Trasmissioni aggiunge `· n client`; il setup mostra lo stato dell'ascolto.

## Struttura

```text
server/
  transport/
    net.js              invariato (transmit TCP client / UDP)
    serverChannel.js    NUOVO  server TCP: accettazione, invio, ACK/NAK, buffer, keep-alive, nuovi tentativi
    channels.js         NUOVO  ClientChannel + ChannelManager (creazione, reconfigure, close, status)
  domain/engine.js      tre chiamate transmit → channels.send; stato, health, arresto, reconfigure
  api/validate.js       schema dei canali + controlli tra campi
client/src/components/
  Setup.jsx             campi per la modalità server, porte proposte
  Display.jsx           numero di client per canale
  Panels.jsx            client raggiunti nella scheda Trasmissioni
```

## File toccati

| File | Modifica |
|---|---|
| `server/transport/serverChannel.js` | nuovo |
| `server/transport/channels.js` | nuovo |
| `server/domain/engine.js` | `channels.send` al posto di `transmit`; `access`/`allowedIps` in `DEFAULT_CONFIG`; `reconfigure` in `cmd_updateConfig`; `channels.close()` in `close()`; canali in `getState()` e `getHealth()`; `clients` nel log delle trasmissioni |
| `server/api/validate.js` | schema dei canali, `arrOf` a lunghezza variabile, controlli tra campi |
| `client/src/components/Setup.jsx`, `Display.jsx`, `Panels.jsx` | interfaccia della modalità server |
| `client/src/styles.css` | stili dei nuovi elementi, se servono |
| `test/serverChannel.test.js` | nuovo |
| `test/validate.test.js` | casi della modalità server |
| `test/app.test.js` | casi end-to-end della modalità server |
| `README.md`, `spec.md`, `tech-requirements.md`, `plan.md` in radice | documentazione alla chiusura |

## Strategia di verifica

- **`serverChannel.test.js`** (client `node:net` reali): nessun client, due client, sesto client rifiutato, testo dal
  client ignorato, ACK, NAK con ritentativi, tutti NAK, client che si collega dopo un invio, chiusura del client,
  porta occupata e nuovo tentativo, accesso `local` dall'IP di rete rifiutato, `network` con IP ammesso e non ammesso,
  latenza < 100 ms, buffer oltre 64 KB con socket finto.
- **`validate.test.js`**: valori e controlli tra campi di TR-2/TR-3; `config.json` della 0002 ancora valido (TR-4).
- **`app.test.js`**: pesata STD con PC in `tcp-server` → il client riceve la stessa stringa del log delle trasmissioni;
  FOM senza client con totalizzazione condizionata; MPP; fine partita; cambio porta dal setup; health; arresto
  con client collegati; tutti i test della 0001 e 0002 senza modifiche.
- **Prove manuali**: PuTTY *Raw* su `127.0.0.1:4001` (stringa visibile, testo digitato ignorato, chiusura della
  finestra); PuTTY da un secondo PC con accesso `rete`; client caduto per rete staccata (TR-11), perché il keep-alive
  non si può simulare in modo affidabile su loopback.
- Esiti in `test-results.md`, criterio per criterio.

## Rischi

- **Keep-alive (TR-11).** Il tempo di rilevamento dipende dal sistema operativo. Node imposta il ritardo iniziale; su
  Windows intervallo e numero di sonde hanno default propri. Se la prova manuale supera 60 s, si torna ai requisiti
  tecnici: o si alza il limite, o si aggiunge un controllo applicativo, che però invierebbe byte non previsti dal formato.
- **Buffer del client lento (TR-10).** Sul loopback i buffer del sistema operativo sono grandi: un client fermo
  difficilmente porta `writableLength` oltre 64 KB in un test reale. Per questo la soglia si verifica con un socket finto,
  più una revisione del codice.
- **Esito "scrittura completata".** Senza ACK/NAK, "scrittura completata" significa consegnata al sistema operativo,
  non letta dal client: è lo stesso significato della modalità client attuale, ma va scritto nella spec viva
  alla chiusura.
- **Firewall di Windows.** In accesso `rete` il primo ascolto su `0.0.0.0` può far comparire la richiesta del firewall:
  da documentare nel README.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritto dopo l'approvazione dei requisiti tecnici.
- 2026-10-02 — approvato dall'utente.
