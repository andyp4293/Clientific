import React, { useEffect, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
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
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  buildAppointmentStartOptions,
  formatScheduleTimeLabel,
} from '@/lib/staff-schedule';
import type { MobilePushPermissionStatus } from '@/lib/mobile-push-notifications';

type MobileScheduleScreenProps = {
  accessMode?: 'owner' | 'staff';
  composerCustomers: MobileCustomerRecord[];
  composerError: string | null;
  data: MobileAppointmentsSummary | null;
  error: string | null;
  isComposerLoading: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  notificationsError?: string | null;
  notificationsPermissionStatus?: MobilePushPermissionStatus;
  servicesSummary: MobileServicesSummary | null;
  staffViewerName?: string | null;
  onCreateAppointment: (input: MobileAppointmentInput) => Promise<void>;
  onCreateAppointmentCustomer: (input: MobileCustomerInput) => Promise<MobileCustomerRecord>;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
  onJumpToToday: () => void;
  onLoadComposerResources: () => Promise<void>;
  onNextDate: () => void;
  onEnablePushNotifications?: () => Promise<void>;
  onSelectDate: (date: string) => void;
  onPreviousDate: () => void;
  onRefresh: () => Promise<void>;
  onSignOut?: () => Promise<void>;
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
  serviceIds: string[];
  serviceStaffAssignments: Record<string, string>;
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
  serviceId: string;
  staffId: string;
  duration: number;
  notes: string;
};

type CalendarTarget = 'schedule' | 'create' | 'edit';

const MANUAL_APPOINTMENT_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

function formatDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function getTomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateKey(tomorrow);
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

function getDefaultTimeOptions(duration: number) {
  return buildAppointmentStartOptions('09:00', '18:00', duration, 30);
}

function getSuggestedTimeOptions({
  dateKey,
  duration,
  staffId,
  staff,
}: {
  dateKey: string;
  duration: number;
  staffId: string;
  staff: MobileStaffRecord[];
}) {
  const fallback = getDefaultTimeOptions(duration);
  if (!staffId) {
    return fallback;
  }

  const selectedStaff = staff.find((entry) => entry.id === staffId);
  if (!selectedStaff) {
    return fallback;
  }

  const dayOfWeek = (parseDateKey(dateKey) ?? new Date()).getDay();
  const dayWindow = selectedStaff.workHours?.[dayOfWeek];
  if (
    !selectedStaff.workDays.includes(dayOfWeek) ||
    !dayWindow?.startTime ||
    !dayWindow?.endTime
  ) {
    return fallback;
  }

  const options = buildAppointmentStartOptions(
    dayWindow.startTime,
    dayWindow.endTime,
    duration,
    30,
  );

  return options.length ? options : fallback;
}

function staffCanPerformService(staff: MobileStaffRecord, serviceId: string) {
  return staff.serviceIds.length === 0 || staff.serviceIds.includes(serviceId);
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

function formatManualDurationLabel(duration: number) {
  if (duration < 60) {
    return `${duration} min`;
  }

  return `${duration / 60} hr`;
}

function createInitialAppointmentForm(dateKey: string): AppointmentCreateFormState {
  return {
    customerId: '',
    newCustomerName: '',
    newCustomerPhone: '',
    serviceId: '',
    serviceIds: [],
    serviceStaffAssignments: {},
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
    serviceId: appointment.serviceId ?? '',
    staffId: appointment.staffId ?? '',
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
      accessibilityState={{ selected }}
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

function StaffChoiceCard({
  member,
  onPress,
  selected,
  testIDPrefix = 'mobile-schedule-create-staff',
}: {
  member: MobileStaffRecord;
  onPress: () => void;
  selected: boolean;
  testIDPrefix?: string;
}) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const coverageLabel = member.serviceNames.length ? member.serviceNames.join(', ') : 'All services';
  const accessibilityLabel = [
    member.fullName,
    member.role ?? 'Team member',
    member.bio,
    `${member.workDaysLabel} · ${coverageLabel}`,
    selected ? 'Selected' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.staffChoiceCard,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surfaceMuted,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
      testID={`${testIDPrefix}-${member.id}`}>
      <View style={styles.staffChoiceHeader}>
        <View style={styles.staffChoiceCopy}>
          <Text style={[styles.staffChoiceTitle, { color: theme.text }]}>{member.fullName}</Text>
          <Text style={[styles.staffChoiceRole, { color: theme.mutedText }]}>
            {member.role ?? 'Team member'}
          </Text>
        </View>
        {selected ? (
          <View style={[styles.staffSelectedBadge, { backgroundColor: theme.accent }]}>
            <Text style={styles.staffSelectedBadgeText}>Selected</Text>
          </View>
        ) : null}
      </View>
      {member.bio ? (
        <Text style={[styles.staffChoiceBio, { color: theme.mutedText }]}>{member.bio}</Text>
      ) : null}
      <Text style={[styles.staffChoiceMeta, { color: theme.mutedText }]}>
        {member.workDaysLabel} · {coverageLabel}
      </Text>
    </Pressable>
  );
}

function TimeSlotChip({
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
        styles.timeSlotChip,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
      testID={testID}>
      <Text
        style={
          selected ? styles.timeSlotChipSelectedText : [styles.timeSlotChipText, { color: theme.text }]
        }>
        {label}
      </Text>
    </Pressable>
  );
}

function CalendarDateButton({
  helperLabel,
  onPress,
  selectedDateKey,
  testID,
}: {
  helperLabel?: string;
  onPress: () => void;
  selectedDateKey: string;
  testID?: string;
}) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const selectedDate = parseDateKey(selectedDateKey) ?? new Date(`${selectedDateKey}T12:00:00`);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.calendarDateButton,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
      testID={testID}>
      <View style={styles.calendarDateButtonCopy}>
        <Text style={[styles.calendarDateButtonLabel, { color: theme.mutedText }]}>
          {helperLabel ?? 'Selected date'}
        </Text>
        <Text style={[styles.calendarDateButtonValue, { color: theme.text }]}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>
      <View
        style={[
          styles.calendarDateButtonIconWrap,
          { backgroundColor: theme.accentSoft, borderColor: theme.border },
        ]}>
        <Feather color={theme.accent} name="calendar" size={18} />
        <Feather color={theme.accent} name="chevron-right" size={16} />
      </View>
    </Pressable>
  );
}

