import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

export type MobileAuthMode = 'sign-in' | 'register' | 'verify';

export type MobileRegistrationForm = {
  businessName: string;
  businessType: string;
  email: string;
  password: string;
  confirmPassword: string;
  referralCode: string;
  acceptTerms: boolean;
};

type MobileAuthScreenProps = {
  error: string | null;
  isResendingCode: boolean;
  isSubmitting: boolean;
  mode: MobileAuthMode;
  notice: string | null;
  onOpenPrivacyPolicy: () => Promise<void>;
  onOpenTermsOfService: () => Promise<void>;
  verificationEmail: string;
  onBackToSignIn: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onModeChange: (mode: Exclude<MobileAuthMode, 'verify'>) => void;
  onRegister: (input: MobileRegistrationForm) => Promise<void>;
  onResendCode: (email: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
};

const BUSINESS_TYPES = [
  'Salon',
  'Spa',
  'Gym',
  'Restaurant',
  'Medical/Dental',
  'Auto Service',
  'Retail',
  'Professional Services',
  'Referral Partner',
  'Other',
] as const;

export function MobileAuthScreen({
  error,
  isResendingCode,
  isSubmitting,
  mode,
  notice,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
  verificationEmail,
  onBackToSignIn,
  onLogin,
  onModeChange,
  onRegister,
  onResendCode,
  onVerify,
}: MobileAuthScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerForm, setRegisterForm] = useState<MobileRegistrationForm>({
    businessName: '',
    businessType: 'Salon',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    acceptTerms: false,
  });
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    if (!verificationEmail) {
      return;
    }

    setLoginEmail((current) => current || verificationEmail);
    setRegisterForm((current) => ({
      ...current,
      email: current.email || verificationEmail,
    }));
  }, [verificationEmail]);

  const title =
    mode === 'sign-in'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create account'
        : 'Verify your email';
  const subtitle =
    mode === 'sign-in'
      ? 'Business and referral access starts here.'
      : mode === 'register'
        ? 'Create your account, then finish setup inside the app.'
        : `Enter the 6-digit code we sent to ${verificationEmail}.`;

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
              <Text style={[styles.brand, { color: theme.text }]}>Clientific</Text>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: theme.mutedText }]}>{subtitle}</Text>
            </View>

            {mode !== 'verify' ? (
              <View
                style={[
                  styles.segmentedControl,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onModeChange('sign-in')}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor:
                        mode === 'sign-in' ? theme.surface : 'transparent',
                    },
                  ]}
                  testID="mobile-auth-mode-sign-in">
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: mode === 'sign-in' ? theme.text : theme.mutedText },
                    ]}>
                    Sign in
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onModeChange('register')}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor:
                        mode === 'register' ? theme.surface : 'transparent',
                    },
                  ]}
                  testID="mobile-auth-mode-register">
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: mode === 'register' ? theme.text : theme.mutedText },
                    ]}>
                    Create account
                  </Text>
                </Pressable>
              </View>
            ) : null}

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

            {notice ? (
              <View
                style={[
                  styles.notice,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}>
                <Text style={[styles.noticeText, { color: theme.text }]}>{notice}</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              {mode === 'sign-in' ? (
                <View style={styles.form}>
                  <FieldLabel text="Email" color={theme.text} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-login-email"
                    textContentType="username"
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                  />

                  <FieldLabel text="Password" color={theme.text} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="••••••••"
                    placeholderTextColor={theme.mutedText}
                    secureTextEntry
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-login-password"
                    textContentType="password"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    onPress={() => void onLogin(loginEmail, loginPassword)}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.accent, opacity: isSubmitting ? 0.72 : 1 },
                    ]}
                    testID="mobile-login-submit">
                    {isSubmitting ? (
                      <ActivityIndicator color="#f8fffc" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {mode === 'register' ? (
                <View style={styles.form}>
                  <FieldLabel text="Business name" color={theme.text} />
                  <TextInput
                    placeholder="Your business name"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-register-business-name"
                    value={registerForm.businessName}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({ ...current, businessName: value }))
                    }
                  />

                  <FieldLabel text="Business type" color={theme.text} />
                  <View style={styles.chipGrid}>
                    {BUSINESS_TYPES.map((businessType) => {
                      const selected = registerForm.businessType === businessType;
                      return (
                        <Pressable
                          key={businessType}
                          accessibilityRole="button"
                          onPress={() =>
                            setRegisterForm((current) => ({
                              ...current,
                              businessType,
                            }))
                          }
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected
                                ? theme.accentSoft
                                : theme.background,
                              borderColor: selected ? theme.accent : theme.border,
                            },
                          ]}
                          testID={`mobile-register-type-${businessType}`}>
                          <Text
                            style={[
                              styles.chipText,
                              { color: selected ? theme.accent : theme.text },
                            ]}>
                            {businessType}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <FieldLabel text="Email" color={theme.text} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-register-email"
                    textContentType="emailAddress"
                    value={registerForm.email}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({ ...current, email: value }))
                    }
                  />

                  <FieldLabel text="Password" color={theme.text} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Create a password"
                    placeholderTextColor={theme.mutedText}
                    secureTextEntry
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-register-password"
                    textContentType="newPassword"
                    value={registerForm.password}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({ ...current, password: value }))
                    }
                  />

                  <FieldLabel text="Confirm password" color={theme.text} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Repeat your password"
                    placeholderTextColor={theme.mutedText}
                    secureTextEntry
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-register-confirm-password"
                    textContentType="password"
                    value={registerForm.confirmPassword}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({
                        ...current,
                        confirmPassword: value,
                      }))
                    }
                  />

                  <FieldLabel text="Referral link or code" color={theme.text} optional />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Paste invite link or code"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    testID="mobile-register-referral-code"
                    value={registerForm.referralCode}
                    onChangeText={(value) =>
                      setRegisterForm((current) => ({ ...current, referralCode: value }))
                    }
                  />
                  <Text style={[styles.helperText, { color: theme.mutedText }]}>
                    Paste the full invite link if someone shared it with you. If signup opens
                    without the invite attached, you can enter the fallback referral code here
                    instead.
                  </Text>

                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: registerForm.acceptTerms }}
                    onPress={() =>
                      setRegisterForm((current) => ({
                        ...current,
                        acceptTerms: !current.acceptTerms,
                      }))
                    }
                    style={styles.checkboxRow}
                    testID="mobile-register-accept-terms">
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: registerForm.acceptTerms
                            ? theme.accent
                            : theme.background,
                          borderColor: registerForm.acceptTerms
                            ? theme.accent
                            : theme.border,
                        },
                      ]}>
                      {registerForm.acceptTerms ? (
                        <Text style={styles.checkboxTick}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.checkboxText, { color: theme.mutedText }]}>
                      I agree to the Terms of Service.
                    </Text>
                  </Pressable>

                  <View style={styles.legalLinksRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onOpenTermsOfService()}
                      testID="mobile-register-open-terms">
                      <Text style={[styles.legalLinkText, { color: theme.accent }]}>
                        View Terms
                      </Text>
                    </Pressable>
                    <Text style={[styles.legalDivider, { color: theme.mutedText }]}>•</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onOpenPrivacyPolicy()}
                      testID="mobile-register-open-privacy">
                      <Text style={[styles.legalLinkText, { color: theme.accent }]}>
                        View Privacy
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    onPress={() => void onRegister(registerForm)}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.accent, opacity: isSubmitting ? 0.72 : 1 },
                    ]}
                    testID="mobile-register-submit">
                    {isSubmitting ? (
                      <ActivityIndicator color="#f8fffc" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create account</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {mode === 'verify' ? (
                <View style={styles.form}>
                  <FieldLabel text="Verification code" color={theme.text} />
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="123456"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                        letterSpacing: 4,
                      },
                    ]}
                    testID="mobile-verify-code"
                    value={verificationCode}
                    onChangeText={(value) =>
                      setVerificationCode(value.replace(/\D/g, '').slice(0, 6))
                    }
                  />

                  <Pressable
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    onPress={() => void onVerify(verificationEmail, verificationCode)}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.accent, opacity: isSubmitting ? 0.72 : 1 },
                    ]}
                    testID="mobile-verify-submit">
                    {isSubmitting ? (
                      <ActivityIndicator color="#f8fffc" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verify email</Text>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={isResendingCode}
                    onPress={() => void onResendCode(verificationEmail)}
                    style={[
                      styles.secondaryButton,
                      { borderColor: theme.border, opacity: isResendingCode ? 0.72 : 1 },
                    ]}
                    testID="mobile-verify-resend">
                    {isResendingCode ? (
                      <ActivityIndicator color={theme.text} />
                    ) : (
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Resend code
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={onBackToSignIn}
                    style={styles.linkButton}
                    testID="mobile-verify-back">
                    <Text style={[styles.linkButtonText, { color: theme.mutedText }]}>
                      Back to sign in
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.globalLegalLinks}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onOpenTermsOfService()}
                  testID="mobile-auth-open-terms">
                  <Text style={[styles.globalLegalLinkText, { color: theme.mutedText }]}>
                    Terms of Service
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onOpenPrivacyPolicy()}
                  testID="mobile-auth-open-privacy">
                  <Text style={[styles.globalLegalLinkText, { color: theme.mutedText }]}>
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  color,
  optional = false,
  text,
}: {
  color: string;
  optional?: boolean;
  text: string;
}) {
  return (
    <Text style={[styles.label, { color }]}>
      {text}
      {optional ? ' (optional)' : ''}
    </Text>
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },
  header: {
    gap: 8,
    paddingTop: 10,
  },
  brand: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 22,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
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
  notice: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  helperText: {
    marginTop: -2,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -2,
  },
  legalLinkText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  legalDivider: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  linkButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  globalLegalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 14,
  },
  globalLegalLinkText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
