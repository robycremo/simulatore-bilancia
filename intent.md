# Intent — Simulatore bilancia

> Documento vivo: descrive **perché** esiste il progetto (il work item di fondo). Si modifica raramente e solo passando
> da una change in `changes/`. Le regole del processo sono nella [costituzione](constitution.md).

## Work item

> Come **chi sviluppa o collauda un software che riceve le pesate**, voglio **un terminale di pesatura simulato,
> fedele a quello reale**, per **provare l'integrazione e i casi di errore senza la bilancia fisica**.

## Problema

Chi sviluppa e collauda i software che ricevono le pesate (PC di reparto, FOM) ha bisogno di un terminale di pesatura
reale per provare l'integrazione. La bilancia fisica non è sempre disponibile, non permette di riprodurre a comando i casi
di errore (stampante in avaria, NAK, time-out) e rende lenti i collaudi.

## Obiettivo

Un simulatore software del terminale di pesatura che:

1. si comporta come un terminale di pesatura reale (funzionamento **STD** e **MPP**, setup, stampa, totali, fine partita);
2. spedisce su IP le **stesse stringhe** del terminale reale (104/106 caratteri) verso PC e FOM;
3. permette di provare a comando anche i casi di errore di trasmissione e di stampa.

## Per chi

- Sviluppatori dei software di ricezione pesate.
- Tecnici che collaudano un impianto prima dell'installazione della bilancia.

## Vincoli

- Backend **Node.js**, interfaccia **React**.
- Gira in locale su Windows, senza dipendenze esterne oltre a Node.
- Il formato delle stringhe è quello definito in `spec.md` § 6: in caso di dubbio vince la spec.
- Ogni modifica segue il percorso della [costituzione](constitution.md) (vedi [changes/README.md](changes/README.md)).
- L'architettura tiene conto dei livelli dello stack di produzione (vedi `spec.md` § Stack).

## Fuori ambito

- Metrologia legale, taratura e certificazione.
- Simulazione elettrica di I/O reali (gli ingressi e le uscite sono virtuali).
- Gestione anagrafiche complete (articoli, clienti): solo i campi che finiscono nella stringa.

## Criteri di successo

- Un software ricevente collaudato con il simulatore funziona senza modifiche con il terminale reale.
- Tutti i casi previsti (STD, MPP, errori FOM/PC, avaria stampante, fine partita) sono riproducibili in meno di un minuto.

## Domande aperte

- Algoritmo del checksum a 2 caratteri.
- Formato della stringa MPP e della stringa speciale di fine partita (da concordare con i sistemi riceventi).
- Eventuale prefisso prima del carattere di inizio `$`, richiesto da alcuni sistemi riceventi.
