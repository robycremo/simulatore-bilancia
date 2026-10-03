# Simulatore bilancia

Simulatore di terminale di pesatura: server Node.js (`server/`) che invia stringhe peso su IP, UI React (`client/`).

Prima di qualsiasi modifica leggi la [costituzione](constitution.md): sono le regole che valgono per tutto il processo.
Documenti vivi: [intent.md](intent.md) (perché), [spec.md](spec.md) (cosa), [tech-requirements.md](tech-requirements.md)
(vincoli misurabili), [plan.md](plan.md) (come).

## Percorso obbligatorio per ogni modifica

`intent → spec → tech-requirements → plan → tasks → codice → test-results → PR`, con ritorno indietro quando serve.
Regole complete in [changes/README.md](changes/README.md).

- Prima di toccare codice: crea o individua la change in `changes/NNNN-nome/` copiando `changes/_template/`.
- Scrivi un documento alla volta e fermati per l'approvazione dell'utente prima del successivo.
  Aggiorna la riga `> Stato:` solo su conferma dell'utente (eccezione: spunte e stato `in corso` di tasks e test-results,
  che seguono il lavoro).
- Durante il codice spunta `tasks.md`; registra ogni verifica ed esito in `test-results.md`, compresi i difetti trovati.
- Se scopri che un documento a monte è sbagliato: fermati, proponi la correzione, annota il motivo nel *Registro*.
- A change completata riporta le modifiche nei documenti vivi in radice.
- Prima di consegnare: `npm run check:flow`, `npm run build` e `npm test` devono passare.

## Comandi

- `npm run dev` — server con watch + Vite su :5173
- `npm run build` / `npm start` / `npm run prod` — UI compilata servita su :3000
- `npm test` — test (`node:test`); i test su intestazioni e cache richiedono la build
- `npm run listen -- 9100 tcp ack` — ricevitore da riga di comando
- `npm run check:flow` — verifica struttura e stati delle change
- `npm run check:public` — verifica che i file siano pubblicabili (il repository è pubblico)

## Repository pubblico

- Negli esempi usa solo IP di documentazione (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`) o di loopback, mai IP reali.
- Non citare il documento da cui è stato ricavato il formato delle stringhe: il riferimento è `spec.md` § 6.
- Non scrivere token, password o dati personali in file, commit, PR o issue.
