/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Source:    docs/design/mobile/02-design-tokens.json (version 1.0.0)
 * Generator: apps/mobile/scripts/gen-tokens.mjs
 *
 * To change a token, edit the design system file and run `npm run tokens`.
 * CI runs `npm run tokens:check` and fails if this file is stale.
 *
 * The consistency contract (docs/design/mobile/agents/02-consistency-contract.md)
 * forbids raw values in screen code. Everything visual resolves through here.
 */

export const TOKENS_SOURCE_VERSION = "1.0.0";

export const color = {
  light: {
    primary: "#1565C0",
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBDEFB",
    onPrimaryContainer: "#0A3A8A",
    primaryFixed: "#D6E9FF",
    primaryFixedDim: "#90CAF9",
    secondary: "#6D28D9",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#EDE9FE",
    onSecondaryContainer: "#4C1D95",
    tertiary: "#0E7490",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#CFFAFE",
    onTertiaryContainer: "#155E75",
    error: "#B91C1C",
    onError: "#FFFFFF",
    errorContainer: "#FEE2E2",
    onErrorContainer: "#7F1D1D",
    surface: "#FFFFFF",
    surfaceDim: "#EEF2F7",
    surfaceBright: "#FFFFFF",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFC",
    surfaceContainer: "#F1F5F9",
    surfaceContainerHigh: "#E9EEF4",
    surfaceContainerHighest: "#E2E8F0",
    onSurface: "#0F172A",
    onSurfaceVariant: "#475569",
    onSurfaceSubtle: "#64748B",
    outline: "#64748B",
    outlineVariant: "#E2E8F0",
    scrim: "#0F172A",
    shadow: "#0F172A",
    inverseSurface: "#1E293B",
    inverseOnSurface: "#F1F5F9",
    inversePrimary: "#90CAF9",
    surfaceTint: "#1976D2",
    pageBackground: "#F5F7FB",
  },
  dark: {
    primary: "#90CAF9",
    onPrimary: "#072D6E",
    primaryContainer: "#0D47A1",
    onPrimaryContainer: "#D6E9FF",
    primaryFixed: "#D6E9FF",
    primaryFixedDim: "#90CAF9",
    secondary: "#C4B5FD",
    onSecondary: "#2E1065",
    secondaryContainer: "#4C1D95",
    onSecondaryContainer: "#EDE9FE",
    tertiary: "#67E8F9",
    onTertiary: "#164E63",
    tertiaryContainer: "#155E75",
    onTertiaryContainer: "#CFFAFE",
    error: "#FCA5A5",
    onError: "#450A0A",
    errorContainer: "#7F1D1D",
    onErrorContainer: "#FEE2E2",
    surface: "#0E1626",
    surfaceDim: "#0A1120",
    surfaceBright: "#1E2B42",
    surfaceContainerLowest: "#07111F",
    surfaceContainerLow: "#0B1420",
    surfaceContainer: "#111C30",
    surfaceContainerHigh: "#152238",
    surfaceContainerHighest: "#1A2942",
    onSurface: "#F8FAFC",
    onSurfaceVariant: "#CBD5E1",
    onSurfaceSubtle: "#94A3B8",
    outline: "#64748B",
    outlineVariant: "#334155",
    scrim: "#020617",
    shadow: "#000000",
    inverseSurface: "#E2E8F0",
    inverseOnSurface: "#1E293B",
    inversePrimary: "#1565C0",
    surfaceTint: "#90CAF9",
    pageBackground: "#07111F",
  },
} as const;

export const surfaceAccent = {
  internal: {
    accent: "@color.light.primary",
    container: "@color.light.primaryContainer",
    onContainer: "@color.light.onPrimaryContainer",
    darkAccent: "@color.dark.primary",
    darkContainer: "@color.dark.primaryContainer",
    darkOnContainer: "@color.dark.onPrimaryContainer",
    label: "RetailOps",
  },
  seller: {
    accent: "@color.light.tertiary",
    container: "@color.light.tertiaryContainer",
    onContainer: "@color.light.onTertiaryContainer",
    darkAccent: "@color.dark.tertiary",
    darkContainer: "@color.dark.tertiaryContainer",
    darkOnContainer: "@color.dark.onTertiaryContainer",
    label: "Seller workspace",
  },
} as const;

