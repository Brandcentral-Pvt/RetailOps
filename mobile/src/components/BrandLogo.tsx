/** Premium BrandCentral wordmark with a stable aspect ratio. */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

const LOGO = require('../../assets/brandcentral-logo.png');
const LOGO_ASPECT = 875 / 166;

interface Props {
  /** Visual height of the wordmark. */
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  accessible?: boolean;
}

export default function BrandLogo({
  size = 32,
  showWordmark = false,
  wordmarkColor,
  accessible = true,
}: Props) {
  return (
    <View
      style={styles.row}
      accessibilityLabel={accessible ? 'BrandCentral RetailOps' : undefined}
      accessibilityRole="image"
    >
      <Image
        source={LOGO}
        style={[
          styles.logo,
          {
            width: size * LOGO_ASPECT,
            height: size,
          },
        ]}
        resizeMode="contain"
        accessible={false}
      />
      {showWordmark ? (
        <Text
          variant="titleLarge"
          style={[
            styles.wordmark,
            wordmarkColor ? { color: wordmarkColor } : null,
          ]}
        >
          RetailOps
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  logo: {
    flexShrink: 1,
  },
  wordmark: {
    fontWeight: '700',
  },
});
