# Change — percorso obbligatorio

Ogni modifica al progetto (funzionalità, correzione, refactoring, dipendenze) segue lo stesso percorso,
sotto le regole della [costituzione](../constitution.md):

```text
                         constitution.md  (regole che valgono per tutti i passi)
                                        │
intent → spec → tech-requirements → plan → tasks → codice → test-results → PR
  ↑                                                                     │
  └──────────────────────────── si torna indietro ──────────────────────┘
```

| # | File | Domanda | Contenuto |
|---|---|---|---|
| 1 | `intent.md` | Cosa vogliamo e perché? | work item: "Come … voglio … per …", problema, obiettivo, fuori ambito |
| 2 | `spec.md` | Cosa deve fare il sistema? | comportamento osservabile, criteri di accettazione |
| 3 | `tech-requirements.md` | Quali vincoli tecnici vanno rispettati? | limiti numerici, prestazioni, sicurezza, compatibilità, dipendenze |
| 4 | `plan.md` | Come lo costruiamo? | approccio, struttura, file toccati, rischi |
| 5 | `tasks.md` | Quale lavoro concreto serve? | lista di compiti spuntabili, nell'ordine di esecuzione |
| 6 | codice | — | — |
| 7 | `test-results.md` | Soddisfa spec e requisiti tecnici? | per ogni criterio: verifica ed esito |
| 8 | PR | Possiamo rivederla e integrarla? | collegamenti ai documenti, esiti, controlli della costituzione |

## Struttura

```text
constitution.md                        regole del processo (emendabili solo esplicitamente)
intent.md, spec.md,                    documenti vivi: stato attuale del progetto
tech-requirements.md, plan.md
changes/
  _template/                           modello da copiare
  NNNN-nome-breve/
    intent.md  spec.md  tech-requirements.md  plan.md  tasks.md  test-results.md
```

## Regole

1. **Nuova change**: copia `_template/` in `changes/NNNN-nome-breve/` (numero successivo, nome in kebab-case).
2. **Un passo alla volta**: ogni documento si scrive solo quando il precedente è approvato.
3. **Si torna indietro**: se un passo a valle scopre un errore a monte, ci si ferma, si corregge il documento a monte
   (e quelli a valle), si annota il motivo nel *Registro* di entrambi.
4. **Chiusura**: con `test-results.md` completato, le modifiche vengono riportate nei documenti vivi in radice e tutti
   i file della change passano a `completato`.
5. **Commit e PR**: ogni commit cita la change (`[0003] ...`); la CI rifiuta modifiche al codice senza una change toccata
   nello stesso ramo.

## Stato

Ogni documento ha in testa una riga `> Stato: <valore>`.

| Stato | intent · spec · tech-requirements · plan | tasks | test-results |
|---|---|---|---|
| `bozza` | in scrittura | in scrittura | non iniziato |
| `approvato` | revisionato, si passa al successivo | lista approvata, codice non iniziato | — |
| `in corso` | — | codice in sviluppo | verifiche in esecuzione |
| `completato` | change chiusa | tutti i compiti fatti | tutti i criteri verificati |
| `abbandonato` | change chiusa senza implementazione; motivo nel registro | | |

`npm run check:flow` verifica che ogni change abbia i sei file con stati validi e che l'ordine sia rispettato:
nessun documento oltre la bozza se il precedente è in bozza, `test-results` avviato solo con i tasks avviati,
chiusura in un unico passo (`test-results` completato solo con tutti i documenti completati, e nessun documento
tranne `tasks` completato prima).
