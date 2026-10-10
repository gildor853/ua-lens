# uap-core test corpus

`corpus.json` holds every `user_agent_string` from `tests/test_ua.yaml`,
`tests/test_os.yaml` and `tests/test_device.yaml` of
[ua-parser/uap-core](https://github.com/ua-parser/uap-core) at commit
`73e7340c3ed8055051607b296bf46ead7aa5f19e` (retrieved 2026-10-10), with the
expected browser / OS / device family labels from those files. It is used for
robustness, performance and spot-check differential tests only.

Licensed under the Apache License 2.0 (see `LICENSE` in this directory).
