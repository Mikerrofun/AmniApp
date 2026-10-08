// Central theme tokens. Keep colors here so screens stay consistent
// and a future design pass only touches this file.

export const theme = {
  colors: {
    primary: '#2563eb',
    primaryActive: '#1d4ed8',
    background: {
      light: '#ffffff',
      dark: '#0a0a0a',
    },
    text: {
      light: '#171717',
      dark: '#fafafa',
    },
    muted: {
      light: '#737373',
      dark: '#a3a3a3',
    },
  },
  radius: {
    md: 12,
    lg: 16,
    xl: 20,
  },
} as const;

// SwitchGlobal / bottom navigation palette (docs/plans/switcher-global-ui.md §2).
// Mirrors the tokens in tailwind.config.js.
export const switcherPalette = {
  background: '#141416',
  card: '#1C1C1F',
  accent: '#C63B3B',
  accentSoft: '#A02F2F',
  textPrimary: '#EDEDEF',
  textMuted: '#8A8A90',
} as const;

export type Theme = typeof theme;
