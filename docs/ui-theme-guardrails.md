# UI Theme Guardrails

These are non-negotiable product rules for theme behavior.

1. Keep all three theme modes available: `light`, `dark`, and `system`.
2. Keep global theme control through `next-themes` in `src/components/providers/ThemeProvider.tsx`.
3. Do not force theme classes in route layouts (for example, adding/removing `dark` on `document.documentElement`).
4. Keep the theme toggle visible in dashboard navigation/settings flows.
5. Any theme behavior change must keep mode cycling and persistence intact.
