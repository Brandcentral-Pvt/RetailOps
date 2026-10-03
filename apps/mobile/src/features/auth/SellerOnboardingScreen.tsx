import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Button } from '../../components/ui/Button';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './AuthLayout';

type Slide = { title: string; body: string; marker: string };

const SLIDES: Slide[] = [
  {
    title: 'Your account, in your pocket',
    body: 'See how your products are performing and respond to anything your account team needs from you.',
    marker: '◌',
  },
  {
    title: 'Understand performance',
    body: 'Review sales, inventory and advertising performance for your own seller account in one place.',
    marker: '↗',
  },
  {
    title: 'What we need from you',
    body: 'Keep contact details current and respond to requests from your account team when action is needed.',
    marker: '✓',
  },
];

/** AUTH-10 — local, per-seller education shown once after the authoritative session is loaded. */
export function SellerOnboardingScreen() {
  const t = useTheme();
  const complete = useAuthStore((state) => state.completeSellerOnboarding);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const slide = SLIDES[page]!;
  const last = page === SLIDES.length - 1;

  const dismiss = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await complete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout title={slide.title} subtitle={slide.body}>
      <View style={{ gap: t.spacing.scale.xl }}>
        <Surface
          tone="surfaceContainerLow"
          radius="xl"
          accessibilityLabel="Seller onboarding illustration"
          style={{
            minHeight: t.component.chart.height,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.c.tertiaryContainer as string,
          }}
        >
          <Text role="displaySmall" color="onTertiaryContainer">{slide.marker}</Text>
        </Surface>
        <View accessibilityRole="adjustable" accessibilityLabel={`Onboarding page ${page + 1} of ${SLIDES.length}`} style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.scale.sm }}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={{
                width: index === page ? t.spacing.scale.xl : t.spacing.scale.sm,
                height: t.spacing.scale.sm,
                borderRadius: t.shape.full as number,
                backgroundColor: index === page ? t.c.tertiary as string : t.c.outlineVariant as string,
              }}
            />
          ))}
        </View>
        <Button
          label={saving ? 'Saving…' : last ? 'Get started' : 'Continue'}
          onPress={() => {
            if (last) void dismiss();
            else setPage((current) => current + 1);
          }}
          loading={saving}
          fullWidth
        />
        <Button label="Skip for now" onPress={() => void dismiss()} variant="text" disabled={saving} fullWidth />
      </View>
    </AuthLayout>
  );
}
