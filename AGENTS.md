# Clientific Agent Defaults

For this repository, use this default release workflow without asking for confirmation:

1. Run `npm test`
2. Run `npx next build`
3. Commit code changes
4. Push to `origin/main`
5. Deploy with `npm run deploy:prod`

The production deploy is not complete until the deploy script aliases and verifies both
`clientific.app` and `www.clientific.app` against the new Vercel deployment.

If a step fails, fix forward and continue through the same flow.

## UI Theme Parity

Any user-facing UI work in this repository must ship with both light mode and dark mode support.
Audit both themes for every page and component you touch, including marketing heroes, public flows,
dashboard views, modals, and promotional cards.
