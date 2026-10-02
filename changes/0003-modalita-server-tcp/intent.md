# 0003 — Modalità server TCP · Intent

> Stato: approvato

## Work item

> Come **chi collauda un software che riceve le pesate**, voglio **collegarmi io al simulatore (per esempio con PuTTY
> in modalità Raw) e ricevere le stringhe sulla connessione aperta** per **provare i software e gli strumenti che si
> aspettano una bilancia in ascolto su una porta TCP**.

## Problema

Oggi il simulatore trasmette solo come **client**: è lui ad aprire una connessione verso PC e FOM (o a inviare in UDP).
Molti terminali reali e molti software di acquisizione funzionano al contrario: la bilancia **ascolta** su una porta e
il PC si collega e resta collegato, ricevendo le stringhe man mano.

Con il simulatore attuale:
- non si può usare un client generico come **PuTTY** o un terminale TCP per guardare le stringhe in arrivo, perché
  sono anch'essi client e non possono mettersi in ascolto;
- non si possono collaudare i software di ricezione pensati per collegarsi alla bilancia.

## Obiettivo

Aggiungere a ciascun canale di trasmissione (PC, FOM) la possibilità di funzionare come **server TCP**. Il simulatore
ascolta su una porta configurabile e invia ogni stringa (pesata, MPP, fine partita) ai client collegati. Il resto del
comportamento non cambia: ciclo di pesatura, esiti, totalizzazione, uscite di errore e formato delle stringhe.

## Fuori ambito

- Modifiche al formato delle stringhe.
- Comandi ricevuti dal client per pilotare la bilancia (es. richiesta del peso su domanda): eventuale change separata.
- Protocolli diversi da TCP grezzo (Telnet con negoziazione, seriale virtuale, Modbus).

## Vincoli

- La costituzione vuole il simulatore **locale per default**: anche la porta server ascolta solo su loopback,
  salvo esposizione esplicita.
- Una connessione TCP grezza non può presentare il token della 0002 come fa la UI: la protezione per l'uso in rete
  va definita in spec. Se serve allentare la regola "esposizione in rete solo con token", va prima emendata la
  costituzione.
- Il codice parte dopo la chiusura della 0002, su cui questa change si appoggia (configurazione, validazione, log, test end-to-end).

## Domande aperte (da chiudere nella spec)

1. **Esito della trasmissione** in modalità server, che decide uscite di errore e totalizzazione con FOM:
   nessun client collegato = errore? Con più client, basta che uno riceva?
2. **ACK/NAK sulla connessione aperta**: si attende la risposta dal client come in modalità client? Con quale time-out?
3. **Più client contemporanei**: tutti ricevono le stringhe, o al massimo uno (il secondo viene rifiutato)?
4. **Porte di default**: proposta 4001 (PC) e 4002 (FOM), per non collidere con i ricevitori di test 9100/9101.
5. **Accesso dalla rete** (PuTTY su un altro PC): elenco di indirizzi IP ammessi, oppure solo loopback?
6. **Stringhe alla connessione**: un client che si collega riceve solo le stringhe successive, o anche l'ultima?

## Registro

- 2026-10-02 — creata su richiesta dell'utente, che vuole usare PuTTY per ricevere le stringhe.
- 2026-10-02 — approvato dall'utente.
