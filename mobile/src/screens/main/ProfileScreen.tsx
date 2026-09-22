/**
 * Seller account & settings.
 *
 * Wired to the RetailOps auth endpoints:
 *  - GET  /auth/me                         (session user — hydrated by authStore)
 *  - PUT  /auth/profile                    (edit name / phone)
 *  - POST /auth/request-password-change    (password-change OTP: step 1)
 *  - PUT  /auth/change-password-with-otp   (password-change OTP: step 2)
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  HelperText,
  IconButton,
  List,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import ScreenContainer from '../../components/ScreenContainer';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { getApiErrorMessage } from '../../services/apiClient';
import { APP_CONFIG } from '../../config/env';
import { RADIUS, SPACING } from '../../theme/theme';
import type { Seller } from '../../types';

export default function ProfileScreen() {
  const { colors } = useTheme();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const applyUserUpdate = useAuthStore((state) => state.applyUserUpdate);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasswordFlow, setShowPasswordFlow] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [editError, setEditError] = useState<string | null>(null);

  const initials = getInitials(user?.firstName, user?.lastName, user?.fullName);
  const email = user?.Email || user?.email || '—';
  const phone = user?.phone || '';
  const roleDisplay =
    user?.role?.displayName || user?.role?.DisplayName || user?.role?.name || user?.role?.Name || 'Member';
  const businessCount = user?.sellers?.length ?? user?.assignedSellers?.length ?? 0;

  const startEditing = () => {
    setEditForm({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: phone,
    });
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveProfile = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError('First name and last name are required.');
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const result = await authService.updateProfile({
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
      });
      if (!result.success) {
        setEditError(result.message ?? 'Failed to update profile.');
        return;
      }
      applyUserUpdate({
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
      });
      setIsEditing(false);
      setSnackbar({ visible: true, message: 'Profile updated successfully.' });
    } catch (err) {
      setEditError(getApiErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out of RetailOps?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Avatar.Text
            size={72}
            label={initials}
            style={{ backgroundColor: colors.primaryContainer }}
            color={colors.onPrimaryContainer}
          />

          <Text variant="titleLarge" style={[styles.name, { color: colors.onSurface }]}>
            {user?.fullName || 'Your account'}
          </Text>

          <Text variant="bodyMedium" style={[styles.email, { color: colors.onSurfaceVariant }]}>
            {email}
          </Text>

          <Chip
            style={styles.roleChip}
            textStyle={[styles.roleChipText, { color: colors.primary }]}
            icon="shield-account-outline"
          >
            {roleDisplay}
          </Chip>
        </View>

        {/* ── Personal Information ───────────────────────────────────── */}
        <Text variant="labelLarge" style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
          PERSONAL INFORMATION
        </Text>

        <Card
          mode="outlined"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
              <Text variant="bodyMedium" style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
                First name <Text style={{ color: colors.error }}>*</Text>
              </Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  dense
                  value={editForm.firstName}
                  onChangeText={(value) => setEditForm((f) => ({ ...f, firstName: value }))}
                  style={[styles.fieldInput, { backgroundColor: colors.surface }]}
                  outlineStyle={{ borderRadius: RADIUS.md }}
                  disabled={saving}
                />
              ) : (
                <Text variant="bodyLarge" style={[styles.fieldValue, { color: colors.onSurface }]}>
                  {user?.firstName || '—'}
                </Text>
              )}
            </View>

            <Divider style={styles.fieldDivider} />

            <View style={styles.row}>
              <Text variant="bodyMedium" style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
                Last name <Text style={{ color: colors.error }}>*</Text>
              </Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  dense
                  value={editForm.lastName}
                  onChangeText={(value) => setEditForm((f) => ({ ...f, lastName: value }))}
                  style={[styles.fieldInput, { backgroundColor: colors.surface }]}
                  outlineStyle={{ borderRadius: RADIUS.md }}
                  disabled={saving}
                />
              ) : (
                <Text variant="bodyLarge" style={[styles.fieldValue, { color: colors.onSurface }]}>
                  {user?.lastName || '—'}
                </Text>
              )}
            </View>

            <Divider style={styles.fieldDivider} />

            <View style={styles.row}>
              <Text variant="bodyMedium" style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
                Email
              </Text>
              <Text variant="bodyLarge" style={[styles.fieldValue, { color: colors.onSurface }]}>
                {email}
              </Text>
            </View>

            <Divider style={styles.fieldDivider} />

            <View style={styles.row}>
              <Text variant="bodyMedium" style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
                Phone
              </Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  dense
                  value={editForm.phone}
                  onChangeText={(value) => setEditForm((f) => ({ ...f, phone: value }))}
                  placeholder="+91 00000 00000"
                  keyboardType="phone-pad"
                  style={[styles.fieldInput, { backgroundColor: colors.surface }]}
                  outlineStyle={{ borderRadius: RADIUS.md }}
                  disabled={saving}
                />
              ) : (
                <Text variant="bodyLarge" style={[styles.fieldValue, { color: colors.onSurface }]}>
                  {phone || 'Not set'}
                </Text>
              )}
            </View>

            {editError ? (
              <HelperText type="error" visible style={styles.helper}>
                {editError}
              </HelperText>
            ) : null}

            {isEditing ? (
              <View style={styles.editActions}>
                <Button
                  mode="text"
                  onPress={cancelEditing}
                  disabled={saving}
                  textColor={colors.onSurfaceVariant}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveProfile}
                  loading={saving}
                  disabled={saving}
                  style={styles.saveButton}
                >
                  Save
                </Button>
              </View>
            ) : (
              <Button
                mode="outlined"
                icon="pencil-outline"
                onPress={startEditing}
                style={[styles.editButton, { borderColor: colors.outlineVariant }]}
              >
                Edit profile
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* ── Account details ────────────────────────────────────────── */}
        <Text variant="labelLarge" style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.onSurfaceVariant }]}>
          ACCOUNT
        </Text>

        <Card
          mode="outlined"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <MetaRow
              icon="calendar-account-outline"
              label="Joined"
              value={formatDate(user?.createdAt)}
            />
            <Divider />
            <MetaRow
              icon="clock-outline"
              label="Last seen"
              value={user?.lastSeen ? formatDate(user.lastSeen) : 'Now'}
            />
            <Divider />
            <MetaRow
              icon="lock-reset"
              label="Password changed"
              value={user?.passwordChangedAt ? formatDate(user.passwordChangedAt) : '—'}
            />
          </Card.Content>
        </Card>

        {/* ── Business ───────────────────────────────────────────────── */}
        <Text variant="labelLarge" style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.onSurfaceVariant }]}>
          BUSINESS
        </Text>

        <Card
          mode="outlined"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            {user?.sellers && user.sellers.length > 0 ? (
              user.sellers.map((seller, index) => (
                <React.Fragment key={seller.Id}>
                  {index > 0 ? <Divider /> : null}
                  <SellerRow seller={seller} />
                </React.Fragment>
              ))
            ) : (
              <List.Item
                title="Business"
                description={
                  businessCount > 0
                    ? `${businessCount} business${businessCount === 1 ? '' : 'es'} connected`
                    : 'Business information'
                }
                titleStyle={styles.listTitle}
                descriptionStyle={styles.listDescription}
                left={(props) => (
                  <List.Icon {...props} icon="store-outline" color={colors.onSurfaceVariant} />
                )}
              />
            )}
          </Card.Content>
        </Card>

        {/* ── Security ───────────────────────────────────────────────── */}
        <Text variant="labelLarge" style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.onSurfaceVariant }]}>
          SECURITY
        </Text>

        <Card
          mode="outlined"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <List.Item
              title="Change password"
              description="Verify your identity with a one-time code"
              titleStyle={styles.listTitle}
              descriptionStyle={styles.listDescription}
              left={(props) => <List.Icon {...props} icon="key-outline" color={colors.onSurfaceVariant} />}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={colors.onSurfaceVariant} />
              )}
              onPress={() => setShowPasswordFlow(true)}
            />
          </Card.Content>
        </Card>

        {/* ── Support ────────────────────────────────────────────────── */}
        <Text variant="labelLarge" style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.onSurfaceVariant }]}>
          SUPPORT
        </Text>

        <Card
          mode="outlined"
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
        >
          <Card.Content style={styles.cardContent}>
            <List.Item
              title="Help & Support"
              description="Get help with your RetailOps account"
              titleStyle={styles.listTitle}
              descriptionStyle={styles.listDescription}
              left={(props) => (
                <List.Icon {...props} icon="help-circle-outline" color={colors.onSurfaceVariant} />
              )}
              right={(props) => (
                <List.Icon {...props} icon="chevron-right" color={colors.onSurfaceVariant} />
              )}
            />
            <Divider />
            <List.Item
              title="About RetailOps"
              description={`App information and ${APP_CONFIG.name} v${APP_CONFIG.version}`}
              titleStyle={styles.listTitle}
              descriptionStyle={styles.listDescription}
              left={(props) => (
                <List.Icon {...props} icon="information-outline" color={colors.onSurfaceVariant} />
              )}
            />
          </Card.Content>
        </Card>

        {/* ── Sign out ───────────────────────────────────────────────── */}
        <Button
          mode="outlined"
          icon="logout"
          textColor={colors.error}
          onPress={handleLogout}
          style={[styles.logout, { borderColor: colors.error }]}
          contentStyle={styles.logoutContent}
        >
          Sign out
        </Button>

        <Text variant="labelSmall" style={[styles.version, { color: colors.onSurfaceVariant }]}>
          {APP_CONFIG.name} v{APP_CONFIG.version}
        </Text>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* ── Change password (OTP flow) ──────────────────────────────── */}
      <ChangePasswordModal
        visible={showPasswordFlow}
        onClose={() => setShowPasswordFlow(false)}
        onChanged={() => {
          setShowPasswordFlow(false);
          logout();
        }}
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </ScreenContainer>
  );
}

