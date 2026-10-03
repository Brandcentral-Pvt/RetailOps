import React, { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Button,
  Chip,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, RADIUS } from '../../theme/theme';
import BrandLogo from '../BrandLogo';
import FluentIcon from '../FluentIcon';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SignInScreenProps {
  onSignIn?: (email: string, password: string) => Promise<void>;
  onForgotPassword?: () => void;
  initialEmail?: string;
}

const ERROR_MESSAGE = 'Email or password is incorrect';

export default function SignInScreen({
  onSignIn,
  onForgotPassword,
  initialEmail = '',
}: SignInScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (emailError) setEmailError(null);
  }, [emailError]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError(null);
  }, [passwordError]);

  const validateForm = useCallback((): boolean => {
    let isValid = true;
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address');
      isValid = false;
    }
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }
    return isValid;
  }, [email, password]);

  const handleSignIn = useCallback(async () => {
    if (!validateForm()) return;
    if (!onSignIn) return;

    setIsSubmitting(true);
    try {
      await onSignIn(email, password);
      setShowError(false);
    } catch {
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, onSignIn, validateForm]);

  const handleForgotPassword = useCallback(() => {
    onForgotPassword?.();
  }, [onForgotPassword]);

  const contentGutter = 16;
  const fieldSpacing = 16;
  const sectionSpacing = 24;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + SPACING.xl,
            paddingBottom: insets.bottom + SPACING.xxl,
            paddingHorizontal: Math.max(insets.left, insets.right, contentGutter),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <BrandLogo size={40} showWordmark={true} wordmarkColor={colors.onSurface} />
          <View style={styles.workspaceChip}>
            <Text variant="labelSmall" style={styles.chipText}>
              Internal workspace
            </Text>
          </View>
        </View>

        <View style={[styles.formSection, { marginTop: sectionSpacing }]}>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={!!emailError}
            style={styles.textField}
            outlineStyle={styles.textFieldOutline}
            placeholderTextColor={colors.onSurfaceVariant}
            selectionColor={colors.primary}
            theme={{
              colors: {
                ...colors,
                primary: colors.primary,
                surface: colors.surface,
                onSurface: colors.onSurface,
                onSurfaceVariant: colors.onSurfaceVariant,
                error: colors.error,
                onError: colors.onError,
                errorContainer: colors.errorContainer,
              },
              roundness: 12,
            }}
            accessibilityLabel="Email address"
            accessibilityHint="Enter your work email address"
          />
          {emailError ? (
            <HelperText type="error" padding="none" style={styles.helperText}>
              {emailError}
            </HelperText>
          ) : null}

          <View style={{ marginTop: fieldSpacing }}>
            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              error={!!passwordError || showError}
              style={styles.textField}
              outlineStyle={styles.textFieldOutline}
              placeholderTextColor={colors.onSurfaceVariant}
              selectionColor={colors.primary}
              theme={{
                colors: {
                  ...colors,
                  primary: colors.primary,
                  surface: colors.surface,
                  onSurface: colors.onSurface,
                  onSurfaceVariant: colors.onSurfaceVariant,
                  error: colors.error,
                  onError: colors.onError,
                  errorContainer: colors.errorContainer,
                },
                roundness: 12,
              }}
              accessibilityLabel="Password"
              accessibilityHint="Enter your password"
              right={
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: showPassword }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              }
            />
          </View>
          {passwordError ? (
            <HelperText type="error" padding="none" style={styles.helperText}>
              {passwordError}
            </HelperText>
          ) : null}

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={handleForgotPassword}
            disabled={isSubmitting}
            accessibilityLabel="Forgot password"
          >
            <Text variant="labelMedium" style={styles.forgotPasswordText}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          {showError && (
            <View
              style={styles.errorBanner}
              role="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={ERROR_MESSAGE}
            >
              <FluentIcon
                name="fluent-color:warning-20"
                size={18}
                color={colors.onErrorContainer}
                style={styles.errorIcon}
              />
              <Text variant="bodySmall" style={styles.errorText}>
                {ERROR_MESSAGE}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.actionSection, { marginTop: sectionSpacing + 8 }]}>
          <Button
            mode="contained"
            onPress={handleSignIn}
            disabled={isSubmitting}
            loading={isSubmitting}
            style={styles.signInButton}
            contentStyle={styles.signInButtonContent}
            accessibilityLabel="Sign in to RetailOps"
          >
            Sign in
          </Button>
        </View>

        <View style={[styles.footerSection, { marginTop: SPACING.lg }]}>
          <View style={styles.securityFooter}>
            <FluentIcon
              name="fluent:key-20-filled"
              size={14}
              color={colors.onSurfaceVariant}
              style={styles.footerIcon}
            />
            <Text variant="labelSmall" style={styles.footerText}>
              Secured by device trust
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'stretch',
  },
  headerSection: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  workspaceChip: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#D7DEE8',
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontWeight: '500',
    textTransform: 'none',
    color: '#334155',
  },
  formSection: {
    width: '100%',
    gap: 0,
  },
  textField: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    fontSize: 16,
  },
  textFieldOutline: {
    borderRadius: 12,
    borderWidth: 1,
  },
  visibilityToggle: {
    padding: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    marginTop: -2,
    marginBottom: 6,
    paddingLeft: 4,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  forgotPasswordText: {
    fontWeight: '500',
    textDecorationLine: 'none',
    color: '#2563EB',
  },
  errorBanner: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  actionSection: {
    width: '100%',
  },
  signInButton: {
    borderRadius: RADIUS.md,
    paddingVertical: 0,
    minHeight: 56,
    elevation: 0,
    shadowOpacity: 0,
  },
  signInButtonContent: {
    paddingVertical: SPACING.md,
  },
  footerSection: {
    width: '100%',
    alignItems: 'center',
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  footerIcon: {
    flexShrink: 0,
  },
  footerText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});