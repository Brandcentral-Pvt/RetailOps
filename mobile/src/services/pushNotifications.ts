/**
 * Push notifications (Expo Notifications → Expo Push Service).
 *
 * - Registers the device's Expo push token with the backend (`/push/register`)
 *   once per session after the user is authenticated.
 * - Configures an Android notification channel and foreground presentation.
 * - Routes the user to the relevant screen when a push is tapped.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from './apiClient';
import { navigationRef } from '../navigation/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'RetailOps',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Fetch the device's Expo push token (requesting permission on iOS) and
 * register it with the backend. Safe to call repeatedly; only registers once
 * per app session.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (registeredToken) return;

  try {
    await ensureAndroidChannel();

    if (Platform.OS === 'ios') {
      const existingPermissions = await Notifications.getPermissionsAsync();
      if (existingPermissions.status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        if (requested.status !== 'granted') return;
      }
    }

    const extra = Constants.expoConfig?.extra as
      | { eas?: { projectId?: string } }
      | undefined;
    const projectId = extra?.eas?.projectId;
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    if (tokenData?.data) {
      await apiClient.post('/push/register', {
        token: tokenData.data,
        platform: Platform.OS,
      });
      registeredToken = true;
    }
  } catch (error) {
    console.warn('Push notification registration failed:', error);
  }
}

let responseHandlerWired = false;

/**
 * Wire the tap-to-open handler for received pushes. Idempotent.
 */
export function setupPushResponseHandler(): void {
  if (responseHandlerWired) return;
  responseHandlerWired = true;

  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | { type?: string; conversationId?: string }
      | undefined;

    if (!navigationRef.isReady()) return;

    if (data?.type === 'message') {
      navigationRef.navigate('Main', { screen: 'Messages' });
    }
    // type === 'call': the incoming-call flow already opens the call screen.
  });
}