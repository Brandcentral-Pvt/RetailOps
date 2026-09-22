/**
 * RetailOps Mobile — React Native Paper Theme
 * Mirrors the web design tokens (src/theme/designTokens.js) so the Android/iOS app
 * shares a single visual identity with the dashboard.
 */
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { Platform } from 'react-native';

/** Brand palette — kept in sync with the web `designTokens.js`. */
export const COLORS = {
  primary: { light: '#42A5F5', main: '#1976D2', dark: '#1565C0' },
  secondary: { light: '#BA68C8', main: '#9C27B0', dark: '#7B1FA2' },
  success: { light: '#4CAF50', main: '#2E7D32', dark: '#1B5E20' },
  warning: { light: '#FF9800', main: '#ED6C02', dark: '#E65100' },
  error: { light: '#EF5350', main: '#D32F2F', dark: '#C62828' },
  info: { light: '#03A9F4', main: '#0288D1', dark: '#01579B' },
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    disabled: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  bg: {
    default: '#F8FAFC',
    paper: '#FFFFFF',
    sidebar: '#0F172A',
    hover: '#F1F5F9',
    selected: '#E3F2FD',
  },
  border: { light: '#E5E7EB', main: '#D1D5DB', dark: '#9CA3AF' },
} as const;

/** Chart palette for future chart components. */
export const CHART_PALETTE = [
  '#1976D2', '#42A5F5', '#0288D1', '#9C27B0', '#BA68C8',
  '#4CAF50', '#FF9800', '#D32F2F', '#64748B', '#0F172A',
] as const;

/** Spacing scale (4pt grid) used across screens. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Border radius scale. */
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24, // Added for larger cards/modals
  pill: 999,
} as const;

/** 
 * World-Class Typography Configuration
 * - Uses platform-specific system fonts for native feel.
 * - Tightens letter spacing (tracking) slightly for a premium, modern look.
 */
const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

// Configure fonts for all MD3 variants, not just displayLarge
const fontConfig = {
  fontFamily,
  // Apply global refinements to all text
  letterSpacing: -0.2, 
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  // Pass the config correctly to configureFonts
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary.main,
    onPrimary: '#FFFFFF',
    primaryContainer: COLORS.bg.selected,
    onPrimaryContainer: COLORS.primary.dark,
    secondary: COLORS.secondary.main,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F3E5F5',
    onSecondaryContainer: COLORS.secondary.dark,
    tertiary: COLORS.info.main,
    onTertiary: '#FFFFFF',
    error: COLORS.error.main,
    onError: '#FFFFFF',
    errorContainer: '#FDECEA',
    onErrorContainer: COLORS.error.dark,
    background: COLORS.bg.default,
    onBackground: COLORS.text.primary,
    surface: COLORS.bg.paper,
    onSurface: COLORS.text.primary,
    surfaceVariant: COLORS.bg.hover,
    onSurfaceVariant: COLORS.text.secondary,
    outline: COLORS.border.main,
    outlineVariant: COLORS.border.light,
    
    // Crucial for RN Paper v5+: Shadows use this color
    shadow: '#000000', 
    
     

    elevation: {
      level0: 'transparent',
      level1: COLORS.bg.paper,
      level2: '#F9FAFB',
      level3: '#F3F4F6',
      level4: '#EDEFF2',
      level5: '#E7EAEE',
    },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary.light,
    onPrimary: '#00203F',
    primaryContainer: COLORS.primary.dark,
    onPrimaryContainer: '#D6E9FF',
    secondary: COLORS.secondary.light,
    onSecondary: '#3A0B45',
    secondaryContainer: COLORS.secondary.dark,
    onSecondaryContainer: '#F3E5F5',
    tertiary: COLORS.info.light,
    onTertiary: '#00203F',
    error: COLORS.error.light,
    onError: '#3A0B45',
    errorContainer: COLORS.error.dark,
    onErrorContainer: '#FDECEA',
    background: '#0B1220',
    onBackground: '#E5E7EB',
    surface: '#111827',
    onSurface: '#E5E7EB',
    surfaceVariant: '#1F2937',
    onSurfaceVariant: '#9CA3AF',
    outline: '#374151',
    outlineVariant: '#1F2937',
    shadow: '#000000',
    
    
    elevation: {
      level0: 'transparent',
      level1: '#111827',
      level2: '#151E2E',
      level3: '#1A2436',
      level4: '#1E293D',
      level5: '#232F45',
    },
  },
};

/** Semantic aliases for module accents (used by card/badge components). */
export const MODULE_COLORS = {
  sellerOnboarding: '#1976D2',
  catalogManagement: '#42A5F5',
  inventoryPlanning: '#FF9800',
  purchaseOrders: '#ED6C02',
  dailyOperations: '#1565C0',
  orderManagement: '#0288D1',
  advertisingManagement: '#9C27B0',
  dealsManagement: '#BA68C8',
  reviewsRatings: '#7B1FA2',
  listingHealth: '#D32F2F',
  businessIntelligence: '#03A9F4',
  sellerSuccess: '#4CAF50',
  growthPlanning: '#2E7D32',
  governance: '#64748B',
  kpiDashboard: '#0F172A',
} as const;