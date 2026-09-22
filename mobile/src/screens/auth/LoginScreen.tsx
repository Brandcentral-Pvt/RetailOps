/** Step 1 of the auth flow: email + password. */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Button, Text, TextInput, useTheme, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { APP_CONFIG } from '../../config/env';
import { SPACING, RADIUS } from '../../theme/theme';
import BrandLogo from '../../components/BrandLogo';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const emailError = email.length > 0 && !/^\S+@\S+\.\S+$/.test(email);
  const isFormValid = email.trim().length > 0 && !emailError && password.length > 0;

  const onSubmit = async () => {
    Keyboard.dismiss();
    setLocalError(null);

    if (!email.trim() || !password) {
      setLocalError('Please enter both your email and password.');
      return;
    }
    if (emailError) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    const result = await login(email.trim().toLowerCase(), password);

    if (!result.success) {
      setLocalError(result.message ?? 'Invalid email or password. Please try again.');
      return;
    }

    if (result.requiresOtp && result.tempToken) {
      navigation.navigate('Otp', {
        tempToken: result.tempToken,
        destination: result.destination,
      });
    }
  };

  /** Submit on hardware/keyboard "Enter". */
  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter') onSubmit();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        {/* ── Ambient background depth (two soft brand blobs) ───────────── */}
        <View pointerEvents="none" style={styles.bgLayer}>
          <View
            style={[
              styles.blob,
              styles.blobTop,
              { backgroundColor: colors.primary, opacity: dark ? 0.1 : 0.05 },
            ]}
          />
          <View
            style={[
              styles.blob,
              styles.blobBottom,
              { backgroundColor: colors.secondary, opacity: dark ? 0.07 : 0.035 },
            ]}
          />
        </View>

        <View style={[styles.container, { paddingTop: insets.top + SPACING.xl }]}>
          {/* ── Brand hero: wordmark at full presence + soft glow ───────── */}
          <View style={styles.brand}>
  <View style={styles.logoWrap}>
    <View
      pointerEvents="none"
      style={styles.logoGlow}
    />

    <BrandLogo size={180} />
  </View>

  <View style={styles.brandText}>
    <Text
      variant="headlineMedium"
      style={[styles.title, { color: colors.onSurface }]}
    >
      Sign in to your account
    </Text>

    <Text
      variant="bodyLarge"
      style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
    >
      Continue to your RetailOps operations workspace.
    </Text>
  </View>
