import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../components/ui/Text';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  secure?: boolean;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  maxLength?: number;
  accessibilityHint?: string;
};

/** Token-driven text field for credentials and OTPs. */
export function AuthField({
  label,
  value,
  onChangeText,
  error = null,
  placeholder,
  secure = false,
  editable = true,
  keyboardType = 'default',
  autoComplete,
  textContentType,
  autoCapitalize = 'none',
  returnKeyType = 'next',
  onSubmitEditing,
  maxLength,
  accessibilityHint,
}: Props) {
  const t = useTheme();
  const [revealed, setRevealed] = useState(false);
  const isInvalid = Boolean(error);
  const spec = t.type.scale.bodyLarge;

  return (
    <View style={{ gap: t.spacing.scale.xs }}>
      <Text role="labelLarge" color="onSurface">{label}</Text>
      <View
        style={{
          minHeight: t.component.textField.outlinedHeight,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.c.surfaceContainerLow as string,
          borderColor: isInvalid ? t.c.error as string : t.c.outline as string,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: t.shape.md as number,
          paddingLeft: t.spacing.scale.lg,
          paddingRight: secure ? t.spacing.scale.xs : t.spacing.scale.lg,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.c.onSurfaceSubtle as string}
          secureTextEntry={secure && !revealed}
          editable={editable}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          maxLength={maxLength}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: !editable }}
          {...(isInvalid ? { accessibilityInvalid: true } : {})}
          style={{
            flex: 1,
            minHeight: t.component.textField.outlinedHeight,
            color: t.c.onSurface as string,
            fontSize: spec.size,
            lineHeight: spec.lineHeight,
            fontWeight: String(spec.weight) as TextStyle['fontWeight'],
            letterSpacing: spec.tracking,
          }}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: revealed }}
            hitSlop={t.spacing.scale.md}
            style={{ minWidth: t.component.iconButton.touchTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text role="labelMedium" color="primary">{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="text" role="bodySmall" color="error">{error}</Text>
      ) : null}
    </View>
  );
}
