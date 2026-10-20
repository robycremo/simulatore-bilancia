# 0005 — Aggiornamenti automatici delle dipendenze · Test results

> Stato: completato

Verifica dei criteri di [spec.md](spec.md) e dei requisiti di [tech-requirements.md](tech-requirements.md).
Legenda: ✅ superato · ❌ fallito · ⏳ da eseguire.

## Test automatici

| Data | Ambiente | Comando | Esito |
|---|---|---|---|
| 2026-10-20 | Windows 11, Node 26.7 | `npm run build && npm test` | 101 superati, 0 falliti (81 esistenti invariati + 14 `dependabotExemption.test` + 6 `checkFlow.test`) |
| 2026-10-20 | Windows 11, Node 26.7 | `npm audit --audit-level=high` | 0 vulnerabilità |
| 2026-10-20 | CI Linux (ubuntu-latest), Node 22 | PR #4 della 0005 (esecuzione 39391136207) | ✅ tutti i passi, compreso `npm audit` |
| 2026-10-20 | CI Linux, Node 22 | `main` dopo il merge (`032a7a6`) | ✅ |

## Criteri di accettazione

| Criterio | Verifica | Esito |
|---|---|---|
| **Regola** | | |
| PR di Dependabot con soli aggiornamenti minori/patch → passo superato, riga dell'eccezione nel log | `checkFlow.test` (riproduzione della PR #3); prova sul ramo reale della PR #3 | ✅ |
| Stessi file, autore diverso (anche ramo `dependabot/…`) → rifiutata | `checkFlow.test`, `dependabotExemption.test`; prova sul ramo reale | ✅ |
| PR di Dependabot con un altro file → rifiutata con il motivo | `checkFlow.test`, `dependabotExemption.test` | ✅ |
| Dipendenza aggiunta o tolta, script o altro campo cambiato → rifiutata con il motivo | `dependabotExemption.test` | ✅ |
| Versione maggiore → rifiutata "serve una change" (anche serie 0.x) | `checkFlow.test`, `dependabotExemption.test` | ✅ |
| `check:flow` locale e su `main` invariato | `checkFlow.test` (senza variabile, modifica solo di documenti); `check:flow` sulle 5 change | ✅ |
| **Correzione di sicurezza e caso reale** | | |
| `concurrently` 9.2.0 → 9.2.5, `shell-quote` 1.9.0 → 1.12.0; audit pulito; CI della 0005 verde | locale: lock con 9.2.5 / 1.12.0, audit 0 vulnerabilità, `npm run dev` avviato (server + Vite, UI 200, `/api/health` via proxy); CI della PR #4 verde, audit compreso | ✅ |
| Dopo il merge: avviso chiuso, CI su `main` verde, PR #3 chiusa da Dependabot | avviso #1 `fixed` (08:08:30 UTC); CI su `main` verde; PR #3 chiusa da Dependabot alle 08:10:21 UTC ("dependencies are up-to-date now") | ✅ |
| Eccezione verificata da un test che riproduce la PR #3 | `checkFlow.test` | ✅ |
| **Documentazione** | | |
| Costituzione § 3 emendata; `changes/README.md` aggiornato | revisione | ✅ |

## Problemi trovati

1. **Stallo tra le due PR** (durante il plan): `npm audit` su `main` falliva già, quindi la PR della 0005 non poteva
   essere integrata e la PR #3 non poteva passare `check:flow` senza la 0005. Ritorno a intent, spec, requisiti e plan:
   la correzione di sicurezza entra nella 0005.

2. **Email personale nel merge commit della PR #4** (T9). Il merge fatto da GitHub (`032a7a6`) ha come autore l'email
   personale dell'account, mentre quello della 0004 (`b4f6787`) aveva l'email anonima: era cambiata un'impostazione
   dell'account. Il commit resta com'è, su indicazione dell'utente: la stessa email è già nei vecchi commit, e
   correggerlo richiederebbe un force push su `main` protetto. L'utente ha ripristinato l'impostazione; il merge della
   PR di chiusura serve da verifica.

La **conferma dal vivo** dell'eccezione arriverà con la prima PR di Dependabot successiva alla change, fuori dai
criteri di chiusura (spec): da segnalare all'utente quando arriva.

## Registro

- 2026-10-20 — creata vuota, in attesa del documento precedente.
- 2026-10-20 — esiti di T1–T8.
- 2026-10-20 — esiti di T9–T10; change chiusa su conferma dell'utente (T11).
