# Security policy

## Supported versions

Only the `main` branch and the latest `0.x` version receive security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report it privately through GitHub's private vulnerability reporting:
<https://github.com/gildor853/ua-lens/security/advisories/new>
(repository **Security** tab → **Report a vulnerability**).

Please include the affected version, a minimal input that reproduces the
problem and its impact. You can expect an acknowledgement within 7 days.
Fixes are released as a patch version and credited in the advisory unless you
prefer otherwise.

## Scope

This is a zero-dependency library that parses untrusted request headers. In
scope: crashes or exceptions on crafted `User-Agent` or `Sec-CH-UA-*` values,
excessive CPU or memory use (super-linear regular expressions, ways around the
input length cap), prototype pollution, and a DNS verification helper that
accepts a host it should reject. Wrong or outdated detections (a browser or
bot that is misidentified) are ordinary bugs, not security issues, unless they
make `verifyBotDns` report a spoofed crawler as verified.

## Disclaimer

This project is provided as is, without warranty. See [DISCLAIMER.md](./DISCLAIMER.md)
for the full disclaimer and limitation of liability.
