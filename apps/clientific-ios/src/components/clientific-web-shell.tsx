import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewNavigation } from 'react-native-webview';
import {
  getHostLabel,
  getPathLabel,
  isSupportedExternalScheme,
  isWebUrl,
} from '../lib/clientific-web-shell-utils';

const DEFAULT_WEB_APP_URL =
  process.env.EXPO_PUBLIC_CLIENTIFIC_WEB_URL ?? 'https://www.clientific.app';

const LIGHT_THEME = {
  background: '#f3f8f7',
  surface: '#ffffff',
  border: '#d7e2e0',
  text: '#102026',
  mutedText: '#5e7270',
  accent: '#0f8a63',
  accentSoft: '#dff4ec',
};

const DARK_THEME = {
  background: '#07131f',
  surface: '#102026',
  border: 'rgba(184, 202, 197, 0.18)',
  text: '#f3f8f7',
  mutedText: '#9eb2af',
  accent: '#18a877',
  accentSoft: 'rgba(24, 168, 119, 0.14)',
};

type ThemePalette = typeof LIGHT_THEME;

type LoadRequest = {
  url: string;
};

function getTheme(isDark: boolean): ThemePalette {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

export function ClientificWebShell() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const theme = getTheme(isDark);
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_WEB_APP_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hasLoadError, setHasLoadError] = useState(false);

  async function openExternal(url: string) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Failed to open external link:', error);
    }
  }

  function handleShouldStartLoad(request: LoadRequest) {
    const { url } = request;

    if (!url || url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
      return true;
    }

    if (isSupportedExternalScheme(url)) {
      void openExternal(url);
      return false;
    }

    return isWebUrl(url);
  }

  function handleNavigationChange(navigation: WebViewNavigation) {
    setCurrentUrl(navigation.url);
    setCanGoBack(navigation.canGoBack);
    setHasLoadError(false);
  }

  function reloadCurrentPage() {
    setHasLoadError(false);
    setIsLoading(true);
    setLoadingProgress(0.1);
    webViewRef.current?.reload();
  }

  function goHome() {
    setHasLoadError(false);
    setIsLoading(true);
    setLoadingProgress(0.1);
    setCurrentUrl(DEFAULT_WEB_APP_URL);
  }

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.webFallback, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.brand, { color: theme.text }]}>Clientific</Text>
          <Text style={[styles.fallbackText, { color: theme.mutedText }]}>
            This route opens the live Clientific web experience at{' '}
            {getHostLabel(DEFAULT_WEB_APP_URL)}.
          </Text>
          <Pressable
            onPress={() => void openExternal(DEFAULT_WEB_APP_URL)}
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.primaryButtonText}>Open Clientific</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.chrome, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={styles.brandBlock}>
          <Text style={[styles.brandEyebrow, { color: theme.accent }]}>Clientific</Text>
          <Text style={[styles.brand, { color: theme.text }]}>Web workspace</Text>
          <Text style={[styles.pathLabel, { color: theme.mutedText }]} numberOfLines={1}>
            {getPathLabel(currentUrl)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            disabled={!canGoBack}
            onPress={() => webViewRef.current?.goBack()}
            style={[
              styles.secondaryButton,
              {
                borderColor: theme.border,
                backgroundColor: canGoBack ? theme.surface : theme.background,
                opacity: canGoBack ? 1 : 0.45,
              },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back</Text>
          </Pressable>

          <Pressable
            onPress={reloadCurrentPage}
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Reload</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(8, Math.round(loadingProgress * 100))}%`,
                backgroundColor: theme.accent,
              },
            ]}
          />
        </View>
      ) : null}

      <View style={styles.webViewWrap}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          originWhitelist={['*']}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationChange}
          onLoadStart={() => {
            setIsLoading(true);
            setHasLoadError(false);
          }}
          onLoadProgress={({ nativeEvent }) => {
            setLoadingProgress(nativeEvent.progress);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            setLoadingProgress(1);
          }}
          onError={() => {
            setHasLoadError(true);
            setIsLoading(false);
          }}
          applicationNameForUserAgent="Clientific"
          style={styles.webView}
        />

        {isLoading ? (
          <View style={[styles.loadingOverlay, { backgroundColor: theme.background }]}>
            <View
              style={[
                styles.loadingCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={[styles.loadingBadge, { backgroundColor: theme.accentSoft }]}>
                <ActivityIndicator color={theme.accent} />
              </View>
              <Text style={[styles.loadingTitle, { color: theme.text }]}>Opening Clientific</Text>
              <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                Loading your live dashboard, customers, appointments, payouts, and check-ins.
              </Text>
            </View>
          </View>
        ) : null}

        {hasLoadError ? (
          <View style={[styles.errorOverlay, { backgroundColor: theme.background }]}>
            <View
              style={[
                styles.errorCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.errorTitle, { color: theme.text }]}>Couldn&apos;t load Clientific</Text>
              <Text style={[styles.errorText, { color: theme.mutedText }]}>
                The app shell is ready, but the live Clientific app didn&apos;t load on this attempt.
              </Text>
              <View style={styles.errorActions}>
                <Pressable
                  onPress={reloadCurrentPage}
                  style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </Pressable>
                <Pressable
                  onPress={goHome}
                  style={[
                    styles.secondaryWideButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Go home</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  chrome: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  brandBlock: {
    gap: 4,
  },
  brandEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  brand: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  pathLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryWideButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 16,
    fontWeight: '800',
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  webViewWrap: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 14,
  },
  loadingBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 14,
  },
  errorTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
  },
  errorActions: {
    marginTop: 4,
    gap: 12,
  },
  webFallback: {
    margin: 24,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
  },
  fallbackText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
