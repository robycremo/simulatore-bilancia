# 0001 — Simulatore iniziale · Intent

> Stato: completato

## Work item

> Come **sviluppatore di un software che riceve le pesate**, voglio **un terminale di pesatura simulato che invii le stesse stringhe di quello reale** per **collaudare l'integrazione senza la bilancia fisica**.

## Problema

Serve un terminale di pesatura da usare al banco per collaudare i software che ricevono le pesate, senza la bilancia fisica.

## Obiettivo

Simulatore Node.js + React che riproduce il terminale (setup punti 1–12, funzionamento STD e MPP) e invia su IP le
stringhe peso a PC e FOM.

## Fuori ambito

Allineamento ai livelli dello stack di produzione (→ change 0002).

## Vincoli

Formato della stringa di riferimento: 104 caratteri, 106 con checksum.

## Registro

- 2026-10-02 — creata e completata. Documentata a posteriori: il codice è nato prima dell'introduzione del percorso.
