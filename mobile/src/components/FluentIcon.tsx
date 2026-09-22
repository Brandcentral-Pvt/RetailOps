import React from 'react';
import { StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { fluentIcons } from '../icons/fluent-icons';

interface FluentIconData {
  body: string;
  width: number;
  height: number;
}

const ICONS = fluentIcons as Record<string, FluentIconData>;

interface Props {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

function isMono(name: string): boolean {
  return name.startsWith('fluent:');
}

export default function FluentIcon({
  name,
  size = 20,
  color,
  style,
}: Props) {
  const data = ICONS[name];

  if (!data) return null;

  const body = data.body
    .replace(/<filter[^>]*>[\s\S]*?<\/filter>/g, '')
    .replace(/\s*filter="url\(#[^"]*\)"/g, '');

  const coloredBody =
    isMono(name) && color
      ? body.replace(/currentColor/g, color)
      : body;

  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${data.width} ${data.height}">${coloredBody}</svg>`;

  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      style={StyleSheet.flatten([styles.base, style])}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    opacity: 1,
  },
});