# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x (`main`) | ✅ |
| older | ❌ |

Security fixes are released on `main` and in the next tagged release.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report it privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability**. Include:

- what you found and where (file, endpoint, configuration);
- how to reproduce it, ideally with the smallest possible example;
- the impact you expect (for example: remote command execution, access without token, denial of service).

## What to expect

- an acknowledgement within **7 days**;
- an initial assessment within **14 days**;
- a fix or a mitigation plan, and credit in the release notes if you wish.

## Scope and deployment notes

The simulator is a **testing tool**, meant to run on a workstation or inside a trusted network:

- by default it listens only on `127.0.0.1`; exposing the web UI to the network requires `SIM_TOKEN`;
- channels in **TCP server** mode accept only local clients by default, or an explicit list of allowed IPv4
  addresses;
- it is not designed to be exposed to the Internet.

Reports about running it outside these conditions are still welcome, but may be handled as hardening rather than
vulnerabilities.
