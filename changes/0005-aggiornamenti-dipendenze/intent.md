# 0005 — Aggiornamenti automatici delle dipendenze · Intent

> Stato: completato

## Work item

> Come **autore del simulatore**, voglio **che gli aggiornamenti delle dipendenze proposti da Dependabot si possano
> integrare senza scrivere una change dedicata**, purché non tocchino altro e superino tutti i controlli, per **tenere
> le dipendenze sicure senza lavoro manuale e senza indebolire il percorso SDD**.

## Problema

Dalla change 0004 il repository è pubblico e Dependabot propone in automatico gli aggiornamenti di sicurezza.
La costituzione (§ 3) e `check:flow` richiedono però che ogni modifica al codice, `package.json` compreso, tocchi
una cartella in `changes/`. Dependabot non può farlo, quindi:

- la PR #3, che porta `concurrently` da 9.2.0 a 9.2.5 e con lui `shell-quote` da 1.9.0 a 1.12.0, correggendo una
  vulnerabilità **critica**, è ferma dal 13 ottobre: la CI fallisce al passo `check:flow` prima ancora di eseguire
  test e audit;
- l'avviso critico resta aperto sul repository pubblico;
- la prossima esecuzione della CI su `main` fallirà al passo `npm audit`;
- ogni futuro aggiornamento di Dependabot si bloccherà allo stesso modo.

Scrivere sei documenti per ogni aggiornamento di versione sarebbe sproporzionato, e il rischio concreto è che gli
aggiornamenti di sicurezza restino in attesa.

## Obiettivo

Una **eccezione stretta e verificata automaticamente** al percorso obbligatorio:

1. vale solo per le PR **create da Dependabot** che modificano **esclusivamente** i file delle dipendenze;
2. tutti gli altri controlli della CI restano obbligatori: contenuti pubblicabili, build, test, audit;
3. il merge resta una decisione dell'autore;
4. la regola è scritta nella costituzione, così non dipende dalla memoria di chi lavora sul progetto.

La correzione di sicurezza della PR #3 viene integrata insieme alla regola, nella stessa change (vedi *Registro*).

## Fuori ambito

- Merge automatico degli aggiornamenti.
- Aggiornamenti di versione programmati (configurazione `dependabot.yml`): oggi arrivano solo quelli di sicurezza.
- Modifiche manuali alle dipendenze fatte dall'autore: continuano a richiedere una change.

## Vincoli

- Il controllo deve distinguere Dependabot in modo non falsificabile da un contributore esterno: un ramo chiamato
  `dependabot/...` o un messaggio di commit non bastano.
- La CI resta con permessi di sola lettura.
- Emendamento della costituzione § 3, con voce negli *Emendamenti*.

## Domande aperte (da chiudere nella spec)

1. **Quali file**: solo `package.json` e `package-lock.json`, o anche i workflow in `.github/workflows/` quando
   Dependabot aggiorna le GitHub Actions?
2. **Aggiornamenti di versione maggiore** (es. 9.x → 10.x), che possono rompere la compatibilità: esentati anch'essi,
   o soggetti a una change?
3. **Traccia**: basta la PR, o ogni aggiornamento integrato va annotato anche in un registro del repository?

## Registro

- 2026-10-20 — creata su richiesta dell'utente (opzione "regola stabile"), dopo aver trovato la PR #3 di Dependabot
  bloccata da `check:flow`.
- 2026-10-20 — approvato dall'utente.
- 2026-10-20 — **ritorno all'intent** durante il plan: `npm audit` su `main` fallisce già, quindi la PR della 0005 e la
  PR #3 si bloccherebbero a vicenda. Su conferma dell'utente la correzione di sicurezza entra nella 0005; la PR #3 non è
  più il primo caso di verifica.
- 2026-10-20 — change chiusa su conferma dell'utente (T11).
