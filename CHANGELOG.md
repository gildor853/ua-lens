# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-10

- Parse User-Agent strings into browser, engine, OS, device and CPU fields, with optional User-Agent Client Hints.
- Treats Chromium reduced/frozen UA values as unknown instead of reporting them as facts.
- Recognises documented crawlers and AI bots (with citations) across multiple categories.
- Optional bot verification helpers (reverse DNS / IP ranges) using a caller-supplied resolver — the core never opens the network.
- Zero runtime dependencies; ESM and CJS builds with TypeScript types.

[Unreleased]: https://github.com/gildor853/ua-lens/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gildor853/ua-lens/releases/tag/v1.0.0
