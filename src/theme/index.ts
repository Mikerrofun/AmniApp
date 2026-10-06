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

export type Theme = typeof theme;
