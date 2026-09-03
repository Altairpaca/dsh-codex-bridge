# Security Policy

## Scope

`dsh-codex-bridge` sits near authentication and proxy configuration, so reports that could expose reusable credentials or account/session material should not be posted publicly with raw evidence.

## Never include in public issues or pull requests

- Codex / ChatGPT access or refresh tokens;
- `~/.codex/auth.json` contents;
- DSH credential files or copied bearer tokens;
- cookies, session identifiers, API keys, proxy passwords, or private endpoint credentials;
- unredacted home-directory paths, account identifiers, or private repository names when they are not necessary to reproduce the bug.

Use synthetic placeholders in examples and redact screenshots/logs before attaching them.

## Reporting

For ordinary bugs that contain no secret material, open a GitHub issue with:

- operating system and architecture;
- Codex and DSH versions;
- the command that failed;
- redacted `doctor` / status output;
- whether the failure occurs before or after official `codex login`.

For a vulnerability or a report that inherently requires sensitive evidence, contact the maintainer through the contact path on the academic site instead of publishing the secret material in an issue.

## Design expectations

Changes in this repository should preserve:

1. official Codex ownership of login and refresh;
2. fail-closed behavior for missing/expired auth where practical;
3. no persistence of reusable credentials in diagnostics or snapshots;
4. explicit redaction boundaries in tests and documentation.
