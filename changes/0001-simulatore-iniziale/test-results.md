# 0001 — Simulatore iniziale · Test results

> Stato: completato

## Test automatici

Nessuno all'epoca della change. Dalla 0002 i criteri qui sotto sono coperti in modo permanente da `test/app.test.js`
(gruppo *nessuna regressione 0001*) e `test/format.test.js`.

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| Soglia, 237,5 kg → pesata automatica, stringa 104 car. come l'esempio di riferimento | prova nel browser (2026-10-02); oggi `format.test` + `app.test` | ✅ |
| FOM in NAK con ACK/NAK → ritrasmissione, OUT1 0,5 s, nessuna totalizzazione con parametro 4 | script WebSocket (2026-10-02); oggi `app.test` | ✅ |
| MPP → archivio e stringa con codice MPP e peso al PC | script WebSocket (2026-10-02); oggi `app.test` | ✅ |
| Fine partita → progressivo a 1, stringa speciale al PC, nuova intestazione | script WebSocket (2026-10-02); oggi `app.test` | ✅ |

## Problemi trovati

Nessuno.

## Registro

- 2026-10-02 — creato dalla sezione *Verifica* del plan all'introduzione del passo *test-results*.
