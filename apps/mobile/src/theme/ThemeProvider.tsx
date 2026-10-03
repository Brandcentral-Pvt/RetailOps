/**
 * ThemeProvider — the only way a screen may read a colour, size or duration.
 *
 * Contract rule: screen code never writes a raw hex, px, or ms value. It reads
 * from `useTheme()`. See docs/design/mobile/agents/02-consistency-contract.md.
 */
import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import {
  color as colorTokens,
  shape as shapeTokens,
  spacing as spacingTokens,
  typography as typeTokens,
  motion as motionTokens,
  a11y as a11yTokens,
  domain as domainTokens,
} from './tokens.generated';

export type ColorSchemeName = 'light' | 'dark';

/** The light palette's shape, widened so the dark palette fits it too. */
export type ColorRoles = { readonly [K in keyof (typeof colorTokens)['light']]: string };

export type Theme = {
  scheme: ColorSchemeName;
  /** M3 colour roles for the active scheme. */
  c: ColorRoles;
  shape: typeof shapeTokens;
  spacing: typeof spacingTokens;
  type: typeof typeTokens;
  motion: typeof motionTokens;
  a11y: typeof a11yTokens;
  domain: typeof domainTokens;
  /** Screen gutter for the active width class. */
  padding: number;
  layout: 'compact' | 'medium' | 'expanded';
};

const ThemeContext = createContext<Theme | null>(null);
const ThemeToggleContext = createContext<() => void>(() => {});

function buildTheme(scheme: ColorSchemeName, width: number): Theme {
  const layout: Theme['layout'] = width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
  return {
    scheme,
    c: colorTokens[scheme] as unknown as ColorRoles,
    shape: shapeTokens,
    spacing: spacingTokens,
    type: typeTokens,
    motion: motionTokens,
    a11y: a11yTokens,
    domain: domainTokens,
    layout,
    padding: spacingTokens.screenPadding[layout],
  };
}

export function ThemeProvider({
  children,
  width,
  override,
}: {
  children: React.ReactNode;
  width: number;
  /** Test/Storybook override. Omit in the app. */
  override?: ColorSchemeName;
}) {
  const system = useColorScheme();
  const [scheme, setScheme] = useState<ColorSchemeName>(override ?? (system === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    if (override) return;
    setScheme(system === 'dark' ? 'dark' : 'light');
  }, [system, override]);

  const toggle = useCallback(() => setScheme((s) => (s === 'light' ? 'dark' : 'light')), []);

  const theme = useMemo(() => buildTheme(scheme, width), [scheme, width]);

  return (
    <ThemeContext.Provider value={theme}>
      <ThemeToggleContext.Provider value={toggle}>{children}</ThemeToggleContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

export function useToggleTheme(): () => void {
  return useContext(ThemeToggleContext);
}
