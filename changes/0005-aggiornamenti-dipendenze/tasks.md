# 0005 — Aggiornamenti automatici delle dipendenze · Tasks

> Stato: in corso

Deriva da [plan.md](plan.md). Ordine di esecuzione; ogni task si chiude con la sua verifica. Tra parentesi i requisiti
tecnici coperti. Si lavora sul ramo `0005-aggiornamenti-dipendenze`.

## Regola

- [x] **T1. Funzioni pure.** `scripts/dependabot-exemption.mjs` con `majorOf`, `compareManifests`,
      `evaluateExemption`; `test/dependabotExemption.test.js` con i valori di `majorOf` (`^9.2.0`, `~1.4`, `>=2.0.0`,
      `0.3.1`, `v10.0.0`, URL git, `*`, `latest`) e i nove casi di TR-13, verificando che i motivi siano tutti elencati
      (TR-2, TR-4…TR-7, TR-10).
- [x] **T2. `check-flow`.** Nel ramo `--base`: con `PR_AUTHOR` assente comportamento invariato; con `PR_AUTHOR`
      impostata lettura di `package.json` in `<base>` e `HEAD` con `git show`, valutazione, riga dell'eccezione o elenco
      dei motivi (TR-1, TR-3, TR-8, TR-9, TR-10).
- [x] **T3. Test di `check-flow`.** `test/checkFlow.test.js` su repository git temporanei: caso che riproduce la PR #3
      (esente con `dependabot[bot]`), stesso caso senza variabile e con altro autore (rifiutato), file in più
      (rifiutato), versione maggiore (rifiutato), modifica senza codice (invariata) (TR-13, TR-14, TR-16).
- [x] **T4. Workflow.** `PR_AUTHOR: ${{ github.event.pull_request.user.login }}` nel passo del percorso di `ci.yml`;
      permessi e altri passi invariati (TR-11, TR-12).

## Correzione di sicurezza

- [x] **T5. Aggiornamento di `concurrently`.** `npm install -D concurrently@^9.2.5`; controllo che `shell-quote` sia
      ≥ 1.12.0 in `package-lock.json`, che `npm audit --audit-level=high` sia pulito e che `npm run dev` si avvii (TR-15).

## Documenti

- [x] **T6. Costituzione e regole.** Costituzione § 3 con la regola della spec § 4 e voce negli *Emendamenti*;
      `changes/README.md` (regola 5, descrizione di `check:flow`).
- [x] **T7. Documenti vivi e README.** `spec.md` § 8 (riga *CI/CD & version control*), `plan.md` (modulo
      `check-flow` e nuovo modulo), `README.md` e `README.it.md` (cenno all'eccezione nella sezione sullo sviluppo).
- [x] **T8. Verifiche locali.** `check:flow`, `check:public`, `build`, `npm test`, `npm audit --audit-level=high`.

## Rilascio

- [ ] **T9. PR della 0005.** Commit con email anonima, push del ramo, PR con il modello, CI verde in tutti i passi
      compreso `npm audit`, merge da GitHub (TR-16).
- [ ] **T10. Verifica dopo il merge.** Avviso su `shell-quote` `fixed`, CI su `main` verde, PR #3 chiusa da Dependabot
      (altrimenti chiusa con un commento che rimanda alla 0005) (TR-16).
- [ ] **T11. Chiusura.** test-results completato, documenti a `completato`, PR di chiusura.
- Dopo la chiusura, fuori dalla change: alla prima PR di Dependabot, lettura del log del passo del percorso e
  segnalazione all'utente.

## Note di implementazione

- T1: `majorOf` accetta anche versioni nella forma `X.Y` (es. `~1.4`), oltre a `X.Y.Z` (TR-6): sono intervalli npm
  validi e la versione maggiore è comunque certa. Restano non interpretabili URL, percorsi, alias `npm:`, `*`, `latest`,
  `1.x`.
- T2: `package.json` della base letto al commit comune (`git merge-base`), coerente con il `git diff <base>...HEAD` usato
  per i file modificati.
- T2: prova sul ramo reale della PR #3 con il nuovo `check-flow`: esente con `dependabot[bot]`
  (`concurrently: ^9.2.0 → ^9.2.5`), rifiutata con un altro autore e senza variabile.

## Registro

- 2026-10-20 — creata vuota, in attesa del documento precedente.
- 2026-10-20 — scritti dopo l'approvazione del plan.
- 2026-10-20 — approvati dall'utente; inizio da T1.
