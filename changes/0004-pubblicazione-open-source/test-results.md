# 0004 — Pubblicazione open source · Test results

> Stato: completato

Verifica dei criteri di [spec.md](spec.md) e dei requisiti di [tech-requirements.md](tech-requirements.md).
Legenda: ✅ superato · ❌ fallito · ⏳ da eseguire. Nessun valore preciso da togliere compare in questo file.

## Fase A — Riscrittura della storia

| Verifica | Esito |
|---|---|
| Bundle completo creato e verificato (`git bundle verify`: "complete history") | ✅ |
| Prova a secco sull'ultimo commit: 13 file, 35 righe tolte / 35 aggiunte, nessuna occorrenza dell'elenco, `npm ci` + `build` + `test` 75/75 | ✅ |
| Riscrittura con `git filter-branch` di 8 commit su 8 (clone fuori da OneDrive) | ✅ |
| Per ogni commit: autore, email, data, committer, messaggio e numero di genitori identici all'originale | ✅ 8/8 |
| Per ogni commit: nessuna occorrenza dell'elenco locale (escluso `package-lock.json`) | ✅ 8/8 |
| Differenze originale → riscritto solo nei 13 file previsti, riga per riga (274 righe in totale sugli 8 commit) | ✅ |
| Nessun segreto (`gho_`, `ghp_`, `github_pat_`, `AKIA…`, `-----BEGIN`) e nessun file `data/`, `.env*`, `.claude/` in tutta la storia | ✅ |
| Albero dell'ultimo commit riscritto identico a quello della prova a secco (`e9f134d`), quindi stessi 75 test verdi | ✅ |
| `main` locale sulla storia riscritta, ramo della 0004 ricreato, documenti ripristinati, `user.email` anonima | ✅ |

## Fase B — Contenuti della pubblicazione

| Verifica | Esito |
|---|---|
| IP reali sostituiti con `192.0.2.10` / `192.0.2.20`; IP di prova dei test negli intervalli RFC 5737 | ✅ |
| Esempio di fantasia con tara nei test del formato e del canale server; stessi campi, posizioni e lunghezze | ✅ |
| `check:public`: 6 test propri; sul progetto 87 file ok; con `--history` 8 commit + quelli nuovi ok | ✅ |
| Il controllo non contiene valori precisi (frasi generiche costruite a pezzi, IP di prova costruiti a runtime) | ✅ revisione |
| CI con `permissions: contents: read` e passo `check:public`; `SECURITY.md` | ✅ |
| `LICENSE` MIT; `package.json` 1.0.0 con licenza, repository, homepage, bugs, keywords, autore | ✅ |
| Screenshot 1400×770, 81 KB, dalla UI reale con dati dimostrativi; nessun IP reale né token visibile | ✅ controllo visivo |
| Anteprima social 1280×640, 278 KB | ✅ controllo visivo |
| `README.md` in inglese e `README.it.md`, link reciproci, badge, screenshot, metodo SDD | ✅ revisione |
| `check:flow`, `build`, `npm test` 81/81, `npm audit` 0 vulnerabilità | ✅ |

## Fase C — Repository su GitHub (privato)

| Verifica | Esito |
|---|---|
| Repository attuale rinominato `simulatore-bilancia-privato`: privato, PR #1 e #2 e 11 esecuzioni della CI conservate | ✅ |
| Nuovo `simulatore-bilancia` privato con la storia riscritta; permessi dei workflow in sola lettura; Dependabot (avvisi e aggiornamenti di sicurezza) attivo; descrizione (212 caratteri) e 9 topic | ✅ |
| PR #1 della 0004: CI verde in tutti i passi, compreso `check:public` (esecuzione 37101438175) | ✅ |
| Merge `418d5a1` con email anonima; CI su `main` verde; tag `v1.0.0` e release | ✅ |
| Clone fresco: 10 commit, solo `main`, tag `v1.0.0`; `check:public --history` con l'elenco completo → nessuna occorrenza | ✅ |
| Nessun segreto né file vietato nella storia (le sole righe trovate sono i documenti della 0004 che elencano i prefissi da cercare) | ✅ |
| Autori: 8 vecchi commit con l'email personale (scelta dell'utente), 2 nuovi con l'email anonima | ✅ come previsto |
| Testo di PR, release e descrizione: nessun IP non ammesso, nessuna occorrenza dell'elenco locale | ✅ |

