# 0004 — Pubblicazione open source · Intent

> Stato: completato

## Work item

> Come **autore del simulatore**, voglio **rendere pubblico il repository su GitHub con una presentazione curata**
> per **farmi conoscere professionalmente**, **senza esporre informazioni riservate** mie, dell'azienda o del
> produttore del terminale.

## Problema

Il progetto è maturo (3 change completate, 75 test, CI, documentazione SDD) ma è privato, e così com'è non è pronto per
essere pubblico:

- **Informazioni da non pubblicare**, nei file e nella storia dei commit:
  - indirizzi IP reali della rete in cui è stato collaudato;
  - l'email personale dell'autore in tutti i commit;
  - riferimenti al documento d'origine da cui sono stati ricavati formato della stringa e funzionamento (titolo del
    documento, paragrafi, esempio originale).
- **Sicurezza del repository pubblico**: mancano rilevamento dei segreti, avvisi sulle dipendenze, protezione di
  `main`, politica di segnalazione delle vulnerabilità, permessi minimi della CI.
- **Presentazione**: README solo in italiano e pensato per l'uso interno, nessuno screenshot, nessuna licenza, nessuna
  descrizione, topic, immagine di anteprima o release.

## Obiettivo

Un repository pubblico che:
1. non contenga riferimenti al documento del produttore **in nessun commit**, né IP reali **nei file attuali e nei
   metadati**;
2. abbia le protezioni di GitHub adatte a un progetto pubblico;
3. si presenti bene a chi lo scopre: README in **inglese** con versione **italiana**, screenshot, badge, licenza
   **MIT**, descrizione, topic, anteprima social, release `v1.0.0`, e il metodo SDD messo in evidenza come punto di forza.

## Decisioni già prese dall'utente

- Storia: **riscritta solo per i riferimenti al documento d'origine**, che spariscono da tutti i commit. Gli IP reali e l'email
  personale restano visibili nei vecchi commit (scelta esplicita dell'utente, vedi *Registro*); nei file attuali gli
  IP vengono comunque sostituiti. I commit futuri usano l'email anonima di GitHub.
- Repository: quello attuale viene **rinominato e resta privato** come copia di riserva (con PR e storico della CI);
  un nuovo repository con il nome attuale riceve la storia riscritta e diventa pubblico.
- Manuale: **generalizzato**. Il formato della stringa e il funzionamento restano, descritti come protocollo del
  simulatore, senza citare il documento d'origine.
- Lingua della vetrina: **inglese + italiano**; la documentazione SDD (`changes/`, documenti vivi) resta in italiano.
- Licenza: **MIT**.

## Fuori ambito

- Traduzione in inglese della documentazione SDD.
- Nuove funzionalità del simulatore.
- Pubblicazione su registri di pacchetti (npm) o demo online.

## Vincoli

- **Il cambio di visibilità è l'ultimo passo**, solo dopo il controllo finale della storia riscritta e una conferma
  esplicita dell'utente: una volta pubblico, il contenuto può essere copiato o messo in cache e non è più ritirabile.
- Il comportamento del simulatore e il formato delle stringhe non cambiano.
- La costituzione cita il documento d'origine (§ 6): va emendata insieme alla generalizzazione.

## Registro

- 2026-10-02 — creata su richiesta dell'utente, con le decisioni su storia, documento d'origine, lingua e licenza.
- 2026-10-02 — approvato dall'utente.
- 2026-10-02 — **ritorno all'intent** durante la spec: l'utente dichiara che la riservatezza della storia non gli
  interessa. Niente riscrittura né ricreazione del repository; restano visibili nei vecchi commit i due IP reali,
  l'email personale e i riferimenti al documento d'origine. Informato esplicitamente di cosa resta pubblico prima della modifica.
- 2026-10-02 — **ritorno all'intent** durante i requisiti tecnici: l'utente ci ripensa per i riferimenti al documento d'origine,
  che vanno tolti anche dalla storia; IP ed email possono restare nei vecchi commit. Per via dei riferimenti delle PR ai
  vecchi commit, il repository attuale viene rinominato (privato, copia di riserva) e uno nuovo riceve la storia riscritta.
- 2026-10-03 — change chiusa su conferma dell'utente (T22): repository pubblico, protezioni attive.
