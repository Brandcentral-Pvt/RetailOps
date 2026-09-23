/** Password recovery entry point for the authentication flow. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BrandLogo from '../../components/BrandLogo';
import ScreenContainer from '../../components/ScreenContainer';
import { RADIUS, SPACING } from '../../theme/theme';
import { authService } from '../../services/authService';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailError = email.length > 0 && !/^\S+@\S+\.\S+$/.test(email);

  const submit = async () => {
    setMessage(null);
    setError(null);
    if (!email.trim() || emailError) {
      setError('Enter the email address associated with your RetailOps account.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.forgotPassword(email.trim().toLowerCase());
      setMessage(
        result.message ??
          'If an account exists for this email, password reset instructions have been sent.',
      );
    } catch {
      setError('We could not send a reset link. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.shell, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Button
            mode="text"
            compact
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to sign in"
            textColor={colors.onSurface}
          >
            Back
          </Button>
          <View style={styles.logoWrap}>
            <BrandLogo size={28} />
          </View>
        </View>

        <View style={styles.content}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text variant="headlineSmall" style={[styles.title, { color: colors.onSurface }]}>
              Reset your password
            </Text>
            <Text variant="bodyMedium" style={[styles.description, { color: colors.onSurfaceVariant }]}>
              Enter your account email and we will send a secure link to continue.
            </Text>

            <TextInput
              label="Account email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={{ borderRadius: RADIUS.md }}
              activeOutlineColor={colors.primary}
              error={!!emailError}
              disabled={isLoading}
              left={<TextInput.Icon icon="email-outline" color={colors.onSurfaceVariant} />}
            />
            {emailError ? (
              <HelperText type="error" padding="none" style={styles.helper}>
                Enter a valid email address.
              </HelperText>
            ) : null}

            {message ? (
              <View
                style={[styles.notice, { backgroundColor: colors.primaryContainer }]}
                accessibilityLiveRegion="polite"
              >
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.noticeText, { color: colors.primary }]}>{message}</Text>
              </View>
            ) : null}

            {error ? (
              <View
                style={[styles.notice, { backgroundColor: dark ? `${colors.error}26` : `${colors.error}14` }]}
                accessibilityRole="alert"
              >
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
                <Text style={[styles.noticeText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={submit}
              loading={isLoading}
              disabled={isLoading || !email.trim() || emailError}
              buttonColor={colors.primary}
              textColor={colors.onPrimary}
              contentStyle={styles.buttonContent}
              style={styles.button}
              accessibilityState={{ disabled: isLoading || !email.trim() || emailError }}
            >
              Send reset link
            </Button>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  logoWrap: { alignItems: 'center', marginTop: 12 },
  content: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: 'center' },
  card: { padding: SPACING.xxl, borderRadius: RADIUS.xxl, borderWidth: 1 },
  title: { fontWeight: '700' },
  description: { marginTop: 10, marginBottom: SPACING.xl, lineHeight: 23 },
  input: { fontSize: 16 },
  helper: { marginBottom: SPACING.sm },
  notice: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: RADIUS.md, marginBottom: 12 },
  noticeText: { flex: 1, marginLeft: 10, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  button: { borderRadius: RADIUS.md, minHeight: 52, marginTop: SPACING.sm },
  buttonContent: { paddingVertical: 6 },
});
