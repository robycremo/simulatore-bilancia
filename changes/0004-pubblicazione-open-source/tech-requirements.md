# 0004 — Pubblicazione open source · Requisiti tecnici

> Stato: completato

Vincoli tecnici misurabili. Derivano da [spec.md](spec.md) e dalla [costituzione](../../constitution.md).

**Regola per questa change:** i valori precisi da togliere (titolo del documento d'origine, numeri di paragrafo,
prefisso e valori dell'esempio originale, IP reali) **non si scrivono in nessun file versionato**, compresi questi
documenti e gli script: altrimenti verrebbero ripubblicati.

## Requisiti

### Riservatezza (spec § 1)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-1 | Controllo versionato `npm run check:public`, eseguito anche in CI | fallisce se un file versionato contiene un IPv4 fuori dagli intervalli ammessi (TR-2) o una frase generica di rimando al documento d'origine, espressa come espressione regolare che non coincide con sé stessa |
| TR-2 | IPv4 ammessi nei file | loopback `127.0.0.0/8`, `0.0.0.0`, `255.255.255.255` e i soli intervalli per la documentazione RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`). Gli IP di prova dei test passano a questi intervalli; i test che servono l'IP di rete reale lo leggono a runtime |
| TR-3 | Elenco locale dei valori precisi | file `scripts/public-check.local.txt`, **ignorato da git**, un'espressione per riga; `check:public` lo usa se presente. Serve ai controlli prima della pubblicazione sul PC dell'autore; in CI non c'è |
| TR-4 | Email dei commit futuri | `user.email` del repository locale = `7611176+robycremo@users.noreply.github.com` |
| TR-5 | Segreti nella storia | nessuna occorrenza di `gho_`, `ghp_`, `github_pat_`, `AKIA`, `-----BEGIN` e nessun file `data/`, `.env*`, `.claude/` in alcun commit |

### Riscrittura della storia (spec § 1)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-6 | Strumento | `git filter-branch` (incluso in Git) con un filtro sui file e uno sui messaggi; lo script di sostituzione e l'elenco dei valori stanno fuori dal repository (cartella temporanea) |
| TR-7 | Ambito | tutti i commit raggiungibili da `main`; gli altri rami locali vengono eliminati prima della pubblicazione; nessun tag preesistente |
| TR-8 | Cosa cambia | solo le sostituzioni della spec § 1 per il documento d'origine; IP reali ed email restano nei vecchi commit |
| TR-9 | Cosa non cambia | numero e ordine dei commit, autori, date, messaggi (salvo i riferimenti, oggi assenti nei messaggi), struttura dei merge |
| TR-10 | Verifica | per ogni commit riscritto: `git grep` con l'elenco locale → nessuna occorrenza; confronto file per file con l'originale → differenze solo nelle righe sostituite; sull'ultimo commit `npm test` verde |
| TR-11 | Copia di sicurezza | prima della riscrittura: bundle Git completo (`git bundle create --all`) in una cartella fuori dal repository |
| TR-12 | Repository su GitHub | `gh repo rename simulatore-bilancia-privato` (resta privato); `gh repo create robycremo/simulatore-bilancia --private`; push della storia riscritta; nessun force push sul repository rinominato |

### Generalizzazione (spec § 2)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-13 | Esempio di fantasia | test del formato con data `15/06/2026`, ora `10:30:00`, progressivo `42`, lordo `250,0 kg`, tara `12,5 kg`, netto `237,5 kg`; stesse verifiche di campi, posizioni e lunghezza (104/106) |
| TR-14 | Formato invariato | stringhe identiche byte per byte a prima per gli stessi dati (tutti i test di `format.test` e `app.test` verdi) |
| TR-15 | Costituzione | § 6 emendato; voce negli *Emendamenti* |

### Protezioni (spec § 3 e § 5)

| ID | Requisito | Fase | Comando / impostazione |
|---|---|---|---|
| TR-16 | Permessi della CI | prima | `permissions: contents: read` in `ci.yml`; permessi predefiniti dei workflow del repository in sola lettura |
| TR-17 | Dependabot | prima | avvisi di vulnerabilità e aggiornamenti di sicurezza automatici attivi |
| TR-18 | `SECURITY.md` | prima | versioni supportate, segnalazione privata tramite *Security → Report a vulnerability*, tempi di risposta indicativi |
| TR-19 | Rilevamento dei segreti | subito dopo | `secret_scanning` e `secret_scanning_push_protection` attivi |
| TR-20 | Protezione di `main` | subito dopo | PR obbligatoria, controllo `build` obbligatorio e aggiornato, force push e cancellazione vietati, regole valide anche per l'amministratore |
| TR-21 | Segnalazione privata delle vulnerabilità | subito dopo | attiva |
| TR-22 | Finestra senza protezioni | — | le protezioni "subito dopo" attivate entro 5 minuti dal cambio di visibilità, nella stessa sessione |

### Presentazione (spec § 4)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-23 | README | `README.md` in inglese, `README.it.md` in italiano, link reciproco nelle prime righe |
| TR-24 | Badge | CI (`actions/workflows/ci.yml/badge.svg`), licenza MIT, Node.js ≥ 22: raggiungibili e coerenti con il repository |
| TR-25 | Screenshot | `docs/images/screenshot.png`, PNG ≤ 500 KB, larghezza ≥ 1200 px, dalla UI reale con dati dimostrativi; nessun IP reale né token visibile |
| TR-26 | Anteprima social | `docs/images/social-preview.png`, 1280×640, ≤ 1 MB. Il caricamento in *Settings → Social preview* è a cura dell'utente (non disponibile via API) |
| TR-27 | Licenza | `LICENSE` testo MIT standard, "Copyright (c) 2026 robycremo", riconosciuta da GitHub come `MIT` |
| TR-28 | `package.json` | `license: "MIT"`, `repository`, `homepage`, `bugs`, `keywords`, `author: "robycremo"`, `version: "1.0.0"` |
| TR-29 | Metadati del repository | descrizione in inglese (≤ 350 caratteri); 6–10 topic in minuscolo |
| TR-30 | Release | tag `v1.0.0` sul commit di `main` che chiude la 0004; note in inglese |

### Pubblicazione (spec § 5)

| ID | Requisito | Misura / soglia |
|---|---|---|
| TR-31 | Cambio di visibilità | `gh repo edit --visibility public --accept-visibility-change-consequences`, solo dopo la conferma dell'utente in chat |
| TR-32 | Verifica anonima | senza autenticazione: pagina del repository, README, `LICENSE` e release rispondono 200 |

## Dipendenze

Nessuna nuova dipendenza. Riscrittura con `git filter-branch`; screenshot e anteprima social prodotti con il browser
integrato dell'ambiente di sviluppo.

## Compatibilità

- Comportamento del simulatore, API e formato delle stringhe invariati (TR-14).
- `check:public` gira su Windows e Linux come `check:flow`.
- Chi ha già clonato il repository privato (oggi solo l'autore) deve ri-clonare quello nuovo: gli identificativi dei
  commit cambiano.

## Controlli della costituzione

- [x] Principi di architettura: nessuna modifica al codice del simulatore.
- [x] Sicurezza e conformità: nessun segreto pubblicato (TR-5), valori riservati mai versionati (regola iniziale, TR-3),
      CI in sola lettura, protezioni del repository, email anonima, copia di sicurezza prima della riscrittura.
- [x] Vincoli tecnologici: nessuna nuova dipendenza.
- [x] Guardrail di business: formato delle stringhe invariato; costituzione emendata.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritti dopo l'approvazione della spec. Verificato sul piano gratuito che protezione di `main`,
  rilevamento dei segreti e segnalazione privata richiedono un repository pubblico: protezioni divise in "prima" e
  "subito dopo" (spec § 5 aggiornata). Id utente GitHub `7611176` per l'email anonima.
- 2026-10-02 — riscritti dopo il ritorno a intent e spec (riferimenti al documento d'origine tolti anche dalla storia):
  aggiunti i requisiti della riscrittura (TR-6…TR-12). Tolti dai documenti della 0004 i valori precisi da cercare,
  che ora stanno solo nell'elenco locale ignorato da git (TR-3).
- 2026-10-02 — approvati dall'utente.
- 2026-10-03 — change chiusa su conferma dell'utente (T22): repository pubblico, protezioni attive.
