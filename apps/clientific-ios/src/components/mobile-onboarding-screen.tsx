import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MobileBusinessProfile, MobileOnboardingInput } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileOnboardingScreenProps = {
  context?: 'onboarding' | 'settings';
  error: string | null;
  isDeletingAccount?: boolean;
  isSaving: boolean;
  onBack?: () => void;
  onDeleteAccount?: () => Promise<void>;
  profile: MobileBusinessProfile;
  onSignOut: () => Promise<void>;
  onSubmit: (input: MobileOnboardingInput) => Promise<void>;
};

type FormState = {
  ownerPhone: string;
  phone: string;
  businessEmail: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  timezone: string;
};

function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

export function MobileOnboardingScreen({
  context = 'onboarding',
  error,
  isDeletingAccount = false,
  isSaving,
  onBack,
  onDeleteAccount,
  profile,
  onSignOut,
  onSubmit,
}: MobileOnboardingScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [form, setForm] = useState<FormState>({
    ownerPhone: '',
    phone: '',
    businessEmail: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    timezone: getDefaultTimezone(),
  });

  useEffect(() => {
    setForm({
      ownerPhone: profile.ownerPhone ?? '',
      phone: profile.phone ?? '',
      businessEmail: profile.businessEmail ?? '',
      street: profile.street ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      zipCode: profile.zipCode ?? '',
      country: profile.country ?? 'United States',
      timezone: profile.timezone ?? getDefaultTimezone(),
    });
  }, [profile]);

  const isSettingsMode = context === 'settings';
  const eyebrow = isSettingsMode ? 'Settings' : 'Finish setup';
  const title = isSettingsMode ? 'Business settings' : 'Complete your business profile';
  const subtitle = isSettingsMode
    ? 'Update your business contact and location details without leaving the app.'
    : 'Add the business contact and location details the app needs before you jump into referrals, funds, and daily activity.';
  const primaryActionLabel = isSettingsMode ? 'Save changes' : 'Finish setup';
  const isBusy = isSaving || isDeletingAccount;

  const handleDeleteAccount = () => {
    if (!onDeleteAccount) {
      return;
    }

    Alert.alert(
      'Delete account?',
      'This permanently deletes your business account, customers, appointments, deals, payout setup, and saved settings from Clientific. App Store subscriptions must still be canceled in your Apple account settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            void onDeleteAccount();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: theme.background }}>
          <View style={styles.container}>
            <View style={styles.header}>
              {isSettingsMode && onBack ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  style={[
                    styles.backButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  testID="mobile-settings-back">
                  <Text style={[styles.backButtonText, { color: theme.text }]}>Back</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: theme.mutedText }]}>{subtitle}</Text>
            </View>

            {error ? (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: theme.accentSoft,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={[styles.bannerText, { color: theme.text }]}>{error}</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Account</Text>

              <ReadOnlyField label="Business name" value={profile.name} theme={theme} />
              <ReadOnlyField label="Business type" value={profile.businessType ?? 'Business'} theme={theme} />
              <ReadOnlyField label="Account email" value={profile.email} theme={theme} />

              <View style={styles.fieldGroup}>
                <FieldLabel label="Personal phone" color={theme.text} />
                <TextInput
                  keyboardType="phone-pad"
                  placeholder="(555) 123-4567"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-onboarding-owner-phone"
                  value={form.ownerPhone}
                  onChangeText={(value) => setForm((current) => ({ ...current, ownerPhone: value }))}
                />
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Business contact</Text>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Business phone" color={theme.text} required />
                <TextInput
                  keyboardType="phone-pad"
                  placeholder="(555) 123-4567"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-onboarding-phone"
                  value={form.phone}
                  onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))}
                />
              </View>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Business email" color={theme.text} />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="hello@yourbusiness.com"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-onboarding-business-email"
                  value={form.businessEmail}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, businessEmail: value }))
                  }
                />
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Street address" color={theme.text} required />
                <TextInput
                  placeholder="123 Main Street"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-onboarding-street"
                  value={form.street}
                  onChangeText={(value) => setForm((current) => ({ ...current, street: value }))}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, styles.rowField]}>
                  <FieldLabel label="City" color={theme.text} required />
                  <TextInput
                    placeholder="City"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-onboarding-city"
                    value={form.city}
                    onChangeText={(value) => setForm((current) => ({ ...current, city: value }))}
                  />
                </View>

                <View style={[styles.fieldGroup, styles.rowField]}>
                  <FieldLabel label="State" color={theme.text} required />
                  <TextInput
                    autoCapitalize="characters"
                    placeholder="NY"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-onboarding-state"
                    value={form.state}
                    onChangeText={(value) => setForm((current) => ({ ...current, state: value }))}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, styles.rowField]}>
                  <FieldLabel label="ZIP code" color={theme.text} required />
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="10001"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-onboarding-zip"
                    value={form.zipCode}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, zipCode: value }))
                    }
                  />
                </View>

                <View style={[styles.fieldGroup, styles.rowField]}>
                  <FieldLabel label="Country" color={theme.text} required />
                  <TextInput
                    placeholder="United States"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-onboarding-country"
                    value={form.country}
                    onChangeText={(value) => setForm((current) => ({ ...current, country: value }))}
                  />
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={() =>
                  void onSubmit({
                    ownerPhone: form.ownerPhone,
                    phone: form.phone,
                    businessEmail: form.businessEmail,
                    street: form.street,
                    city: form.city,
                    state: form.state,
                    zipCode: form.zipCode,
                    country: form.country,
                    timezone: form.timezone,
                  })
                }
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.accent, opacity: isBusy ? 0.72 : 1 },
                ]}
                testID="mobile-onboarding-submit">
                {isSaving ? (
                  <ActivityIndicator color="#f8fffc" />
                ) : (
                  <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
                )}
              </Pressable>

              {!isSettingsMode ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onSignOut()}
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  testID="mobile-onboarding-signout">
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Sign out</Text>
                </Pressable>
              ) : null}
            </View>

            {isSettingsMode && onDeleteAccount ? (
              <View
                style={[
                  styles.dangerCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}>
                <Text style={[styles.dangerTitle, { color: theme.danger }]}>Delete account</Text>
                <Text style={[styles.dangerText, { color: theme.mutedText }]}>
                  Permanently delete your Clientific business account and the data tied to it,
                  including appointments, customers, deals, referrals, payouts, and settings.
                </Text>
                <Text style={[styles.dangerText, { color: theme.mutedText }]}>
                  If you started a subscription through Apple, cancel it separately in your App
                  Store account settings to avoid future renewals.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={handleDeleteAccount}
                  style={[
                    styles.deleteButton,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.danger,
                      opacity: isBusy ? 0.72 : 1,
                    },
                  ]}
                  testID="mobile-settings-delete-account">
                  {isDeletingAccount ? (
                    <ActivityIndicator color={theme.danger} />
                  ) : (
                    <Text style={[styles.deleteButtonText, { color: theme.danger }]}>
                      Delete account
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  color,
  label,
  required = false,
}: {
  color: string;
  label: string;
  required?: boolean;
}) {
  return (
    <Text style={[styles.label, { color }]}>
      {label}
      {required ? ' *' : ''}
    </Text>
  );
}

function ReadOnlyField({
  label,
  theme,
  value,
}: {
  label: string;
  theme: ReturnType<typeof getClientificTheme>;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} color={theme.text} />
      <View
        style={[
          styles.readOnlyField,
          {
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.border,
          },
        ]}>
        <Text style={[styles.readOnlyValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  backButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
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
  card: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  readOnlyField: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  readOnlyValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  actions: {
    gap: 10,
    paddingTop: 4,
  },
  dangerCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  dangerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  dangerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  deleteButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
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
    lineHeight: 20,
    fontWeight: '800',
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
    lineHeight: 20,
    fontWeight: '700',
  },
});
