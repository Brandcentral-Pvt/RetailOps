/**
 * Native call-audio bridge (Android).
 *
 * react-native-webrtc does not expose a speaker toggle, so this calls a
 * small native module that flips the Android AudioManager speakerphone state.
 */
import { NativeModules, Platform } from 'react-native';

const { CallAudio } = NativeModules as {
  CallAudio?: {
    setSpeakerphoneOn: (on: boolean) => Promise<boolean>;
  };
};

export async function setSpeakerphone(on: boolean): Promise<void> {
  if (Platform.OS !== 'android' || !CallAudio?.setSpeakerphoneOn) {
    return;
  }

  try {
    await CallAudio.setSpeakerphoneOn(on);
  } catch (error) {
    console.warn('Failed to toggle speakerphone:', error);
  }
}