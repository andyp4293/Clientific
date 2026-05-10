import React, { useEffect, useMemo, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getClientificWebUrl,
  type MobileCheckInLookupResponse,
  type MobileCheckInMutationResponse,
  type MobileCheckInSubmissionInput,
  type MobileCheckInsSummary,
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
  onOpenUrl: (url: string) => Promise<void>;
  onPreviousDate: () => void;
  onRefresh: () => Promise<void>;
  onSelectDate: (dateKey: string) => void;
  onSubmit: (input: MobileCheckInSubmissionInput) => Promise<MobileCheckInMutationResponse>;
};

type ClientificTheme = ReturnType<typeof getClientificTheme>;

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

function formatDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, 12);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
}

function buildCalendarMonth(anchorDate: Date) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const todayKey = formatDateKey(new Date());
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = formatDateKey(date);
    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: dateKey === todayKey,
    };
  });

  return {
    monthLabel: monthStart.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    cells,
  };
}

function CalendarPickerModal({
  monthAnchor,
  onClose,
  onNextMonth,
  onPreviousMonth,
  onSelectDate,
  selectedDateKey,
  theme,
  visible,
}: {
  monthAnchor: Date;
  onClose: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onSelectDate: (dateKey: string) => void;
  selectedDateKey: string;
  theme: ClientificTheme;
  visible: boolean;
}) {
  const calendar = useMemo(() => buildCalendarMonth(monthAnchor), [monthAnchor]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.calendarModalCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <View style={styles.calendarModalHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>Calendar</Text>
              <Text style={[styles.calendarModalTitle, { color: theme.text }]}>
                {calendar.monthLabel}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.calendarCloseButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
              testID="mobile-checkins-calendar-close">
              <Feather color={theme.text} name="x" size={18} />
            </Pressable>
          </View>

          <View style={styles.calendarControlsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onPreviousMonth}
              style={[
                styles.calendarControlButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
              testID="mobile-checkins-calendar-previous-month">
              <Feather color={theme.text} name="chevron-left" size={18} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onNextMonth}
              style={[
                styles.calendarControlButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
              testID="mobile-checkins-calendar-next-month">
              <Feather color={theme.text} name="chevron-right" size={18} />
            </Pressable>
          </View>

          <View style={styles.calendarWeekdayRow}>
            {calendar.weekdayLabels.map((label) => (
              <Text
                key={label}
                style={[styles.calendarWeekdayLabel, { color: theme.mutedText }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendar.cells.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey;
              return (
                <Pressable
                  key={cell.dateKey}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelectDate(cell.dateKey)}
                  style={[
                    styles.calendarDayButton,
                    isSelected
                      ? { backgroundColor: theme.accent, borderColor: theme.accent }
                      : {
                          backgroundColor: theme.surfaceMuted,
                          borderColor: theme.border,
                        },
                    !cell.inCurrentMonth && styles.calendarDayButtonOutsideMonth,
                  ]}
                  testID={`mobile-checkins-calendar-day-${cell.dateKey}`}>
                  <Text
                    style={[
                      styles.calendarDayText,
                      isSelected
                        ? styles.calendarDayTextSelected
                        : {
                            color: cell.inCurrentMonth ? theme.text : theme.mutedText,
                          },
                    ]}>
                    {cell.dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DateControlButton({
  icon,
  onPress,
  testID,
  theme,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  testID: string;
  theme: ClientificTheme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.dateControlButton,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
      testID={testID}>
      <Feather color={theme.text} name={icon} size={18} />
    </Pressable>
  );
}

export function MobileCheckinsScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onJumpToToday,
  onLookup,
  onNextDate,
  onOpenUrl,
  onPreviousDate,
  onRefresh,
  onSelectDate,
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonthAnchor, setCalendarMonthAnchor] = useState<Date>(
    parseDateKey(data?.selectedDate ?? formatDateKey(new Date())) ?? new Date(),
  );
  const [copiedDeviceLink, setCopiedDeviceLink] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.selectedDate) {
      setCalendarMonthAnchor(parseDateKey(data.selectedDate) ?? new Date(`${data.selectedDate}T12:00:00`));
    }
  }, [data?.selectedDate]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const phoneReady = useMemo(
    () => sanitizePhoneDigits(phoneDigits).length === PHONE_DIGIT_COUNT,
    [phoneDigits],
  );

  const isViewingToday = useMemo(
    () => (data?.selectedDate ?? '') === formatDateKey(new Date()),
    [data?.selectedDate],
  );

  const checkInUrl = useMemo(() => {
    const publicId = data?.business.publicId?.trim();
    if (!publicId) {
      return '';
    }

    return `${getClientificWebUrl()}/check-in/${publicId}`;
  }, [data?.business.publicId]);

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

  async function handleCopyDeviceLink() {
    if (!checkInUrl) {
      return;
    }

    await Clipboard.setStringAsync(checkInUrl);
    setCopiedDeviceLink(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => setCopiedDeviceLink(false), 1600);
  }

  function openCalendar() {
    const dateKey = data?.selectedDate ?? formatDateKey(new Date());
    setCalendarMonthAnchor(parseDateKey(dateKey) ?? new Date(`${dateKey}T12:00:00`));
    setIsCalendarOpen(true);
  }

  function handleCalendarSelect(dateKey: string) {
    onSelectDate(dateKey);
    setIsCalendarOpen(false);
  }

  return (
    <>
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
            Pick the day, run staff-assisted arrivals, and open the same in-store check-in link you use on the web dashboard.
          </Text>

          <View style={styles.dateToolbar}>
            <DateControlButton
              icon="chevron-left"
              onPress={onPreviousDate}
              testID="mobile-checkins-previous"
              theme={theme}
            />
            <Pressable
              accessibilityRole="button"
              onPress={openCalendar}
              style={[
                styles.dateSummaryButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
              testID="mobile-checkins-open-calendar">
              <View style={styles.dateSummaryCopy}>
                <Text style={[styles.dateSummaryLabel, { color: theme.mutedText }]}>
                  Check-in date
                </Text>
                <Text style={[styles.dateSummaryValue, { color: theme.text }]}>
                  {data?.dateLabel ?? 'Choose a day'}
                </Text>
              </View>
              <View
                style={[
                  styles.dateSummaryIconWrap,
                  { backgroundColor: theme.accentSoft, borderColor: theme.border },
                ]}>
                <Feather color={theme.accent} name="calendar" size={18} />
              </View>
            </Pressable>
            <DateControlButton
              icon="chevron-right"
              onPress={onNextDate}
              testID="mobile-checkins-next"
              theme={theme}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isViewingToday }}
            onPress={onJumpToToday}
            style={[
              styles.todayChip,
              isViewingToday
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-checkins-today">
            <Text
              style={
                isViewingToday
                  ? styles.todayChipSelectedText
                  : [styles.todayChipText, { color: theme.text }]
              }>
              Today
            </Text>
          </Pressable>
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
              <Text style={[styles.sectionTitle, { color: theme.text }]}>In-store check-in</Text>
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                Use this same public link for your front desk, a kiosk tablet, or a self-serve device in the salon.
              </Text>

              <View
                style={[
                  styles.linkCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.linkLabel, { color: theme.mutedText }]}>Device link</Text>
                <Text style={[styles.linkValue, { color: theme.text }]}>
                  {checkInUrl || 'Public business link is still loading for this account.'}
                </Text>
                <View style={styles.linkActionRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!checkInUrl}
                    onPress={() => void handleCopyDeviceLink()}
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: checkInUrl ? 1 : 0.72,
                      },
                    ]}
                    testID="mobile-checkins-copy-link">
                    <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                      {copiedDeviceLink ? 'Copied' : 'Copy link'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!checkInUrl}
                    onPress={() => void onOpenUrl(checkInUrl)}
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: checkInUrl ? 1 : 0.72,
                      },
                    ]}
                    testID="mobile-checkins-open-link">
                    <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                      Open check-in
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.hintGrid}>
                <View
                  style={[
                    styles.hintCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.hintTitle, { color: theme.text }]}>Front desk</Text>
                  <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                    Open the link on the salon phone, tablet, or kiosk device for staff-assisted arrivals.
                  </Text>
                </View>
                <View
                  style={[
                    styles.hintCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.hintTitle, { color: theme.text }]}>Self-serve</Text>
                  <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                    Keep the link handy so guests can launch the same check-in flow from another device when needed.
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick check-in</Text>
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                Use this when someone is standing at the desk. Type the customer&apos;s phone number to find the right profile or create a new guest on the spot.
              </Text>

              <View
                style={[
                  styles.lookupCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.lookupLabel, { color: theme.mutedText }]}>Customer phone number</Text>
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

      <CalendarPickerModal
        monthAnchor={calendarMonthAnchor}
        onClose={() => setIsCalendarOpen(false)}
        onNextMonth={() => setCalendarMonthAnchor((current) => addMonths(current, 1))}
        onPreviousMonth={() => setCalendarMonthAnchor((current) => addMonths(current, -1))}
        onSelectDate={handleCalendarSelect}
        selectedDateKey={data?.selectedDate ?? formatDateKey(new Date())}
        theme={theme}
        visible={isCalendarOpen}
      />
    </>
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
  dateToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  dateControlButton: {
    width: 48,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSummaryButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateSummaryCopy: {
    flex: 1,
    gap: 4,
  },
  dateSummaryLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  dateSummaryValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  dateSummaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayChip: {
    alignSelf: 'flex-start',
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  todayChipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  todayChipSelectedText: {
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
  linkCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  linkLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  linkValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  linkActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  hintGrid: {
    gap: 10,
  },
  hintCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  hintTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
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
    flexGrow: 1,
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
    paddingVertical: 16,
    gap: 10,
  },
  matchTitle: {
    fontSize: 17,
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
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  recentRow: {
    borderTopWidth: 1,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recentCopy: {
    flex: 1,
    gap: 4,
  },
  recentTime: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 15, 23, 0.36)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  calendarModalCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarModalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  calendarCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarControlButton: {
    width: 54,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  calendarWeekdayLabel: {
    width: '13%',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  calendarDayButton: {
    width: '13%',
    minWidth: 40,
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayButtonOutsideMonth: {
    opacity: 0.72,
  },
  calendarDayText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  calendarDayTextSelected: {
    color: '#f8fffc',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
});
