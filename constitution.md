# Costituzione — Simulatore bilancia

> Regole che governano l'intero processo: valgono per ogni change, per ogni documento e per ogni riga di codice.
> Un documento o un codice che le viola va corretto, oppure prima si emenda la costituzione (vedi *Emendamenti*).

## 1. Principi di architettura

- **Motore unica fonte di verità.** Tutta la logica di pesatura sta in `server/domain/`. La UI è una vista: mostra lo
  stato e invia comandi, non decide nulla.
- **Livelli dello stack separati.** Ogni livello ha la sua cartella (`config`, `api`, `domain`, `transport`, `storage`,
  `observability`). Il dominio non conosce rete, accesso o limiti; riceve comandi già validati.
- **Testabile da codice.** Il server si avvia con `createApp()` su porte e cartelle scelte dal chiamante, così ogni
  comportamento si verifica su un'istanza reale.
- **Dipendenze verso l'interno.** `api` → `domain` → `transport`/`storage`; mai il contrario.

## 2. Sicurezza e conformità

- **Locale per default.** Il server ascolta solo su loopback. L'esposizione in rete richiede un token per la UI e
  le API; per le porte TCP server dei canali, che non possono presentare un token, un elenco esplicito di IP ammessi.
- **Ogni input è validato** al confine (`server/api/validate.js`) prima di raggiungere il dominio.
- **Nessun segreto nel repository**: token e configurazioni locali stanno in variabili d'ambiente o file ignorati da git.
- **Log senza segreti**: i token non vengono mai scritti nei log. I dati di pesata non sono dati personali; se una
  change introducesse dati personali, prima va aggiornata questa sezione.
- **Dipendenze**: nessuna vulnerabilità di gravità *high* o superiore (`npm audit` in CI).
- Il simulatore invia stringhe **solo** agli indirizzi configurati dall'utente nel setup o, in modalità TCP server,
  ai client ammessi che si collegano.

## 3. Pratiche di ingegneria

- **Percorso obbligatorio** per ogni modifica (dettagli in [changes/README.md](changes/README.md)):
  `intent → spec → tech-requirements → plan → tasks → codice → test-results → PR`.
- **Un documento alla volta**, con approvazione esplicita dell'utente prima del successivo.
- **Si torna indietro**: se un passo a valle contraddice uno a monte, ci si ferma, si corregge il documento a monte e
  si annota il motivo nel *Registro*. Il codice non diverge mai dai documenti.
- **Commit e PR** citano la change (`[0003] ...`); una PR corrisponde a una change.
- Documenti, interfaccia e messaggi in **italiano**; nomi nel codice in inglese.

## 4. Standard di qualità

- Ogni criterio di accettazione ha un **test automatico** o una **prova manuale descritta**, con esito registrato in
  `test-results.md`.
- **CI verde** prima del merge: `check:flow`, build, test, audit.
- **Nessuna regressione**: i criteri delle change completate restano verificati (`test/app.test.js`).
- Il **formato delle stringhe** trasmesse è coperto da test campo per campo.

## 5. Vincoli tecnologici

- Node.js ≥ 22, React + Vite, Express, `ws`. Test con `node:test`.
- **Nuove dipendenze di runtime** solo se motivate in `tech-requirements.md` della change.
- Persistenza su file JSON in `data/`; un database solo con una change che ne dimostri la necessità.
- Piattaforma principale **Windows** (uso), **Linux** (CI).

## 6. Guardrail di business

- **Fedeltà al terminale reale**: in caso di dubbio vince il formato definito nella spec. Il formato delle stringhe
  (`spec.md` § 6) non cambia senza una change dedicata.
- È uno **strumento di collaudo**: non sostituisce la bilancia metrologica e non va usato per pesate fiscali.
- Avvio con un solo comando, senza servizi esterni.

## Emendamenti

- 2026-10-02 — prima stesura: raccoglie le regole prima sparse tra `CLAUDE.md`, `intent.md` e `changes/README.md`
  e introduce nel percorso tech-requirements, tasks e test-results.
- 2026-10-02 — § 2: accesso dalla rete alle porte TCP server dei canali con elenco esplicito di IP ammessi, al posto
  del token che una connessione TCP grezza non può presentare; invio delle stringhe anche ai client ammessi
  collegati in modalità TCP server (change 0003, spec approvata).
- 2026-10-03 — § 6: la fedeltà è al formato definito nella spec (`spec.md` § 6), unico riferimento per il tracciato
  delle stringhe; il testo è stato allineato anche nella storia del repository (change 0004).
