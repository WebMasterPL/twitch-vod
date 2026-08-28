export const colors = {
  background: '#0E0E10',
  surface: '#18181B',
  surfaceHigh: '#1F1F23',
  border: '#2A2A30',
  text: '#EFEFF1',
  textMuted: '#ADADB8',
  accent: '#9147FF',
  accentPressed: '#772CE8',
  live: '#EB0400',
  danger: '#F5515F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

/** Powyzej tej szerokosci wchodzimy w uklad dwukolumnowy (iPad, Stage Manager). */
export const WIDE_LAYOUT_BREAKPOINT = 820;
