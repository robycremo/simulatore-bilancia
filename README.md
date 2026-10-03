# Weighing terminal simulator

🇬🇧 English · 🇮🇹 [Versione italiana](README.it.md)

[![CI](https://github.com/robycremo/simulatore-bilancia/actions/workflows/ci.yml/badge.svg)](https://github.com/robycremo/simulatore-bilancia/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Node.js ≥ 22](https://img.shields.io/badge/node-%E2%89%A5%2022-339933?logo=node.js&logoColor=white)

**Test the software that receives weighings — without a scale on your desk.**

The simulator behaves like an industrial weighing terminal: you put a load on the virtual platform, it waits for a
stable weight, prints a ticket and sends the weight string to the PC and to a second system (FOM) over the network,
exactly as the real terminal would. Every failure case — printer out of paper, NAK from the receiver, nobody
listening — can be reproduced on demand, in seconds.

![The simulator: terminal display, keypad and printer ticket](docs/images/screenshot.png)

> The user interface and the in-depth documentation are in Italian: the simulator was built for an Italian plant.
> This page gives you everything you need to run it and to understand how it is made.

## Features

- **Faithful weighing cycle** — threshold or photocell trigger, stability wait with timeout, tare and zero, standard
  and *MPP* (archive) modes, end-of-batch, totals and progressive counter.
- **Real strings on the wire** — fixed 104-character record (106 with checksum: none, XOR or sum mod 256), sent over
  **TCP client**, **UDP** or **TCP server** (clients such as PuTTY connect to the simulator), with optional
  **ACK/NAK** handshake and retries.
- **Error injection** — printer disconnected or out of paper, NAK or silent receiver, no client connected; error
  outputs light up as on the real terminal.
- **Built-in test receivers** that answer ACK, NAK or nothing, plus a command-line receiver.
- **Safe by default** — listens on `127.0.0.1` only; network access requires a token (web UI) or an explicit IP
  allow-list (TCP server ports); every command is validated and rate-limited.
- **Operable** — atomic state saving with automatic recovery, daily JSON logs, `/api/health`, graceful shutdown.

## Quick start

Requires **Node.js 22 or newer**.

```bash
git clone https://github.com/robycremo/simulatore-bilancia.git
cd simulatore-bilancia
npm ci
npm run prod
```

Open <http://localhost:3000>, drag the load slider above the threshold and watch the ticket print and the string
appear in the *Ricevitori test* (test receivers) tab.

| Command | What it does |
|---|---|
| `npm run prod` | build the UI and start the simulator on port 3000 |
| `npm run dev` | development mode with hot reload (UI on port 5173) |
| `npm test` | run the automated test suite |
| `npm run listen -- 9100 tcp ack` | stand-alone receiver that prints every string it gets |

Environment variables: `PORT` (default `3000`), `HOST` (default `127.0.0.1`; `0.0.0.0` to open the web UI to other
PCs) and `SIM_TOKEN` (required whenever `HOST` is not local).

## Receiving strings with PuTTY

1. In **Setup → 7) Trasmissione a PC**, set *Protocollo* to **TCP server** (port **4001** is suggested) and save.
2. In PuTTY: host `127.0.0.1`, port `4001`, connection type **Raw**.
3. Every weighing now shows up in PuTTY as a 104-character line.

Up to 5 clients per channel receive the same strings. To connect from another PC, set *Accesso* to *rete* and list
the allowed IP addresses (for example `192.0.2.20`). Without a connected client the transmission counts as failed —
just like a receiving PC that is switched off.

## Architecture

```text
 Browser (React)                    server/
   client/src  ──WebSocket /ws──►  api/ws.js ──(validate)──►  domain/engine.js
               ◄── state 10 Hz ──                                │
               ──HTTP──────────►  api/http.js (UI, health)       ├─► transport/channels.js ─┬─► net.js ───────► PC / FOM (TCP client, UDP)
                                                                 │                          └─► serverChannel.js ◄── PC / FOM / PuTTY (TCP server)
                                                                 ├─► transport/receiver.js ◄── built-in test receivers
                                                                 ├─► storage/jsonStore.js    data/*.json
                                                                 └─► observability/logger.js data/logs/
```

- The **engine** is the single source of truth (weight model, weighing cycle, printer, totals); the React UI is only
  a view that sends commands.
- Each layer of a production stack has its own folder: `config`, `api`, `domain`, `transport`, `storage`,
  `observability`. The domain never sees the network, access rules or limits — it receives validated commands only.
- No runtime dependencies beyond `express` and `ws`: validation, rate limiting, logging and the TCP server are small
  in-house modules.

## How it's built: spec-driven development

This repository is also an example of **spec-driven development** carried out end to end, with an AI pair
programmer and a human approving every step.

A [**constitution**](constitution.md) sets the rules — architecture principles, security, engineering practices,
quality standards, technology constraints, business guardrails. Every change then follows the same path, one
approved document at a time:

```text
intent → spec → tech-requirements → plan → tasks → code → test-results → PR
  ↑                                                                    │
  └────────────────────────── go back when needed ─────────────────────┘
```

| # | Document | Question it answers |
|---|---|---|
| 1 | `intent.md` | What do we want, and why? |
| 2 | `spec.md` | What must the system do? (observable behaviour, acceptance criteria) |
| 3 | `tech-requirements.md` | Which measurable technical constraints apply? |
| 4 | `plan.md` | How will we build it? |
| 5 | `tasks.md` | What concrete work is needed? |
| 7 | `test-results.md` | Does it satisfy the spec and the requirements? Every criterion, with its evidence |

The full history is in [`changes/`](changes/README.md):

| Change | What it delivered |
|---|---|
| [0001 — initial simulator](changes/0001-simulatore-iniziale/intent.md) | weighing cycle, setup, strings, printer, test receivers |
| [0002 — production stack](changes/0002-allineamento-stack/intent.md) | each of the 13 stack layers covered or explicitly ruled out: auth, validation, rate limiting, atomic storage, logs, health, CI |
| [0003 — TCP server mode](changes/0003-modalita-server-tcp/intent.md) | channels that listen for clients such as PuTTY, with IP allow-list |
| [0004 — open-source release](changes/0004-pubblicazione-open-source/intent.md) | this public repository: licensing, security settings, documentation |

Each `test-results.md` also records the defects found along the way and the times the process went back to an
earlier document — the parts that usually stay invisible. `npm run check:flow` (also in CI) verifies that every change
has its six documents and that their statuses respect the order.

## Testing & CI

- **80+ automated tests** with `node:test`: unit tests plus end-to-end tests on real server instances (random ports,
  temporary data folders) covering the weighing cycle, ACK/NAK, access control, rate limiting, storage recovery and
  TCP server mode.
- **GitHub Actions** on every push and pull request: process check, publishable-content check, build, tests and
  `npm audit` (fails on high-severity vulnerabilities).

## Security

The simulator is a **testing tool** for workstations and trusted networks, not an Internet-facing service. See
[SECURITY.md](SECURITY.md) for supported versions and how to report a vulnerability privately.

## License

[MIT](LICENSE) © 2026 robycremo
