/**
 * RetailOps Mobile design system.
 *
 * The tokens below are intentionally semantic: screens should consume theme
 * colors rather than raw hex values so light, dark, and future brand themes
 * remain consistent across iOS, Android, tablet, and web.
 */
import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { Platform } from 'react-native';

export const PRIMITIVE_COLORS = {
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  cyan: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
  },
  violet: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#781C1C',
    950: '#450F0F',
  },
} as const;

export const COLORS = {
  primary: '#2563EB',
  primaryStrong: '#1D4ED8',
  primarySoft: '#EFF6FF',
  secondary: '#7C3AED',
  secondarySoft: '#F5F3FF',
  tertiary: '#0E7490',
  success: '#15803D',
  successSoft: '#F0FDF4',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  error: '#B91C1C',
  errorSoft: '#FEF2F2',
  info: '#0E7490',
  infoSoft: '#ECFEFF',
  ink: '#0F172A',
  inkMuted: '#475569',
  inkSubtle: '#64748B',
  canvas: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  outline: '#D7DEE8',
  outlineStrong: '#B8C4D4',
} as const;

export const DARK_COLORS = {
  primary: '#60A5FA',
  primaryStrong: '#93C5FD',
  primarySoft: '#172554',
  secondary: '#A78BFA',
  secondarySoft: '#2E1065',
  tertiary: '#67E8F9',
  success: '#4ADE80',
  successSoft: '#052E16',
  warning: '#FBBF24',
  warningSoft: '#451A03',
  error: '#FCA5A5',
  errorSoft: '#450A0A',
  info: '#67E8F9',
  infoSoft: '#164E63',
  ink: '#F8FAFC',
  inkMuted: '#CBD5E1',
  inkSubtle: '#94A3B8',
  canvas: '#07111F',
  surface: '#0E1626',
  surfaceMuted: '#172235',
  outline: '#334155',
  outlineStrong: '#475569',
} as const;

/** Spacing scale (4pt grid) used across screens. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 48,
} as const;

/** Border radius scale. */
export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
} as const;

/** Typography is deliberately neutral and readable at every supported size. */
const fontFamily = (Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) ?? 'System') as string;

const fontConfig = {
  fontFamily,
  fontSize: 16,
  fontWeight: '400' as const,
  lineHeight: 24,
};

const lightElevation = {
  level0: 'transparent',
  level1: '#FFFFFF',
  level2: '#F8FAFC',
  level3: '#F1F5F9',
  level4: '#E2E8F0',
  level5: '#CBD5E1',
};

const darkElevation = {
  level0: 'transparent',
  level1: '#111C30',
  level2: '#152238',
  level3: '#1A2942',
  level4: '#20314E',
  level5: '#273B5B',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: COLORS.primarySoft,
    onPrimaryContainer: COLORS.primaryStrong,
    secondary: COLORS.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: COLORS.secondarySoft,
    onSecondaryContainer: '#4C1D95',
    tertiary: COLORS.tertiary,
    onTertiary: '#FFFFFF',
    error: COLORS.error,
    onError: '#FFFFFF',
    errorContainer: COLORS.errorSoft,
    onErrorContainer: '#7F1D1D',
    background: COLORS.canvas,
    onBackground: COLORS.ink,
    surface: COLORS.surface,
    onSurface: COLORS.ink,
    surfaceVariant: COLORS.surfaceMuted,
    onSurfaceVariant: COLORS.inkMuted,
    outline: COLORS.outlineStrong,
    outlineVariant: COLORS.outline,
    backdrop: 'rgba(15, 23, 42, 0.36)',
    shadow: COLORS.ink,
    scrim: 'rgba(15, 23, 42, 0.36)',
    elevation: lightElevation,
    surfaceDisabled: COLORS.surfaceMuted,
    onSurfaceDisabled: COLORS.inkSubtle,
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: DARK_COLORS.primary,
    onPrimary: '#0B1E3F',
    primaryContainer: DARK_COLORS.primarySoft,
    onPrimaryContainer: DARK_COLORS.primaryStrong,
    secondary: DARK_COLORS.secondary,
    onSecondary: '#1E1B4B',
    secondaryContainer: DARK_COLORS.secondarySoft,
    onSecondaryContainer: '#EDE9FE',
    tertiary: DARK_COLORS.tertiary,
    onTertiary: '#164E63',
    error: DARK_COLORS.error,
    onError: '#450A0A',
    errorContainer: DARK_COLORS.errorSoft,
    onErrorContainer: '#7F1D1D',
    background: DARK_COLORS.canvas,
    onBackground: DARK_COLORS.ink,
    surface: DARK_COLORS.surface,
    onSurface: DARK_COLORS.ink,
    surfaceVariant: DARK_COLORS.surfaceMuted,
    onSurfaceVariant: DARK_COLORS.inkMuted,
    outline: DARK_COLORS.outlineStrong,
    outlineVariant: DARK_COLORS.outline,
    backdrop: 'rgba(2, 6, 23, 0.58)',
    shadow: '#000000',
    scrim: 'rgba(2, 6, 23, 0.58)',
    elevation: darkElevation,
    surfaceDisabled: DARK_COLORS.surfaceMuted,
    onSurfaceDisabled: DARK_COLORS.inkSubtle,
  },
};

/** Chart palette with distinct hues and dark-mode-safe values. */
export const CHART_PALETTE = [
  '#2563EB',
  '#0891B2',
  '#7C3AED',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#0F172A',
  '#64748B',
] as const;

/** Semantic aliases for module accents. */
export const MODULE_COLORS = {
  sellerOnboarding: COLORS.primary,
  catalogManagement: '#0891B2',
  inventoryPlanning: COLORS.warning,
  purchaseOrders: '#D97706',
  dailyOperations: COLORS.primaryStrong,
  orderManagement: COLORS.tertiary,
  advertisingManagement: COLORS.secondary,
  dealsManagement: '#A855F7',
  reviewsRatings: COLORS.secondary,
  listingHealth: COLORS.error,
  businessIntelligence: COLORS.tertiary,
  sellerSuccess: COLORS.success,
  growthPlanning: '#15803D',
  governance: COLORS.inkSubtle,
  kpiDashboard: COLORS.ink,
} as const;

export const PREMIUM_SHADOWS = {
  soft: {
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  raised: {
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
} as const;

export const TYPOGRAPHY = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const },
  headline: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;
