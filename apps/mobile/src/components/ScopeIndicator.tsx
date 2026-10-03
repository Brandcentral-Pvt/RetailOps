/**
 * ScopeIndicator — the seller switcher, which is a *scope* control, not a
 * filter.
 *
 * Design decision 05 + schema §10: the UI states its own scope so a user can
 * never misread "all sellers" data as "my sellers" data. Which options exist
 * is decided by scope mode, in src/auth/permissions.ts `scopeOffers`:
 *
 *   global   → "All sellers" + every seller
 *   assigned → assigned sellers only, no "All sellers"
 *   self     → pinned, no switcher at all
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../auth/authStore';
import { scopeOffers, type Session } from '../auth/permissions';
import { Text } from './ui/Text';
import { Chip } from './ui/Chip';

export function ScopeIndicator({
  sellers,
  selectedSellerId,
  onSelect,
}: {
  sellers: { id: string; name: string }[];
  selectedSellerId: string | null;
  onSelect: (sellerId: string | null) => void;
}) {
  const t = useTheme();
  const session = useAuthStore((s) => s.session) as Session | null;
  const [open, setOpen] = useState(false);

  if (!session) return null;
  const offers = scopeOffers(session, sellers);

  // Scope "self": pinned to one account. No control, but the scope is stated.
  if (!offers.canSwitch) {
    return <Chip label={`Own account · ${offers.sellers[0]?.name ?? '—'}`} tone="neutral" icon="◉" />;
  }

  const current =
    selectedSellerId === null
      ? { id: null, name: 'All sellers' }
      : offers.sellers.find((s) => s.id === selectedSellerId) ?? { id: null, name: 'All sellers' };

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Seller scope: ${current.name}`}
        accessibilityHint="Changes which seller accounts this screen shows"
        style={{
          flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.xs,
          backgroundColor: t.c.secondaryContainer as string,
          borderRadius: t.shape.full as number,
          paddingHorizontal: t.spacing.scale.md,
          paddingVertical: t.spacing.scale.xs,
          minHeight: 32,
        }}
      >
        <Text role="labelMedium" color="onSecondaryContainer">{current.name}</Text>
        <Text role="labelSmall" color="onSecondaryContainer">▾</Text>
      </Pressable>

      {open ? (
        <View
          style={{
            position: 'absolute', top: 40, left: 0, zIndex: 20, minWidth: 220,
            backgroundColor: t.c.surfaceContainerHigh as string,
            borderRadius: t.shape.md as number,
            padding: t.spacing.scale.xs,
            gap: 2,
          }}
        >
          {offers.canSelectAll ? (
            <ScopeOption
              label="All sellers"
              selected={selectedSellerId === null}
              onPress={() => { onSelect(null); setOpen(false); }}
            />
          ) : null}
          {offers.sellers.map((s) => (
            <ScopeOption
              key={s.id}
              label={s.name}
              selected={selectedSellerId === s.id}
              onPress={() => { onSelect(s.id); setOpen(false); }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ScopeOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.sm,
        paddingVertical: t.spacing.scale.sm, paddingHorizontal: t.spacing.scale.md,
        borderRadius: t.shape.sm as number, minHeight: 44,
        backgroundColor: selected ? t.c.secondaryContainer as string : 'transparent',
      }}
    >
      <Text role="labelLarge" color="onSurface" style={{ flex: 1 }}>{label}</Text>
      {selected ? <Text role="labelLarge" color="primary">✓</Text> : null}
    </Pressable>
  );
}