/* ─── Supporting components ──────────────────────────────────────────── */

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIcon}>
        <List.Icon icon={icon} color={colors.onSurfaceVariant} style={styles.metaIconInner} />
      </View>
      <View style={styles.metaInfo}>
        <Text variant="bodyMedium" style={[styles.metaLabel, { color: colors.onSurfaceVariant }]}>
          {label}
        </Text>
        <Text variant="bodyLarge" style={[styles.metaValue, { color: colors.onSurface }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SellerRow({ seller }: { seller: Seller }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sellerRow}>
      <View style={[styles.sellerIcon, { backgroundColor: colors.surfaceVariant }]}>
        <List.Icon icon="store-outline" color={colors.onSurfaceVariant} style={styles.metaIconInner} />
      </View>
      <View style={styles.sellerInfo}>
        <Text variant="bodyLarge" numberOfLines={1} style={[styles.sellerName, { color: colors.onSurface }]}>
          {seller.Name}
        </Text>
        <View style={styles.sellerMeta}>
          {seller.Marketplace ? <Chip textStyle={styles.sellerChipText} style={styles.sellerChip}>{seller.Marketplace}</Chip> : null}
          {seller.Plan ? <Chip textStyle={styles.sellerChipText} style={styles.sellerChip}>{seller.Plan}</Chip> : null}
          {seller.SellerId ? (
            <Text variant="labelSmall" numberOfLines={1} style={[styles.sellerId, { color: colors.onSurfaceVariant }]}>
              {seller.SellerId}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

function ChangePasswordModal({ visible, onClose, onChanged }: ChangePasswordModalProps) {
  const { colors } = useTheme();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const passwordsMatch = confirmPassword.length === 0 || confirmPassword === newPassword;
  const canSend =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword;

  const reset = () => {
    setStep(0);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtp('');
    setTempToken('');
    setDestination('');
    setBusy(false);
    setError(null);
    setInfo(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSendCode = async () => {
    Keyboard.dismiss();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await authService.requestPasswordChange(currentPassword);
      if (!result.success || !result.tempToken) {
        setError(result.message ?? 'Failed to send verification code.');
        return;
      }
      setTempToken(result.tempToken);
      setDestination(result.destination ?? '');
      setInfo(result.message ?? `Verification code sent to ${result.destination}`);
      setStep(1);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send verification code.'));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await authService.requestPasswordChange(currentPassword);
      if (!result.success || !result.tempToken) {
        setError(result.message ?? 'Failed to resend verification code.');
        return;
      }
      setTempToken(result.tempToken);
      setInfo(result.message ?? 'A new verification code has been sent.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not resend the verification code.'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    Keyboard.dismiss();
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await authService.changePasswordWithOtp(tempToken, otp.trim(), newPassword);
      if (!result.success) {
        setError(result.message ?? 'Failed to change password.');
        return;
      }
      setInfo(result.message ?? 'Password changed successfully.');
      setStep(2);
      setTimeout(onChanged, 2500);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to change password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        dismissable={!busy}
        contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboard}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.onSurface }]}>
              Change password
            </Text>
            <IconButton
              icon="close"
              size={20}
              iconColor={colors.onSurfaceVariant}
              onPress={handleClose}
              disabled={busy}
              style={styles.modalClose}
            />
          </View>

          {step === 0 ? (
            <View>
              <HelperText type="info" visible style={styles.modalHint}>
                Verify your current password first. A one-time code will be sent to your email.
              </HelperText>

              <TextInput
                label="Current password"
                mode="outlined"
                secureTextEntry
                autoCapitalize="none"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={[styles.modalInput, { backgroundColor: colors.surface }]}
                outlineStyle={{ borderRadius: RADIUS.md }}
                disabled={busy}
              />

              <TextInput
                label="New password"
                mode="outlined"
                secureTextEntry
                autoCapitalize="none"
                value={newPassword}
                onChangeText={setNewPassword}
                style={[styles.modalInput, { backgroundColor: colors.surface }]}
                outlineStyle={{ borderRadius: RADIUS.md }}
                disabled={busy}
              />
              <HelperText type={newPassword.length > 0 && newPassword.length < 8 ? 'error' : 'info'} visible style={styles.modalHint}>
                At least 8 characters.
              </HelperText>

              <TextInput
                label="Confirm new password"
                mode="outlined"
                secureTextEntry
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={!passwordsMatch}
                style={[styles.modalInput, { backgroundColor: colors.surface }]}
                outlineStyle={{ borderRadius: RADIUS.md }}
                disabled={busy}
              />
              {confirmPassword.length > 0 && !passwordsMatch ? (
                <HelperText type="error" visible>
                  Passwords do not match.
                </HelperText>
              ) : null}

              {error ? <HelperText type="error" visible style={styles.modalHint}>{error}</HelperText> : null}

              <Button
                mode="contained"
                onPress={handleSendCode}
                loading={busy}
                disabled={busy || !canSend}
                style={styles.modalButton}
                contentStyle={styles.modalButtonContent}
              >
                Send verification code
              </Button>
            </View>
          ) : step === 1 ? (
            <View>
              <View style={[styles.otpIcon, { backgroundColor: colors.primaryContainer }]}>
                <List.Icon icon="shield-check-outline" color={colors.primary} style={styles.metaIconInner} />
              </View>

              <Text variant="bodyMedium" style={[styles.modalCenterText, { color: colors.onSurfaceVariant }]}>
                A 6-digit code has been sent to{' '}
                <Text style={{ fontWeight: '600', color: colors.onSurface }}>{destination || 'your email'}</Text>
              </Text>

              <TextInput
                label="Verification code"
                mode="outlined"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(value) => {
                  setError(null);
                  setOtp(value.replace(/[^0-9]/g, '').slice(0, 6));
                }}
                autoFocus
                style={[styles.modalInput, styles.otpInput, { backgroundColor: colors.surface }]}
                contentStyle={styles.otpInputContent}
                outlineStyle={{ borderRadius: RADIUS.md }}
                disabled={busy}
              />

              {error ? <HelperText type="error" visible style={styles.modalHint}>{error}</HelperText> : null}
              {info ? <HelperText type="info" visible style={styles.modalHint}>{info}</HelperText> : null}

              <Button
                mode="contained"
                onPress={handleVerify}
                loading={busy}
                disabled={busy || otp.length !== 6}
                style={styles.modalButton}
                contentStyle={styles.modalButtonContent}
              >
                Verify & change password
              </Button>

              <View style={styles.modalSecondaryRow}>
                <Button
                  mode="text"
                  compact
                  onPress={handleResend}
                  loading={busy}
                  disabled={busy}
                >
                  Resend code
                </Button>
                <Button mode="text" compact onPress={() => setStep(0)} disabled={busy}>
                  Back
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.successView}>
              <View style={[styles.successIcon, { backgroundColor: colors.primaryContainer }]}>
                <List.Icon icon="check-circle-outline" color={colors.primary} style={styles.metaIconInner} />
              </View>
              <Text variant="titleLarge" style={[styles.successTitle, { color: colors.onSurface }]}>
                Password changed!
              </Text>
              <Text variant="bodyMedium" style={[styles.modalCenterText, { color: colors.onSurfaceVariant }]}>
                You'll be signed out shortly. Please sign in again with your new password.
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

function getInitials(firstName?: string, lastName?: string, fullName?: string): string {
  if (firstName || lastName) {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  }
  if (fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0]?.[0]?.toUpperCase() || 'U';
  }
  return 'U';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: SPACING.xl,
  },

  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },

  name: {
    marginTop: SPACING.md,
    fontWeight: '700',
  },

  email: {
    marginTop: 2,
  },

  roleChip: {
    marginTop: SPACING.sm,
    backgroundColor: 'transparent',
  },

  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  sectionLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
    marginLeft: 2,
  },

  sectionSpacing: {
    marginTop: SPACING.xl,
  },

  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    elevation: 0,
  },

  cardContent: {
    paddingVertical: SPACING.xs,
  },

  listTitle: {
    fontWeight: '600',
  },

  listDescription: {
    marginTop: 2,
  },

  /* Fields */
  row: {
    paddingVertical: SPACING.sm,
  },

  fieldLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },

  fieldValue: {
    fontWeight: '500',
  },

  fieldInput: {
    backgroundColor: 'transparent',
  },

  fieldDivider: {
    marginVertical: SPACING.xs,
  },

  helper: {
    paddingHorizontal: 0,
    marginTop: SPACING.xs,
  },

  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  saveButton: {
    borderRadius: RADIUS.md,
    minWidth: 90,
  },

  editButton: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
  },

  /* Meta rows */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  metaIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },

  metaIconInner: {
    margin: 0,
  },

  metaInfo: {
    flex: 1,
  },

  metaLabel: {
    fontWeight: '500',
  },

  metaValue: {
    marginTop: 1,
    fontWeight: '600',
  },

  /* Seller rows */
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },

  sellerIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  sellerInfo: {
    flex: 1,
    minWidth: 0,
  },

  sellerName: {
    fontWeight: '600',
  },

  sellerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },

  sellerChip: {
    height: 24,
    backgroundColor: 'transparent',
  },

  sellerChipText: {
    fontSize: 11,
  },

  sellerId: {
    flexShrink: 1,
  },

  logout: {
    marginTop: SPACING.xl,
    borderRadius: RADIUS.md,
  },

  logoutContent: {
    paddingVertical: SPACING.sm,
  },

  version: {
    textAlign: 'center',
    marginTop: SPACING.lg,
  },

  bottomSpacing: {
    height: SPACING.xl,
  },

  /* Modal */
  modal: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
  },

  modalKeyboard: {
    width: '100%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  modalTitle: {
    fontWeight: '700',
  },

  modalClose: {
    margin: 0,
  },

  modalHint: {
    paddingHorizontal: 0,
  },

  modalInput: {
    backgroundColor: 'transparent',
    marginTop: SPACING.sm,
  },

  modalButton: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
  },

  modalButtonContent: {
    minHeight: 48,
  },

  modalSecondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },

  modalCenterText: {
    textAlign: 'center',
    lineHeight: 20,
  },

  otpIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },

  otpInput: {
    marginTop: SPACING.md,
  },

  otpInputContent: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 21,
    fontWeight: '600',
  },

  successView: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },

  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  successTitle: {
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
});