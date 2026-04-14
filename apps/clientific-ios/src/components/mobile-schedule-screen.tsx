import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  MobileAppointmentEntry,
  MobileAppointmentInput,
  MobileAppointmentUpdateInput,
  MobileAppointmentsSummary,
  MobileCustomerInput,
  MobileCustomerRecord,
  MobileServiceRecord,
  MobileServicesSummary,
  MobileStaffRecord,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileScheduleScreenProps = {
  composerCustomers: MobileCustomerRecord[];
  composerError: string | null;
  data: MobileAppointmentsSummary | null;
  error: string | null;
  isComposerLoading: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  servicesSummary: MobileServicesSummary | null;
  onCreateAppointment: (input: MobileAppointmentInput) => Promise<void>;
  onCreateAppointmentCustomer: (input: MobileCustomerInput) => Promise<MobileCustomerRecord>;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
  onJumpToToday: () => void;
  onLoadComposerResources: () => Promise<void>;
  onNextDate: () => void;
  onPreviousDate: () => void;
  onRefresh: () => Promise<void>;
  onUpdateAppointment: (
    appointmentId: string,
    input: MobileAppointmentUpdateInput,
  ) => Promise<void>;
};

type CustomerMode = 'existing' | 'new';

type AppointmentCreateFormState = {
  customerId: string;
  newCustomerName: string;
  newCustomerPhone: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  duration: number;
  notes: string;
  appointmentSmsConsent: boolean;
};

type AppointmentEditFormState = {
  date: string;
  time: string;
  duration: number;
  notes: string;
};

function formatDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function getTomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateKey(tomorrow);
}

function formatIsoToDateKey(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-CA');
}

function formatIsoToTimeValue(isoString: string) {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatTimePreview(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }

  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function createInitialAppointmentForm(dateKey: string): AppointmentCreateFormState {
  return {
    customerId: '',
    newCustomerName: '',
    newCustomerPhone: '',
    serviceId: '',
    staffId: '',
    date: dateKey,
    time: '',
    duration: 60,
    notes: '',
    appointmentSmsConsent: false,
  };
}

function createEditForm(appointment: MobileAppointmentEntry): AppointmentEditFormState {
  return {
    date: formatIsoToDateKey(appointment.startTime),
    time: formatIsoToTimeValue(appointment.startTime),
    duration: appointment.duration,
    notes: appointment.notes ?? '',
  };
}

function OptionChip({
  label,
  onPress,
  selected,
  testID,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  testID?: string;
}) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.optionChip,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
      testID={testID}>
      <Text
        style={
          selected
            ? styles.optionChipSelectedText
            : [styles.optionChipText, { color: theme.text }]
        }>
        {label}
      </Text>
    </Pressable>
  );
}

function AppointmentSheet({
  children,
  onClose,
  subtitle,
  title,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
}) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheetScreen, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.sheetHeader,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <View style={styles.sheetHeaderCopy}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.sheetSubtitle, { color: theme.mutedText }]}>{subtitle}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[
              styles.sheetCloseButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.sheetCloseButtonText, { color: theme.text }]}>Close</Text>
          </Pressable>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionLabel({ label }: { label: string }) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>{label}</Text>;
}

function InlineErrorCard({ message }: { message: string }) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <View
      style={[
        styles.inlineErrorCard,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}>
      <Text style={[styles.inlineErrorTitle, { color: theme.text }]}>Something needs attention</Text>
      <Text style={[styles.inlineErrorText, { color: theme.mutedText }]}>{message}</Text>
    </View>
  );
}

