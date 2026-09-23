/**
 * Premium drawer shell for the authenticated RetailOps app.
 *
 * The navigation is intentionally data-oriented: the most important seller
 * signals live under Home, while catalog, operations, growth, business, and
 * account tools remain easy to scan on phones and spacious on tablets.
 *
 * UI/UX pass:
 *  - Live unread badges (messages + notifications) wired to stores.
 *  - Active-route indicator drawn as an absolutely-positioned rail, so the
 *    row never shifts bounds when it becomes active.
 *  - Softer icon treatment: no noisy surfaces on idle rows, cleanup on active.
 *  - Refined brand header and account footer with 4pt spacing rhythm.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {
  Icon,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import {
  Animated,
  StyleSheet,
  View,
} from 'react-native';

import DashboardScreen from '../screens/main/DashboardScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MessagesNavigator from './MessagesNavigator';
import CallsNavigator from './CallsNavigator';
import AsinsScreen from '../screens/main/AsinsScreen';
import AdsScreen from '../screens/main/AdsScreen';
import TasksScreen from '../screens/main/TasksScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import CallHistoryScreen from '../screens/calls/CallHistoryScreen';
import PlaceholderScreen from '../components/PlaceholderScreen';
import BrandLogo from '../components/BrandLogo';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

import type { MainDrawerParamList } from '../types';

const Drawer = createDrawerNavigator<MainDrawerParamList>();

/* ============================================================
   TYPES
============================================================ */

interface MenuItemConfig {
  label: string;
  icon: string;
  route: keyof MainDrawerParamList;
  hint?: string;
}

interface MenuSectionConfig {
  title: string;
  items: MenuItemConfig[];
}

/* ============================================================
   MENU MODEL — single source of truth for the drawer items
============================================================ */

const MENU_SECTIONS: MenuSectionConfig[] = [
  {
    title: 'HOME',
    items: [
      {
        label: 'Dashboard',
        icon: 'view-dashboard-outline',
        route: 'Dashboard',
        hint: 'Open your business overview',
      },
      {
        label: 'Messages',
        icon: 'chat-outline',
        route: 'Messages',
        hint: 'Open team and support conversations',
      },
      {
        label: 'Call History',
        icon: 'phone-log',
        route: 'CallHistory',
        hint: 'Review recent voice and video calls',
      },
      {
        label: 'Notifications',
        icon: 'bell-outline',
        route: 'Notifications',
        hint: 'Review alerts and actions',
      },
    ],
  },
  {
    title: 'CATALOG',
    items: [
      {
        label: 'Products',
        icon: 'package-variant-closed',
        route: 'Products',
        hint: 'Manage your product catalog',
      },
      {
        label: 'Listings',
        icon: 'file-document-edit-outline',
        route: 'Listings',
        hint: 'Manage marketplace listings',
      },
      {
        label: 'Inventory',
        icon: 'warehouse',
        route: 'Inventory',
        hint: 'Monitor inventory health',
      },
      {
        label: 'Pricing',
        icon: 'tag-outline',
        route: 'Pricing',
        hint: 'Review marketplace pricing',
      },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      {
        label: 'Orders',
        icon: 'shopping-outline',
        route: 'Orders',
        hint: 'Monitor orders and fulfilment',
      },
      {
        label: 'Tasks',
        icon: 'clipboard-check-outline',
        route: 'Tasks',
        hint: 'Review actions that need attention',
      },
      {
        label: 'Marketplaces',
        icon: 'storefront-outline',
        route: 'Marketplaces',
        hint: 'Review connected selling channels',
      },
    ],
  },
  {
    title: 'GROWTH',
    items: [
      {
        label: 'Advertising',
        icon: 'chart-line',
        route: 'Advertising',
        hint: 'Review advertising performance',
      },
      {
        label: 'Deals',
        icon: 'sale-outline',
        route: 'Deals',
        hint: 'Review marketplace deals',
      },
      {
        label: 'Performance',
        icon: 'chart-box-outline',
        route: 'Performance',
        hint: 'Review business performance',
      },
    ],
  },
  {
    title: 'BUSINESS',
    items: [
      {
        label: 'Reports',
        icon: 'file-chart-outline',
        route: 'Reports',
        hint: 'Access business reports',
      },
      {
        label: 'Support',
        icon: 'lifebuoy',
        route: 'Support',
        hint: 'Get help with RetailOps',
      },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      {
        label: 'Profile',
        icon: 'account-circle-outline',
        route: 'Profile',
        hint: 'Manage your business account',
      },
      {
        label: 'Settings',
        icon: 'cog-outline',
        route: 'Settings',
        hint: 'Manage app preferences',
      },
    ],
  },
];

