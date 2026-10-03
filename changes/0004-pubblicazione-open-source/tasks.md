# 0004 — Pubblicazione open source · Tasks

> Stato: completato

Deriva da [plan.md](plan.md). Ordine di esecuzione; ogni task si chiude con la sua verifica. Tra parentesi i requisiti
tecnici coperti. Nessun valore preciso da togliere compare in questo file (regola dei requisiti tecnici).

## Fase A — Riscrittura della storia (in locale)

- [x] **T1. Messa in sicurezza.** `git stash -u` dei documenti della 0004; bundle completo
      `Documents\GitHub\simulatore-bilancia-backup-<data>.bundle`, verificato con `git bundle verify` (TR-11).
- [x] **T2. Elenco locale e regole.** In una cartella temporanea fuori dal repository: `public-check.local.txt`
      (TR-3) e `rewrite.cjs` con sostituzioni legate a file e contesto, dati dei test e stringhe attese coerenti.
      Prova a secco sull'ultimo commit in una copia: test verdi, nessuna occorrenza dell'elenco.
- [x] **T3. Riscrittura.** `git filter-branch` su `main` con filtro dei file e dei messaggi; eliminazione degli altri
      rami locali (TR-6, TR-7, TR-8).
- [x] **T4. Verifica.** Per ogni commit: nessuna occorrenza dell'elenco; differenze con l'originale solo nelle righe
      sostituite; stessi autori, date, messaggi e merge. Ultimo commit: `npm ci`, `build`, `test` verdi. Ricerca di
      segreti e file vietati su tutta la storia. Poi rimozione di `refs/original` (TR-5, TR-9, TR-10).
- [x] **T5. Ripresa.** Ramo `0004-pubblicazione-open-source` dalla `main` riscritta, `git stash pop`, email anonima
      in `user.email` del repository locale (TR-4).

## Fase B — Contenuti della pubblicazione (in locale)

- [x] **T6. Generalizzazione finale.** Esempio di fantasia con tara nei test del formato e del canale server;
      emendamento della costituzione § 6; IP reali nei test-results 0002/0003 e nel test di validazione → `192.0.2.10`
      / `192.0.2.20`; IP di prova dei test → intervalli RFC 5737. Test verdi, stringhe invariate (TR-2, TR-13…TR-15).
- [x] **T7. `check:public`.** `scripts/check-public.mjs` (IP, frasi generiche, elenco locale, opzione `--history`),
      `test/checkPublic.test.js`, script npm, passo in CI, `.gitignore` per l'elenco locale (TR-1…TR-3).
- [x] **T8. Sicurezza nei file.** `permissions: contents: read` in `ci.yml`; `SECURITY.md` (TR-16, TR-18).
- [x] **T9. Licenza e pacchetto.** `LICENSE` MIT; `package.json` con licenza, repository, homepage, bugs, keywords,
      autore e versione `1.0.0` (TR-27, TR-28).
- [x] **T10. Screenshot.** Istanza dimostrativa da script temporaneo (`createApp` su cartella dati temporanea),
      pesate di esempio, cattura con Edge headless; controllo visivo, dimensioni e peso (TR-25).
- [x] **T11. Anteprima social.** Pagina HTML temporanea 1280×640, cattura con Edge headless; controllo di dimensioni
      e peso (TR-26).
- [x] **T12. README.** `README.md` in inglese (presentazione, badge, screenshot, funzionalità, avvio rapido, PuTTY,
      architettura, metodo SDD, test e CI, sicurezza, licenza) e `README.it.md`, con link reciproci (TR-23, TR-24).
- [x] **T13. Verifiche locali.** `check:flow`, `check:public` e `check:public --history` con l'elenco locale, `build`,
      `test`, `audit`; documenti vivi in radice aggiornati.

## Fase C — Repository su GitHub (ancora privato)

- [x] **T14. Rinomina.** `gh repo rename simulatore-bilancia-privato`; verifica che sia privato e conservi PR e CI
      (TR-12).
- [x] **T15. Nuovo repository.** `gh repo create robycremo/simulatore-bilancia --private`; push di `main` e del ramo
      della 0004; permessi dei workflow in sola lettura; Dependabot; descrizione e topic (TR-12, TR-16, TR-17, TR-29).
- [x] **T16. PR e release.** PR della 0004 con il modello → CI verde → merge → tag `v1.0.0` e release con note in
      inglese (TR-30).
- [x] **T17. Controllo finale.** Clone fresco in una cartella temporanea: `check:public --history` con l'elenco
      locale, ricerca dei segreti, elenco di PR, tag e release; **resoconto all'utente e richiesta di conferma**.

## Fase D — Pubblicazione (solo dopo la conferma dell'utente)

- [x] **T18. Visibilità pubblica** (TR-31).
- [x] **T19. Protezioni entro 5 minuti.** Rilevamento dei segreti con blocco al push, protezione di `main`,
      segnalazione privata delle vulnerabilità; lettura via API per conferma (TR-19…TR-22).
- [x] **T20. Verifica anonima.** `curl` senza credenziali su pagina, README, `LICENSE`, release → 200 (TR-32).
- [x] **T21. A cura dell'utente.** Caricamento dell'anteprima social; impostazioni dell'account sull'email privata.
- [x] **T22. Chiusura.** test-results completato (con la nota sugli hash delle change 0001–0003), documenti a
      `completato`, PR di chiusura.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritti dopo l'approvazione del plan.
- 2026-10-02 — approvati dall'utente; inizio dalla fase A.

## Note di implementazione

- T1: bundle in `Documents\simulatore-bilancia-backup-20261002.bundle` invece che in `Documents\GitHub\`, perché
  `Documents\GitHub` è a sua volta un repository git (il plan chiede "fuori da qualsiasi repository"). Copia ulteriore
  dei documenti della 0004 in `Documents\simulatore-bilancia-0004-stash.patch`.
- T2: la prima prova a secco ha incollato testo estraneo in `intent.md`: nel testo sostitutivo la sequenza `` $` `` veniva
  interpretata da `String.replace`. Corretto usando una funzione come sostituto; seconda prova: 35 righe tolte e 35
  aggiunte, nessuna occorrenza, 75 test verdi.
- T3: riscrittura eseguita in un **clone fuori da OneDrive** (cartella temporanea) invece che nella cartella del
  progetto, dopo due blocchi di OneDrive su file in `.git` durante stash e rimozione della copia temporanea. Il
  risultato è stato poi portato nella cartella del progetto con `fetch` + `reset --hard` (T5).
- T4: test dell'ultimo commit verificati per uguaglianza dell'albero con la prova a secco (stesso hash `e9f134d`),
  invece di reinstallare le dipendenze.
- T7: le frasi generiche sul documento d'origine sono state tolte anche dai documenti della 0004 (riformulati con
  "documento d'origine"), perché una volta committati sarebbero finiti nella storia; l'elenco locale le copre comunque.
  Gli IP privati del test di `check:public` sono costruiti a runtime, così il file non contiene indirizzi non ammessi.
- T10/T11: `msedge --screenshot` cattura prima che la UI si colleghi al WebSocket; usato il protocollo DevTools di Edge
  con `fetch`/`WebSocket` di Node (script temporaneo fuori dal repository), attesa del display prima della cattura.
- T16: merge fatto in locale (`git merge --no-ff`) con l'email anonima e poi pubblicato su `main`, invece che da GitHub:
  un merge da GitHub avrebbe usato l'email principale dell'account. GitHub ha segnato la PR come merged.
- 2026-10-03 — change chiusa su conferma dell'utente (T22): repository pubblico, protezioni attive.
