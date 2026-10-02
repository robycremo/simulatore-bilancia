# 0001 — Simulatore iniziale · Spec

> Stato: completato

## Comportamento

Quello descritto in [spec.md](../../spec.md) § 1–7 (bilancia, setup, ciclo STD, ciclo MPP, fine partita, stringhe,
strumenti di collaudo).

## Criteri di accettazione

- [x] Con funzionamento a soglia, un carico di 237,5 kg genera una pesata automatica e una stringa di 104 caratteri
      identica nel formato all'esempio di riferimento.
- [x] Con ACK/NAK attivo e FOM che risponde NAK: ritrasmissione, impulso OUT1 di 0,5 s e, con parametro 4, nessuna totalizzazione.
- [x] In MPP la pesata finisce nell'archivio MPP e al PC arriva la stringa con codice MPP e peso.
- [x] Fine partita: progressivo a 1, stringa speciale al PC, intestazione ristampata alla pesata successiva.

## Impatto sui documenti vivi

Prima stesura di `spec.md` § 1–7.

## Registro

- 2026-10-02 — creata e completata.
