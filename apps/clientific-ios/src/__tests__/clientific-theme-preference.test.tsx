import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import {
  CLIENTIFIC_THEME_PREFERENCE_KEY,
  ClientificThemePreferenceProvider,
  normalizeClientificThemePreference,
  resolveClientificColorScheme,
  useClientificThemePreference,
} from '@/lib/clientific-theme-preference';

const secureStoreMock = SecureStore as typeof SecureStore & {
  __reset: () => void;
  __setItem: (key: string, value: string) => void;
};

function ThemeProbe() {
  const { isHydrated, resolvedColorScheme, setThemePreference, themePreference } =
    useClientificThemePreference();

  return (
    <View>
      <Text testID="theme-pref">{themePreference}</Text>
      <Text testID="theme-resolved">{resolvedColorScheme}</Text>
      <Text testID="theme-hydrated">{isHydrated ? 'yes' : 'no'}</Text>
      <Pressable
        onPress={() => void setThemePreference('light')}
        testID="theme-set-light"
      />
      <Pressable
        onPress={() => void setThemePreference('dark')}
        testID="theme-set-dark"
      />
      <Pressable
        onPress={() => void setThemePreference('system')}
        testID="theme-set-system"
      />
    </View>
  );
}

describe('Clientific theme preference', () => {
  beforeEach(() => {
    secureStoreMock.__reset();
  });

  it('normalizes stored values and resolves system color scheme safely', () => {
    expect(normalizeClientificThemePreference('light')).toBe('light');
    expect(normalizeClientificThemePreference('dark')).toBe('dark');
    expect(normalizeClientificThemePreference('anything-else')).toBe('system');

    expect(resolveClientificColorScheme('system', 'dark')).toBe('dark');
    expect(resolveClientificColorScheme('system', null)).toBe('light');
    expect(resolveClientificColorScheme('light', 'dark')).toBe('light');
  });

  it('loads a saved preference from storage before rendering the effective scheme', async () => {
    secureStoreMock.__setItem(CLIENTIFIC_THEME_PREFERENCE_KEY, 'dark');

    render(
      <ClientificThemePreferenceProvider>
        <ThemeProbe />
      </ClientificThemePreferenceProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('theme-hydrated').props.children).toBe('yes'),
    );

    expect(screen.getByTestId('theme-pref').props.children).toBe('dark');
    expect(screen.getByTestId('theme-resolved').props.children).toBe('dark');
  });

  it('persists preference updates and clears storage when returning to system mode', async () => {
    render(
      <ClientificThemePreferenceProvider>
        <ThemeProbe />
      </ClientificThemePreferenceProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('theme-hydrated').props.children).toBe('yes'),
    );

    fireEvent.press(screen.getByTestId('theme-set-light'));

    await waitFor(() =>
      expect(screen.getByTestId('theme-pref').props.children).toBe('light'),
    );
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      CLIENTIFIC_THEME_PREFERENCE_KEY,
      'light',
    );

    fireEvent.press(screen.getByTestId('theme-set-system'));

    await waitFor(() =>
      expect(screen.getByTestId('theme-pref').props.children).toBe('system'),
    );
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith(
      CLIENTIFIC_THEME_PREFERENCE_KEY,
    );
  });
});
