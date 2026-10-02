# 0002 — Allineamento allo stack di produzione · Spec

> Stato: completato

Deriva da [intent.md](intent.md). Descrive solo il comportamento osservabile: il *come* è nel plan.
Il comportamento di pesatura e il formato delle stringhe ([spec.md](../../spec.md) § 1–7) **non cambiano**.

## Comportamento

### Configurazione di avvio

Il server si configura con variabili d'ambiente; senza variabili si comporta in modo sicuro per l'uso locale.

| Variabile | Default | Significato |
|---|---|---|
| `PORT` | `3000` | porta HTTP/WebSocket |
| `HOST` | `127.0.0.1` | interfaccia di ascolto; `0.0.0.0` per l'accesso da altri PC |
| `SIM_TOKEN` | — | token di accesso, **obbligatorio** se `HOST` non è un indirizzo di loopback |

### 1. Frontend

- Un errore di rendering mostra un pannello "Errore dell'interfaccia" con il pulsante **Ricarica**, invece di una pagina bianca.
- L'errore viene inviato al server e finisce nel log.
- Se il server rifiuta un comando, la UI mostra il motivo in una notifica temporanea.

### 2. APIs & backend logic

- Il server accetta solo comandi noti, con argomenti del tipo e dell'intervallo previsti
  (es. `setLoad` numero finito; `receiver.index` 0 o 1; `updateConfig` con porte 1–65535, divisione > 0, soglia ≥ 0).
- Un comando non valido viene scartato **senza modificare lo stato**; il client riceve `{type:'error', message}`.
- Messaggi WebSocket oltre **16 KB** o non JSON vengono scartati con un errore.
- `GET /api/health` risponde `200` con JSON: `status`, `version`, `uptime`, fase del ciclo, modo STD/MPP, stato dei ricevitori.

### 3. Database & storage

- Setup e stato vengono salvati in modo che un'interruzione durante il salvataggio non lasci mai un file incompleto.
- Prima di ogni salvataggio la versione precedente viene conservata come `*.bak`.
- Se all'avvio `config.json` o `state.json` è illeggibile: il file viene rinominato `*.corrupt-<data-ora>`, il simulatore
  parte con i valori di default (o dal `.bak` se valido) e scrive un avviso nel log.
- Decisione: **nessun database**. I volumi (setup, stato, archivio MPP fino a 5000 righe) non lo giustificano.

### 4. Auth & permissions

- Di default il server è raggiungibile **solo dal PC locale**.
- Con `HOST` non di loopback e senza `SIM_TOKEN` il server non parte e spiega perché.
- I client remoti devono presentare il token prima di ricevere lo stato o inviare comandi; la UI lo chiede una volta
  e lo ricorda per la sessione del browser. Token errato → connessione chiusa e tentativo registrato nel log.
