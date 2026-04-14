import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  MobileCheckInLookupResponse,
  MobileCheckInMutationResponse,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileCheckinsScreenProps = {
  data: MobileCheckInsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onJumpToToday: () => void;
  onLookup: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onNextDate: () => void;
  onPreviousDate: () => void;
  onRefresh: () => Promise<void>;
  onSubmit: (input: MobileCheckInSubmissionInput) => Promise<MobileCheckInMutationResponse>;
};

const PHONE_DIGIT_COUNT = 10;

function sanitizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('1') && digits.length > PHONE_DIGIT_COUNT) {
    return digits.slice(1, PHONE_DIGIT_COUNT + 1);
  }
  return digits.slice(0, PHONE_DIGIT_COUNT);
}

function formatPhoneEntry(value: string) {
  const digits = sanitizePhoneDigits(value);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function getLookupPlaceholder(phone: string) {
  return phone.length === 0 ? '(___) ___-____' : formatPhoneEntry(phone);
}

export function MobileCheckinsScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onJumpToToday,
  onLookup,
  onNextDate,
  onPreviousDate,
  onRefresh,
  onSubmit,
}: MobileCheckinsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [lookupResult, setLookupResult] = useState<MobileCheckInLookupResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const phoneReady = useMemo(
    () => sanitizePhoneDigits(phoneDigits).length === PHONE_DIGIT_COUNT,
    [phoneDigits],
  );

  async function handleLookup() {
    const normalizedPhone = sanitizePhoneDigits(phoneDigits);
    if (normalizedPhone.length !== PHONE_DIGIT_COUNT) {
      setLookupError('Enter a full 10-digit phone number.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);
    setSuccessMessage(null);

    try {
      const result = await onLookup(normalizedPhone);
      setLookupResult(result);
      if (result.status !== 'new') {
        setNewCustomerName('');
        setNewCustomerEmail('');
      }
    } catch (lookupIssue) {
      setLookupError(lookupIssue instanceof Error ? lookupIssue.message : 'Unable to find customer.');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleSubmit(input: MobileCheckInSubmissionInput) {
    setIsSubmitting(true);
    setLookupError(null);
    setSuccessMessage(null);

    try {
      const response = await onSubmit(input);
      setSuccessMessage(`${response.checkIn.customerName} checked in at ${response.checkIn.checkedInAtLabel}.`);
      setLookupResult(null);
      setPhoneDigits('');
      setNewCustomerName('');
      setNewCustomerEmail('');
      await onRefresh();
    } catch (submitIssue) {
      setLookupError(
        submitIssue instanceof Error ? submitIssue.message : 'Unable to complete the check-in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={theme.accent}
          onRefresh={() => void onRefresh()}
        />
      }
      style={{ backgroundColor: theme.background }}>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Check-ins</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>
          {data?.dateLabel ?? 'Guest arrivals'}
        </Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Keep the arrival flow simple: type a phone number, match the customer, and keep moving.
        </Text>

        <View style={styles.dateRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onPreviousDate}
            style={[styles.dateButton, { borderColor: theme.border }]}
            testID="mobile-checkins-previous">
            <Text style={[styles.dateButtonText, { color: theme.text }]}>Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onJumpToToday}
            style={[styles.dateButton, { backgroundColor: theme.accent, borderColor: theme.accent }]}
            testID="mobile-checkins-today">
            <Text style={styles.dateButtonPrimaryText}>Today</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onNextDate}
            style={[styles.dateButton, { borderColor: theme.border }]}
            testID="mobile-checkins-next">
            <Text style={[styles.dateButtonText, { color: theme.text }]}>Next</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load check-ins</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>{error}</Text>
        </View>
      ) : null}

      {isLoading && !data ? (
        <View
          style={[
            styles.loadingCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Loading check-ins...
          </Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick check-in</Text>
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              Mobile apps don&apos;t need a fake keypad. Use the phone keyboard and keep the desk moving.
            </Text>

            <View
              style={[
                styles.lookupCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}>
              <Text style={[styles.lookupLabel, { color: theme.mutedText }]}>Phone number</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                onChangeText={(value) => {
                  setPhoneDigits(sanitizePhoneDigits(value));
                  setLookupError(null);
                  setLookupResult(null);
                  setSuccessMessage(null);
                }}
                placeholder={getLookupPlaceholder(phoneDigits)}
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.lookupInput,
                  { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                ]}
                testID="mobile-checkins-phone-input"
                value={formatPhoneEntry(phoneDigits)}
              />

              <Pressable
                accessibilityRole="button"
                disabled={!phoneReady || isLookingUp || isSubmitting}
                onPress={() => void handleLookup()}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: phoneReady ? theme.accent : theme.surfaceMuted,
                    opacity: phoneReady ? 1 : 0.72,
                  },
                ]}
                testID="mobile-checkins-lookup">
                <Text style={styles.primaryButtonText}>
                  {isLookingUp ? 'Looking up...' : 'Find customer'}
                </Text>
              </Pressable>
            </View>

            {lookupError ? (
              <View
                style={[
                  styles.noticeCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.noticeText, { color: theme.danger }]}>{lookupError}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View
                style={[
                  styles.noticeCard,
                  { backgroundColor: theme.accentSoft, borderColor: theme.border },
                ]}>
                <Text style={[styles.noticeTitle, { color: theme.accent }]}>Checked in</Text>
                <Text style={[styles.noticeText, { color: theme.text }]}>{successMessage}</Text>
              </View>
            ) : null}

            {lookupResult?.status === 'existing' ? (
              <View
                style={[
                  styles.matchCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.matchTitle, { color: theme.text }]}>
                  {lookupResult.customer.name}
                </Text>
                <Text style={[styles.matchText, { color: theme.mutedText }]}>
                  {lookupResult.customer.phoneDisplay ?? 'No phone'} ·{' '}
                  {lookupResult.customer.lastVisitLabel ?? 'No recent visit'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() =>
                    void handleSubmit({
                      customerId: lookupResult.customer.id,
                    })
                  }
                  style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                  testID="mobile-checkins-submit-existing">
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Checking in...' : 'Check in customer'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {lookupResult?.status === 'multiple' ? (
              <View style={styles.stack}>
                <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                  Multiple customers match this number. Pick the right profile to continue.
                </Text>
                {lookupResult.customers.map((customer) => (
                  <View
                    key={customer.id}
                    style={[
                      styles.matchCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.matchTitle, { color: theme.text }]}>{customer.name}</Text>
                    <Text style={[styles.matchText, { color: theme.mutedText }]}>
                      {customer.phoneDisplay ?? 'No phone'} · {customer.lastVisitLabel ?? 'No recent visit'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSubmitting}
                      onPress={() => void handleSubmit({ customerId: customer.id })}
                      style={[styles.secondaryButton, { borderColor: theme.border }]}
                      testID={`mobile-checkins-submit-${customer.id}`}>
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Use this customer
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {lookupResult?.status === 'new' ? (
              <View
                style={[
                  styles.matchCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.matchTitle, { color: theme.text }]}>New customer</Text>
                <Text style={[styles.matchText, { color: theme.mutedText }]}>
                  {lookupResult.displayPhone}
                </Text>

                <TextInput
                  autoCapitalize="words"
                  onChangeText={setNewCustomerName}
                  placeholder="Customer name"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.textInput,
                    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                  ]}
                  testID="mobile-checkins-new-name"
                  value={newCustomerName}
                />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setNewCustomerEmail}
                  placeholder="Email (optional)"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.textInput,
                    { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                  ]}
                  testID="mobile-checkins-new-email"
                  value={newCustomerEmail}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting || newCustomerName.trim().length === 0}
                  onPress={() =>
                    void handleSubmit({
                      phone: lookupResult.normalizedPhone,
                      customerName: newCustomerName.trim(),
                      customerEmail: newCustomerEmail.trim() || undefined,
                    })
                  }
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor:
                        newCustomerName.trim().length > 0 ? theme.accent : theme.surfaceMuted,
                      opacity: newCustomerName.trim().length > 0 ? 1 : 0.72,
                    },
                  ]}
                  testID="mobile-checkins-submit-new">
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Checking in...' : 'Create and check in'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Logged</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data?.count ?? 0}</Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Latest</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.latestCheckInLabel ?? '--'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent check-ins</Text>
            {data?.checkIns.length ? (
              data.checkIns.map((checkIn) => (
                <View
                  key={checkIn.id}
                  style={[styles.recentRow, { borderColor: theme.border }]}>
                  <View style={styles.recentCopy}>
                    <Text style={[styles.matchTitle, { color: theme.text }]}>
                      {checkIn.customerName}
                    </Text>
                    <Text style={[styles.matchText, { color: theme.mutedText }]}>
                      {checkIn.phoneDisplay ?? 'No phone'}
                      {checkIn.serviceName ? ` · ${checkIn.serviceName}` : ''}
                      {checkIn.staffName ? ` · ${checkIn.staffName}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.recentTime, { color: theme.accent }]}>
                    {checkIn.checkedInAtLabel}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                No guest arrivals have been logged for this day.
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  dateButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  dateButtonPrimaryText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  noticeTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 10,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  lookupCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  lookupLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  lookupInput: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 15,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  stack: {
    gap: 10,
  },
  matchCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  matchTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  matchText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 98,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  recentRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  recentCopy: {
    flex: 1,
    gap: 4,
  },
  recentTime: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
});
