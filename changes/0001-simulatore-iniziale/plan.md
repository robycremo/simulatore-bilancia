# 0001 — Simulatore iniziale · Plan

> Stato: completato

## Approccio

Motore unico lato server (tick 100 ms) e UI React come sola vista via WebSocket: il server può aprire socket TCP/UDP,
il browser no. Architettura descritta in [plan.md](../../plan.md).

## File toccati

Tutti i file in `server/` e `client/`, `package.json`, `vite.config.js`.

## Strategia di verifica

Prova nel browser e script WebSocket end-to-end; dal 0002 coperta in modo permanente da `test/app.test.js`.
Esiti in [test-results.md](test-results.md).

## Registro

- 2026-10-02 — creata e completata.
- 2026-10-02 — adeguato al percorso SDD: passi in [tasks.md](tasks.md), verifica in [test-results.md](test-results.md).