- I client dal PC locale non devono presentare il token.
- Decisione: nessun utente o ruolo (fuori ambito nell'intent).

### 5. Hosting & deployment

- `npm run prod` compila la UI e avvia il server con un solo comando.
- Il README ha una sezione **Installazione su PC di collaudo**: requisiti, installazione, avvio, variabili d'ambiente,
  accesso da un altro PC, dove sono i log.

### 6. Cloud & compute

- Decisione: **non applicabile**. Il simulatore deve stare nella stessa rete dei software da collaudare;
  la decisione è riportata in `spec.md`.

### 7. CI/CD & version control

A ogni push su `main` e a ogni pull request la CI esegue, e fallisce se uno solo fallisce:
1. verifica del percorso (`check:flow`);
2. test automatici;
3. build della UI;
4. controllo vulnerabilità delle dipendenze (fallisce da gravità *high* in su).

I test automatici coprono almeno: lunghezza 104/106 della stringa pesata, posizione e formato di ogni campo
sull'esempio di riferimento, i due checksum, i template MPP e fine partita, la validazione dei comandi.

### 8. Security & RLS

- Il WebSocket accetta connessioni dal browser solo se l'origine è la pagina del simulatore stesso.
- Le risposte HTTP includono intestazioni di sicurezza: nessun inserimento in frame di altri siti, nessun MIME sniffing,
  nessun referrer, Content-Security-Policy che consente solo risorse del simulatore.
- Decisione: **RLS non applicabile** (nessun database).

### 9. Rate limiting

- Ogni connessione può inviare al massimo **50 comandi al secondo**; quelli in eccesso vengono scartati e il client riceve
  al massimo un avviso al secondo. Trascinare il cursore del carico non deve mai raggiungere il limite.
- Una connessione oltre il limite per **10 secondi consecutivi** viene chiusa.
- Massimo **10 connessioni** WebSocket contemporanee; l'undicesima viene rifiutata.

### 10. Caching & CDN

- I file della UI con hash nel nome vengono serviti con cache di un anno, marcati immutabili.
- `index.html` viene sempre rivalidato, così dopo un aggiornamento il browser carica la versione nuova.
- Decisione: **CDN non applicabile**.

### 11. Load balancing & scaling

- Decisione: **non applicabile**. Il simulatore è un terminale con stato: una sola istanza per porta.
- Se la porta HTTP è già occupata (es. seconda istanza), il server termina con un messaggio chiaro e codice di uscita ≠ 0,
  senza stack trace.

### 12. Error tracking & logs

- Log in `data/logs/simulatore-AAAA-MM-GG.log`, una riga JSON per evento, con data-ora, livello ed evento.
- Eventi registrati: avvio e arresto, modifica setup, ogni pesata (progressivo, netto, innesco, esiti trasmissione),
  errori di trasmissione, avaria stampante, fine partita, comandi rifiutati, connessioni e disconnessioni,
  accessi negati, errori della UI, errori non gestiti.
- In console resta un output leggibile.
- I file più vecchi di **14 giorni** vengono eliminati all'avvio.
- Un errore non gestito viene registrato prima che il processo termini; una promise rifiutata non gestita viene registrata
  senza terminare.

### 13. Availability & recovery

- Su arresto (Ctrl+C o segnale di terminazione) il server salva lo stato, chiude i ricevitori e le connessioni
  ed esce entro **3 secondi**. Al riavvio progressivo, totali e archivio MPP sono quelli di prima.
- Un ricevitore di test con avvio automatico che va in errore (es. porta occupata) ritenta ogni **5 secondi**
  e lo stato del ricevitore nella UI lo mostra.
- La UI si riconnette da sola dopo un riavvio del server e lo segnala (comportamento già presente, da mantenere).

## Criteri di accettazione

**Configurazione e accesso**
- [ ] Avvio senza variabili → raggiungibile da `http://localhost:3000`, non dall'IP del PC.
- [ ] `HOST=0.0.0.0` senza `SIM_TOKEN` → il server non parte, messaggio esplicito, codice di uscita ≠ 0.
- [ ] `HOST=0.0.0.0 SIM_TOKEN=x` → da un altro PC la UI chiede il token; con token giusto funziona, con token sbagliato la connessione viene chiusa e c'è una riga nel log.

**API e validazione**
- [ ] `{"type":"cmd","cmd":"setLoad","args":"abc"}` → errore al client, carico invariato.
- [ ] Comando inesistente → errore al client, stato invariato.
- [ ] `updateConfig` con porta 70000 → rifiutato, setup invariato.
- [ ] Messaggio da 20 KB → scartato con errore.
- [ ] `GET /api/health` → 200 con i campi elencati.

**Storage e recovery**
- [ ] `state.json` sostituito con testo non JSON → all'avvio viene rinominato `*.corrupt-*`, il simulatore parte, c'è un avviso nel log.
- [ ] Dopo un salvataggio esiste `state.json.bak` con la versione precedente.
- [ ] Ctrl+C con progressivo 7 → il processo esce entro 3 s; al riavvio il progressivo è 7.
- [ ] Ricevitore PC su porta occupata → stato "errore"; liberata la porta, entro 5 s torna "in ascolto".

**Sicurezza, limiti e cache**
- [ ] Connessione WebSocket con `Origin` di un altro sito → rifiutata.
- [ ] Le risposte HTTP contengono le intestazioni di sicurezza descritte.
- [ ] 200 comandi in 1 secondo → al massimo 50 eseguiti, il client riceve l'avviso; per 10 s consecutivi → connessione chiusa.
- [ ] Undicesima connessione WebSocket → rifiutata.
- [ ] Trascinamento continuo del cursore del carico → nessun avviso di limite.
- [ ] `/assets/*` con `Cache-Control: public, max-age=31536000, immutable`; `index.html` con `no-cache`.
- [ ] Seconda istanza sulla stessa porta → esce con messaggio chiaro e codice ≠ 0.

**Log ed errori**
- [ ] Una pesata STD con FOM in NAK produce nel log una riga per la pesata e una per l'errore di trasmissione.
- [ ] Un errore lanciato apposta in un componente React mostra il pannello con **Ricarica** e una riga nel log.
- [ ] File di log più vecchi di 14 giorni vengono eliminati all'avvio.

**CI e documentazione**
- [ ] La CI esegue check:flow, test, build e controllo dipendenze; un test volutamente rotto la fa fallire.
- [ ] I test verificano la stringa dell'esempio di riferimento campo per campo.
- [ ] `npm run prod` avvia il simulatore partendo da un clone pulito dopo `npm ci`.
- [ ] Il README contiene la sezione *Installazione su PC di collaudo*.

**Nessuna regressione**
- [ ] I criteri di accettazione della change 0001 restano soddisfatti.

## Impatto sui documenti vivi

- `spec.md` § 8 *Stack*: tabella aggiornata con il comportamento definito qui e le decisioni di non applicabilità.
- `spec.md`: nuova sezione § 9 *Operatività* (variabili d'ambiente, accesso remoto, health, log).
- `intent.md`: nessuna modifica.

## Registro

- 2026-10-02 — creata vuota, in attesa dell'intent.
- 2026-10-02 — scritta dopo l'approvazione dell'intent.
- 2026-10-02 — approvata dall'utente.
- 2026-10-02 — change chiusa su conferma dell'utente (T13).
