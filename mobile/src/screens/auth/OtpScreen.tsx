
/** Step 2 of the auth flow: verify the emailed one-time code. */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Keyboard,
} from 'react-native';

import {
  Button,
  HelperText,
  Icon,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/apiClient';
import { RADIUS, SPACING } from '../../theme/theme';
import BrandLogo from '../../components/BrandLogo';
import type { AuthStackParamList } from '../../types';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'Otp'
>;

const RESEND_COOLDOWN = 30;

export default function OtpScreen({
  route,
  navigation,
}: Props) {
  const { tempToken, destination } = route.params;

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const verifyOtp = useAuthStore(
    (state) => state.verifyOtp,
  );

  const isLoggingIn = useAuthStore(
    (state) => state.isLoggingIn,
  );

  const [otp, setOtp] = useState('');
  const [trustDevice, setTrustDevice] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [info, setInfo] =
    useState<string | null>(null);

  const [resending, setResending] =
    useState(false);

  const [resendCountdown, setResendCountdown] =
    useState(0);

  /* ---------------------------------------------------------
     Resend cooldown
  --------------------------------------------------------- */

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCountdown((value) =>
        value > 0 ? value - 1 : 0,
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

  /* ---------------------------------------------------------
     Verify OTP
  --------------------------------------------------------- */

  const onSubmit = async () => {
    setError(null);
    setInfo(null);

    const code = otp.trim();

    if (code.length !== 6) {
      setError(
        'Enter the 6-digit verification code.',
      );
      return;
    }

    const result = await verifyOtp(
      tempToken,
      code,
      trustDevice,
    );

    if (!result.success) {
      setError(
        result.message ??
          'The verification code is invalid or has expired.',
      );
    }

    // Successful verification causes the root
    // navigator to switch to Main automatically.
  };

  /* ---------------------------------------------------------
     Resend OTP
  --------------------------------------------------------- */

  const onResend = async () => {
    if (
      resending ||
      resendCountdown > 0
    ) {
      return;
    }

    setError(null);
    setInfo(null);
    setResending(true);

    try {
      const response =
        await authService.resendOtp(
          tempToken,
        );

      setInfo(
        response.message ??
          'A new verification code has been sent.',
      );

      setOtp('');
      setResendCountdown(
        RESEND_COOLDOWN,
      );
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'Could not resend the verification code.',
        ),
      );
    } finally {
      setResending(false);
    }
  };

  /* ---------------------------------------------------------
     OTP input
  --------------------------------------------------------- */

  const handleOtpChange = (
    value: string,
  ) => {
    setError(null);

    const cleaned = value
      .replace(/[^0-9]/g, '')
      .slice(0, 6);

    setOtp(cleaned);
  };

  return (
    <TouchableWithoutFeedback
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      <KeyboardAvoidingView
        style={[
          styles.flex,
          {
            backgroundColor:
              colors.background,
          },
        ]}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={[
            styles.container,
            {
              paddingTop:
                insets.top + SPACING.lg,
              paddingBottom:
                insets.bottom,
            },
          ]}
        >
          {/* ==================================================
              TOP BAR
          ================================================== */}

          <View style={styles.topBar}>
            <Pressable
              onPress={() =>
                navigation.goBack()
              }
              disabled={isLoggingIn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              style={({ pressed }) => [
                styles.backButton,
                {
                  borderColor:
                    colors.outlineVariant,
                  backgroundColor:
                    colors.surface,
                  opacity: pressed
                    ? 0.65
                    : 1,
                },
              ]}
            >
              <Icon
                source="arrow-left"
                size={20}
                color={
                  colors.onSurface
                }
              />
            </Pressable>

            <Text
              variant="labelMedium"
              style={[
                styles.stepLabel,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              STEP 2 OF 2
            </Text>
          </View>

          {/* ==================================================
              BRAND / INTRO
          ================================================== */}

          <View style={styles.header}>
            <View
              style={[
                styles.logoContainer,
                {
                  backgroundColor:
                    colors.primaryContainer,
                },
              ]}
            >
              <BrandLogo size={58} />
            </View>

            <Text
              variant="headlineMedium"
              style={[
                styles.title,
                {
                  color:
                    colors.onSurface,
                },
              ]}
            >
              Verify your sign-in
            </Text>

            <Text
              variant="bodyMedium"
              style={[
                styles.subtitle,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              Enter the verification code
              sent to
            </Text>

            {destination ? (
              <View
                style={[
                  styles.destinationContainer,
                  {
                    backgroundColor:
                      colors.surfaceVariant,
                    borderColor:
                      colors.outlineVariant,
                  },
                ]}
              >
                <Icon
                  source="email-outline"
                  size={17}
                  color={
                    colors.onSurfaceVariant
                  }
                />

                <Text
                  variant="bodyMedium"
                  style={[
                    styles.destination,
                    {
                      color:
                        colors.onSurface,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {destination}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ==================================================
              FORM
          ================================================== */}

          <View style={styles.form}>
            <Text
              variant="labelLarge"
              style={[
                styles.fieldLabel,
                {
                  color:
                    colors.onSurface,
                },
              ]}
            >
              Verification code
            </Text>

            <TextInput
              value={otp}
              onChangeText={handleOtpChange}
              mode="outlined"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
              maxLength={6}
              disabled={isLoggingIn}
              error={!!error}
              placeholder="000000"
              placeholderTextColor={
                colors.onSurfaceVariant
              }
              style={[
                styles.input,
                {
                  backgroundColor:
                    colors.surface,
                },
              ]}
              outlineStyle={{
                borderRadius: RADIUS.lg,
              }}
              contentStyle={
                styles.inputContent
              }
              outlineColor={
                colors.outlineVariant
              }
              activeOutlineColor={
                colors.primary
              }
              selectionColor={
                colors.primary
              }
            />

            <Text
              variant="bodySmall"
              style={[
                styles.codeHint,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              Enter the 6-digit code from
              your email.
            </Text>

            {/* ==================================================
                MESSAGES
            ================================================== */}

            <View
              style={styles.messageArea}
            >
              {error ? (
                <HelperText
                  type="error"
                  visible
                  style={styles.helper}
                >
                  {error}
                </HelperText>
              ) : info ? (
                <HelperText
                  type="info"
                  visible
                  style={[
                    styles.helper,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  {info}
                </HelperText>
              ) : null}
            </View>

            {/* ==================================================
                TRUST DEVICE
            ================================================== */}

            <Pressable
              onPress={() =>
                setTrustDevice(
                  (value) => !value,
                )
              }
              disabled={isLoggingIn}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: trustDevice,
                disabled: isLoggingIn,
              }}
              style={({ pressed }) => [
                styles.trustRow,
                {
                  opacity: pressed
                    ? 0.7
                    : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor:
                      trustDevice
                        ? colors.primary
                        : colors.outline,
                    backgroundColor:
                      trustDevice
                        ? colors.primary
                        : 'transparent',
                  },
                ]}
              >
                {trustDevice ? (
                  <Icon
                    source="check"
                    size={15}
                    color={
                      colors.onPrimary
                    }
                  />
                ) : null}
              </View>

              <View
                style={styles.trustContent}
              >
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.trustTitle,
                    {
                      color:
                        colors.onSurface,
                    },
                  ]}
                >
                  Trust this device
                </Text>

                <Text
                  variant="bodySmall"
                  style={[
                    styles.trustDescription,
                    {
                      color:
                        colors.onSurfaceVariant,
                    },
                  ]}
                >
                  Don't ask for a code next
                  time on this device.
                </Text>
              </View>
            </Pressable>

            {/* ==================================================
                VERIFY BUTTON
            ================================================== */}

            <Button
              mode="contained"
              onPress={onSubmit}
              loading={isLoggingIn}
              disabled={
                isLoggingIn ||
                otp.length !== 6
              }
              buttonColor={
                colors.primary
              }
              textColor={
                colors.onPrimary
              }
              style={styles.button}
              contentStyle={
                styles.buttonContent
              }
              labelStyle={
                styles.buttonLabel
              }
              rippleColor={
                `${colors.onPrimary}25`
              }
            >
              {isLoggingIn
                ? 'Verifying…'
                : 'Verify and continue'}
            </Button>

            {/* ==================================================
                RESEND
            ================================================== */}

            <View
              style={styles.resendContainer}
            >
              <Text
                variant="bodySmall"
                style={{
                  color:
                    colors.onSurfaceVariant,
                }}
              >
                Didn't receive the code?
              </Text>

              <Button
                mode="text"
                onPress={onResend}
                loading={resending}
                disabled={
                  isLoggingIn ||
                  resending ||
                  resendCountdown > 0
                }
                compact
                textColor={
                  colors.primary
                }
                labelStyle={
                  styles.resendLabel
                }
              >
                {resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : 'Resend code'}
              </Button>
            </View>
          </View>

          {/* ==================================================
              SECURITY FOOTER
          ================================================== */}

          <View
            style={[
              styles.footer,
              {
                borderTopColor:
                  colors.outlineVariant,
              },
            ]}
          >
            <Icon
              source="shield-check-outline"
              size={15}
              color={
                colors.onSurfaceVariant
              }
            />

            <Text
              variant="bodySmall"
              style={[
                styles.footerText,
                {
                  color:
                    colors.onSurfaceVariant,
                },
              ]}
            >
              Your verification is securely
              processed by RetailOps.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },

  /* ----------------------------------------------------------
     Top bar
  ---------------------------------------------------------- */

  topBar: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* ----------------------------------------------------------
     Header
  ---------------------------------------------------------- */

  header: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },

  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  title: {
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: SPACING.xs,
    textAlign: 'center',
    lineHeight: 21,
  },

  destinationContainer: {
    maxWidth: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },

  destination: {
    flexShrink: 1,
    marginLeft: SPACING.sm,
    fontWeight: '600',
  },

  /* ----------------------------------------------------------
     Form
  ---------------------------------------------------------- */

  form: {
    width: '100%',
  },

  fieldLabel: {
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },

  input: {
    height: 58,
    fontSize: 18,
  },

  inputContent: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 21,
    fontWeight: '600',
  },

  codeHint: {
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  /* ----------------------------------------------------------
     Messages
  ---------------------------------------------------------- */

  messageArea: {
    minHeight: 38,
    justifyContent: 'center',
  },

  helper: {
    marginHorizontal: 0,
    paddingHorizontal: 0,
    textAlign: 'center',
  },

  /* ----------------------------------------------------------
     Trust device
  ---------------------------------------------------------- */

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },

  checkbox: {
    width: 21,
    height: 21,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  trustContent: {
    flex: 1,
  },

  trustTitle: {
    fontWeight: '600',
  },

  trustDescription: {
    marginTop: 2,
    lineHeight: 17,
  },

  /* ----------------------------------------------------------
     Primary button
  ---------------------------------------------------------- */

  button: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    elevation: 0,
  },

  buttonContent: {
    minHeight: 50,
  },

  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },

  /* ----------------------------------------------------------
     Resend
  ---------------------------------------------------------- */

  resendContainer: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },

  resendLabel: {
    fontWeight: '700',
  },

  /* ----------------------------------------------------------
     Footer
  ---------------------------------------------------------- */

  footer: {
    marginTop: 'auto',
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.md,
  },

  footerText: {
    marginLeft: 5,
    textAlign: 'center',
  },
});
