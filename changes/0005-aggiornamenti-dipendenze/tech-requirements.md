# 0005 — Aggiornamenti automatici delle dipendenze · Requisiti tecnici

> Stato: approvato

Vincoli tecnici misurabili. Derivano da [spec.md](spec.md) e dalla [costituzione](../../constitution.md).

## Requisiti

### Identificazione della PR di Dependabot (spec § 1, condizione 1)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-1 | Fonte dell'autore | `github.event.pull_request.user.login` (autore della PR registrato da GitHub), passato al passo del percorso nella variabile d'ambiente `PR_AUTHOR`; nessun uso di nome del ramo, messaggi o autori dei commit |
| TR-2 | Valore ammesso | esattamente `dependabot[bot]` |
| TR-3 | Contesti senza eccezione | variabile assente o vuota (esecuzione locale, push su `main`) → nessuna eccezione, comportamento identico a oggi |

### Verifica dei file (spec § 1, condizioni 2–4)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-4 | File modificati | `git diff --name-only <base>...HEAD` (come oggi con `--base`): insieme contenuto in `{package.json, package-lock.json}` |
| TR-5 | `package.json` | confronto tra la versione in `<base>` e quella in `HEAD`, entrambe lette con `git show` e interpretate come JSON: tutti i campi di primo livello diversi da `dependencies` e `devDependencies` identici; in questi due, stesse chiavi; cambia solo il valore (la versione) |
| TR-6 | Versione maggiore | dal valore si estrae la prima versione numerica `X.Y.Z` (ignorando prefissi `^`, `~`, `>=`, `=`, `v`); la maggiore è `X`, oppure `0.Y` se `X` è 0 (per semver nella serie 0.x è la minore che rompe la compatibilità). Maggiore diversa → rifiuto |
| TR-7 | Valori non interpretabili | versione senza `X.Y.Z` riconoscibile (URL git, `*`, `latest`, percorsi locali) → rifiuto prudente |
| TR-8 | `package-lock.json` | nessun controllo di contenuto (è generato): la coerenza con `package.json` è già verificata da `npm ci` nella CI |

### Messaggi e CI

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-9 | Eccezione applicata | una riga nel log del passo del percorso con autore, file e dipendenze aggiornate (`nome: vecchia → nuova`) |
| TR-10 | Eccezione negata | per una PR di Dependabot: elenco di **tutte** le condizioni non soddisfatte, ciascuna con il dettaglio (file in più, campo cambiato, dipendenza aggiunta o tolta, versione maggiore) |
| TR-11 | Workflow | `ci.yml` passa `PR_AUTHOR` solo al passo del percorso; permessi della CI invariati (`contents: read`); nessun nuovo segreto |
| TR-12 | Altri passi | `check:public`, build, test e `npm audit --audit-level=high` invariati e obbligatori anche per le PR esentate |

### Test

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-13 | Test automatici | in `test/checkFlow.test.js`, con repository git temporanei: aggiornamento minore valido; autore diverso con stessi file; file in più; dipendenza aggiunta; dipendenza tolta; script cambiato; versione maggiore (anche `0.3` → `0.4`); valore non interpretabile; variabile assente |
| TR-14 | Regressione | tutti i test esistenti verdi; `npm run check:flow` in locale invariato sulle 5 change |

### Correzione di sicurezza (stesso aggiornamento della PR #3)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-15 | Aggiornamento | `concurrently` in `devDependencies` da `^9.2.0` a `^9.2.5` (`npm install -D concurrently@^9.2.5`); `shell-quote` risolto a ≥ 1.12.0 in `package-lock.json`; `npm audit --audit-level=high` senza vulnerabilità; `npm run dev` si avvia |
| TR-16 | Esito | CI della PR della 0005 verde in tutti i passi; dopo il merge l'avviso su `shell-quote` risulta `fixed`, la CI su `main` è verde e la PR #3 è chiusa; in `checkFlow.test.js` un caso riproduce la PR #3 (stessi file e versioni, autore `dependabot[bot]`) e risulta esente |

## Dipendenze

Nessuna nuova dipendenza: niente libreria `semver`, l'estrazione della versione maggiore è una funzione interna con i
suoi test.

## Compatibilità

- Windows e Linux, come oggi.
- Le PR create dall'autore o da altri contributori seguono la regola di oggi, senza differenze.

## Rischio residuo

Una PR può modificare `ci.yml` e quindi il modo in cui la CI calcola `PR_AUTHOR`. Una PR del genere però tocca un file
diverso da `package.json` e `package-lock.json`, e la condizione 2 la esclude dall'eccezione. In generale, che una PR
non alteri la CI lo garantisce la revisione dell'autore prima del merge, che resta obbligatoria: questa change non
introduce merge automatici.

## Controlli della costituzione

- [x] Principi di architettura: nessuna modifica al simulatore; la logica sta in `scripts/check-flow.mjs`.
- [x] Sicurezza e conformità: identificazione basata sull'autore registrato da GitHub, permessi della CI invariati,
      audit sempre obbligatorio, merge manuale.
- [x] Pratiche di ingegneria: eccezione scritta nella costituzione, stretta e verificata in automatico.
- [x] Vincoli tecnologici: nessuna nuova dipendenza.

## Registro

- 2026-10-20 — creata vuota, in attesa del documento precedente.
- 2026-10-20 — scritti dopo l'approvazione della spec.
- 2026-10-20 — approvati dall'utente.
- 2026-10-20 — TR-15 e TR-16 riscritti dopo il ritorno a intent e spec: la correzione di sicurezza entra nella change
  (le due PR si sarebbero bloccate a vicenda per l'audit già fallito su `main`).
