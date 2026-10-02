# 0001 — Simulatore iniziale · Requisiti tecnici

> Stato: completato

## Requisiti

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-1 | Backend | Node.js, unico processo; il browser non apre socket TCP/UDP, quindi le trasmissioni partono dal server |
| TR-2 | Frontend | React + Vite, collegato al server via WebSocket `/ws` |
| TR-3 | Ciclo del motore | tick di 100 ms; stato inviato alla UI a 10 Hz |
| TR-4 | Stringa pesata | 104 caratteri, 106 con checksum; codifica latin1; terminatore CR |
| TR-5 | Trasmissione | TCP client (una connessione per stringa) o UDP; ACK `06h` / NAK `15h`, time-out e tentativi configurabili |
| TR-6 | Uscite di errore | impulso 0,5 s (STD), circa 1 s (MPP) |
| TR-7 | Persistenza | setup e stato in JSON in `data/` |
| TR-8 | Ricevitori di test | PC 9100, FOM 9101, TCP o UDP |

## Dipendenze

Runtime: `express` (UI compilata), `ws` (WebSocket). Sviluppo: `vite`, `@vitejs/plugin-react`, `react`, `react-dom`,
`concurrently`.

## Compatibilità

Windows 11, Node ≥ 22.

## Controlli della costituzione

Change precedente alla costituzione: controllo fatto a posteriori dalla 0002, che ne copre le lacune (sicurezza, log, CI).

## Registro

- 2026-10-02 — documentato a posteriori all'introduzione del passo *tech-requirements*.
