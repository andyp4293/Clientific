import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileStaffPasswordScreenProps = {
  error: string | null;
  isSubmitting: boolean;
  staffName?: string | null;
  businessName?: string | null;
  onSubmit: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function MobileStaffPasswordScreen({
  error,
  isSubmitting,
  staffName,
  businessName,
  onSubmit,
  onSignOut,
}: MobileStaffPasswordScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError ?? error;

  async function handleSubmit() {
    setLocalError(null);
    if (newPassword.length < 8) {
      setLocalError('Use at least 8 characters for the new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('New password and confirmation do not match.');
      return;
    }
    await onSubmit({ currentPassword, newPassword });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>First sign-in</Text>
          <Text style={[styles.title, { color: theme.text }]}>Create your employee password</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            {staffName ? `${staffName}, ` : ''}
            use the temporary password from your email once, then choose your own password
            before opening your appointment view{businessName ? ` for ${businessName}` : ''}.
          </Text>

          {displayError ? (
            <View style={[styles.banner, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
              <Text style={[styles.bannerText, { color: theme.text }]}>{displayError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <FieldLabel text="Temporary password" color={theme.text} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Password from email"
              placeholderTextColor={theme.mutedText}
              secureTextEntry
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              testID="mobile-staff-current-password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <FieldLabel text="New password" color={theme.text} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.mutedText}
              secureTextEntry
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              testID="mobile-staff-new-password"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <FieldLabel text="Confirm new password" color={theme.text} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Type it again"
              placeholderTextColor={theme.mutedText}
              secureTextEntry
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              testID="mobile-staff-confirm-password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.accent, opacity: isSubmitting ? 0.72 : 1 },
              ]}
              testID="mobile-staff-password-submit">
              {isSubmitting ? (
                <ActivityIndicator color="#f8fffc" />
              ) : (
                <Text style={styles.primaryButtonText}>Create password</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void onSignOut()}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              testID="mobile-staff-password-sign-out">
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Use a different account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.label, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 22,
    gap: 16,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 16,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
});