/* ============================================================
   MAIN NAVIGATOR
============================================================ */

export default function MainNavigator() {
  const { colors } = useTheme();
  const { width, drawerWidth, drawerType } = useResponsiveLayout();

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => (
        <RetailOpsDrawerContent {...props} />
      )}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: colors.onSurface,
        headerTitleStyle: {
          fontSize: width >= 820 ? 19 : 17,
          fontWeight: '700',
        },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        drawerType,
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: colors.surface,
          borderRightColor: colors.outlineVariant,
          borderRightWidth: 1,
        },
        overlayColor: colors.backdrop,
        swipeEdgeWidth: 48,
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Drawer.Screen name="Messages" component={MessagesNavigator} options={{ title: 'Messages', headerShown: false }} />

      {/* Hidden route — the Calls stack is navigated to programmatically from
          the chat call buttons (never rendered as a drawer item). */}
      <Drawer.Screen
        name="Calls"
        component={CallsNavigator}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen name="CallHistory" component={CallHistoryScreen} options={{ title: 'Call History' }} />
      <Drawer.Screen name="Products" component={AsinsScreen} options={{ title: 'Products' }} />
      <Drawer.Screen name="Listings" component={PlaceholderScreen} initialParams={{ title: 'Listings', icon: 'file-document-edit-outline', description: 'Create, manage and optimize marketplace listings.' }} options={{ title: 'Listings' }} />
      <Drawer.Screen name="Inventory" component={PlaceholderScreen} initialParams={{ title: 'Inventory', icon: 'warehouse', description: 'Monitor stock levels, availability and inventory health.' }} options={{ title: 'Inventory' }} />
      <Drawer.Screen name="Pricing" component={PlaceholderScreen} initialParams={{ title: 'Pricing', icon: 'tag-outline', description: 'Monitor marketplace pricing and pricing issues.' }} options={{ title: 'Pricing' }} />
      <Drawer.Screen name="Orders" component={PlaceholderScreen} initialParams={{ title: 'Orders', icon: 'shopping-outline', description: 'Monitor orders, fulfilment and marketplace activity.' }} options={{ title: 'Orders' }} />
      <Drawer.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks' }} />
      <Drawer.Screen name="Marketplaces" component={PlaceholderScreen} initialParams={{ title: 'Marketplaces', icon: 'storefront-outline', description: 'Manage your connected marketplaces and selling channels.' }} options={{ title: 'Marketplaces' }} />
      <Drawer.Screen name="Advertising" component={AdsScreen} options={{ title: 'Advertising' }} />
      <Drawer.Screen name="Deals" component={PlaceholderScreen} initialParams={{ title: 'Deals', icon: 'sale-outline', description: 'Manage marketplace deals and promotional activity.' }} options={{ title: 'Deals' }} />
      <Drawer.Screen name="Performance" component={PlaceholderScreen} initialParams={{ title: 'Performance', icon: 'chart-box-outline', description: 'Review business and marketplace performance.' }} options={{ title: 'Performance' }} />
      <Drawer.Screen name="Reports" component={PlaceholderScreen} initialParams={{ title: 'Reports', icon: 'file-chart-outline', description: 'Access business reports and marketplace insights.' }} options={{ title: 'Reports' }} />
      <Drawer.Screen name="Support" component={PlaceholderScreen} initialParams={{ title: 'Support', icon: 'lifebuoy', description: 'Get help with your RetailOps account and marketplace operations.' }} options={{ title: 'Support' }} />
      <Drawer.Screen name="Settings" component={PlaceholderScreen} initialParams={{ title: 'Settings', icon: 'cog-outline', description: 'Manage your RetailOps preferences and account settings.' }} options={{ title: 'Settings' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Business Account' }} />
    </Drawer.Navigator>
  );
}

/* ============================================================
   CUSTOM DRAWER CONTENT
============================================================ */

