# 0004 — Pubblicazione open source · Plan

> Stato: completato

Deriva da [spec.md](spec.md) e [tech-requirements.md](tech-requirements.md). Come nei requisiti, questo documento
**non contiene i valori precisi** da togliere: stanno solo nell'elenco locale ignorato da git (TR-3).

## Approccio

Il lavoro procede in quattro fasi. Ognuna si chiude con una verifica prima di passare alla successiva, e solo l'ultima
rende visibile qualcosa all'esterno.

### Fase A — Riscrittura della storia (in locale)

1. **Messa in sicurezza.** I documenti della 0004, non ancora committati, vengono messi da parte con `git stash -u`
   (`filter-branch` richiede una copia di lavoro pulita). Si crea il bundle completo del repository (TR-11) in
   `Documents\GitHub\simulatore-bilancia-backup-<data>.bundle`, fuori dalla cartella del progetto e da qualsiasi
   repository.
2. **Elenco e regole di sostituzione** in una cartella temporanea fuori dal repository:
   - `public-check.local.txt`: i valori precisi da cercare (TR-3), poi copiato anche in `scripts/` come file ignorato;
   - `rewrite.cjs`: le sostituzioni, ciascuna legata al file e al contesto in cui compare, per non toccare altro
     (per esempio un numero dell'esempio originale non viene sostituito dove compare in `package-lock.json`).

   Le sostituzioni rendono coerenti tra loro testo e test di ogni commit: se un test confronta una stringa attesa
   costruita con i valori dell'esempio, cambiano insieme i dati in ingresso e la stringa attesa, mantenendo le
   larghezze dei campi. Così ogni commit riscritto resta compilabile e i suoi test restano validi.
3. **Riscrittura.** `git filter-branch --tree-filter "node <tmp>/rewrite.cjs" --msg-filter … -- main` su tutti i
   commit raggiungibili da `main` (TR-6, TR-7). Il filtro dei messaggi non trova nulla oggi, ma resta per sicurezza.
   Gli altri rami locali vengono eliminati; `refs/original` viene rimosso solo dopo la verifica.
4. **Verifica (TR-10).**
   - Per ogni commit riscritto: `git grep` con l'elenco locale → nessuna occorrenza.
   - Confronto commit per commit con l'originale (`git diff <originale> <riscritto>`): differenze solo nelle righe
     sostituite; stessi autori, date, messaggi e struttura dei merge.
   - Sull'ultimo commit: `npm ci`, `npm run build`, `npm test` verdi.
   - Ricerca dei segreti e dei file vietati su tutta la storia (TR-5).
5. **Ripresa del lavoro.** Nuovo ramo `0004-pubblicazione-open-source` dalla `main` riscritta; `git stash pop` dei
   documenti della 0004; email anonima in `user.email` del repository locale (TR-4).

### Fase B — Contenuti della pubblicazione (in locale, ramo della 0004)

1. **Generalizzazione nei file attuali.** La riscrittura ha già generalizzato l'ultimo commit; restano da fare:
   - test del formato con l'esempio di fantasia completo di tara (TR-13);
   - emendamento della costituzione § 6 con la voce negli *Emendamenti* (TR-15);
   - IP reali dei test-results 0002/0003 e del test di validazione → `192.0.2.10` / `192.0.2.20`; IP di prova dei
     test → intervalli RFC 5737 (TR-2).
2. **`check:public`** (`scripts/check-public.mjs`, script `npm run check:public`, passo in CI):
   - scorre i file versionati (`git ls-files`);
   - IPv4 fuori dagli intervalli ammessi → errore;
   - frasi generiche di rimando al documento d'origine, scritte come espressioni regolari che non coincidono con sé
     stesse → errore; i documenti della 0004, che parlano di queste frasi, sono esclusi solo per questa regola;
   - se esiste `scripts/public-check.local.txt` (in `.gitignore`), cerca anche quei valori, nei file e, con
     `--history`, in tutti i commit;
   - unit test con file finti in una cartella temporanea.
3. **Sicurezza del repository nei file:** `permissions: contents: read` in `ci.yml` (TR-16), `SECURITY.md` (TR-18).
4. **Licenza e pacchetto:** `LICENSE` MIT (TR-27); `package.json` con licenza, repository, homepage, bugs, keywords,
   autore, versione `1.0.0` (TR-28).
5. **Immagini** (TR-25, TR-26), prodotte con Edge in modalità headless (`msedge --headless --screenshot`), senza
   dipendenze nuove:
   - **screenshot**: il simulatore avviato da uno script temporaneo con `createApp` su una cartella dati temporanea
     (setup di default, nessun IP reale), carico dimostrativo e alcune pesate, poi cattura della pagina a 1400 px di
     larghezza; controllo visivo che non compaiano IP reali o token;
   - **anteprima social**: una pagina HTML temporanea 1280×640 con nome, frase di presentazione e una versione
     ridotta dello screenshot, catturata nello stesso modo.

   Entrambe in `docs/images/`, con controllo di dimensioni e peso.
6. **README:**
   - `README.md` in inglese: presentazione e badge; screenshot; *Features*; *Quick start*; *Using it with PuTTY*;
     *Architecture* (livelli e schema); **How it's built** (costituzione, percorso dei sei documenti, le change come
     esempi reali, con link); *Testing & CI*; *Security*; *License*; link alla versione italiana;
   - `README.it.md`: l'attuale README italiano, con IP di esempio e link alla versione inglese.
