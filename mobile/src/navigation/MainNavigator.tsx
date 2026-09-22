/**
 * Drawer shell for the authenticated RetailOps app.
 *
 * Seller-facing navigation:
 * Home
 * Catalog
 * Operations
 * Growth
 * Business
 * Account
 */

import React from 'react';
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
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import DashboardScreen from '../screens/main/DashboardScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MessagesNavigator from './MessagesNavigator';
import AsinsScreen from '../screens/main/AsinsScreen';
import AdsScreen from '../screens/main/AdsScreen';
import TasksScreen from '../screens/main/TasksScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import PlaceholderScreen from '../components/PlaceholderScreen';
import BrandLogo from '../components/BrandLogo';

import type { MainDrawerParamList } from '../types';

const Drawer =
  createDrawerNavigator<MainDrawerParamList>();

/* ============================================================
   NAVIGATION CONFIGURATION
============================================================ */

interface MenuItemConfig {
  label: string;
  icon: string;
  route: keyof MainDrawerParamList;
}

interface MenuSectionConfig {
  title: string;
  items: MenuItemConfig[];
}

const MENU_SECTIONS: MenuSectionConfig[] = [
  {
    title: 'HOME',
    items: [
      {
        label: 'Dashboard',
        icon: 'view-dashboard-outline',
        route: 'Dashboard',
      },
      {
        label: 'Messages',
        icon: 'chat-outline',
        route: 'Messages',
      },
      {
        label: 'Notifications',
        icon: 'bell-outline',
        route: 'Notifications',
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
      },
      {
        label: 'Listings',
        icon: 'file-document-edit-outline',
        route: 'Listings',
      },
      {
        label: 'Inventory',
        icon: 'warehouse',
        route: 'Inventory',
      },
      {
        label: 'Pricing',
        icon: 'tag-outline',
        route: 'Pricing',
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
      },
      {
        label: 'Tasks',
        icon: 'clipboard-check-outline',
        route: 'Tasks',
      },
      {
        label: 'Marketplaces',
        icon: 'storefront-outline',
        route: 'Marketplaces',
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
      },
      {
        label: 'Deals',
        icon: 'sale-outline',
        route: 'Deals',
      },
      {
        label: 'Performance',
        icon: 'chart-box-outline',
        route: 'Performance',
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
      },
      {
        label: 'Support',
        icon: 'lifebuoy',
        route: 'Support',
      },
    ],
  },
];

/* ============================================================
   MAIN NAVIGATOR
============================================================ */

