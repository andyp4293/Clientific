import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileLoginScreenProps = {
  error: string | null;
  isLoading: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
  onOpenWorkspace: () => void;
};

export function MobileLoginScreen({
  error,
  isLoading,
  onSubmit,
  onOpenWorkspace,
}: MobileLoginScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Clientific Mobile</Text>
        <Text style={[styles.title, { color: theme.text }]}>Sign in natively</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          We&apos;re starting the iPhone app with a real native login and dashboard, then
          replacing the rest screen by screen.
        </Text>

        {error ? (
          <View
            style={[
              styles.banner,
              { backgroundColor: theme.accentSoft, borderColor: theme.border },
            ]}>
            <Text style={[styles.bannerText, { color: theme.text }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.input,
              { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
            ]}
            testID="mobile-login-email"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Password</Text>
          <TextInput
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.input,
              { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
            ]}
            testID="mobile-login-password"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => void onSubmit(email, password)}
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, opacity: isLoading ? 0.7 : 1 },
          ]}
          testID="mobile-login-submit">
          {isLoading ? (
            <ActivityIndicator color="#f8fffc" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onOpenWorkspace}
          style={[
            styles.secondaryButton,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
          testID="mobile-open-workspace">
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Open full workspace
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
