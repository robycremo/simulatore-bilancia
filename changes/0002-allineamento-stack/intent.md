# 0002 — Allineamento allo stack di produzione · Intent

> Stato: approvato

## Work item

> Come **responsabile del simulatore**, voglio **che ogni livello dello stack di produzione sia coperto o escluso con motivazione** per **poterlo usare in rete in modo sicuro, diagnosticare i problemi e non perdere dati**.

## Problema

Il simulatore funziona, ma è nato come prototipo: non tutti i livelli dello stack di produzione sono coperti in modo
esplicito. Alcuni mancano del tutto (CI, log, rate limiting), altri sono impliciti (sicurezza, recovery).

| Livello | Oggi | Lacuna |
|---|---|---|
| Frontend | React + Vite, componenti in un'unica cartella | nessuna gestione errori di rendering (error boundary) |
| APIs & backend logic | WebSocket con comandi `cmd_*` | comandi e argomenti non validati; nessun endpoint di salute |
| Database & storage | JSON in `data/` | scrittura non atomica: un'interruzione può corrompere `state.json` |
| Auth & permissions | nessuna | il server ascolta su tutte le interfacce: chiunque in rete può comandare il simulatore |
| Hosting & deployment | `npm start` | nessuna procedura documentata di installazione su un PC di collaudo |
| Cloud & compute | — | non applicabile; decisione da formalizzare |
| CI/CD & version control | git appena inizializzato | nessuna pipeline: build e struttura delle change non verificate |
| Security & RLS | — | nessun controllo Origin sul WebSocket, nessun limite alla dimensione dei messaggi, dipendenze non controllate; RLS non applicabile |
| Rate limiting | — | un client può inondare il motore di comandi |
| Caching & CDN | file statici senza intestazioni di cache | asset con hash non marcati immutabili; CDN non applicabile |
| Load balancing & scaling | — | non applicabile (istanza singola con stato); manca un controllo contro due istanze sulle stesse porte |
| Error tracking & logs | `console.log` | nessun log su file, nessuna cattura degli errori non gestiti |
| Availability & recovery | stato persistito, riconnessione UI | nessun arresto pulito; un ricevitore in errore resta fermo |

## Obiettivo

Coprire ogni livello dello stack con una soluzione proporzionata a uno strumento di collaudo locale, oppure con una
decisione motivata di non applicabilità. Nessun cambiamento al comportamento di pesatura né al formato delle stringhe.

## Fuori ambito

- Database relazionale, cloud, CDN, bilanciamento: si documenta la non applicabilità.
- Autenticazione con utenti e ruoli.

## Vincoli

- Resta avviabile con un solo comando su Windows, senza servizi esterni.
- Ogni livello introdotto deve avere una verifica automatica o una prova manuale descritta.

## Registro

- 2026-10-02 — creata. Spec e plan si scrivono dopo l'approvazione di questo intent.
- 2026-10-02 — approvato dall'utente.
