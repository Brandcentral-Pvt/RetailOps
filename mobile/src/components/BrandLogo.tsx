/** Brand logo (BrandCentral) with an optional wordmark. */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

const LOGO = require('../../assets/brandcentral-logo.png');

interface Props {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
}

export default function BrandLogo({ size = 64, showWordmark = false, wordmarkColor }: Props) {
  return (
    <View style={styles.row}>
      <Image
        source={LOGO}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="BrandCentral"
      />
      {showWordmark ? (
        <Text variant="titleLarge" style={[styles.wordmark, wordmarkColor ? { color: wordmarkColor } : null]}>
          RetailOps
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'center' },
  wordmark: { marginTop: 8, fontWeight: '700', letterSpacing: -0.3 },
});