export const typography = {
  family: {
    brand: "Roboto",
    numeric: "Roboto",
    fallback: "system-ui, sans-serif",
  },
  scale: {
    displayLarge: {
      size: 57,
      lineHeight: 64,
      weight: 400,
      tracking: -0.25,
    },
    displayMedium: {
      size: 45,
      lineHeight: 52,
      weight: 400,
      tracking: 0,
    },
    displaySmall: {
      size: 36,
      lineHeight: 44,
      weight: 400,
      tracking: 0,
    },
    headlineLarge: {
      size: 32,
      lineHeight: 40,
      weight: 400,
      tracking: 0,
    },
    headlineMedium: {
      size: 28,
      lineHeight: 36,
      weight: 400,
      tracking: 0,
    },
    headlineSmall: {
      size: 24,
      lineHeight: 32,
      weight: 400,
      tracking: 0,
    },
    titleLarge: {
      size: 22,
      lineHeight: 28,
      weight: 400,
      tracking: 0,
    },
    titleMedium: {
      size: 16,
      lineHeight: 24,
      weight: 500,
      tracking: 0.15,
    },
    titleSmall: {
      size: 14,
      lineHeight: 20,
      weight: 500,
      tracking: 0.1,
    },
    bodyLarge: {
      size: 16,
      lineHeight: 24,
      weight: 400,
      tracking: 0.5,
    },
    bodyMedium: {
      size: 14,
      lineHeight: 20,
      weight: 400,
      tracking: 0.25,
    },
    bodySmall: {
      size: 12,
      lineHeight: 16,
      weight: 400,
      tracking: 0.4,
    },
    labelLarge: {
      size: 14,
      lineHeight: 20,
      weight: 500,
      tracking: 0.1,
    },
    labelMedium: {
      size: 12,
      lineHeight: 16,
      weight: 500,
      tracking: 0.5,
    },
    labelSmall: {
      size: 11,
      lineHeight: 16,
      weight: 500,
      tracking: 0.5,
    },
  },
  usage: {
    screenTitle: "titleLarge",
    sectionHeader: "titleMedium",
    cardTitle: "titleSmall",
    kpiValueLarge: "headlineSmall",
    kpiValueCompact: "titleLarge",
    rowPrimary: "bodyLarge",
    rowSecondary: "bodySmall",
    bodyCopy: "bodyMedium",
    chip: "labelMedium",
    buttonLabel: "labelLarge",
    badge: "labelSmall",
    tableHeavy: "labelSmall",
  },
  numericRoles: {
    metricLarge: {
      size: 28,
      lineHeight: 34,
      weight: 500,
      figures: "tabular",
    },
    metricMedium: {
      size: 20,
      lineHeight: 26,
      weight: 500,
      figures: "tabular",
    },
    metricInline: {
      size: 14,
      lineHeight: 20,
      weight: 400,
      figures: "tabular",
    },
    metricTable: {
      size: 13,
      lineHeight: 18,
      weight: 400,
      figures: "tabular",
    },
  },
  scaleBehaviour: {
    minLabelSize: 12,
    minBodySize: 14,
    maxSupportedFontScale: 2,
    overflowRule: "Grids reflow to fewer columns at high font scale; KPI grids collapse to 1 column. Text is never truncated for a metric value — it wraps or the layout changes.",
  },
} as const;

export const shape = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 999,
} as const;

export const spacing = {
  grid: 4,
  scale: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
    xhuge: 48,
  },
  screenPadding: {
    compact: 16,
    medium: 24,
    expanded: 32,
  },
  gutter: {
    compact: 12,
    medium: 16,
    expanded: 24,
  },
  contentMaxWidth: {
    compact: 0,
    medium: 720,
    expanded: 1200,
  },
  sectionGap: 24,
  listRow: {
    oneLine: 56,
    twoLine: 72,
    threeLine: 88,
    compact: 44,
  },
} as const;