type CalendarPickerProps = {
  monthAnchor: Date;
  onClose: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onSelectDate: (dateKey: string) => void;
  selectedDateKey: string;
};

function CalendarPickerContent({
  monthAnchor,
  onClose,
  onNextMonth,
  onPreviousMonth,
  onSelectDate,
  selectedDateKey,
}: CalendarPickerProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const { cells, monthLabel, weekdayLabels } = useMemo(
    () => buildCalendarMonth(monthAnchor),
    [monthAnchor],
  );
  const calendarRows = useMemo(() => {
    const rows: typeof cells[] = [];
    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7));
    }
    return rows;
  }, [cells]);

  return (
    <View style={styles.calendarOverlay}>
      <View
        style={[
          styles.calendarModal,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <View style={styles.calendarHeader}>
          <View style={styles.calendarHeaderCopy}>
            <Text style={[styles.calendarHeaderEyebrow, { color: theme.accent }]}>
              Calendar
            </Text>
            <Text style={[styles.calendarHeaderTitle, { color: theme.text }]}>{monthLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[
              styles.calendarCloseButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-calendar-close">
            <Feather color={theme.text} name="x" size={18} />
          </Pressable>
        </View>

        <View style={styles.calendarMonthActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onPreviousMonth}
            style={[
              styles.calendarMonthButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-calendar-previous-month">
            <Feather color={theme.text} name="chevron-left" size={18} />
          </Pressable>
          <View
            style={[
              styles.calendarMonthLabelWrap,
              { backgroundColor: theme.accentSoft, borderColor: theme.border },
            ]}>
            <Text style={[styles.calendarMonthLabel, { color: theme.accent }]}>{monthLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onNextMonth}
            style={[
              styles.calendarMonthButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-calendar-next-month">
            <Feather color={theme.text} name="chevron-right" size={18} />
          </Pressable>
        </View>

        <View style={styles.calendarWeekdayRow}>
          {weekdayLabels.map((label) => (
            <Text
              key={label}
              style={[styles.calendarWeekdayLabel, { color: theme.mutedText }]}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarRows.map((row, rowIndex) => (
            <View key={`calendar-row-${rowIndex}`} style={styles.calendarGridRow}>
              {row.map((cell) => {
                const isSelected = cell.dateKey === selectedDateKey;
                return (
                  <Pressable
                    key={cell.dateKey}
                    accessibilityRole="button"
                    onPress={() => onSelectDate(cell.dateKey)}
                    style={[
                      styles.calendarDayCell,
                      {
                        backgroundColor: isSelected
                          ? theme.accent
                          : cell.isToday
                            ? theme.accentSoft
                            : theme.surfaceMuted,
                        borderColor: isSelected
                          ? theme.accent
                          : cell.isToday
                            ? theme.accent
                            : theme.border,
                      },
                    ]}
                    testID={`mobile-calendar-day-${cell.dateKey}`}>
                    <Text
                      style={[
                        isSelected ? styles.calendarDayTextSelected : styles.calendarDayText,
                        {
                          color: isSelected
                            ? '#ffffff'
                            : cell.inCurrentMonth
                              ? theme.text
                              : theme.mutedText,
                        },
                      ]}>
                      {cell.dayNumber}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function CalendarPickerInlineOverlay({
  visible,
  ...props
}: CalendarPickerProps & { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.inlineCalendarOverlay}>
      <CalendarPickerContent {...props} />
    </View>
  );
}

function CalendarPickerModal({
  visible,
  ...props
}: CalendarPickerProps & { visible: boolean }) {
  return (
    <Modal
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      visible={visible}>
      <CalendarPickerContent {...props} />
    </Modal>
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
  const insets = useSafeAreaInsets();
  const safeTop = insets.top || initialWindowMetrics?.insets.top || 0;
  const safeBottom = insets.bottom || initialWindowMetrics?.insets.bottom || 0;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.sheetScreen,
          { backgroundColor: theme.background, paddingTop: safeTop, paddingBottom: safeBottom },
        ]}>
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
            ]}
            testID="mobile-schedule-sheet-close">
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
  accessMode = 'owner',
  composerCustomers,
  composerError,
  data,
  error,
  isComposerLoading,
  isLoading,
  isRefreshing,
  notificationsError,
  notificationsPermissionStatus = 'undetermined',
  servicesSummary,
  staffViewerName,
  onCreateAppointment,
  onCreateAppointmentCustomer,
  onDeleteAppointment,
  onJumpToToday,
  onLoadComposerResources,
  onNextDate,
  onEnablePushNotifications,
  onSelectDate,
  onPreviousDate,
  onRefresh,
  onSignOut,
  onUpdateAppointment,
}: MobileScheduleScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const isViewingToday = data?.selectedDate === formatDateKey(new Date());
  const isStaffMode = accessMode === 'staff';
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
    serviceId: '',
    staffId: '',
    duration: 60,
    notes: '',
  });
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget | null>(null);
  const [calendarMonthAnchor, setCalendarMonthAnchor] = useState<Date>(
    parseDateKey(data?.selectedDate ?? formatDateKey(new Date())) ?? new Date(),
  );
  const [activeAppointmentAction, setActiveAppointmentAction] = useState<{
    id: string;
    action: 'confirm' | 'cancel';
  } | null>(null);

  const availableServices = servicesSummary?.services.filter((service) => service.isActive) ?? [];
  const availableStaff = servicesSummary?.staff.filter((staff) => staff.isActive) ?? [];
  const selectedCreateServiceIds = createForm.serviceIds.length
    ? createForm.serviceIds
    : createForm.serviceId
      ? [createForm.serviceId]
      : [];
  const selectedCreateServices = selectedCreateServiceIds
    .map((serviceId) => availableServices.find((service) => service.id === serviceId))
    .filter((service): service is MobileServiceRecord => Boolean(service));
  const selectedCreateService = selectedCreateServices[0] ?? null;
  const selectedEditService =
    editForm.serviceId
      ? availableServices.find((service) => service.id === editForm.serviceId) ?? null
      : null;
  const createEffectiveDuration = selectedCreateServices.length
    ? selectedCreateServices.reduce((sum, service) => sum + service.duration, 0)
    : createForm.duration;
  const editEffectiveDuration = selectedEditService?.duration ?? editForm.duration;
  const getCreateEligibleStaffForService = (serviceId: string) =>
    availableStaff.filter((staff) => staffCanPerformService(staff, serviceId));
  const createEligibleStaff = selectedCreateService
    ? getCreateEligibleStaffForService(selectedCreateService.id)
    : availableStaff;
  const editEligibleStaff = selectedEditService
    ? availableStaff.filter((staff) => staffCanPerformService(staff, selectedEditService.id))
    : availableStaff;
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

  const selectedScheduleDateKey = data?.selectedDate ?? formatDateKey(new Date());
  const pendingAppointments = useMemo(
    () => data?.appointments.filter((appointment) => appointment.canConfirm) ?? [],
    [data?.appointments],
  );
  const createSuggestedTimeOptions = useMemo(
    () => {
      if (!selectedCreateServices.length) {
        return [];
      }

      return getSuggestedTimeOptions({
        dateKey: createForm.date,
        duration: createEffectiveDuration,
        staffId:
          selectedCreateServiceIds.length === 1
            ? createForm.serviceStaffAssignments[selectedCreateServiceIds[0]] || createForm.staffId
            : '',
        staff: createEligibleStaff,
      });
    },
    [
      createEffectiveDuration,
      createEligibleStaff,
      createForm.date,
      createForm.serviceStaffAssignments,
      createForm.staffId,
      selectedCreateServiceIds,
      selectedCreateServices.length,
    ],
  );
  const editSuggestedTimeOptions = useMemo(
    () =>
      editingAppointment
        ? getSuggestedTimeOptions({
            dateKey: editForm.date,
            duration: editEffectiveDuration,
            staffId: editForm.staffId,
            staff: editEligibleStaff,
          })
        : [],
    [editEffectiveDuration, editEligibleStaff, editForm.date, editForm.staffId, editingAppointment],
  );
  const activeCalendarDateKey =
    calendarTarget === 'create'
      ? createForm.date
      : calendarTarget === 'edit'
        ? editForm.date
        : selectedScheduleDateKey;

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

    const selectedCustomerStillAvailable = composerCustomers.some(
      (customer) => customer.id === createForm.customerId,
    );

    if (selectedCustomerStillAvailable) {
      return;
    }

    if (customerSearch.trim()) {
      if (createForm.customerId) {
        setCreateForm((current) => ({ ...current, customerId: '' }));
      }
      return;
    }

    const [defaultCustomer] = composerCustomers;
    if (!defaultCustomer) {
      if (createForm.customerId) {
        setCreateForm((current) => ({ ...current, customerId: '' }));
      }
      return;
    }

    setCreateForm((current) => ({
      ...current,
      customerId: defaultCustomer.id,
    }));
    setSheetError((current) =>
      current === 'Choose an existing customer first.' ? null : current,
    );
  }, [
    composerCustomers,
    createForm.customerId,
    customerMode,
    customerSearch,
    isCreateSheetVisible,
  ]);

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

  useEffect(() => {
    if (!isCreateSheetVisible || !createSuggestedTimeOptions.length) {
      return;
    }

    if (createSuggestedTimeOptions.includes(createForm.time)) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      time: createSuggestedTimeOptions[0] ?? '',
    }));
  }, [createForm.time, createSuggestedTimeOptions, isCreateSheetVisible]);

  useEffect(() => {
    if (!isCreateSheetVisible || !availableServices.length) {
      return;
    }

    const selectedServiceStillActive = availableServices.some(
      (service) => service.id === createForm.serviceId,
    );

    if (selectedServiceStillActive) {
      return;
    }

    const [defaultService] = availableServices;
    if (!defaultService) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      serviceId: defaultService.id,
      serviceIds: [defaultService.id],
      duration: defaultService.duration,
      time: '',
    }));
  }, [availableServices, createForm.serviceId, createForm.serviceIds.length, isCreateSheetVisible]);

  useEffect(() => {
    if (!selectedCreateServices.length) return;

    const nextAssignments = { ...createForm.serviceStaffAssignments };
    let changed = false;

    for (const service of selectedCreateServices) {
      const staffId = nextAssignments[service.id];
      if (!staffId) continue;
      if (getCreateEligibleStaffForService(service.id).some((staff) => staff.id === staffId)) {
        continue;
      }

      delete nextAssignments[service.id];
      changed = true;
    }

    if (!changed) return;

    setCreateForm((current) => ({
      ...current,
      serviceStaffAssignments: nextAssignments,
      staffId: '',
      time: '',
    }));
  }, [availableStaff, createForm.serviceStaffAssignments, selectedCreateServices]);

  useEffect(() => {
    if (!selectedEditService || !editForm.staffId) {
      return;
    }

    if (editEligibleStaff.some((staff) => staff.id === editForm.staffId)) {
      return;
    }

    setEditForm((current) => ({
      ...current,
      staffId: '',
      time: '',
    }));
  }, [editEligibleStaff, editForm.staffId, selectedEditService]);

  useEffect(() => {
    if (!editingAppointment || !editSuggestedTimeOptions.length) {
      return;
    }

    if (editSuggestedTimeOptions.includes(editForm.time)) {
      return;
    }

    setEditForm((current) => ({
      ...current,
      time: editSuggestedTimeOptions[0] ?? '',
    }));
  }, [editForm.time, editSuggestedTimeOptions, editingAppointment]);

  const openCreateSheet = () => {
    if (isStaffMode) {
      return;
    }

    setSheetError(null);
    setCustomerMode('existing');
    setCustomerSearch('');
    const initialForm = createInitialAppointmentForm(data?.selectedDate ?? formatDateKey(new Date()));
    const [defaultService] = availableServices;
    setCreateForm(
      defaultService
        ? {
            ...initialForm,
            serviceId: defaultService.id,
            serviceIds: [defaultService.id],
            duration: defaultService.duration,
          }
        : initialForm,
    );
    setIsCreateSheetVisible(true);
    void onLoadComposerResources();
  };

  const openEditSheet = (appointment: MobileAppointmentEntry) => {
    setSheetError(null);
    setEditingAppointment(appointment);
    setEditForm(createEditForm(appointment));
  };

  const openCalendar = (target: CalendarTarget, dateKey: string) => {
    setCalendarTarget(target);
    setCalendarMonthAnchor(parseDateKey(dateKey) ?? new Date(`${dateKey}T12:00:00`));
  };

  const closeCalendar = () => {
    setCalendarTarget(null);
  };

  const handleCalendarSelect = (dateKey: string) => {
    if (calendarTarget === 'schedule') {
      onSelectDate(dateKey);
    }

    if (calendarTarget === 'create') {
      setCreateForm((current) => ({ ...current, date: dateKey, time: '' }));
    }

    if (calendarTarget === 'edit') {
      setEditForm((current) => ({ ...current, date: dateKey, time: '' }));
    }

    closeCalendar();
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
    if (!selectedCreateServices.length) {
      setSheetError('Add and select an active service before creating the appointment.');
      return;
    }

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
        serviceId: selectedCreateServiceIds[0] || null,
        serviceIds: selectedCreateServiceIds,
        staffId:
          selectedCreateServiceIds.length === 1
            ? createForm.serviceStaffAssignments[selectedCreateServiceIds[0]] || createForm.staffId || null
            : null,
        serviceStaffAssignments: selectedCreateServiceIds.map((serviceId) => ({
          serviceId,
          staffId: createForm.serviceStaffAssignments[serviceId] || null,
        })),
        startTime: start.toISOString(),
        startDate: createForm.date,
        startTimeLocal: createForm.time,
        duration: createEffectiveDuration,
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
        startDate: editForm.date,
        startTimeLocal: editForm.time,
        duration: editEffectiveDuration,
        serviceId: editForm.serviceId || null,
        serviceIds: editForm.serviceId ? [editForm.serviceId] : [],
        staffId: editForm.staffId || null,
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
              <Text style={[styles.eyebrow, { color: theme.accent }]}>
                {isStaffMode ? 'Employee schedule' : 'Appointments'}
              </Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {data?.dateLabel ?? 'Daily appointments'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
                {isStaffMode
                  ? `${staffViewerName ?? 'Staff'} can view assigned appointments only. Customer phone numbers stay hidden.`
                  : 'Review, confirm, edit, and create bookings from the same native flow.'}
              </Text>
            </View>
            {isStaffMode ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void onSignOut?.()}
                style={[styles.staffSignOutButton, { borderColor: theme.border }]}
                testID="mobile-staff-signout">
                <Text style={[styles.staffSignOutButtonText, { color: theme.text }]}>Sign out</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={openCreateSheet}
                style={[styles.addButton, { backgroundColor: theme.accent }]}
                testID="mobile-schedule-add">
                <Text style={styles.addButtonText}>New</Text>
              </Pressable>
            )}
          </View>

          <CalendarDateButton
            helperLabel="Appointment day"
            onPress={() => openCalendar('schedule', selectedScheduleDateKey)}
            selectedDateKey={selectedScheduleDateKey}
            testID="mobile-schedule-open-calendar"
          />

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
        {isStaffMode ? (
          <View
            style={[
              styles.privacyCard,
              { backgroundColor: theme.accentSoft, borderColor: theme.border },
            ]}
            testID="mobile-staff-privacy-card">
            <Feather name="lock" size={18} color={theme.accent} />
            <View style={styles.privacyCopy}>
              <Text style={[styles.privacyTitle, { color: theme.text }]}>
                Customer privacy is on
              </Text>
              <Text style={[styles.privacyText, { color: theme.mutedText }]}>
                You can see customer names, services, times, and notes for your assigned
                appointments. Phone numbers and customer records are hidden.
              </Text>
            </View>
          </View>
        ) : null}

        {isStaffMode ? (
          <View
            style={[
              styles.privacyCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            testID="mobile-staff-notifications-card">
            <Feather
              name={notificationsPermissionStatus === 'granted' ? 'bell' : 'bell-off'}
              size={18}
              color={theme.accent}
            />
            <View style={styles.privacyCopy}>
              <Text style={[styles.privacyTitle, { color: theme.text }]}>
                Appointment alerts{' '}
                {notificationsPermissionStatus === 'granted' ? 'are on' : 'need setup'}
              </Text>
              <Text style={[styles.privacyText, { color: theme.mutedText }]}>
                {notificationsPermissionStatus === 'granted'
                  ? 'This phone is ready to receive push alerts when a booking is assigned to you.'
                  : 'Turn on notifications so assigned appointments can pop up on this phone.'}
              </Text>
              {notificationsError ? (
                <Text style={[styles.privacyText, { color: theme.danger }]}>
                  {notificationsError}
                </Text>
              ) : null}
              {notificationsPermissionStatus !== 'granted' && onEnablePushNotifications ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onEnablePushNotifications()}
                  style={[styles.notificationSetupButton, { borderColor: theme.accent }]}
                  testID="mobile-staff-enable-notifications">
                  <Feather name="check-circle" size={16} color={theme.accent} />
                  <Text style={[styles.notificationSetupButtonText, { color: theme.accent }]}>
                    Enable alerts
                  </Text>
                </Pressable>
              ) : null}
            </View>
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
              {!isStaffMode && pendingAppointments.length ? (
                <View
                  style={[
                    styles.pendingAttentionCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.pendingAttentionTitle, { color: theme.text }]}>
                    {pendingAppointments.length} appointment
                    {pendingAppointments.length === 1 ? '' : 's'} waiting for confirmation
                  </Text>
                  <Text style={[styles.pendingAttentionText, { color: theme.mutedText }]}>
                    Confirm pending bookings quickly so your customer and team are synced right from
                    the iPhone.
                  </Text>
                </View>
              ) : null}

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

                      {!isStaffMode ? (
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
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                    Nothing is booked yet
                  </Text>
                  <Text style={[styles.emptyStateText, { color: theme.mutedText }]}>
                    {isStaffMode
                      ? 'Assigned bookings will appear here without exposing customer phone numbers.'
                      : 'Create a service-based appointment here instead of jumping back to the web dashboard.'}
                  </Text>
                  {!isStaffMode ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={openCreateSheet}
                      style={[styles.emptyStateButton, { backgroundColor: theme.accent }]}
                      testID="mobile-schedule-empty-create">
                      <Text style={styles.emptyStateButtonText}>Create appointment</Text>
                    </Pressable>
                  ) : null}
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
                  onPress={() => {
                    setCustomerMode(mode);
                    setSheetError(null);
                  }}
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
                          accessibilityState={{ selected: createForm.customerId === customer.id }}
                          onPress={() => {
                            setCreateForm((current) => ({
                              ...current,
                              customerId: customer.id,
                            }));
                            setSheetError((current) =>
                              current === 'Choose an existing customer first.' ? null : current,
                            );
                          }}
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
            <SectionLabel label="Service & staff" />
            <Text style={[styles.helperText, { color: theme.mutedText }]}>
              Pick one or more services. Multiple services run back-to-back, and each service can
              have its own employee.
            </Text>

            <SectionLabel label="Services" />
            {availableServices.length ? (
              <>
                <View style={styles.segmentRow}>
                  {availableServices.map((service) => (
                    <OptionChip
                      key={service.id}
                      label={service.name}
                      onPress={() =>
                        setCreateForm((current) => {
                          const alreadySelected = current.serviceIds.includes(service.id);
                          const serviceIds = alreadySelected
                            ? current.serviceIds.filter((serviceId) => serviceId !== service.id)
                            : [...current.serviceIds, service.id];
                          const serviceStaffAssignments = {
                            ...current.serviceStaffAssignments,
                          };
                          if (alreadySelected) {
                            delete serviceStaffAssignments[service.id];
                          }
                          const primaryServiceId = serviceIds[0] ?? '';
                          const duration = serviceIds.length
                            ? serviceIds.reduce((sum, serviceId) => {
                                const selected = availableServices.find(
                                  (entry) => entry.id === serviceId,
                                );
                                return sum + (selected?.duration ?? 0);
                              }, 0)
                            : current.duration;

                          return {
                            ...current,
                            serviceId: primaryServiceId,
                            serviceIds,
                            serviceStaffAssignments,
                            staffId: primaryServiceId
                              ? serviceStaffAssignments[primaryServiceId] ?? ''
                              : '',
                            duration,
                            time: '',
                          };
                        })
                      }
                      selected={selectedCreateServiceIds.includes(service.id)}
                      testID={`mobile-schedule-create-service-${service.id}`}
                    />
                  ))}
                </View>

                {selectedCreateServices.length ? (
                  <View
                    style={[
                      styles.summaryCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.summaryCardTitle, { color: theme.text }]}>
                      {selectedCreateServices.length === 1
                        ? selectedCreateServices[0].name
                        : `${selectedCreateServices.length} services selected`}
                    </Text>
                    <Text style={[styles.summaryCardText, { color: theme.mutedText }]}>
                      {createEffectiveDuration} min total · consecutive appointment
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={[styles.warningText, { color: '#c47f00' }]}>
                No active services are set up yet. Add services in Services & Staff so mobile
                bookings can use the same service-based flow as the web dashboard.
              </Text>
            )}

            {selectedCreateServices.length ? (
              <>
                <SectionLabel label="Staff by service" />
                <View style={styles.staffChoiceStack}>
                  {selectedCreateServices.map((service, index) => {
                    const assignedStaffId = createForm.serviceStaffAssignments[service.id] ?? '';
                    const eligibleStaffForService = getCreateEligibleStaffForService(service.id);
                    return (
                      <View
                        key={service.id}
                        style={[
                          styles.serviceStaffCard,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        ]}>
                        <Text style={[styles.staffChoiceTitle, { color: theme.text }]}>
                          {index + 1}. {service.name}
                        </Text>
                        <Text style={[styles.staffChoiceRole, { color: theme.mutedText }]}>
                          {service.durationLabel} · choose who performs this service.
                        </Text>
                        <View style={styles.staffChoiceStack}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: !assignedStaffId }}
                            onPress={() =>
                              setCreateForm((current) => ({
                                ...current,
                                serviceStaffAssignments: {
                                  ...current.serviceStaffAssignments,
                                  [service.id]: '',
                                },
                                staffId: index === 0 ? '' : current.staffId,
                                time: '',
                              }))
                            }
                            style={[
                              styles.staffChoiceCard,
                              {
                                backgroundColor: !assignedStaffId
                                  ? theme.accentSoft
                                  : theme.surface,
                                borderColor: !assignedStaffId ? theme.accent : theme.border,
                              },
                            ]}
                            testID={`mobile-schedule-create-staff-any-${service.id}`}>
                            <View style={styles.staffChoiceHeader}>
                              <View style={styles.staffChoiceCopy}>
                                <Text style={[styles.staffChoiceTitle, { color: theme.text }]}>
                                  Any available
                                </Text>
                                <Text style={[styles.staffChoiceRole, { color: theme.mutedText }]}>
                                  Clientific can assign an open employee for this service.
                                </Text>
                              </View>
                              {!assignedStaffId ? (
                                <View
                                  style={[
                                    styles.staffSelectedBadge,
                                    { backgroundColor: theme.accent },
                                  ]}>
                                  <Text style={styles.staffSelectedBadgeText}>Selected</Text>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                          {eligibleStaffForService.map((staff) => (
                            <StaffChoiceCard
                              key={staff.id}
                              member={staff}
                              onPress={() =>
                                setCreateForm((current) => ({
                                  ...current,
                                  serviceStaffAssignments: {
                                    ...current.serviceStaffAssignments,
                                    [service.id]: staff.id,
                                  },
                                  staffId: index === 0 ? staff.id : current.staffId,
                                  time: '',
                                }))
                              }
                              selected={assignedStaffId === staff.id}
                              testIDPrefix={
                                selectedCreateServices.length === 1
                                  ? 'mobile-schedule-create-staff'
                                  : `mobile-schedule-create-staff-${service.id}`
                              }
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

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
            <SectionLabel label="When" />
            <Text style={[styles.helperText, { color: theme.mutedText }]}>
              Use the calendar to pick the day, then choose from the available slots for this
              appointment.
            </Text>

            <CalendarDateButton
              helperLabel="Appointment date"
              onPress={() => openCalendar('create', createForm.date)}
              selectedDateKey={createForm.date}
              testID="mobile-schedule-create-open-calendar"
            />

            <View style={styles.quickDateRow}>
              {[
                { label: 'Today', value: formatDateKey(new Date()) },
                { label: 'Tomorrow', value: getTomorrowKey() },
              ].map((choice) => (
                <OptionChip
                  key={choice.label}
                  label={choice.label}
                  onPress={() =>
                    setCreateForm((current) => ({ ...current, date: choice.value, time: '' }))
                  }
                  selected={createForm.date === choice.value}
                />
              ))}
            </View>

            <Text style={[styles.helperText, { color: theme.mutedText }]}>
              {selectedCreateServices.length
                ? selectedCreateServices.length === 1
                  ? `Available slots are based on ${selectedCreateServices[0].name} (${selectedCreateServices[0].durationLabel}).`
                  : `Available slots reserve ${createEffectiveDuration} minutes for ${selectedCreateServices.length} consecutive services.`
                : 'Add an active service before choosing an appointment time.'}
            </Text>

            <SectionLabel label="Available start times" />
            <View style={styles.timeSlotGrid}>
              {createSuggestedTimeOptions.map((timeValue) => (
                <TimeSlotChip
                  key={timeValue}
                  label={formatScheduleTimeLabel(timeValue)}
                  onPress={() =>
                    setCreateForm((current) => ({ ...current, time: timeValue }))
                  }
                  selected={createForm.time === timeValue}
                  testID={`mobile-schedule-create-time-${timeValue}`}
                />
              ))}
            </View>
            {!createSuggestedTimeOptions.length ? (
              <Text style={[styles.warningText, { color: '#c47f00' }]}>
                {selectedCreateServices.length
                  ? 'No suggested times are available for this day yet. Pick another date or staff member.'
                  : 'Start times will appear after you add an active service.'}
              </Text>
            ) : null}

            <SectionLabel label="Notes" />
            <Text style={[styles.helperText, { color: theme.mutedText }]}>
              The appointment will save for {createForm.date} at{' '}
              {createForm.time ? formatTimePreview(createForm.time) : 'the selected time'}.
            </Text>
          </View>

          <View
            style={[
              styles.detailSectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <SectionLabel label="Appointment texts" />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: createForm.appointmentSmsConsent }}
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
                  styles.consentCheckmark,
                  {
                    backgroundColor: createForm.appointmentSmsConsent
                      ? theme.accent
                      : 'transparent',
                    borderColor: createForm.appointmentSmsConsent
                      ? theme.accent
                      : theme.border,
                  },
                ]}
                testID="mobile-schedule-appointment-sms-indicator">
                {createForm.appointmentSmsConsent ? (
                  <Feather color="#ffffff" name="check" size={18} />
                ) : null}
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
            accessibilityState={{
              disabled: isSubmittingCreate || !selectedCreateServices.length,
            }}
            disabled={isSubmittingCreate || !selectedCreateServices.length}
            onPress={() => void handleSubmitCreate()}
            style={[
              styles.footerPrimaryButton,
              {
                backgroundColor: theme.accent,
                opacity: isSubmittingCreate || !selectedCreateServices.length ? 0.55 : 1,
              },
            ]}
            testID="mobile-schedule-create-submit">
            <Text style={styles.footerPrimaryButtonText}>
              {isSubmittingCreate
                ? 'Creating...'
                : selectedCreateServices.length
                  ? 'Create appointment'
                  : 'Add a service first'}
            </Text>
          </Pressable>
        </View>
        <CalendarPickerInlineOverlay
          monthAnchor={calendarMonthAnchor}
          onClose={closeCalendar}
          onNextMonth={() => setCalendarMonthAnchor((current) => addMonths(current, 1))}
          onPreviousMonth={() => setCalendarMonthAnchor((current) => addMonths(current, -1))}
          onSelectDate={handleCalendarSelect}
          selectedDateKey={activeCalendarDateKey}
          visible={calendarTarget === 'create'}
        />
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
                <SectionLabel label="Service & staff" />
                <Text style={[styles.helperText, { color: theme.mutedText }]}>
                  Change the service, staff member, date, or time. Online and AI bookings with
                  appointment-text consent will receive an updated SMS automatically.
                </Text>

                <SectionLabel label="Service" />
                {availableServices.length ? (
                  <View style={styles.segmentRow}>
                    {availableServices.map((service) => (
                      <OptionChip
                        key={service.id}
                        label={service.name}
                        onPress={() =>
                          setEditForm((current) => ({
                            ...current,
                            serviceId: service.id,
                            duration: service.duration,
                            staffId:
                              current.staffId && service.id !== current.serviceId
                                ? ''
                                : current.staffId,
                            time: '',
                          }))
                        }
                        selected={editForm.serviceId === service.id}
                        testID={`mobile-schedule-edit-service-${service.id}`}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.warningText, { color: '#c47f00' }]}>
                    No active services are set up yet, so this appointment can only keep manual
                    timing until services are added.
                  </Text>
                )}

                {selectedEditService ? (
                  <View
                    style={[
                      styles.summaryCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.summaryCardTitle, { color: theme.text }]}>
                      {selectedEditService.name}
                    </Text>
                    <Text style={[styles.summaryCardText, { color: theme.mutedText }]}>
                      {selectedEditService.durationLabel}
                    </Text>
                  </View>
                ) : null}

                <SectionLabel label="Staff" />
                <View style={styles.staffChoiceStack}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !editForm.staffId }}
                    onPress={() => setEditForm((current) => ({ ...current, staffId: '', time: '' }))}
                    style={[
                      styles.staffChoiceCard,
                      {
                        backgroundColor: !editForm.staffId ? theme.accentSoft : theme.surfaceMuted,
                        borderColor: !editForm.staffId ? theme.accent : theme.border,
                      },
                    ]}
                    testID="mobile-schedule-edit-staff-any">
                    <View style={styles.staffChoiceHeader}>
                      <View style={styles.staffChoiceCopy}>
                        <Text style={[styles.staffChoiceTitle, { color: theme.text }]}>
                          Any available team member
                        </Text>
                        <Text style={[styles.staffChoiceRole, { color: theme.mutedText }]}>
                          Uses the first open employee who can perform the selected service.
                        </Text>
                      </View>
                      {!editForm.staffId ? (
                        <View style={[styles.staffSelectedBadge, { backgroundColor: theme.accent }]}>
                          <Text style={styles.staffSelectedBadgeText}>Selected</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                  {editEligibleStaff.map((staff) => (
                    <StaffChoiceCard
                      key={staff.id}
                      member={staff}
                      onPress={() =>
                        setEditForm((current) => ({ ...current, staffId: staff.id, time: '' }))
                      }
                      selected={editForm.staffId === staff.id}
                      testIDPrefix="mobile-schedule-edit-staff"
                    />
                  ))}
                </View>

                <SectionLabel label="Date" />
                <CalendarDateButton
                  helperLabel="Appointment date"
                  onPress={() => openCalendar('edit', editForm.date)}
                  selectedDateKey={editForm.date}
                  testID="mobile-schedule-edit-open-calendar"
                />
                {!selectedEditService ? (
                  <>
                    <SectionLabel label="Manual duration" />
                    <View style={styles.segmentRow}>
                      {MANUAL_APPOINTMENT_DURATIONS.map((duration) => (
                        <OptionChip
                          key={duration}
                          label={formatManualDurationLabel(duration)}
                          onPress={() => setEditForm((current) => ({ ...current, duration }))}
                          selected={editForm.duration === duration}
                          testID={`mobile-schedule-edit-duration-${duration}`}
                        />
                      ))}
                    </View>
                  </>
                ) : null}
                <SectionLabel label="Available start times" />
                <View style={styles.timeSlotGrid}>
                  {editSuggestedTimeOptions.map((timeValue) => (
                    <TimeSlotChip
                      key={timeValue}
                      label={formatScheduleTimeLabel(timeValue)}
                      onPress={() =>
                        setEditForm((current) => ({ ...current, time: timeValue }))
                      }
                      selected={editForm.time === timeValue}
                      testID={`mobile-schedule-edit-time-${timeValue}`}
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
        <CalendarPickerInlineOverlay
          monthAnchor={calendarMonthAnchor}
          onClose={closeCalendar}
          onNextMonth={() => setCalendarMonthAnchor((current) => addMonths(current, 1))}
          onPreviousMonth={() => setCalendarMonthAnchor((current) => addMonths(current, -1))}
          onSelectDate={handleCalendarSelect}
          selectedDateKey={activeCalendarDateKey}
          visible={calendarTarget === 'edit'}
        />
      </AppointmentSheet>

      <CalendarPickerModal
        monthAnchor={calendarMonthAnchor}
        onClose={closeCalendar}
        onNextMonth={() => setCalendarMonthAnchor((current) => addMonths(current, 1))}
        onPreviousMonth={() => setCalendarMonthAnchor((current) => addMonths(current, -1))}
        onSelectDate={handleCalendarSelect}
        selectedDateKey={activeCalendarDateKey}
        visible={calendarTarget === 'schedule'}
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
  staffSignOutButton: {
    minWidth: 86,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  staffSignOutButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  calendarDateButton: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarDateButtonCopy: {
    flex: 1,
    gap: 4,
  },
  calendarDateButtonLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  calendarDateButtonValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  calendarDateButtonAction: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  calendarDateButtonIconWrap: {
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  privacyCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  privacyCopy: {
    flex: 1,
    gap: 4,
  },
  privacyTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  notificationSetupButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationSetupButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
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
    position: 'relative',
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
  staffChoiceStack: {
    gap: 10,
  },
  serviceStaffCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  staffChoiceCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 7,
  },
  staffChoiceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  staffChoiceCopy: {
    flex: 1,
    gap: 3,
  },
  staffChoiceTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  staffChoiceRole: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  staffChoiceBio: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  staffChoiceMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  staffSelectedBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  staffSelectedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  summaryCardTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  summaryCardText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
  timeSlotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlotChip: {
    minWidth: 108,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotChipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  timeSlotChipSelectedText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
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
  pendingAttentionCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  pendingAttentionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  pendingAttentionText: {
    fontSize: 14,
    lineHeight: 20,
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
  consentCheckmark: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.52)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  inlineCalendarOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  calendarModal: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  calendarHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  calendarHeaderEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  calendarHeaderTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  calendarCloseButton: {
    borderWidth: 1,
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  calendarMonthButton: {
    borderWidth: 1,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabelWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  calendarMonthLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarWeekdayLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  calendarGrid: {
    gap: 8,
  },
  calendarGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarDayCell: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarDayTextSelected: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
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