7. **Verifiche locali:** `check:flow`, `check:public` (con l'elenco locale, anche `--history`), `build`, `test`,
   `audit`.

### Fase C — Repository su GitHub (ancora privato)

1. `gh repo rename simulatore-bilancia-privato` sul repository attuale: resta privato con PR #1/#2 e CI (TR-12).
2. `gh repo create robycremo/simulatore-bilancia --private`; push di `main` riscritta e del ramo della 0004.
3. Impostazioni disponibili sul piano gratuito per i repository privati: permessi dei workflow in sola lettura,
   avvisi e aggiornamenti di sicurezza Dependabot (TR-16, TR-17); descrizione e topic (TR-29).
4. PR della 0004 con il modello → CI verde → merge su `main` → tag `v1.0.0` e release con note in inglese (TR-30).
5. **Controllo finale prima della pubblicazione:** clone fresco del nuovo repository in una cartella temporanea,
   `check:public --history` con l'elenco locale, ricerca dei segreti, elenco di PR, tag e release; resoconto
   all'utente.

### Fase D — Pubblicazione (solo dopo la conferma dell'utente in chat)

1. `gh repo edit --visibility public --accept-visibility-change-consequences` (TR-31).
2. Entro 5 minuti (TR-22): rilevamento dei segreti con blocco al push, protezione di `main` (PR obbligatoria,
   controllo `build`, niente force push né cancellazione, anche per l'amministratore), segnalazione privata delle
   vulnerabilità (TR-19…TR-21); verifica via API che risultino attive.
3. Verifica anonima con `curl` senza credenziali: pagina, README, `LICENSE`, release → 200 (TR-32).
4. A cura dell'utente: caricamento dell'anteprima social; impostazioni dell'account sull'email privata.
5. Chiusura della change con una PR (dopo la protezione di `main` non ci sono più push diretti).

## Struttura

```text
scripts/check-public.mjs            NUOVO   controllo dei contenuti pubblicabili
scripts/public-check.local.txt      locale, ignorato da git (elenco dei valori precisi)
test/checkPublic.test.js            NUOVO
docs/images/screenshot.png          NUOVO
docs/images/social-preview.png      NUOVO
LICENSE, SECURITY.md, README.it.md  NUOVI
README.md                           riscritto in inglese
```

## File toccati

| File | Modifica |
|---|---|
| tutta la storia di `main` | riscritta (fase A) solo nei file che contengono riferimenti al documento d'origine |
| `constitution.md` | emendamento § 6 |
| `test/format.test.js`, `test/serverChannel.test.js` | esempio di fantasia |
| `test/validate.test.js`, test con IP di prova | intervalli RFC 5737 |
| `changes/0002…/test-results.md`, `changes/0003…/test-results.md` | IP reali → IP di esempio |
| `scripts/check-public.mjs`, `test/checkPublic.test.js` | nuovi |
| `package.json` | script `check:public`, metadati, versione `1.0.0` |
| `.github/workflows/ci.yml` | `permissions`, passo `check:public` |
| `.gitignore` | `scripts/public-check.local.txt` |
| `README.md`, `README.it.md`, `LICENSE`, `SECURITY.md`, `docs/images/*` | presentazione |
| `plan.md`, `spec.md`, `intent.md` in radice | storico delle change, rimandi al formato |

## Strategia di verifica

- **Riscrittura**: verifiche della fase A.4 registrate in `test-results.md` (numero di commit prima e dopo, occorrenze
  dell'elenco = 0, differenze limitate alle righe sostituite, test verdi).
- **Automatica**: `checkPublic.test.js`, tutti i test esistenti, CI sulla PR del nuovo repository con il passo
  `check:public`.
- **Prove manuali**: controllo visivo di screenshot e anteprima; resoconto del controllo finale (C.5) all'utente; verifica
  anonima dopo la pubblicazione; protezioni lette via API.

## Rischi

- **`filter-branch` su OneDrive.** La sincronizzazione può bloccare per un istante i file in `.git` durante la
  riscrittura. Mitigazione: bundle di sicurezza prima di iniziare; in caso di errore si riparte dal bundle.
- **Sostituzioni troppo larghe.** Un numero dell'esempio può comparire in altri contesti (hash, lock file).
  Mitigazione: sostituzioni legate a file e contesto, confronto commit per commit (A.4).
- **Il controllo stesso diffonde i valori.** Mitigazione: valori precisi solo nell'elenco locale ignorato; frasi
  generiche come espressioni regolari che non coincidono con sé stesse.
- **Finestra senza protezioni** tra il cambio di visibilità e l'attivazione delle protezioni: pochi minuti, con un
  repository già verificato (C.5) e senza collaboratori esterni.
- **Identificativi dei commit nei documenti.** Alcuni documenti citano hash (`c3372f4`, `d646b9c`, …) che dopo la
  riscrittura non esistono più nel nuovo repository. Si lasciano invariati nella storia e si aggiunge una nota nei
  test-results della 0004: gli hash citati nelle change 0001–0003 si riferiscono alla storia precedente, conservata
  nel repository privato rinominato.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritto dopo l'approvazione dei requisiti tecnici.
- 2026-10-02 — approvato dall'utente.
- 2026-10-03 — change chiusa su conferma dell'utente (T22): repository pubblico, protezioni attive.