</View>

          {/* ── Form ────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.form}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              onKeyPress={handleKeyPress}
              mode="outlined"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={{ borderRadius: RADIUS.md }}
              error={!!emailError}
              disabled={isLoggingIn}
              left={<TextInput.Icon icon="email-outline" color={colors.onSurfaceVariant} />}
              right={
                email.length > 0 ? (
                  <TextInput.Icon
                    icon="close-circle"
                    color={colors.onSurfaceVariant}
                    onPress={() => setEmail('')}
                    forceTextInputFocus={false}
                  />
                ) : undefined
              }
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              onKeyPress={handleKeyPress}
              mode="outlined"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="done"
              style={[styles.input, { backgroundColor: colors.surface }]}
              outlineStyle={{ borderRadius: RADIUS.md }}
              disabled={isLoggingIn}
              left={<TextInput.Icon icon="lock-outline" color={colors.onSurfaceVariant} />}
              right={
                <TextInput.Icon
                  forceTextInputFocus={false}
                  icon={() => (
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={colors.onSurfaceVariant}
                    />
                  )}
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
            />

            {/* Forgot password */}
            <View style={styles.forgotPasswordRow}>
              <Button
                mode="text"
                compact
                onPress={() => navigation.navigate('ForgotPassword' as any)}
                labelStyle={{ fontSize: 13, fontWeight: '600' }}
                textColor={colors.primary}
                style={styles.forgotPasswordBtn}
              >
                Forgot password?
              </Button>
            </View>

            {/* Inline error — springs in, pushes content below smoothly */}
            {localError ? (
              <Animated.View
                entering={FadeInDown.duration(220).springify().damping(18)}
                exiting={FadeOutUp.duration(160)}
                style={[
                  styles.errorContainer,
                  { backgroundColor: dark ? `${colors.error}26` : `${colors.error}14` },
                ]}
              >
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{localError}</Text>
              </Animated.View>
            ) : null}

            {/* Everything below the error slides smoothly when it mounts/unmounts */}
            <Animated.View layout={LinearTransition.springify().damping(18)}>
              <Button
                mode="contained"
                onPress={onSubmit}
                loading={isLoggingIn}
                disabled={isLoggingIn}
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
                rippleColor={dark ? `${colors.primary}40` : `${colors.onPrimary}25`}
                style={[styles.button, { opacity: isFormValid || isLoggingIn ? 1 : 0.45 }]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                accessibilityState={{ disabled: !isFormValid || isLoggingIn }}
              >
                {isLoggingIn ? 'Signing in…' : 'Sign In'}
              </Button>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <Divider style={styles.divider} />
                <Text
                  variant="labelSmall"
                  style={{ color: colors.onSurfaceVariant, paddingHorizontal: SPACING.sm }}
                >
                  OR
                </Text>
                <Divider style={styles.divider} />
              </View>

              {/* Social auth */}
              <View style={styles.socialRow}>
                <Button
                  mode="outlined"
                  onPress={() => {/* Handle Apple Login */ }}
                  style={[styles.socialButton, { borderColor: colors.outlineVariant }]}
                  contentStyle={styles.socialContent}
                  icon={({ size, color }) => (
                    <MaterialCommunityIcons name="apple" size={size} color={color} />
                  )}
                  labelStyle={{ color: colors.onSurface, fontWeight: '600' }}
                >
                  Apple
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => {/* Handle Google Login */ }}
                  style={[styles.socialButton, { borderColor: colors.outlineVariant }]}
                  contentStyle={styles.socialContent}
                  icon={({ size, color }) => (
                    <MaterialCommunityIcons name="google" size={size} color={color} />
                  )}
                  labelStyle={{ color: colors.onSurface, fontWeight: '600' }}
                >
                  Google
                </Button>
              </View>
            </Animated.View>
          </Animated.View>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeIn.delay(420).duration(400)}
            style={[styles.footerRow, { paddingBottom: insets.bottom + SPACING.lg }]}
          >
            <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant, opacity: 0.7 }}>
              v{APP_CONFIG.version}
            </Text>
            <Button
              mode="text"
              compact
              onPress={() => {/* Handle Support */ }}
              labelStyle={{ fontSize: 12, fontWeight: '500' }}
              textColor={colors.onSurfaceVariant}
            >
              Contact Support
            </Button>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.xl },

  /* Ambient background */
  bgLayer: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'hidden' },
  blob: { position: 'absolute' },
  blobTop: { top: -120, right: -90, width: 300, height: 300, borderRadius: 150 },
  blobBottom: { bottom: -140, left: -110, width: 280, height: 280, borderRadius: 140 },

  /* Brand hero */
  brand: { alignItems: 'center', marginBottom: SPACING.xl, zIndex: 1 },
  logoWrap: {
    width: '100%',
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logoGlow: {
    position: 'absolute',
    width: 220,
    height: 130,
    borderRadius: 110,
    top: '50%',
    left: '50%',
    marginLeft: -110,
    marginTop: -65,
  },
  brandText: { alignItems: 'center' },
  title: { fontWeight: '700', letterSpacing: -0.5, marginBottom: SPACING.xs, textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 22 },

  /* Form */
  form: { zIndex: 1 },
  input: { marginBottom: SPACING.md, fontSize: 16 },
  forgotPasswordRow: { alignItems: 'flex-end', marginTop: -SPACING.sm, marginBottom: SPACING.md },
  forgotPasswordBtn: { margin: 0, padding: 0, height: 32 },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: { flex: 1, marginLeft: SPACING.sm, fontSize: 14, fontWeight: '500', lineHeight: 20 },

  button: { marginTop: SPACING.sm, borderRadius: RADIUS.md, elevation: 0 },
  buttonContent: { paddingVertical: SPACING.md - 2 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.lg },
  divider: { flex: 1, height: 1 },

  socialRow: { flexDirection: 'row', gap: SPACING.md },
  socialButton: { flex: 1, borderRadius: RADIUS.md },
  socialContent: { paddingVertical: SPACING.sm },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
});