export const component = {
  appBar: {
    height: 64,
    heightWithSubtitle: 76,
    smallHeight: 56,
  },
  navigationBar: {
    height: 64,
    iconSize: 24,
    labelStyle: "labelMedium",
    maxSlots: 5,
  },
  navigationRail: {
    width: 80,
    itemHeight: 56,
    iconSize: 24,
  },
  navigationDrawer: {
    width: 320,
    itemHeight: 56,
  },
  button: {
    height: 40,
    largeHeight: 48,
    minWidth: 88,
    iconSize: 18,
    radius: "shape.full",
    touchTarget: 48,
  },
  fab: {
    size: 56,
    smallSize: 40,
    iconSize: 24,
    radius: "shape.lg",
  },
  iconButton: {
    touchTarget: 48,
    iconSize: 24,
    visualSize: 40,
  },
  chip: {
    height: 32,
    radius: "shape.sm",
    iconSize: 18,
    minTap: 48,
  },
  textField: {
    filledHeight: 56,
    outlinedHeight: 56,
    labelStyle: "bodySmall",
    assistStyle: "bodySmall",
  },
  card: {
    radius: "shape.md",
    padding: 16,
    gap: 12,
    minHeight: 88,
    listCardMinHeight: 96,
  },
  kpiCard: {
    minHeight: 104,
    padding: 16,
    valueStyle: "numericRoles.metricLarge",
    deltaStyle: "labelLarge",
    columns: {
      compact: 2,
      medium: 3,
      expanded: 4,
    },
  },
  metricRow: {
    height: 44,
    labelWidth: 140,
  },
  bottomSheet: {
    radius: "shape.xl",
    maxHeightFraction: 0.9,
    handleWidth: 32,
    handleHeight: 4,
  },
  dialog: {
    radius: "shape.xl",
    maxWidth: 420,
    padding: 24,
    actionsGap: 8,
  },
  snackbar: {
    radius: "shape.xs",
    maxWidth: 480,
    durationMs: 4000,
  },
  segmentedButton: {
    height: 40,
    radius: "shape.full",
  },
  searchBar: {
    height: 56,
    radius: "shape.full",
  },
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  },
  statusChip: {
    height: 24,
    radius: "shape.xs",
    iconSize: 14,
    labelStyle: "labelSmall",
  },
  sparkline: {
    height: 32,
    strokeWidth: 2,
    compactHeight: 24,
  },
  chart: {
    height: 220,
    expandedHeight: 280,
    gridlineOpacity: 0.12,
    axisLabelStyle: "labelSmall",
  },
  skeleton: {
    radius: "shape.sm",
    shimmerMs: 1400,
    lineHeight: 12,
    blockHeight: 72,
  },
} as const;

export const motion = {
  duration: {
    short1: 50,
    short2: 100,
    short3: 150,
    short4: 200,
    medium1: 250,
    medium2: 300,
    medium3: 350,
    medium4: 400,
    long1: 450,
    long2: 500,
    long3: 550,
    long4: 600,
    shimmer: 1400,
    stagger: 30,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    standardAccelerate: "cubic-bezier(0.3, 0, 1, 1)",
    standardDecelerate: "cubic-bezier(0, 0, 0, 1)",
    emphasized: "cubic-bezier(0.2, 0, 0, 1)",
    emphasizedAccelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)",
    emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)",
    linear: "linear",
  },
  semantics: {
    tap: {
      duration: "short2",
      easing: "standard",
    },
    stateChange: {
      duration: "short3",
      easing: "standard",
    },
    screenPush: {
      duration: "medium3",
      easing: "emphasized",
    },
    sheetEnter: {
      duration: "medium2",
      easing: "emphasizedDecelerate",
    },
    sheetExit: {
      duration: "short4",
      easing: "emphasizedAccelerate",
    },
    dialogEnter: {
      duration: "short3",
      easing: "emphasizedDecelerate",
    },
    valueChange: {
      duration: "medium2",
      easing: "standard",
    },
    skeleton: {
      duration: "shimmer",
      easing: "linear",
    },
    pullToRefresh: {
      duration: "medium1",
      easing: "standard",
    },
  },
  rules: {
    maxDuration: 600,
    reduceMotion: "When the OS requests reduced motion: replace transitions with <=100 ms opacity cross-fades, disable shimmer (static placeholder), disable shared-axis and stagger.",
    haptics: {
      light: ["selection change", "pull-to-refresh trigger", "chip toggle"],
      medium: ["hold-to-confirm complete", "task status committed", "payment-adjacent confirm"],
      disabled: ["scroll", "list load", "navigation", "background sync"],
    },
  },
} as const;