export function MobileScheduleScreen({
  composerCustomers,
  composerError,
  data,
  error,
  isComposerLoading,
  isLoading,
  isRefreshing,
  servicesSummary,
  onCreateAppointment,
  onCreateAppointmentCustomer,
  onDeleteAppointment,
  onJumpToToday,
  onLoadComposerResources,
  onNextDate,
  onPreviousDate,
  onRefresh,
  onUpdateAppointment,
}: MobileScheduleScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const isViewingToday = data?.selectedDate === formatDateKey(new Date());
  const [isCreateSheetVisible, setIsCreateSheetVisible] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<MobileAppointmentEntry | null>(null);
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [customerSearch, setCustomerSearch] = useState('');
  const [createForm, setCreateForm] = useState(() =>
    createInitialAppointmentForm(data?.selectedDate ?? formatDateKey(new Date())),
  );
  const [editForm, setEditForm] = useState<AppointmentEditFormState>({
    date: formatDateKey(new Date()),
    time: '',
    duration: 60,
    notes: '',
  });
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [activeAppointmentAction, setActiveAppointmentAction] = useState<{
    id: string;
    action: 'confirm' | 'cancel';
  } | null>(null);

  const availableServices = servicesSummary?.services.filter((service) => service.isActive) ?? [];
  const availableStaff = servicesSummary?.staff.filter((staff) => staff.isActive) ?? [];
  const selectedExistingCustomer =
    customerMode === 'existing'
      ? composerCustomers.find((customer) => customer.id === createForm.customerId) ?? null
      : null;
  const manualConsentPhone =
    customerMode === 'new'
      ? createForm.newCustomerPhone.trim()
      : selectedExistingCustomer?.phone?.trim() ?? '';

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    if (!search) {
      return composerCustomers.slice(0, 16);
    }

    return composerCustomers
      .filter((customer) => {
        const haystack = [customer.name, customer.phoneDisplay ?? '', customer.phone ?? '', customer.email ?? '']
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      })
      .slice(0, 16);
  }, [composerCustomers, customerSearch]);

  useEffect(() => {
    if (!isCreateSheetVisible) {
      return;
    }

    setCreateForm((current) => {
      if (current.date === (data?.selectedDate ?? current.date)) {
        return current;
      }

      return {
        ...current,
        date: data?.selectedDate ?? current.date,
      };
    });
  }, [data?.selectedDate, isCreateSheetVisible]);

  useEffect(() => {
    if (!isCreateSheetVisible) {
      return;
    }

    if (customerMode !== 'existing') {
      return;
    }

    const shouldEnableAppointmentSms = Boolean(
      selectedExistingCustomer?.smsConsent && !selectedExistingCustomer?.smsOptedOut,
    );

    setCreateForm((current) =>
      current.appointmentSmsConsent === shouldEnableAppointmentSms
        ? current
        : {
            ...current,
            appointmentSmsConsent: shouldEnableAppointmentSms,
          },
    );
  }, [
    customerMode,
    isCreateSheetVisible,
    selectedExistingCustomer?.id,
    selectedExistingCustomer?.smsConsent,
    selectedExistingCustomer?.smsOptedOut,
  ]);

  const openCreateSheet = () => {
    setSheetError(null);
    setCustomerMode('existing');
    setCustomerSearch('');
    setCreateForm(createInitialAppointmentForm(data?.selectedDate ?? formatDateKey(new Date())));
    setIsCreateSheetVisible(true);
    void onLoadComposerResources();
  };

  const openEditSheet = (appointment: MobileAppointmentEntry) => {
    setSheetError(null);
    setEditingAppointment(appointment);
    setEditForm(createEditForm(appointment));
  };

  const closeCreateSheet = () => {
    if (isSubmittingCreate) {
      return;
    }

    setIsCreateSheetVisible(false);
    setSheetError(null);
  };

  const closeEditSheet = () => {
    if (isSubmittingEdit) {
      return;
    }

    setEditingAppointment(null);
    setSheetError(null);
  };

  const handleSubmitCreate = async () => {
    if (!createForm.time.trim()) {
      setSheetError('Select a start time for the appointment.');
      return;
    }

    if (customerMode === 'existing' && !createForm.customerId) {
      setSheetError('Choose an existing customer first.');
      return;
    }

    if (customerMode === 'new' && !createForm.newCustomerName.trim()) {
      setSheetError('Add the new customer name before creating the appointment.');
      return;
    }

    if (createForm.appointmentSmsConsent && !manualConsentPhone) {
      setSheetError('Add a phone number before enabling appointment texts.');
      return;
    }

    const start = new Date(`${createForm.date}T${createForm.time}`);
    if (Number.isNaN(start.getTime())) {
      setSheetError('Use a valid date and time for the appointment.');
      return;
    }

    setIsSubmittingCreate(true);
    setSheetError(null);

    try {
      let customerId = createForm.customerId;

      if (customerMode === 'new') {
        const customer = await onCreateAppointmentCustomer({
          name: createForm.newCustomerName.trim(),
          phone: createForm.newCustomerPhone.trim() || null,
        });
        customerId = customer.id;
      }

      await onCreateAppointment({
        customerId,
        serviceId: createForm.serviceId || null,
        staffId: createForm.staffId || null,
        startTime: start.toISOString(),
        duration: createForm.duration,
        notes: createForm.notes.trim() || null,
        appointmentSmsConsent: createForm.appointmentSmsConsent,
      });

      setIsCreateSheetVisible(false);
      setCustomerSearch('');
      setCreateForm(createInitialAppointmentForm(data?.selectedDate ?? formatDateKey(new Date())));
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Unable to create appointment.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editingAppointment) {
      return;
    }

    if (!editForm.time.trim()) {
      setSheetError('Select a start time for the appointment.');
      return;
    }

    const start = new Date(`${editForm.date}T${editForm.time}`);
    if (Number.isNaN(start.getTime())) {
      setSheetError('Use a valid date and time for the appointment.');
      return;
    }

    setIsSubmittingEdit(true);
    setSheetError(null);

    try {
      await onUpdateAppointment(editingAppointment.id, {
        startTime: start.toISOString(),
        duration: editForm.duration,
        notes: editForm.notes.trim() || null,
      });
      setEditingAppointment(null);
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Unable to update appointment.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    setActiveAppointmentAction({ id: appointmentId, action: 'confirm' });
    try {
      await onUpdateAppointment(appointmentId, { status: 'confirmed' });
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Unable to confirm appointment.');
    } finally {
      setActiveAppointmentAction(null);
    }
  };

  const handleCancelAppointment = async (appointment: MobileAppointmentEntry) => {
    Alert.alert(
      'Cancel appointment?',
      `Cancel ${appointment.customerName}'s appointment and notify them if SMS is enabled?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: async () => {
            setActiveAppointmentAction({ id: appointment.id, action: 'cancel' });
            try {
              await onDeleteAppointment(appointment.id);
            } catch (error) {
              setSheetError(
                error instanceof Error ? error.message : 'Unable to cancel appointment.',
              );
            } finally {
              setActiveAppointmentAction(null);
            }
          },
        },
      ],
    );
  };

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
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>Appointments</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {data?.dateLabel ?? 'Daily appointments'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
                Review, confirm, edit, and create bookings from the same native flow.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openCreateSheet}
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              testID="mobile-schedule-add">
              <Text style={styles.addButtonText}>New</Text>
            </Pressable>
          </View>

          <View style={styles.dateRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onPreviousDate}
              style={[styles.dateButton, { borderColor: theme.border }]}
              testID="mobile-schedule-previous">
              <Text style={[styles.dateButtonText, { color: theme.text }]}>Prev</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onJumpToToday}
              style={[
                styles.dateButton,
                isViewingToday
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              testID="mobile-schedule-today"
              accessibilityState={{ selected: isViewingToday }}>
              <Text
                style={
                  isViewingToday
                    ? styles.dateButtonPrimaryText
                    : [styles.dateButtonText, { color: theme.accent }]
                }>
                Today
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onNextDate}
              style={[styles.dateButton, { borderColor: theme.border }]}
              testID="mobile-schedule-next">
              <Text style={[styles.dateButtonText, { color: theme.text }]}>Next</Text>
            </Pressable>
          </View>
        </View>

        {error ? <InlineErrorCard message={error} /> : null}
        {sheetError ? <InlineErrorCard message={sheetError} /> : null}

        {isLoading && !data ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>
              Loading appointments...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              {[
                { label: 'Total', value: data?.counts.total ?? 0 },
                { label: 'Pending', value: data?.counts.pending ?? 0 },
                { label: 'Confirmed', value: data?.counts.confirmed ?? 0 },
                { label: 'Scheduled', value: data?.counts.scheduled ?? 0 },
              ].map((metric) => (
                <View
                  key={metric.label}
                  style={[
                    styles.metricCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.metricLabel, { color: theme.mutedText }]}>{metric.label}</Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Appointments</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.mutedText }]}>
                  {data?.appointments.length ?? 0} on this day
                </Text>
              </View>

              {data?.appointments.length ? (
                data.appointments.map((appointment) => {
                  const isConfirming =
                    activeAppointmentAction?.id === appointment.id &&
                    activeAppointmentAction.action === 'confirm';
                  const isCancelling =
                    activeAppointmentAction?.id === appointment.id &&
                    activeAppointmentAction.action === 'cancel';

                  return (
                    <View
                      key={appointment.id}
                      style={[styles.appointmentCard, { borderColor: theme.border }]}>
                      <View style={styles.appointmentHeader}>
                        <View style={styles.appointmentIdentity}>
                          <Text style={[styles.appointmentName, { color: theme.text }]}>
                            {appointment.customerName}
                          </Text>
                          <Text style={[styles.appointmentMeta, { color: theme.mutedText }]}>
                            {appointment.serviceName}
                            {appointment.staffName ? ` · ${appointment.staffName}` : ''}
                          </Text>
                          <Text style={[styles.appointmentMeta, { color: theme.mutedText }]}>
                            {appointment.startTimeLabel} - {appointment.endTimeLabel} · {appointment.sourceLabel}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor:
                                appointment.status === 'confirmed'
                                  ? theme.accentSoft
                                  : theme.surfaceMuted,
                              borderColor: theme.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusLabel,
                              {
                                color:
                                  appointment.status === 'confirmed'
                                    ? theme.accent
                                    : theme.text,
                              },
                            ]}>
                            {appointment.statusLabel}
                          </Text>
                        </View>
                      </View>

                      {appointment.notes ? (
                        <Text style={[styles.notesText, { color: theme.mutedText }]}>
                          {appointment.notes}
                        </Text>
                      ) : null}

                      <View style={styles.actionRow}>
                        {appointment.canConfirm ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => void handleConfirmAppointment(appointment.id)}
                            style={[styles.primaryActionButton, { backgroundColor: theme.accent }]}
                            disabled={isConfirming}
                            testID={`mobile-appointment-confirm-${appointment.id}`}>
                            <Text style={styles.primaryActionButtonText}>
                              {isConfirming ? 'Confirming...' : 'Confirm'}
                            </Text>
                          </Pressable>
                        ) : null}
                        {appointment.canModify ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => openEditSheet(appointment)}
                              style={[
                                styles.secondaryActionButton,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                              ]}
                              testID={`mobile-appointment-edit-${appointment.id}`}>
                              <Text style={[styles.secondaryActionButtonText, { color: theme.text }]}>
                                Edit
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => handleCancelAppointment(appointment)}
                              style={[
                                styles.secondaryActionButton,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                              ]}
                              disabled={isCancelling}
                              testID={`mobile-appointment-cancel-${appointment.id}`}>
                              <Text style={[styles.secondaryActionButtonText, { color: theme.text }]}>
                                {isCancelling ? 'Cancelling...' : 'Cancel'}
                              </Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                    Nothing is booked yet
                  </Text>
                  <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                    Create a manual appointment here instead of jumping back to the web dashboard.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openCreateSheet}
                    style={[styles.emptyStateButton, { backgroundColor: theme.accent }]}
                    testID="mobile-schedule-empty-create">
                    <Text style={styles.emptyStateButtonText}>Create appointment</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <AppointmentSheet
        onClose={closeCreateSheet}
        subtitle="Create the booking directly in the app and optionally enable appointment texts."
        title="New appointment"
        visible={isCreateSheetVisible}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} /> : null}
          {composerError ? <InlineErrorCard message={composerError} /> : null}

          <View
            style={[
              styles.detailSectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <SectionLabel label="Customer" />
            <View style={styles.segmentRow}>
              {(['existing', 'new'] as const).map((mode) => (
                <OptionChip
                  key={mode}
                  label={mode === 'existing' ? 'Existing' : 'New'}
                  onPress={() => setCustomerMode(mode)}
                  selected={customerMode === mode}
                />
              ))}
            </View>

            {customerMode === 'existing' ? (
              <>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={setCustomerSearch}
                  placeholder="Search by name or phone"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={customerSearch}
                />
                {isComposerLoading ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator color={theme.accent} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.optionCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    {filteredCustomers.length ? (
                      filteredCustomers.map((customer) => (
                        <Pressable
                          key={customer.id}
                          accessibilityRole="button"
                          onPress={() =>
                            setCreateForm((current) => ({
                              ...current,
                              customerId: customer.id,
                            }))
                          }
                          style={[
                            styles.customerPickRow,
                            { borderColor: theme.border },
                            createForm.customerId === customer.id
                              ? { backgroundColor: theme.accentSoft }
                              : null,
                          ]}
                          testID={`mobile-existing-customer-${customer.id}`}>
                          <View style={styles.customerPickCopy}>
                            <Text style={[styles.customerPickTitle, { color: theme.text }]}>
                              {customer.name}
                            </Text>
                            <Text style={[styles.customerPickMeta, { color: theme.mutedText }]}>
                              {customer.phoneDisplay ?? customer.email ?? 'No phone on file'}
                            </Text>
                          </View>
                          <Text style={[styles.customerPickStatus, { color: theme.mutedText }]}>
                            {customer.smsOptedOut
                              ? 'SMS opted out'
                              : customer.smsConsent
                                ? 'SMS ready'
                                : 'No SMS approval'}
                          </Text>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                        No customers match that search yet.
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.stackGap}>
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(value) =>
                    setCreateForm((current) => ({ ...current, newCustomerName: value }))
                  }
                  placeholder="Customer name"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={createForm.newCustomerName}
                />
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={(value) =>
                    setCreateForm((current) => ({ ...current, newCustomerPhone: value }))
                  }
                  placeholder="Phone number"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={createForm.newCustomerPhone}
                />
              </View>
            )}
          </View>

          <View
            style={[
              styles.detailSectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <SectionLabel label="When" />
            <View style={styles.quickDateRow}>
              <OptionChip
                label="Today"
                onPress={() =>
                  setCreateForm((current) => ({ ...current, date: formatDateKey(new Date()) }))
                }
                selected={createForm.date === formatDateKey(new Date())}
              />
              <OptionChip
                label="Tomorrow"
                onPress={() =>
                  setCreateForm((current) => ({ ...current, date: getTomorrowKey() }))
                }
                selected={createForm.date === getTomorrowKey()}
              />
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.flexColumn}>
                <SectionLabel label="Date" />
                <TextInput
                  onChangeText={(value) =>
                    setCreateForm((current) => ({ ...current, date: value }))
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-schedule-create-date"
                  value={createForm.date}
                />
              </View>
              <View style={styles.flexColumn}>
                <SectionLabel label="Time" />
                <TextInput
                  onChangeText={(value) =>
                    setCreateForm((current) => ({ ...current, time: value }))
                  }
                  placeholder="HH:MM"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-schedule-create-time"
                  value={createForm.time}
                />
              </View>
            </View>

            <Text style={[styles.helperText, { color: theme.mutedText }]}>
              The appointment will save for {createForm.date} at{' '}
              {createForm.time ? formatTimePreview(createForm.time) : 'the selected time'}.
            </Text>

            <SectionLabel label="Duration" />
            <View style={styles.segmentRow}>
              {[30, 45, 60, 90, 120].map((duration) => (
                <OptionChip
                  key={duration}
                  label={duration >= 60 ? `${duration / 60} hr` : `${duration} min`}
                  onPress={() =>
                    setCreateForm((current) => ({ ...current, duration }))
                  }
                  selected={createForm.duration === duration}
                />
              ))}
            </View>
          </View>

          <View
            style={[
              styles.detailSectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <SectionLabel label="Service & staff" />
            <Text style={[styles.helperText, { color: theme.mutedText }]}>
              Keep these optional for quick front-desk entry, or add them now for a fuller booking.
            </Text>

            <SectionLabel label="Service" />
            <View style={styles.segmentRow}>
              <OptionChip
                label="No service"
                onPress={() => setCreateForm((current) => ({ ...current, serviceId: '' }))}
                selected={!createForm.serviceId}
              />
              {availableServices.map((service) => (
                <OptionChip
                  key={service.id}
                  label={service.name}
                  onPress={() =>
                    setCreateForm((current) => ({ ...current, serviceId: service.id }))
                  }
                  selected={createForm.serviceId === service.id}
                />
              ))}
            </View>

            <SectionLabel label="Staff" />
            <View style={styles.segmentRow}>
              <OptionChip
                label="Any"
                onPress={() => setCreateForm((current) => ({ ...current, staffId: '' }))}
                selected={!createForm.staffId}
              />
              {availableStaff.map((staff) => (
                <OptionChip
                  key={staff.id}
                  label={staff.fullName}
                  onPress={() =>
                    setCreateForm((current) => ({ ...current, staffId: staff.id }))
                  }
                  selected={createForm.staffId === staff.id}
                />
              ))}
            </View>

            <SectionLabel label="Notes" />
            <TextInput
              multiline
              onChangeText={(value) => setCreateForm((current) => ({ ...current, notes: value }))}
              placeholder="Special requests or notes"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={createForm.notes}
            />
          </View>

          <View
            style={[
              styles.detailSectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <SectionLabel label="Appointment texts" />
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setCreateForm((current) => ({
                  ...current,
                  appointmentSmsConsent: !current.appointmentSmsConsent,
                }))
              }
              style={[
                styles.consentCard,
                {
                  backgroundColor: createForm.appointmentSmsConsent
                    ? theme.accentSoft
                    : theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
              testID="mobile-schedule-appointment-sms-toggle">
              <View style={styles.consentCopy}>
                <Text style={[styles.consentTitle, { color: theme.text }]}>
                  Customer verbally agreed to appointment texts
                </Text>
                <Text style={[styles.consentBody, { color: theme.mutedText }]}>
                  This sends the appointment request now, then future confirmation and reminder texts for this number. Reply STOP to opt out.
                </Text>
              </View>
              <View
                style={[
                  styles.consentToggle,
                  {
                    backgroundColor: createForm.appointmentSmsConsent
                      ? theme.accent
                      : theme.surface,
                    borderColor: theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.consentToggleText,
                    {
                      color: createForm.appointmentSmsConsent ? '#ffffff' : theme.text,
                    },
                  ]}>
                  {createForm.appointmentSmsConsent ? 'On' : 'Off'}
                </Text>
              </View>
            </Pressable>
            {createForm.appointmentSmsConsent && !manualConsentPhone ? (
              <Text style={[styles.warningText, { color: '#c47f00' }]}>
                Add a phone number before enabling appointment texts.
              </Text>
            ) : null}
          </View>
        </ScrollView>
        <View
          style={[
            styles.sheetFooter,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}>
          <Pressable
            accessibilityRole="button"
            onPress={closeCreateSheet}
            style={[
              styles.footerSecondaryButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.footerSecondaryButtonText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmittingCreate}
            onPress={() => void handleSubmitCreate()}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-schedule-create-submit">
            <Text style={styles.footerPrimaryButtonText}>
              {isSubmittingCreate ? 'Creating...' : 'Create appointment'}
            </Text>
          </Pressable>
        </View>
      </AppointmentSheet>

      <AppointmentSheet
        onClose={closeEditSheet}
        subtitle="Adjust timing or notes without leaving the native schedule."
        title="Edit appointment"
        visible={Boolean(editingAppointment)}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} /> : null}
          {editingAppointment ? (
            <>
              <View
                style={[
                  styles.detailSectionCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}>
                <SectionLabel label="Booking" />
                <Text style={[styles.detailHeadline, { color: theme.text }]}>
                  {editingAppointment.customerName}
                </Text>
                <Text style={[styles.detailMeta, { color: theme.mutedText }]}>
                  {editingAppointment.serviceName}
                  {editingAppointment.staffName ? ` · ${editingAppointment.staffName}` : ''}
                </Text>
              </View>

              <View
                style={[
                  styles.detailSectionCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}>
                <SectionLabel label="Date" />
                <TextInput
                  onChangeText={(value) => setEditForm((current) => ({ ...current, date: value }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-schedule-edit-date"
                  value={editForm.date}
                />
                <SectionLabel label="Time" />
                <TextInput
                  onChangeText={(value) => setEditForm((current) => ({ ...current, time: value }))}
                  placeholder="HH:MM"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  testID="mobile-schedule-edit-time"
                  value={editForm.time}
                />
                <SectionLabel label="Duration" />
                <View style={styles.segmentRow}>
                  {[30, 45, 60, 90, 120].map((duration) => (
                    <OptionChip
                      key={duration}
                      label={duration >= 60 ? `${duration / 60} hr` : `${duration} min`}
                      onPress={() => setEditForm((current) => ({ ...current, duration }))}
                      selected={editForm.duration === duration}
                    />
                  ))}
                </View>
                <SectionLabel label="Notes" />
                <TextInput
                  multiline
                  onChangeText={(value) =>
                    setEditForm((current) => ({ ...current, notes: value }))
                  }
                  placeholder="Special requests or notes"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={editForm.notes}
                />
              </View>
            </>
          ) : null}
        </ScrollView>
        <View
          style={[
            styles.sheetFooter,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}>
          <Pressable
            accessibilityRole="button"
            onPress={closeEditSheet}
            style={[
              styles.footerSecondaryButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.footerSecondaryButtonText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmittingEdit}
            onPress={() => void handleSubmitEdit()}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-schedule-edit-submit">
            <Text style={styles.footerPrimaryButtonText}>
              {isSubmittingEdit ? 'Saving...' : 'Save changes'}
            </Text>
          </Pressable>
        </View>
      </AppointmentSheet>
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
    gap: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
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
  addButton: {
    minWidth: 74,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  dateButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  loadingCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  metricValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  appointmentCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  appointmentHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  appointmentIdentity: {
    flex: 1,
    gap: 4,
  },
  appointmentName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  appointmentMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryActionButton: {
    minWidth: 112,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  secondaryActionButton: {
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  emptyStateCard: {
    borderRadius: 24,
    paddingVertical: 18,
    gap: 10,
    alignItems: 'flex-start',
  },
  emptyStateTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  emptyStateButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  sheetScreen: {
    flex: 1,
  },
  sheetHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sheetCloseButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sheetCloseButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
  },
  detailSectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  optionChipSelectedText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 108,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  optionCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  customerPickRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerPickCopy: {
    flex: 1,
    gap: 3,
  },
  customerPickTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  customerPickMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  customerPickStatus: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  emptyInlineText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  inlineLoading: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackGap: {
    gap: 12,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexColumn: {
    flex: 1,
    gap: 6,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  consentCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  consentCopy: {
    flex: 1,
    gap: 4,
  },
  consentTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  consentBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  consentToggle: {
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  consentToggleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sheetFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondaryButtonText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  footerPrimaryButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  inlineErrorCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  inlineErrorTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  inlineErrorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  detailHeadline: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  detailMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