function RetailOpsDrawerContent(
  props: DrawerContentComponentProps,
) {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const currentRoute = props.state.routes[props.state.index]?.name;

  const unreadMessages = useChatStore((s) => s.unreadTotal);
  const unreadNotifications = useNotificationStore((s) => s.unreadCount);

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.email?.split('@')[0] ||
    'RetailOps user';
  const role =
    user?.role?.displayName ||
    user?.role?.Name ||
    user?.role?.name ||
    'Seller';

  const badges = useMemo<Partial<Record<string, number>>>(
    () => ({
      Messages: unreadMessages > 0 ? unreadMessages : undefined,
      Notifications: unreadNotifications > 0 ? unreadNotifications : undefined,
    }),
    [unreadMessages, unreadNotifications],
  );

  const navigate = (
    routeName: keyof MainDrawerParamList,
  ) => {
    props.navigation.navigate(routeName);
  };

  return (
    <View
      style={[
        styles.drawer,
        {
          backgroundColor: colors.surface,
        },
      ]}
    >
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandSection}>
          <View style={styles.brandRow}>
            <BrandLogo size={30} />
            <View style={styles.brandText}>
              <Text style={[styles.brandName, { color: colors.onSurface }]}>
                RetailOps
              </Text>
              <Text style={[styles.brandSubtitle, { color: colors.onSurfaceVariant }]}>
                Sales operations
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.brandDivider,
              { backgroundColor: colors.outlineVariant },
            ]}
          />
        </View>

        <View style={styles.sections}>
          {MENU_SECTIONS.map((section) => (
            <DrawerSection
              key={section.title}
              title={section.title}
              currentRoute={currentRoute}
              items={section.items}
              badges={badges}
              navigate={navigate}
            />
          ))}
        </View>
      </DrawerContentScrollView>

      <TouchableRipple
        onPress={() => navigate('Profile')}
        accessibilityRole="button"
        accessibilityLabel={`Open profile for ${displayName}`}
        accessibilityHint="View and edit your business account"
        style={[
          styles.accountButton,
          { backgroundColor: colors.surfaceVariant },
        ]}
      >
        <View style={styles.accountContent}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <Text
              style={[styles.avatarText, { color: colors.onPrimaryContainer }]}
            >
              {getInitials(displayName)}
            </Text>
          </View>
          <View style={styles.accountText}>
            <Text numberOfLines={1} style={[styles.accountName, { color: colors.onSurface }]}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={[styles.accountType, { color: colors.onSurfaceVariant }]}>
              {role}
            </Text>
          </View>
          <Icon
            source="chevron-right"
            size={20}
            color={colors.onSurfaceVariant}
          />
        </View>
      </TouchableRipple>
    </View>
  );
}

function DrawerSection({
  title,
  currentRoute,
  items,
  badges,
  navigate,
}: {
  title: string;
  currentRoute?: string;
  items: MenuItemConfig[];
  badges: Partial<Record<string, number>>;
  navigate: (routeName: keyof MainDrawerParamList) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
        {title}
      </Text>
      {items.map((item) => {
        const active = currentRoute === item.route;
        const badge = badges[item.route];
        return (
          <DrawerMenuItem
            key={item.route}
            label={item.label}
            icon={item.icon}
            active={active}
            badge={badge}
            hint={item.hint}
            onPress={() => navigate(item.route)}
          />
        );
      })}
    </View>
  );
}

function DrawerMenuItem({
  label,
  icon,
  active,
  badge,
  hint,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
  hint?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 240 : 160,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  const idleColor = colors.onSurfaceVariant;
  const activeColor = colors.primary;

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint || `Open ${label}`}
      accessibilityState={{ selected: active }}
      rippleColor={colors.primaryContainer}
      style={styles.menuItem}
    >
      <React.Fragment>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.menuBackground,
            {
              backgroundColor: colors.primaryContainer,
              opacity: progress,
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.menuRail,
            {
              backgroundColor: activeColor,
              opacity: progress,
            },
          ]}
        />
        <View style={styles.menuItemContent}>
          <Animated.View
            style={[
              styles.menuIcon,
              {
                backgroundColor: colors.surfaceVariant,
                opacity: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.28, 1],
                }),
              },
            ]}
          >
            <Icon
              source={icon}
              size={20}
              color={active ? activeColor : idleColor}
            />
          </Animated.View>
          <Text
            numberOfLines={1}
            style={[
              styles.menuLabel,
              {
                color: active ? activeColor : colors.onSurface,
              },
            ]}
          >
            {label}
          </Text>
          {badge != null && badge > 0 ? (
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: active ? colors.primary : colors.surfaceVariant,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeLabel,
                  {
                    color: active ? colors.onPrimary : colors.onSurfaceVariant,
                  },
                ]}
              >
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          ) : null}
        </View>
      </React.Fragment>
    </TouchableRipple>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  brandSection: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    flex: 1,
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  brandDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
  },
  sections: {
    paddingTop: 6,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    paddingHorizontal: 22,
    marginBottom: 7,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  menuItem: {
    minHeight: 52,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  menuBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 14,
  },
  menuRail: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 1.5,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  badgePill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  accountButton: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  accountContent: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  accountText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  accountName: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  accountType: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
});