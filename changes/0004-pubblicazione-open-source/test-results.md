# 0004 — Pubblicazione open source · Test results

> Stato: in corso

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

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| Nessun riferimento al documento d'origine in tutti i commit e nei tag | fase A (sopra); tag e nuovo repository in T17 | ✅ storia · ⏳ T17 |
| Nessun IP reale nei file di `main` | T6, T13 (`check:public`) | ✅ |
| Nuovo repository senza PR o CI che rimandino a commit non riscritti | T17 | ⏳ |
| Repository rinominato `simulatore-bilancia-privato`, privato | T14 | ⏳ |
| Stessa sequenza di commit, autori, date e messaggi | fase A | ✅ |
| Commit della 0004 e successivi con email anonima | T13, T17 | ⏳ |
| `data/`, `.env`, `.claude/` mai presenti; nessun token o password | fase A | ✅ |
| Test verdi, stringhe identiche byte per byte | T6, T13: 81/81, codice del formato invariato | ✅ |
| Protezioni attive; push diretto su `main` rifiutato | T19 | ⏳ |
| README inglese/italiano, screenshot, badge | T10–T12 | ✅ (badge CI verificato dopo il push) |
| `LICENSE` MIT, `SECURITY.md`, descrizione, topic, release `v1.0.0` | T9, T15, T16 | ⏳ |
| Visibilità pubblica solo dopo la conferma; pagine raggiungibili senza autenticazione | T18, T20 | ⏳ |

## Problemi trovati

1. **Testo estraneo nella prima prova a secco** (T2): la sequenza `` $` `` nel testo sostitutivo veniva interpretata
   da `String.replace` come "testo precedente". Trovato perché il conteggio delle righe non tornava (87 aggiunte,
   35 tolte); corretto prima di toccare la storia.
2. **Blocchi di OneDrive** su file in `.git` (T1, T3): riscrittura spostata in un clone fuori da OneDrive.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-03 — esiti della fase A.
