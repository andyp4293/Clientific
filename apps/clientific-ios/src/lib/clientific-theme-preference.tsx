import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

export type ClientificThemePreference = 'light' | 'dark' | 'system';
export type ClientificResolvedColorScheme = 'light' | 'dark';

export const CLIENTIFIC_THEME_PREFERENCE_KEY = 'clientific.mobile.theme.preference';

type ClientificThemePreferenceContextValue = {
  isHydrated: boolean;
  resolvedColorScheme: ClientificResolvedColorScheme;
  setThemePreference: (nextPreference: ClientificThemePreference) => Promise<void>;
  themePreference: ClientificThemePreference;
};

const DEFAULT_CONTEXT_VALUE: ClientificThemePreferenceContextValue = {
  isHydrated: true,
  resolvedColorScheme: 'light',
  setThemePreference: async () => undefined,
  themePreference: 'system',
};

const ClientificThemePreferenceContext =
  createContext<ClientificThemePreferenceContextValue>(DEFAULT_CONTEXT_VALUE);

export function normalizeClientificThemePreference(
  value: string | null | undefined,
): ClientificThemePreference {
  if (value === 'light' || value === 'dark') {
    return value;
  }

  return 'system';
}

export function resolveClientificColorScheme(
  themePreference: ClientificThemePreference,
  systemColorScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): ClientificResolvedColorScheme {
  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export function ClientificThemePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemColorScheme = useNativeColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<ClientificThemePreference>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const storedPreference = await SecureStore.getItemAsync(
          CLIENTIFIC_THEME_PREFERENCE_KEY,
        );

        if (isMounted) {
          setThemePreferenceState(normalizeClientificThemePreference(storedPreference));
        }
      } catch (error) {
        console.warn('Unable to restore Clientific theme preference:', error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemePreference = useCallback(
    async (nextPreference: ClientificThemePreference) => {
      setThemePreferenceState(nextPreference);

      try {
        if (nextPreference === 'system') {
          await SecureStore.deleteItemAsync(CLIENTIFIC_THEME_PREFERENCE_KEY);
          return;
        }

        await SecureStore.setItemAsync(
          CLIENTIFIC_THEME_PREFERENCE_KEY,
          nextPreference,
        );
      } catch (error) {
        console.warn('Unable to save Clientific theme preference:', error);
      }
    },
    [],
  );

  const resolvedColorScheme = resolveClientificColorScheme(
    themePreference,
    systemColorScheme,
  );

  const value = useMemo(
    () => ({
      isHydrated,
      resolvedColorScheme,
      setThemePreference,
      themePreference,
    }),
    [isHydrated, resolvedColorScheme, setThemePreference, themePreference],
  );

  return (
    <ClientificThemePreferenceContext.Provider value={value}>
      {children}
    </ClientificThemePreferenceContext.Provider>
  );
}

export function useClientificThemePreference() {
  return useContext(ClientificThemePreferenceContext);
}

export function useClientificColorScheme() {
  return useClientificThemePreference().resolvedColorScheme;
}
