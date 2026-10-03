# 0004 — Pubblicazione open source · Spec

> Stato: completato

Deriva da [intent.md](intent.md). Descrive ciò che deve risultare osservabile nel repository pubblico. Il comportamento
del simulatore e il formato delle stringhe non cambiano.

## Comportamento

### 1. Informazioni riservate

| Categoria | Cosa | Sostituito da | Dove |
|---|---|---|---|
| Produttore | riferimenti al documento d'origine: le frasi che rimandano al documento, il titolo del documento e i numeri dei suoi paragrafi, il prefisso e i valori dell'esempio originale (data, ora, progressivo, peso). I valori precisi da cercare non si scrivono nei documenti versionati (vedi requisiti tecnici) | "formato del simulatore" / "tracciato del simulatore"; esempio con valori di fantasia | **tutti i commit** (file e messaggi), file attuali, metadati |
| Rete | gli indirizzi IP reali della rete in cui sono stati fatti i collaudi | indirizzi riservati alla documentazione: `192.0.2.10` (PC del simulatore), `192.0.2.20` (secondo PC) | file attuali e metadati; **restano nei vecchi commit** per scelta dell'utente |
| Persona | l'email personale come autore dei commit | l'email anonima di GitHub `<id>+robycremo@users.noreply.github.com` | commit futuri; **resta nei vecchi commit** per scelta dell'utente |

Restano ammesse le espressioni "prova manuale" / "manuale nel browser", che indicano una verifica fatta a mano e non
il documento.