export default function MainNavigator() {
  const { width } = useWindowDimensions();

  /*
   * Keep the drawer comfortable on phones while preventing
   * excessively wide drawers on larger Android devices.
   */
  const drawerWidth = Math.min(
    360,
    Math.max(300, width * 0.84),
  );

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => (
        <RetailOpsDrawerContent {...props} />
      )}
      screenOptions={{
        headerShown: true,

        headerStyle: {
          backgroundColor: '#FFFFFF',
        },

        headerTintColor: '#111827',

        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '700',
        },

        headerTitleAlign: 'left',

        headerShadowVisible: false,

        drawerType: 'front',

        drawerStyle: {
          width: drawerWidth,
          backgroundColor: '#FFFFFF',
        },

        overlayColor: 'rgba(15, 23, 42, 0.30)',

        swipeEdgeWidth: 40,

        sceneStyle: {
          backgroundColor: '#F8FAFC',
        },
      }}
    >
      {/* ======================================================
          HOME
      ====================================================== */}

      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />

      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
        }}
      />

      <Drawer.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          title: 'Messages',
          headerShown: false,
        }}
      />

      {/* ======================================================
          CATALOG
      ====================================================== */}

      <Drawer.Screen
        name="Products"
        component={AsinsScreen}
        options={{
          title: 'Products',
        }}
      />

      <Drawer.Screen
        name="Listings"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Listings',
          icon: 'file-document-edit-outline',
          description:
            'Create, manage and optimize marketplace listings.',
        }}
        options={{
          title: 'Listings',
        }}
      />

      <Drawer.Screen
        name="Inventory"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Inventory',
          icon: 'warehouse',
          description:
            'Monitor stock levels, availability and inventory health.',
        }}
        options={{
          title: 'Inventory',
        }}
      />

      <Drawer.Screen
        name="Pricing"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Pricing',
          icon: 'tag-outline',
          description:
            'Monitor marketplace pricing and pricing issues.',
        }}
        options={{
          title: 'Pricing',
        }}
      />

      {/* ======================================================
          OPERATIONS
      ====================================================== */}

      <Drawer.Screen
        name="Orders"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Orders',
          icon: 'shopping-outline',
          description:
            'Monitor orders, fulfilment and marketplace activity.',
        }}
        options={{
          title: 'Orders',
        }}
      />

      <Drawer.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
        }}
      />

      <Drawer.Screen
        name="Marketplaces"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Marketplaces',
          icon: 'storefront-outline',
          description:
            'Manage your connected marketplaces and selling channels.',
        }}
        options={{
          title: 'Marketplaces',
        }}
      />

      {/* ======================================================
          GROWTH
      ====================================================== */}

      <Drawer.Screen
        name="Advertising"
        component={AdsScreen}
        options={{
          title: 'Advertising',
        }}
      />

      <Drawer.Screen
        name="Deals"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Deals',
          icon: 'sale-outline',
          description:
            'Manage marketplace deals and promotional activity.',
        }}
        options={{
          title: 'Deals',
        }}
      />

      <Drawer.Screen
        name="Performance"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Performance',
          icon: 'chart-box-outline',
          description:
            'Review business and marketplace performance.',
        }}
        options={{
          title: 'Performance',
        }}
      />

      {/* ======================================================
          BUSINESS
      ====================================================== */}

      <Drawer.Screen
        name="Reports"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Reports',
          icon: 'file-chart-outline',
          description:
            'Access business reports and marketplace insights.',
        }}
        options={{
          title: 'Reports',
        }}
      />

      <Drawer.Screen
        name="Support"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Support',
          icon: 'lifebuoy',
          description:
            'Get help with your RetailOps account and marketplace operations.',
        }}
        options={{
          title: 'Support',
        }}
      />

      {/* ======================================================
          ACCOUNT
      ====================================================== */}

      <Drawer.Screen
        name="Settings"
        component={PlaceholderScreen}
        initialParams={{
          title: 'Settings',
          icon: 'cog-outline',
          description:
            'Manage your RetailOps preferences and account settings.',
        }}
        options={{
          title: 'Settings',
        }}
      />

      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Business Account',
        }}
      />
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

  const currentRoute =
    props.state.routes[props.state.index]?.name;

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
      {/* ======================================================
          SCROLLABLE NAVIGATION
      ====================================================== */}

      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ====================================================
            BRAND HEADER
        ==================================================== */}

        <View
          style={[
            styles.brandSection,
            {
              borderBottomColor:
                colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.logoWrapper}>
            <BrandLogo size={52} />
          </View>

          <View style={styles.brandText}>
            <Text
              style={[
                styles.brandName,
                {
                  color: colors.onSurface,
                },
              ]}
            >
              BrandCentral
            </Text>

            <Text
              style={[
                styles.brandSubtitle,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              Seller Success Platform
            </Text>
          </View>
        </View>

        {/* ====================================================
            NAVIGATION SECTIONS
        ==================================================== */}

        {MENU_SECTIONS.map((section) => (
          <DrawerSection
            key={section.title}
            title={section.title}
          >
            {section.items.map((item) => (
              <DrawerMenuItem
                key={item.route}
                label={item.label}
                icon={item.icon}
                active={
                  currentRoute === item.route
                }
                onPress={() =>
                  navigate(item.route)
                }
              />
            ))}
          </DrawerSection>
        ))}

        {/* Extra bottom spacing so the last section does
            not touch the fixed footer. */}
        <View style={styles.bottomScrollSpace} />
      </DrawerContentScrollView>

      {/* ======================================================
          FIXED ACCOUNT FOOTER
      ====================================================== */}

      <View
        style={[
          styles.drawerFooter,
          {
            borderTopColor:
              colors.outlineVariant,
            backgroundColor:
              colors.surface,
          },
        ]}
      >
        <DrawerMenuItem
          label="Settings"
          icon="cog-outline"
          active={currentRoute === 'Settings'}
          onPress={() =>
            navigate('Settings')
          }
          footerItem
        />

        <TouchableRipple
          onPress={() =>
            navigate('Profile')
          }
          borderless
          rippleColor="rgba(25, 118, 210, 0.08)"
          style={styles.accountButton}
        >
          <View style={styles.accountContent}>
            {/* Avatar */}

            <View
              style={[
                styles.avatar,
                {
                  backgroundColor:
                    colors.primaryContainer,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color: colors.primary,
                  },
                ]}
              >
                J
              </Text>
            </View>

            {/* Account information */}

            <View style={styles.accountText}>
              <Text
                style={[
                  styles.accountName,
                  {
                    color:
                      colors.onSurface,
                  },
                ]}
                numberOfLines={1}
              >
                Jenil
              </Text>

              <Text
                style={[
                  styles.accountType,
                  {
                    color:
                      colors.onSurfaceVariant,
                  },
                ]}
                numberOfLines={1}
              >
                Business Account
              </Text>
            </View>

            <Icon
              source="chevron-right"
              size={21}
              color={
                colors.onSurfaceVariant
              }
            />
          </View>
        </TouchableRipple>
      </View>
    </View>
  );
}

/* ============================================================
   SECTION
============================================================ */

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.onSurfaceVariant,
          },
        ]}
      >
        {title}
      </Text>

      <View style={styles.sectionItems}>
        {children}
      </View>
    </View>
  );
}

