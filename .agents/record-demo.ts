import { brand } from './produce-demo.ts';

export const playwright = '.';
export const overlay = {
  accent: brand.colors.accentSoft,
  ring: brand.colors.accentSoft,
  scrim: 'rgba(10, 20, 12, .55)',
  captionBg: brand.colors.caption,
  captionFg: '#ffffff',
  callout: 'pin',
  calloutBg: '#ffffff',
  calloutFg: brand.colors.ink,
  calloutBorder: brand.colors.line,
};

// Public pages need no hook. Add real seeded-account sign-in here once auth exists.
