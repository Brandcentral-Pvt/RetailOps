/**
 * CallButton — reusable button to start audio/video call.
 * Usage: <CallButton callType="audio" onPress={...} />
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import type { CallType } from '../../types';

interface CallButtonProps {
  callType: CallType;
  onPress: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'labeled';
  style?: ViewStyle;
}

import { ViewStyle } from 'react-native';

const SIZE_CONFIG = {
  small: { buttonSize: 36, iconSize: 18, fontSize: 11 },
  medium: { buttonSize: 48, iconSize: 24, fontSize: 13 },
  large: { buttonSize: 60, iconSize: 28, fontSize: 15 },
};

export default function CallButton({
  callType,
  onPress,
  disabled = false,
  size = 'medium',
  variant = 'icon',
  style,
}: CallButtonProps) {
  const { colors } = useTheme();
  const config = SIZE_CONFIG[size];

  const iconName = callType === 'video' ? 'video' : 'phone';
  const label = callType === 'video' ? 'Video' : 'Voice';

  if (variant === 'labeled') {
    return (
      <TouchableOpacity
        style={[
          styles.labeledButton,
          { backgroundColor: disabled ? '#E0E0E0' : colors.primary },
          style,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <View style={styles.labeledContent}>
          <Text style={[styles.labeledIcon, { fontSize: config.iconSize, color: '#FFFFFF' }]}>
            {callType === 'video' ? '📹' : '📞'}
          </Text>
          <Text
            style={[
              styles.labeledText,
              { fontSize: config.fontSize, color: '#FFFFFF' },
            ]}
          >
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <IconButton
      icon={iconName}
      size={config.iconSize}
      onPress={onPress}
      disabled={disabled}
      iconColor="#FFFFFF"
      style={[
        styles.iconButton,
        {
          width: config.buttonSize,
          height: config.buttonSize,
          borderRadius: config.buttonSize / 2,
          backgroundColor: disabled ? '#E0E0E0' : colors.primary,
        },
        style,
      ]}
      rippleColor="rgba(255,255,255,0.3)"
    />
  );
}

const styles = StyleSheet.create({
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  labeledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
  },
  labeledContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labeledIcon: {
    fontWeight: 'normal',
  },
  labeledText: {
    fontWeight: '600',
  },
});