# Contributing to PrivateBudget

Thanks for your interest! Good-faith pull requests are welcome.

A few things to set expectations:

- **This is a maintainer-led project.** Reviews may be occasional and slow —
  please don't take a delay personally.
- **Open an issue first for anything non-trivial.** A quick discussion before you
  build saves everyone time, especially for features or refactors.
- **Keep the privacy guarantee intact.** PrivateBudget's whole point is that
  financial data never leaves the device. Contributions must not add a
  data-bearing backend, network calls that carry user data, analytics, trackers,
  or third-party scripts. The strict `connect-src 'self'` CSP is a hard
  constraint, not a preference.
- **Match the existing code.** TypeScript, the existing patterns, and money as
  integer cents (never floating point).
- **Add tests** for behavior changes (`npm test`, and `npm run e2e` where
  relevant) and make sure `npm run build` passes.

## Licensing of contributions

By submitting a contribution, you agree that it is licensed under the project's
[AGPL-3.0](LICENSE), the same terms as the rest of the project.

## Branding

The PrivateBudget name, logo, and domain are **not** part of the open-source
license (see [NOTICE](NOTICE)). Contributions should not change or repurpose the
project's branding.

## Security issues

**Do not report security or privacy vulnerabilities in public issues or PRs.**
See [SECURITY.md](SECURITY.md) for private disclosure.