## Fase D — Pubblicazione

| Verifica | Esito |
|---|---|
| Conferma esplicita dell'utente in chat ("pubblica") prima del cambio di visibilità | ✅ |
| Visibilità pubblica alle 06:05:46 UTC del 2026-10-03 | ✅ |
| Rilevamento dei segreti e blocco al push attivi; segnalazione privata delle vulnerabilità attiva | ✅ lettura via API |
| Protezione di `main`: PR obbligatoria, controllo `build` obbligatorio e aggiornato, amministratore incluso, force push e cancellazione vietati | ✅ lettura via API |
| Protezioni attive alle 06:06:05 UTC: 19 s dopo la pubblicazione (limite 5 minuti) | ✅ |
| Senza autenticazione: pagina del repository, release, README, `LICENSE`, screenshot e badge CI → 200 | ✅ |
| API pubblica: licenza riconosciuta `MIT`, 9 topic, descrizione presente | ✅ |
| Repository di riserva `simulatore-bilancia-privato` non visibile senza autenticazione (404) | ✅ |

| A cura dell'utente: anteprima social caricata | ✅ verificato via API (`usesCustomOpenGraphImage: true`) |
| A cura dell'utente: email privata e blocco dei push che espongono l'email, nelle impostazioni dell'account | ✅ dichiarato dall'utente (non leggibile con i permessi del token) |

**Identificativi dei commit nelle change 0001–0003.** Gli hash citati in quei documenti (per esempio i commit di
chiusura e le esecuzioni della CI) si riferiscono alla storia precedente la riscrittura, conservata nel repository
privato `simulatore-bilancia-privato`; nel repository pubblico gli stessi commit hanno identificativi nuovi.

**Prova reale della protezione di `main`** (T22): il push diretto del commit di chiusura è stato rifiutato da
GitHub con "GH006: Protected branch update failed … Changes must be made through a pull request … Required status
check "build" is expected"; il commit è stato quindi portato su un ramo e integrato con una PR.

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| Nessun riferimento al documento d'origine in tutti i commit e nei tag | fase A e T17 (clone fresco) | ✅ |
| Nessun IP reale nei file di `main` | T6, T13 (`check:public`) | ✅ |
| Nuovo repository senza PR o CI che rimandino a commit non riscritti | T17: unica PR #1 della 0004, CI solo sui commit nuovi | ✅ |
| Repository rinominato `simulatore-bilancia-privato`, privato | T14 | ✅ |
| Stessa sequenza di commit, autori, date e messaggi | fase A | ✅ |
| Commit della 0004 e successivi con email anonima | T17 (`5110cb7`, `418d5a1`) | ✅ |
| `data/`, `.env`, `.claude/` mai presenti; nessun token o password | fase A | ✅ |
| Test verdi, stringhe identiche byte per byte | T6, T13: 81/81, codice del formato invariato | ✅ |
| Protezioni attive; push diretto su `main` rifiutato | T19 (lettura via API; vedi fase D) | ✅ |
| README inglese/italiano, screenshot, badge | T10–T12 | ✅ (badge CI verificato dopo il push) |
| `LICENSE` MIT, `SECURITY.md`, descrizione, topic, release `v1.0.0` | T9, T15, T16, T20 (licenza riconosciuta MIT) | ✅ |
| Visibilità pubblica solo dopo la conferma; pagine raggiungibili senza autenticazione | T18, T20 | ✅ |

## Problemi trovati

1. **Testo estraneo nella prima prova a secco** (T2): la sequenza `` $` `` nel testo sostitutivo veniva interpretata
   da `String.replace` come "testo precedente". Trovato perché il conteggio delle righe non tornava (87 aggiunte,
   35 tolte); corretto prima di toccare la storia.
2. **Blocchi di OneDrive** su file in `.git` (T1, T3): riscrittura spostata in un clone fuori da OneDrive.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-03 — esiti della fase A.
- 2026-10-03 — change chiusa su conferma dell'utente (T22): repository pubblico, protezioni attive.
