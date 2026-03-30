export const LIGHT_THEME = {
  background: '#f3f8f7',
  surface: '#ffffff',
  surfaceMuted: '#edf4f2',
  border: '#d7e2e0',
  text: '#102026',
  mutedText: '#5e7270',
  accent: '#0f8a63',
  accentSoft: '#dff4ec',
  danger: '#b14f63',
};

export const DARK_THEME = {
  background: '#07131f',
  surface: '#102026',
  surfaceMuted: '#142834',
  border: 'rgba(184, 202, 197, 0.18)',
  text: '#f3f8f7',
  mutedText: '#9eb2af',
  accent: '#18a877',
  accentSoft: 'rgba(24, 168, 119, 0.14)',
  danger: '#ff8a9d',
};

export type ClientificTheme = typeof LIGHT_THEME;

export function getClientificTheme(
  colorScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
) {
  return colorScheme === 'light' ? LIGHT_THEME : DARK_THEME;
}
