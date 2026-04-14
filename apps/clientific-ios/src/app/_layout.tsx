import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import {
  ClientificThemePreferenceProvider,
  useClientificColorScheme,
} from '@/lib/clientific-theme-preference';

function ClientificAppLayout() {
  const colorScheme = useClientificColorScheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(
      colorScheme === 'dark' ? '#07131f' : '#f3f8f7',
    );
  }, [colorScheme]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#07131f' : '#f3f8f7',
          },
        }}
      />
    </>
  );
}

export default function TabLayout() {
  return (
    <ClientificThemePreferenceProvider>
      <ClientificAppLayout />
    </ClientificThemePreferenceProvider>
  );
}
