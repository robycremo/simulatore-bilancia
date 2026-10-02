# Requisiti tecnici — Simulatore bilancia

> Documento vivo: vincoli tecnici **misurabili** del sistema, nello stato delle change completate.
> Deriva da [spec.md](spec.md) e dalla [costituzione](constitution.md). Si aggiorna solo alla chiusura di una change.

## Piattaforma

| ID | Requisito | Misura / soglia | Origine |
|---|---|---|---|
| TR-P1 | Runtime | Node.js ≥ 22; uso su Windows, CI su Linux | 0001 |
| TR-P2 | Dipendenze di runtime | solo `express`, `ws` | 0001, confermato da 0002 |
| TR-P3 | Avvio | un solo comando, nessun servizio esterno | costituzione § 6 |

## Motore e trasmissione

| ID | Requisito | Misura / soglia | Origine |
|---|---|---|---|
| TR-M1 | Ciclo del motore | tick 100 ms; stato alla UI a 10 Hz | 0001 |
| TR-M2 | Stringa pesata | 104 caratteri, 106 con checksum; latin1; CR finale | 0001 |
| TR-M3 | Trasmissione | TCP client (una connessione per stringa) o UDP; ACK `06h` / NAK `15h` | 0001 |
| TR-M4 | Uscite di errore | impulso 0,5 s (STD), circa 1 s (MPP) | 0001 |
| TR-M5 | Ricevitori di test | PC 9100, FOM 9101 | 0001 |

## Persistenza

| ID | Requisito | Misura / soglia | Origine |
|---|---|---|---|
| TR-S1 | Formato | JSON in `data/` (`config.json`, `state.json`) | 0001 |

## Stack di produzione (0002)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-A1 | Interfaccia di ascolto di default | `127.0.0.1:3000` (`HOST`, `PORT`) |
| TR-A2 | Token fuori da loopback | obbligatorio; confronto a tempo costante; mai nei log; chiusura `4401`, timeout 30 s |
| TR-A3 | Messaggi | WebSocket ≤ 16 KB; `/api/client-error` ≤ 4 KB e ≤ 10/minuto per IP |
| TR-A4 | Rate limiting | ≤ 50 comandi in qualsiasi intervallo di 1 s; avviso ≤ 1/s; 10 s consecutivi → `1008`; ≤ 10 connessioni |
| TR-A5 | Invii del carico dalla UI | ≤ 20/s |
| TR-A6 | Sicurezza HTTP | Origin = Host per il WebSocket; `nosniff`, `DENY`, `no-referrer`, CSP solo `'self'`, niente `X-Powered-By` |
| TR-A7 | Dipendenze | 0 vulnerabilità di gravità *high* o superiore |
| TR-A8 | Cache | `/assets/*` un anno immutabile; `index.html` `no-cache`; `/api/health` `no-store` |
| TR-A9 | Storage | scrittura atomica (tmp + fsync + rename) con `.bak`; recupero `.corrupt-*` → `.bak` → default |
| TR-A10 | Log | JSON lines giornalieri, 14 giorni, scrittura sincrona |
| TR-A11 | Arresto | ≤ 3 s con stato salvato |
| TR-A12 | Ricevitori di test | nuovo tentativo ogni 5 s |
| TR-A13 | Seconda istanza | messaggio chiaro, codice di uscita 1, nessuno stack trace |

Dettaglio e verifiche: [changes/0002-allineamento-stack/tech-requirements.md](changes/0002-allineamento-stack/tech-requirements.md).
