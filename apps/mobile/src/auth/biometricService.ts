import { NativeModules, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'retailops.biometric-unlock-enabled';

type NativeBiometricModule = {
  hasHardwareAsync?: () => Promise<boolean>;
  isEnrolledAsync?: () => Promise<boolean>;
  authenticateAsync?: (options: { promptMessage: string; cancelLabel: string; disableDeviceFallback: boolean }) => Promise<{ success?: boolean }>;
};

function nativeModule(): NativeBiometricModule | null {
  if (Platform.OS === 'web') return null;
  const module = NativeModules.ExpoLocalAuthentication as NativeBiometricModule | undefined;
  return module?.hasHardwareAsync && module?.isEnrolledAsync && module?.authenticateAsync ? module : null;
}

export async function biometricAvailable(): Promise<boolean> {
  const module = nativeModule();
  if (!module?.hasHardwareAsync || !module.isEnrolledAsync) return false;
  try {
    return Boolean(await module.hasHardwareAsync()) && Boolean(await module.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === 'enabled';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, 'enabled', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  }
}

export async function requestBiometricUnlock(): Promise<boolean> {
  const module = nativeModule();
  if (!module?.authenticateAsync || !(await biometricAvailable())) return false;
  try {
    const result = await module.authenticateAsync({
      promptMessage: 'Unlock RetailOps',
      cancelLabel: 'Use password instead',
      // The platform credential remains an allowed fallback. The screen never
      // becomes a hard lockout when biometrics are not available.
      disableDeviceFallback: false,
    });
    return Boolean(result.success);
  } catch {
    return false;
  }
}
