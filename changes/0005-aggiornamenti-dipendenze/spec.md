# 0005 — Aggiornamenti automatici delle dipendenze · Spec

> Stato: completato

Deriva da [intent.md](intent.md). Descrive solo il comportamento osservabile. Il simulatore non cambia.

## Comportamento

### 1. Quando vale l'eccezione

Una pull request è **esentata dall'obbligo della change** (costituzione § 3, regola "modifiche al codice senza una
change in `changes/`") solo se valgono **tutte** queste condizioni:

| # | Condizione | Perché |
|---|---|---|
| 1 | La PR è stata **creata da Dependabot**, secondo l'autore registrato da GitHub sulla PR | non falsificabile: il nome del ramo, il messaggio o l'autore dei commit si possono scrivere a piacere, l'autore della PR no |
| 2 | Modifica **solo** `package.json` e `package-lock.json` | un aggiornamento che tocca altro non è più solo un aggiornamento |
| 3 | In `package.json` cambiano **solo i numeri di versione** di dipendenze già presenti, in `dependencies` o `devDependencies` | niente nuove dipendenze, rimozioni, script o altri campi |
| 4 | Nessuna dipendenza diretta cambia **versione maggiore** (es. `^9.x` → `^10.x`) | le versioni maggiori possono rompere la compatibilità: richiedono una change |

Se manca anche una sola condizione, si applica la regola normale e la CI si ferma al passo del percorso, con un
messaggio che dice **quale condizione non è soddisfatta**.

Le modifiche alle dipendenze fatte dall'autore, a mano o su un proprio ramo, richiedono sempre una change.

### 2. Cosa resta obbligatorio

Per una PR esentata la CI esegue comunque, e deve superare:
- il controllo della struttura delle change esistenti;
- il controllo dei contenuti pubblicabili;
- la build;
- tutti i test;
- il controllo delle vulnerabilità (`npm audit`, gravità *high* o superiore).

Il passo del percorso scrive nel log che l'eccezione è stata applicata e perché, per esempio
"PR di Dependabot: solo aggiornamenti di versione di dipendenze esistenti, nessuna versione maggiore".

### 3. Merge e traccia

- Il merge resta manuale e lo decide l'autore. La protezione di `main` non cambia: PR obbligatoria con CI verde.
- **La traccia è la PR stessa**, con la descrizione generata da Dependabot (pacchetti, versioni, note di rilascio,
  avviso di sicurezza collegato). Non si tiene un registro separato nel repository.
- Dal punto di vista del percorso, una PR esentata non è una change: non ha un numero e non compare nello storico in
  `plan.md`.

### 4. Costituzione

La costituzione § 3 riceve una nuova regola, con voce negli *Emendamenti*:

> **Aggiornamenti delle dipendenze da Dependabot.** Le PR create da Dependabot che modificano solo i numeri di versione
> di dipendenze già presenti in `package.json` e `package-lock.json`, senza cambi di versione maggiore, non richiedono
> una change: devono comunque superare tutti i controlli della CI, e il merge resta dell'autore. Ogni altra modifica
> alle dipendenze segue il percorso normale.

### 5. Risposte alle domande aperte dell'intent

1. **File esentati**: solo `package.json` e `package-lock.json`. I workflow restano fuori: cambiano il comportamento
   della CI, che è parte della sicurezza del repository (oggi Dependabot non aggiorna le GitHub Actions).
2. **Versioni maggiori**: non esentate, serve una change.
3. **Traccia**: la PR, senza registro separato.

## Criteri di accettazione

**Regola**
- [ ] PR di Dependabot con soli aggiornamenti minori o di patch delle dipendenze esistenti → passo del percorso
      superato, con il messaggio dell'eccezione nel log.
- [ ] Stessi file modificati, ma PR creata da un utente qualsiasi (anche con ramo chiamato `dependabot/...`) → rifiutata.
- [ ] PR di Dependabot che tocca anche un altro file → rifiutata, con il motivo.
- [ ] PR di Dependabot che aggiunge o toglie una dipendenza, o cambia uno script o un altro campo di `package.json`
      → rifiutata, con il motivo.
- [ ] PR di Dependabot con un cambio di versione maggiore → rifiutata, con il motivo "versione maggiore: serve una change".
- [ ] `npm run check:flow` in locale e la CI su `main` si comportano come prima.

**Correzione di sicurezza e caso reale**
- [ ] La change stessa aggiorna `concurrently` da 9.2.0 a 9.2.5, e con lui `shell-quote` da 1.9.0 a 1.12.0 (lo stesso
      aggiornamento della PR #3): `npm audit` senza vulnerabilità *high* o superiori, CI della PR della 0005 verde in
      tutti i passi.
- [ ] Dopo il merge l'avviso critico su `shell-quote` risulta chiuso, la CI su `main` è verde e la PR #3 viene chiusa
      da Dependabot perché superata.
- [ ] L'eccezione è verificata dai test automatici con un caso che riproduce la PR #3: stessi file, stesse versioni,
      autore `dependabot[bot]`.
- La conferma dal vivo arriverà con la prima PR di Dependabot successiva alla change: non è un criterio di chiusura,
  verrà segnalata all'autore quando arriva.

**Documentazione**
- [ ] Costituzione § 3 emendata; regole delle change (`changes/README.md`) aggiornate con l'eccezione.

## Impatto sui documenti vivi

- `constitution.md` § 3 ed *Emendamenti*.
- `changes/README.md`: regola 5 e descrizione di `check:flow`.
- `spec.md` § 8 (riga *CI/CD & version control*); `plan.md` (modulo `check-flow.mjs`).

## Registro

- 2026-10-20 — creata vuota, in attesa del documento precedente.
- 2026-10-20 — scritta dopo l'approvazione dell'intent. Le tre domande aperte sono chiuse con proposte da confermare
  in approvazione: solo file delle dipendenze; versioni maggiori non esentate; traccia nella PR.
- 2026-10-20 — approvata dall'utente, con le tre proposte.
- 2026-10-20 — **ritorno alla spec** durante il plan (stessa causa, conferma dell'utente): criteri del caso reale
  sostituiti da "correzione di sicurezza nella change" e da un test che riproduce la PR #3; prova dal vivo alla prima PR
  di Dependabot successiva, fuori dai criteri di chiusura.
- 2026-10-20 — change chiusa su conferma dell'utente (T11).