**Storia riscritta e nuovo repository.** I commit vengono riscritti per togliere i riferimenti al documento d'origine
(stessa sequenza, stessi messaggi salvo quei riferimenti, stessi autori e date; cambiano gli identificativi). GitHub
conserva i riferimenti delle PR ai vecchi commit e non permette di cancellarli, quindi:
- il repository attuale viene **rinominato** in `simulatore-bilancia-privato` e **resta privato**, con PR #1 e #2 e lo
  storico della CI, come copia di riserva (l'utente può cancellarlo quando vuole);
- un **nuovo** repository `simulatore-bilancia` riceve la storia riscritta e diventa pubblico. Non ha PR né esecuzioni
  della CI precedenti; i loro esiti restano documentati nei test-results delle change.

### 2. Generalizzazione del documento d'origine

- `intent.md`, `spec.md`, `constitution.md`, le change 0001–0003 e i test parlano di **formato del simulatore**:
  il tracciato a 104/106 caratteri è definito in `spec.md` § 6, che diventa l'unico riferimento.
- Le domande aperte su checksum e stringhe MPP / fine partita restano, formulate senza citare il documento d'origine.
- La costituzione § 6 viene emendata: "fedeltà al formato definito in `spec.md` § 6" al posto del rimando al documento d'origine.
- Il test dell'esempio usa valori di fantasia ma verifica gli stessi campi, posizioni e lunghezze.

### 3. Protezioni del repository

| Protezione | Comportamento atteso |
|---|---|
| Rilevamento dei segreti con blocco al push | un push che contiene un token riconosciuto viene rifiutato |
| Avvisi e aggiornamenti di sicurezza Dependabot | vulnerabilità nelle dipendenze segnalate e corrette con PR automatiche |
| Protezione di `main` | niente push diretti né force push; merge solo tramite PR con CI verde |
| Segnalazione privata delle vulnerabilità | chi trova una vulnerabilità la segnala in privato, come indicato in `SECURITY.md` |
| Permessi della CI | la CI ha solo permesso di lettura sul repository |
| Email nei commit futuri | il repository locale usa l'email anonima; si consiglia all'utente di attivare su GitHub "Keep my email address private" e "Block command line pushes that expose my email" (impostazioni del suo account, che restano a lui) |

### 4. Presentazione

- **README in inglese** (`README.md`) con: titolo e frase di presentazione, badge (CI, licenza, Node.js), screenshot
  dell'interfaccia, funzionalità principali, avvio rapido, uso con PuTTY, come è costruito (architettura a livelli),
  **come è sviluppato** (metodo SDD: costituzione, percorso dei sei documenti, le change come esempi reali), test e
  CI, sicurezza, licenza, link alla versione italiana.
- **README in italiano** (`README.it.md`): il contenuto attuale, con link alla versione inglese.
- **Licenza MIT** (`LICENSE`), con titolare `robycremo`; `package.json` con `license`, `repository`, `keywords`.
- **`SECURITY.md`**: versioni supportate, come segnalare una vulnerabilità in privato, cosa aspettarsi.
- **Metadati del repository**: descrizione, topic (es. `scale-simulator`, `weighing`, `nodejs`, `react`, `tcp`,
  `industrial-automation`, `spec-driven-development`), immagine di anteprima per i social (1280×640).
- **Release `v1.0.0`** con note in inglese che riassumono le change 0001–0004.
- La documentazione SDD (`changes/`, documenti vivi, costituzione) resta in italiano.

### 5. Pubblicazione

Il repository diventa pubblico **solo** dopo:
1. il controllo finale sui file di `main` e sui metadati (nessuna occorrenza della tabella § 1);
2. le protezioni del § 3 attive, tranne quelle che GitHub concede solo ai repository pubblici con il piano gratuito
   (rilevamento dei segreti con blocco al push, protezione di `main`, segnalazione privata delle vulnerabilità): queste
   si attivano **subito dopo** il cambio di visibilità, nella stessa sessione, e la pubblicazione è conclusa solo quando
   risultano attive;
3. la **conferma esplicita dell'utente** in chat.

Dopo la pubblicazione si verifica, senza autenticazione, che pagina, README, licenza e release siano visibili.

## Criteri di accettazione

**Riservatezza**
- [ ] Ricerca su **tutti i commit** del nuovo repository (contenuti e messaggi) e sui tag: nessun riferimento al
      documento d'origine (§ 1); "prova manuale" ammessa.
- [ ] Ricerca nei file di `main`: nessun IP reale.
- [ ] Il nuovo repository non ha PR né esecuzioni della CI che rimandino a commit non riscritti; release e descrizione
      senza IP reali né riferimenti al documento.
- [ ] Il repository rinominato `simulatore-bilancia-privato` esiste ed è privato.
- [ ] La storia riscritta ha la stessa sequenza di commit, con gli stessi autori, date e messaggi (salvo i riferimenti
      al documento); il contenuto finale dei file coincide con quello atteso.
- [ ] I commit della 0004 e successivi hanno come autore l'email anonima di GitHub.
- [ ] `data/`, `.env`, `.claude/` mai presenti nella storia; nessun token o password nella storia.

**Comportamento invariato**
- [ ] Tutti i test passano (75 o più) e la CI è verde; le stringhe generate sono identiche byte per byte a prima.

**Protezioni**
- [ ] Le protezioni del § 3 risultano attive nelle impostazioni del repository; un push diretto su `main` viene rifiutato.

**Presentazione**
- [ ] README in inglese e in italiano collegati tra loro, con screenshot e badge funzionanti.
- [ ] `LICENSE` MIT riconosciuta da GitHub; `SECURITY.md` presente; descrizione, topic e release `v1.0.0` visibili.

**Pubblicazione**
- [ ] Visibilità pubblica impostata solo dopo la conferma dell'utente; pagina del repository, README e release
      raggiungibili senza autenticazione.

## Impatto sui documenti vivi

- `intent.md`, `spec.md`: generalizzazione dei riferimenti al documento d'origine.
- `constitution.md` § 6: emendamento sulla fedeltà al formato; § 3: nuova regola sull'email anonima nei commit.
- `README.md` (inglese) e nuovo `README.it.md`.

## Registro

- 2026-10-02 — creata vuota, in attesa del documento precedente.
- 2026-10-02 — scritta dopo l'approvazione dell'intent. Emerso il problema delle PR e dello storico della CI, non
  cancellabili su GitHub: proposta di ricreare il repository (§ 1), da confermare in approvazione.
- 2026-10-02 — l'utente rinuncia alla riservatezza della storia: § 1 limitato ai file attuali e ai metadati
  modificabili; proposta di ricreare il repository ritirata; criteri di riservatezza aggiornati.
- 2026-10-02 — approvata dall'utente.
- 2026-10-02 — **ritorno alla spec** (requisiti tecnici): con il piano gratuito GitHub non consente su un repository
  privato la protezione di `main` ("Upgrade to GitHub Pro or make this repository public"), il rilevamento dei segreti e
  la segnalazione privata delle vulnerabilità. § 5: queste tre si attivano subito dopo il cambio di visibilità.
- 2026-10-02 — **ritorno alla spec** (dopo il ritorno all'intent): riferimenti al documento d'origine tolti da tutti i
  commit; IP ed email restano nei vecchi commit; repository attuale rinominato e privato, nuovo repository con la
  storia riscritta. § 1 e criteri di riservatezza aggiornati.
- 2026-10-03 — change chiusa su conferma dell'utente (T22): repository pubblico, protezioni attive.