export const domain = {
  status: {
    success: {
      fg: "#15803D",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      icon: "checkmark-circle",
      darkFg: "#4ADE80",
      darkBg: "#052E16",
      darkBorder: "#166534",
    },
    warning: {
      fg: "#B45309",
      bg: "#FFFBEB",
      border: "#FDE68A",
      icon: "warning",
      darkFg: "#FBBF24",
      darkBg: "#451A03",
      darkBorder: "#92400E",
    },
    danger: {
      fg: "#B91C1C",
      bg: "#FEF2F2",
      border: "#FECACA",
      icon: "error-circle",
      darkFg: "#FCA5A5",
      darkBg: "#450A0A",
      darkBorder: "#991B1B",
    },
    info: {
      fg: "#0E7490",
      bg: "#ECFEFF",
      border: "#A5F3FC",
      icon: "info",
      darkFg: "#67E8F9",
      darkBg: "#164E63",
      darkBorder: "#155E75",
    },
    neutral: {
      fg: "#475569",
      bg: "#F1F5F9",
      border: "#E2E8F0",
      icon: "circle",
      darkFg: "#CBD5E1",
      darkBg: "#1A2942",
      darkBorder: "#334155",
    },
    brand: {
      fg: "#1565C0",
      bg: "#E3F2FD",
      border: "#BBDEFB",
      icon: "star",
      darkFg: "#90CAF9",
      darkBg: "#0D47A1",
      darkBorder: "#1565C0",
    },
  },
  sla: {
    onTrack: {
      status: "success",
      label: "On track",
      icon: "clock",
      countdownFrom: "warningHours",
      darkOverride: null,
    },
    atRisk: {
      status: "warning",
      label: "At risk",
      icon: "clock-alert",
    },
    dueSoon: {
      status: "warning",
      label: "Due soon",
      icon: "clock-alert",
    },
    breached: {
      status: "danger",
      label: "Overdue",
      icon: "alert",
    },
    paused: {
      status: "neutral",
      label: "Paused",
      icon: "pause",
    },
    completed: {
      status: "success",
      label: "Done",
      icon: "checkmark",
    },
    thresholds: {
      breached: "remaining <= 0",
      atRisk: "remaining <= 12h",
      dueSoon: "remaining <= 24h",
    },
    sellerLabelOverride: {
      breached: "Overdue",
      atRisk: "Due soon",
    },
  },
  delta: {
    good: {
      fg: "#15803D",
      icon: "arrow-up",
      darkFg: "#4ADE80",
    },
    bad: {
      fg: "#B91C1C",
      icon: "arrow-down",
      darkFg: "#FCA5A5",
    },
    flat: {
      fg: "#64748B",
      icon: "arrow-right",
      darkFg: "#94A3B8",
    },
    polarity: {
      revenue: "up-is-good",
      units: "up-is-good",
      gms: "up-is-good",
      roas: "up-is-good",
      ctr: "up-is-good",
      conversion: "up-is-good",
      rating: "up-is-good",
      bsr: "down-is-good",
      rank: "down-is-good",
      acos: "down-is-good",
      spend: "neutral",
      tacos: "down-is-good",
      returns: "down-is-good",
      slaRemaining: "up-is-good",
    },
    flatThresholdPct: 0.5,
  },
  freshness: {
    freshLabel: null,
    agedChip: {
      status: "neutral",
      icon: "history",
      textPattern: "Updated {relative}",
    },
    staleChip: {
      status: "warning",
      icon: "cloud-off",
      textPattern: "Synced {relative}",
    },
    syncing: {
      status: "brand",
      icon: "sync",
      textPattern: "Refreshing…",
    },
    failed: {
      status: "danger",
      icon: "cloud-off",
      textPattern: "Refresh failed",
    },
    partial: {
      status: "warning",
      icon: "alert",
      textPattern: "Partial data",
    },
    thresholds: {
      asinPriceBsr: "6h",
      ads: "24h",
      sales: "24h",
      inventory: "24h",
      tasks: "live",
      chat: "live",
    },
    staleOpacity: 0.6,
  },
  marketplace: {
    amazon: {
      fg: "#232F3E",
      accent: "#FF9900",
      label: "Amazon",
    },
    ajio: {
      fg: "#2E2E2E",
      accent: "#D42127",
      label: "Ajio",
    },
    flipkart: {
      fg: "#172337",
      accent: "#F7C948",
      label: "Flipkart",
    },
    unknown: {
      fg: "#64748B",
      accent: "#94A3B8",
      label: "Marketplace",
    },
  },
  role: {
    super_admin: {
      color: "#DC2626",
      label: "Super Admin",
    },
    admin: {
      color: "#EF4444",
      label: "Admin",
    },
    operational_manager: {
      color: "#8B5CF6",
      label: "Operational Manager",
    },
    brand_manager: {
      color: "#3B82F6",
      label: "Brand Manager",
    },
    catalog_manager: {
      color: "#DB2777",
      label: "Catalog Manager",
    },
    listing_team: {
      color: "#10B981",
      label: "Listing Team",
    },
    reviewer: {
      color: "#0891B2",
      label: "Reviewer",
    },
    viewer: {
      color: "#6B7280",
      label: "Viewer",
    },
    seller_client: {
      color: "#0E7490",
      label: "Seller",
    },
  },
  chart: {
    categorical: ["#1976D2", "#0E7490", "#7C3AED", "#16A34A", "#F59E0B", "#DB2777", "#4F46E5", "#64748B"],
    sequentialBlue: ["#E3F2FD", "#BBDEFB", "#90CAF9", "#64B5F6", "#42A5F5", "#1976D2", "#1565C0", "#0D47A1"],
    diverging: ["#B91C1C", "#FCA5A5", "#E2E8F0", "#93C5FD", "#1D4ED8"],
    positive: "#15803D",
    negative: "#B91C1C",
    neutral: "#94A3B8",
    gridline: "#E2E8F0",
    gridlineDark: "#334155",
    rules: {
      maxSeriesDefault: 5,
      legendRequiredAbove: 1,
      tableAlternativeRequired: true,
      neverRelyOnColourAlone: true,
      categoryLabelTruncation: "Middle-ellipsis on SKU/ASIN; never on axis labels — rotate instead",
    },
  },
  entityIcon: {
    asin: "tag",
    parentAsin: "collection",
    sku: "barcode",
    seller: "store",
    task: "checkbox",
    alert: "alert",
    campaign: "megaphone",
    keyword: "search",
    conversation: "chat",
    call: "call",
    report: "document",
    user: "person",
    team: "people",
  },
} as const;

export const a11y = {
  contrast: {
    bodyText: 4.5,
    largeText: 3,
    uiComponent: 3,
    focusIndicator: 3,
  },
  touchTarget: 48,
  touchSpacing: 8,
  focusIndicator: {
    width: 2,
    offset: 2,
    color: "@color.light.primary",
  },
  fontScale: {
    min: 1,
    max: 2,
    reflowAt: 1.3,
  },
  announcements: {
    listItem: "{index} of {total}, {title}, {subtitle}",
    metric: "{label}, {value}, {delta} versus previous period",
    statusChange: "{entity} is now {status}",
    syncComplete: "Data refreshed",
  },
  reduceMotionHonoured: true,
  chartsNeedTextAlternative: true,
} as const;

export const localization = {
  default: "en-IN",
  supported: ["en-IN"],
  planned: ["hi-IN", "gu-IN"],
  timezone: "Asia/Kolkata",
  numberSystem: "latin",
  grouping: "indian",
  currency: "INR",
  rules: {
    noStringConcatenation: true,
    expandForLength: "+40%",
    rtl: "not planned",
  },
} as const;

export type ColorScheme = keyof typeof color;
export type ColorSchemeName = 'light' | 'dark';
