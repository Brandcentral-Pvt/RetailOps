/** Step 1 of the auth flow: email + password. */
import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  Divider,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BrandLogo from '../../components/BrandLogo';
import { APP_CONFIG } from '../../config/env';
import { useAuthStore } from '../../store/authStore';
import { RADIUS, SPACING } from '../../theme/theme';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((state) => state.login);
  const isLoggingIn = useAuthStore((state) => state.isLoggingIn);

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
      setLocalError('Enter your email and password to continue.');
      return;
    }
    if (emailError) {
      setLocalError('Enter a valid email address.');
      return;
    }

    const result = await login(email.trim().toLowerCase(), password);
    if (!result.success) {
      setLocalError(result.message ?? 'We could not sign you in. Check your details and try again.');
      return;
    }

    if (result.requiresOtp && result.tempToken) {
      navigation.navigate('Otp', {
        tempToken: result.tempToken,
        destination: result.destination,
      });
    }
  };

  const handleKeyPress = (event: { nativeEvent: { key: string } }) => {
    if (event.nativeEvent.key === 'Enter') onSubmit();
  };

  return (
    <LinearGradient
      colors={dark ? ['#07111F', '#0E1626', '#07111F'] : ['#F5F7FB', '#EEF2F7', '#F5F7FB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={[styles.flex, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 24}
        >
          <View style={[styles.shell, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <Animated.View entering={FadeIn.duration(300)} style={styles.hero}>
              <View
                style={[
                  styles.logoPanel,
                  {
                    backgroundColor: colors.surface,
                    shadowColor: colors.shadow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <BrandLogo size={32} />
              </View>
              <Text variant="headlineMedium" style={[styles.title, { color: colors.onSurface }]}>
                Welcome back
              </Text>
              <Text variant="bodyLarge" style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
                Sign in to manage your retail operations.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.form}>
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
                activeOutlineColor={colors.primary}
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
              {emailError ? (
                <HelperText type="error" padding="none" style={styles.helper}>
                  Enter a valid email address.
                </HelperText>
              ) : null}

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
                activeOutlineColor={colors.primary}
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
                    onPress={() => setShowPassword((visible) => !visible)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  />
                }
              />

              <View style={styles.formActions}>
                <Button
                  mode="text"
                  compact
                  onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() || undefined })}
                  labelStyle={styles.linkLabel}
                  textColor={colors.primary}
                  accessibilityLabel="Recover your password"
                >
                  Forgot password?
                </Button>
              </View>

              {localError ? (
                <View
                  style={[
                    styles.errorContainer,
                    { backgroundColor: dark ? `${colors.error}26` : `${colors.error}14` },
                  ]}
                  accessibilityRole="alert"
                >
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{localError}</Text>
                </View>
              ) : null}

              <Button
                mode="contained"
                onPress={onSubmit}
                loading={isLoggingIn}
                disabled={isLoggingIn || !isFormValid}
                buttonColor={colors.primary}
                textColor={colors.onPrimary}
                style={[styles.button, { opacity: isFormValid || isLoggingIn ? 1 : 0.48 }]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                accessibilityState={{ disabled: isLoggingIn || !isFormValid }}
              >
                {isLoggingIn ? 'Signing in…' : 'Sign In'}
              </Button>

              <View style={styles.dividerContainer}>
                <Divider style={styles.divider} />
                <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant, paddingHorizontal: SPACING.sm }}>
                  SECURE WORKSPACE
                </Text>
                <Divider style={styles.divider} />
              </View>

              <Text variant="bodySmall" style={[styles.securityNote, { color: colors.onSurfaceVariant }]}>
                Your credentials are sent securely to RetailOps. Use your account email and current password.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(280).duration(300)} style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
              <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant, opacity: 0.72 }}>
                RetailOps · v{APP_CONFIG.version}
              </Text>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  shell: { flex: 1, paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 28 },
  logoPanel: {
    width: 184,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  title: { fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 8, maxWidth: 320, lineHeight: 23 },
  form: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  input: { marginBottom: 4, fontSize: 16 },
  helper: { marginTop: -2, marginBottom: 6, paddingLeft: 4 },
  formActions: { alignItems: 'flex-end', marginTop: 4, marginBottom: 10 },
  linkLabel: { fontSize: 13, fontWeight: '700' },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 12,
  },
  errorText: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  button: { borderRadius: RADIUS.md, minHeight: 52, elevation: 0 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  securityNote: { textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  footer: { marginTop: 'auto', alignItems: 'center' },
});
