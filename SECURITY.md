# Security Policy

PrivateBudget is a privacy-focused application, so security and privacy reports
are taken seriously. Thank you for helping keep users safe.

## Reporting a vulnerability

**Please report vulnerabilities privately — do not open a public issue or pull
request**, as that could expose users before a fix is available.

Preferred channel:

- **GitHub private vulnerability reporting** — go to the repository's
  **Security** tab → **Report a vulnerability** (GitHub Security Advisories).

Alternatively, you can email **security@privatebudget.org**.
<!-- Set up this alias (or replace it with your preferred contact) before publicizing. -->

Please include:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if possible), and
- any suggested remediation.

## What to expect

- Acknowledgement of your report as soon as reasonably possible.
- An assessment and, if confirmed, a fix prioritized according to severity.
- Credit for the disclosure if you'd like it (let me know your preference).

## Scope

Of particular interest: anything that could cause financial data to leave the
device, weaken the Content-Security-Policy / no-network guarantee, or expose
data stored in the browser (IndexedDB) to other origins or third parties.
