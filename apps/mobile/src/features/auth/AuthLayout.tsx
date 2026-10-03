import React, { type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../components/ui/Text';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Shared unauthenticated shell. It intentionally does not use ScreenShell: an
 * auth screen has no Session yet, so it must never pass an authenticated gate. */
export function AuthLayout({ title, subtitle, children, footer, style }: Props) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.c.pageBackground as string }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: t.padding,
            paddingVertical: t.spacing.scale.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            accessibilityRole="summary"
            accessibilityLabel="RetailOps authentication"
            style={[
              {
                alignSelf: 'center',
                width: '100%',
                maxWidth: t.component.dialog.maxWidth,
                backgroundColor: t.c.surface as string,
                borderColor: t.c.outlineVariant as string,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: t.shape.xl as number,
                padding: t.spacing.scale.xxl,
                gap: t.spacing.scale.xl,
              },
              style,
            ]}
          >
            <View style={{ alignItems: 'center', gap: t.spacing.scale.md }}>
              <Image
                source={require('../../../assets/brandcentral-logo.png')}
                accessibilityLabel="BrandCentral"
                style={{ width: t.component.avatar.xl, height: t.component.avatar.xl, borderRadius: t.shape.md as number }}
                resizeMode="contain"
              />
              <View style={{ gap: t.spacing.scale.xs }}>
                <Text role="headlineSmall" center accessibilityRole="header">{title}</Text>
                <Text role="bodyMedium" color="onSurfaceVariant" center>{subtitle}</Text>
              </View>
            </View>
            {children}
            {footer ? <View style={{ alignItems: 'center' }}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
