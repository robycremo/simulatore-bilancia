# 0005 — Aggiornamenti automatici delle dipendenze · Plan

> Stato: completato

Deriva da [spec.md](spec.md) e [tech-requirements.md](tech-requirements.md).
Verificato prima di scrivere: sulla PR #3 GitHub registra `user.login = dependabot[bot]` (`type = Bot`), con il ramo
nello stesso repository.

## Approccio

1. **Logica dell'eccezione in un modulo a parte, senza effetti collaterali.**
   `scripts/dependabot-exemption.mjs` esporta funzioni pure, cioè senza accesso a git, file o rete:
   - `majorOf(range)`: maggiore secondo TR-6/TR-7 (`X`, oppure `0.Y`; `null` se non interpretabile);
   - `compareManifests(base, head)`: confronta i due `package.json` già letti; restituisce gli aggiornamenti
     (`nome: vecchia → nuova`) e i motivi di rifiuto (campo cambiato, dipendenza aggiunta o tolta, versione maggiore,
     valore non interpretabile);
   - `evaluateExemption({ author, changedFiles, base, head })`: applica le quattro condizioni della spec e
     restituisce `{ exempt, reasons, updates }`, con **tutti** i motivi, non solo il primo.

   Funzioni pure = test rapidi e completi su ogni caso, senza repository di prova.
2. **`check-flow.mjs` usa il modulo solo dove serve.** Nel ramo `--base`, quando il codice è modificato senza una
   change:
   - se `PR_AUTHOR` è assente o vuota → errore di oggi, invariato (TR-3);
   - altrimenti legge `package.json` in `<base>` e in `HEAD` con `git show` e chiama `evaluateExemption`:
     - esente → stampa la riga dell'eccezione (TR-9) e non segnala errore;
     - non esente → l'errore di oggi, seguito dall'elenco dei motivi (TR-10).

   Il resto di `check-flow` (struttura delle change, stati, documenti vivi) non cambia e vale anche per le PR esentate.
3. **Workflow.** Nel passo "Percorso SDD" di `ci.yml`, `env: PR_AUTHOR: ${{ github.event.pull_request.user.login }}`.
   Sui push l'espressione è vuota, quindi nessuna eccezione. Permessi e altri passi invariati (TR-11, TR-12).
4. **Costituzione e regole.** § 3 con la regola della spec § 4 e voce negli *Emendamenti*; `changes/README.md`
   (regola 5 e descrizione di `check:flow`) con l'eccezione e un rimando alla costituzione.
5. **Correzione di sicurezza nella change.** Oggi `npm audit` su `main` fallisce per `shell-quote`: anche la CI della
   0005 fallirebbe e la PR #3 non può passare `check:flow` finché la 0005 non è in `main`, quindi le due PR si
   bloccherebbero a vicenda. La 0005 fa quindi lo stesso aggiornamento della PR #3: `concurrently` a `^9.2.5` con
   `npm install -D concurrently@^9.2.5`, che porta `shell-quote` a 1.12.0. È una modifica normale, coperta da questa
   change. Verifica: `npm audit` senza vulnerabilità *high* o superiori, `npm run dev` che si avvia.
6. **Rilascio.** In quest'ordine:
   1. PR della 0005 → CI verde, compreso `npm audit` → merge da GitHub. Dalla 0004 `main` accetta solo PR, e il merge
      commit usa l'email anonima dell'account.
   2. Verifica: avviso su `shell-quote` `fixed`, CI su `main` verde, PR #3 chiusa da Dependabot perché superata. Se non
      si chiude da sola entro qualche minuto, la chiudo con un commento che rimanda alla 0005.
   3. Chiusura della change con una PR.
   4. Alla prima PR di Dependabot successiva, lettura del log del passo del percorso, che deve mostrare la riga
      dell'eccezione, e segnalazione all'utente. Fuori dalla change.

## Struttura

```text
scripts/dependabot-exemption.mjs   NUOVO   majorOf, compareManifests, evaluateExemption (funzioni pure)
scripts/check-flow.mjs                     ramo --base: eccezione quando PR_AUTHOR è impostata
test/dependabotExemption.test.js   NUOVO   casi delle funzioni pure
test/checkFlow.test.js             NUOVO   check-flow su repository git temporanei, con e senza PR_AUTHOR
.github/workflows/ci.yml                   PR_AUTHOR nel passo del percorso
```

## File toccati

| File | Modifica |
|---|---|
| `scripts/dependabot-exemption.mjs` | nuovo |
| `scripts/check-flow.mjs` | uso del modulo nel ramo `--base`, messaggi |
| `test/dependabotExemption.test.js`, `test/checkFlow.test.js` | nuovi |
| `.github/workflows/ci.yml` | variabile `PR_AUTHOR` |
| `constitution.md` | § 3 ed *Emendamenti* |
| `changes/README.md` | regola 5, descrizione di `check:flow` |
| `spec.md`, `plan.md`, `README.md`, `README.it.md` in radice | riga CI dello stack, modulo, sezione sullo sviluppo (eccezione citata) |

## Strategia di verifica

- **`dependabotExemption.test.js`** (funzioni pure): `majorOf` su `^9.2.0`, `~1.4`, `>=2.0.0`, `0.3.1`, `v10.0.0`,
  URL git, `*`, `latest`; `evaluateExemption` sui nove casi di TR-13, con controllo che i motivi siano **tutti**
  elencati.
- **`checkFlow.test.js`** (repository git temporanei con una copia degli script e una change minima): la stessa PR
  di aggiornamento passa con `PR_AUTHOR=dependabot[bot]`, fallisce senza variabile e con un autore diverso; il log
  contiene la riga dell'eccezione o i motivi.
- **Regressione**: tutta la suite, `check:flow` sulle 5 change, `check:public`, `build`, `audit`.
- **Caso reale riprodotto nei test**: un caso di `checkFlow.test.js` usa esattamente i file e le versioni della PR #3,
  con autore `dependabot[bot]`.
- **Correzione di sicurezza**: `npm audit` locale e in CI, avviso chiuso e PR #3 chiusa dopo il merge.

## Rischi

- **Prima prova dal vivo rimandata**: l'eccezione funzionerà su una vera PR di Dependabot solo dopo la change.
  Mitigazione: test che riproducono la PR #3; verifica del log alla prima PR successiva.
- **Versioni nel lock non verificate** (TR-8): una versione maggiore transitiva può arrivare con un aggiornamento
  minore di una dipendenza diretta. È accettato: la copertura la danno test e build obbligatori.

## Registro

- 2026-10-20 — creata vuota, in attesa del documento precedente.
- 2026-10-20 — scritto dopo l'approvazione dei requisiti tecnici.
- 2026-10-20 — aggiornato su conferma dell'utente: correzione di sicurezza nella change (passo 5), nuovo ordine di
  rilascio (passo 6), verifica e rischi allineati.
- 2026-10-20 — approvato dall'utente.
- 2026-10-20 — change chiusa su conferma dell'utente (T11).
