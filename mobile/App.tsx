/**
 * RetailOps Mobile — application entry.
 * Providers (top → bottom): SafeArea → Paper (theme) → Navigation.
 */
import React from 'react';
import { StatusBar, useColorScheme, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import { darkTheme, lightTheme } from './src/theme/theme';

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <StatusBar
              animated
              barStyle={isDark ? 'light-content' : 'dark-content'}
              backgroundColor={theme.colors.background}
            />
            <RootNavigator />
          </PaperProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}