/* ============================================================
   MENU ITEM
============================================================ */

function DrawerMenuItem({
  label,
  icon,
  active,
  onPress,
  footerItem = false,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
  footerItem?: boolean;
}) {
  const { colors } = useTheme();

  const foregroundColor = active
    ? colors.primary
    : colors.onSurface;

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      rippleColor="rgba(25, 118, 210, 0.08)"
      style={[
        styles.menuItem,
        footerItem && styles.footerMenuItem,
        active && {
          backgroundColor:
            colors.primaryContainer,
        },
      ]}
    >
      <View style={styles.menuItemContent}>
        <View
          style={[
            styles.menuIcon,
            active && styles.menuIconActive,
          ]}
        >
          <Icon
            source={icon}
            size={22}
            color={foregroundColor}
          />
        </View>

        <Text
          style={[
            styles.menuLabel,
            {
              color: foregroundColor,
            },
            active && styles.menuLabelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
  },

  /* ==========================================================
     SCROLL AREA
  ========================================================== */

  scrollContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },

  bottomScrollSpace: {
    height: 12,
  },

  /* ==========================================================
     BRAND
  ========================================================== */

  brandSection: {
    minHeight: 96,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,

    flexDirection: 'row',
    alignItems: 'center',

    borderBottomWidth: 1,
  },

  logoWrapper: {
    width: 54,
    height: 54,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 12,
  },

  brandText: {
    flex: 1,
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
  },

  brandSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
    fontWeight: '400',
  },

  /* ==========================================================
     SECTIONS
  ========================================================== */

  section: {
    marginTop: 21,
  },

  sectionTitle: {
    paddingHorizontal: 20,

    marginBottom: 8,

    fontSize: 11,
    lineHeight: 16,

    fontWeight: '600',
    letterSpacing: 0.75,
  },

  sectionItems: {
    paddingHorizontal: 10,
  },

  /* ==========================================================
     MENU ITEM
  ========================================================== */

  menuItem: {
    height: 48,

    borderRadius: 12,

    marginBottom: 3,

    overflow: 'hidden',
  },

  footerMenuItem: {
    marginHorizontal: 10,
    marginBottom: 5,
  },

  menuItemContent: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 14,
  },

  menuIcon: {
    width: 34,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 5,
  },

  menuIconActive: {
    transform: [
      {
        scale: 1.02,
      },
    ],
  },

  menuLabel: {
    flex: 1,

    fontSize: 15,
    lineHeight: 20,

    fontWeight: '500',

    letterSpacing: -0.1,
  },

  menuLabelActive: {
    fontWeight: '600',
  },

  /* ==========================================================
     FOOTER
  ========================================================== */

  drawerFooter: {
    borderTopWidth: 1,

    paddingTop: 8,
    paddingBottom: 8,
  },

  /* ==========================================================
     ACCOUNT
  ========================================================== */

  accountButton: {
    marginHorizontal: 10,

    borderRadius: 12,

    overflow: 'hidden',
  },

  accountContent: {
    minHeight: 60,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,
  },

  avatar: {
    width: 38,
    height: 38,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 11,
  },

  avatarText: {
    fontSize: 15,
    lineHeight: 20,

    fontWeight: '600',
  },

  accountText: {
    flex: 1,

    minWidth: 0,
  },

  accountName: {
    fontSize: 13,
    lineHeight: 18,

    fontWeight: '600',
  },

  accountType: {
    fontSize: 11,
    lineHeight: 16,

    marginTop: 1,
  },
});