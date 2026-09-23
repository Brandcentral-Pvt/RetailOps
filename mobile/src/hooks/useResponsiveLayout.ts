import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  phone: 0,
  compactTablet: 600,
  tablet: 820,
  desktop: 1180,
} as const;

export type DeviceSize = 'phone' | 'tablet' | 'desktop';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const isCompactTablet = width >= BREAKPOINTS.compactTablet;
  const isLandscape = width > height;
  const size: DeviceSize = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'phone';

  return {
    width,
    height,
    size,
    isDesktop,
    isTablet,
    isCompactTablet,
    isLandscape,
    isPhone: size === 'phone',
    contentGutter: isDesktop ? 32 : isTablet ? 24 : 16,
    drawerWidth: isDesktop ? 400 : isTablet ? 360 : Math.min(320, Math.max(280, width * 0.86)),
    drawerType: isDesktop || isTablet ? 'permanent' : 'front',
  } as const;
}
