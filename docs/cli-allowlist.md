# CLI Allowlist Inventory

Source of truth: `.claude/settings.local.json` `permissions.allow`.

This list is intentionally sanitized. It names allowed CLI/tools without repeating inline credential values that appear in some raw allowlist entries.

## Allowed CLIs/Tools

- `cat`
- `cmd`
- `curl`
- `echo`
- `find`
- `git`
- `grep`
- `ls`
- `node`
- `npm`
- `npx`
- `pip`
- `pip3`
- `powershell`
- `powershell.exe`
- `printf`
- `python`
- `python3`
- `source`
- `stripe`
- `taskkill`
- `twilio`
- `vapi`
- `vercel`
- `where`
- `winget`

## Web Capabilities In Allowlist

- `WebFetch` (domain-restricted entries are present in the source file)
- `WebSearch`

## Deployment-Critical CLIs

- `npm`
- `npx`
- `git`
- `vercel`
