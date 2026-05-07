import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { StrivoColors } from '@/constants/theme';
import { requestPermissions } from '@/services/notifications';
import { supabase } from '@/lib/supabase';
import { migrateLocalSessions } from '@/services/sessions';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

const StrivoTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: StrivoColors.bg,
    card: StrivoColors.bg,
    border: StrivoColors.border,
    text: StrivoColors.text,
    primary: StrivoColors.accent,
  },
};

export default function RootLayout() {
  useEffect(() => {
    requestPermissions();
    Promise.all([
      supabase.auth.getSession(),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]).then(([{ data: { session } }]) => {
      if (!session) router.replace('/onboarding');
      else void migrateLocalSessions();
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={StrivoTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="register" options={{ headerShown: false, animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
