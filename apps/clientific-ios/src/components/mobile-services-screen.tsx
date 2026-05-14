import React, { useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  MobileServiceGroupInput,
  MobileServiceGroupRecord,
  MobileServiceInput,
  MobileServiceRecord,
  MobileServicesSummary,
  MobileStaffInput,
  MobileStaffRecord,
  MobileStaffWorkHours,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileServicesScreenProps = {
  data: MobileServicesSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onCreateServiceGroup: (input: MobileServiceGroupInput) => Promise<void>;
  onCreateService: (input: MobileServiceInput) => Promise<void>;
  onCreateStaff: (input: MobileStaffInput) => Promise<void>;
  onDeleteServiceGroup: (groupId: string) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onReorderServiceGroups: (ids: string[]) => Promise<void>;
  onReorderServices: (ids: string[]) => Promise<void>;
  onUpdateServiceGroup: (groupId: string, input: MobileServiceGroupInput) => Promise<void>;
  onUpdateService: (serviceId: string, input: MobileServiceInput) => Promise<void>;
  onUpdateStaff: (staffId: string, input: MobileStaffInput) => Promise<void>;
};

type ServicesTab = 'services' | 'staff';

type ServiceFormState = {
  name: string;
  description: string;
  duration: string;
  price: string;
  isActive: boolean;
  groupId: string;
};

type GroupFormState = {
  name: string;
};

type StaffFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  bio: string;
  isActive: boolean;
  workDays: number[];
  workHours: MobileStaffWorkHours;
  serviceIds: string[];
};

const DAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function createEmptyServiceForm(): ServiceFormState {
  return {
    name: '',
    description: '',
    duration: '60',
    price: '',
    isActive: true,
    groupId: '',
  };
}

function createGroupForm(group?: MobileServiceGroupRecord | null): GroupFormState {
  return {
    name: group?.name ?? '',
  };
}

function ensureWorkHoursForDays(workDays: number[], workHours?: MobileStaffWorkHours) {
  const nextHours: MobileStaffWorkHours = {};

  for (const day of workDays) {
    nextHours[day] = workHours?.[day] ?? { startTime: '09:00', endTime: '17:00' };
  }

  return nextHours;
}

function createStaffForm(member?: MobileStaffRecord | null): StaffFormState {
  const workDays = member?.workDays?.length ? member.workDays : [1, 2, 3, 4, 5];

  return {
    fullName: member?.fullName ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    role: member?.role ?? '',
    bio: member?.bio ?? '',
    isActive: member?.isActive ?? true,
    workDays,
    workHours: ensureWorkHoursForDays(workDays, member?.workHours),
    serviceIds: member?.serviceIds ?? [],
  };
}

function createServiceForm(service?: MobileServiceRecord | null): ServiceFormState {
  return {
    name: service?.name ?? '',
    description: service?.description ?? '',
    duration: service ? String(service.duration) : '60',
    price: service?.price !== null && service?.price !== undefined ? String(service.price) : '',
    isActive: service?.isActive ?? true,
    groupId: service?.groupId ?? '',
  };
}

function FieldLabel({ label, themeText }: { label: string; themeText: string }) {
  return <Text style={[styles.fieldLabel, { color: themeText }]}>{label}</Text>;
}

function InlineErrorCard({ message, theme }: { message: string; theme: ReturnType<typeof getClientificTheme> }) {
  return (
    <View
      style={[
        styles.noticeCard,
        {
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.border,
        },
      ]}>
      <Text style={[styles.noticeTitle, { color: theme.danger }]}>Something needs attention</Text>
      <Text style={[styles.noticeText, { color: theme.text }]}>{message}</Text>
    </View>
  );
}

function FilterChip({
  label,
  onPress,
  selected,
  theme,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  theme: ReturnType<typeof getClientificTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.optionPill,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}>
      <Text
        style={
          selected
            ? styles.optionPillSelectedText
            : [styles.optionPillText, { color: theme.text }]
        }>
        {label}
      </Text>
    </Pressable>
  );
}

function FullScreenSheet({
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
              styles.headerCloseButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-services-sheet-close">
            <Text style={[styles.headerCloseButtonText, { color: theme.text }]}>Close</Text>
          </Pressable>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MobileServicesScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onCreateServiceGroup,
  onCreateService,
  onCreateStaff,
  onDeleteServiceGroup,
  onDeleteService,
  onDeleteStaff,
  onRefresh,
  onReorderServiceGroups,
  onReorderServices,
  onUpdateServiceGroup,
  onUpdateService,
  onUpdateStaff,
}: MobileServicesScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [activeTab, setActiveTab] = useState<ServicesTab>('services');
  const [editingGroup, setEditingGroup] = useState<MobileServiceGroupRecord | null>(null);
  const [editingService, setEditingService] = useState<MobileServiceRecord | null>(null);
  const [editingStaff, setEditingStaff] = useState<MobileStaffRecord | null>(null);
  const [isGroupSheetVisible, setIsGroupSheetVisible] = useState(false);
  const [isServiceSheetVisible, setIsServiceSheetVisible] = useState(false);
  const [isStaffSheetVisible, setIsStaffSheetVisible] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState>(createGroupForm);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(createEmptyServiceForm);
  const [staffForm, setStaffForm] = useState<StaffFormState>(createStaffForm);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const sortedGroups = useMemo(
    () => [...(data?.groups ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    [data?.groups],
  );
  const sortedServices = useMemo(
    () => [...(data?.services ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    [data?.services],
  );
  const sortedStaff = useMemo(
    () => [...(data?.staff ?? [])].sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [data?.staff],
  );

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(createGroupForm());
    setSheetError(null);
    setIsGroupSheetVisible(true);
  };

  const openEditGroup = (group: MobileServiceGroupRecord) => {
    setEditingGroup(group);
    setGroupForm(createGroupForm(group));
    setSheetError(null);
    setIsGroupSheetVisible(true);
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceForm(createEmptyServiceForm());
    setSheetError(null);
    setIsServiceSheetVisible(true);
  };

  const openEditService = (service: MobileServiceRecord) => {
    setEditingService(service);
    setServiceForm(createServiceForm(service));
    setSheetError(null);
    setIsServiceSheetVisible(true);
  };

  const openCreateStaff = () => {
    setEditingStaff(null);
    setStaffForm(createStaffForm());
    setSheetError(null);
    setIsStaffSheetVisible(true);
  };

  const handleMoveGroup = async (
    groupId: string,
    direction: 'up' | 'down',
  ) => {
    const currentIndex = sortedGroups.findIndex((group) => group.id === groupId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedGroups.length) {
      return;
    }

    const next = [...sortedGroups];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    await onReorderServiceGroups(next.map((group) => group.id));
  };

  const handleMoveService = async (
    serviceId: string,
    direction: 'up' | 'down',
    groupId: string | null,
  ) => {
    const scopedServices = sortedServices.filter(
      (service) => (service.groupId ?? null) === groupId,
    );
    const scopedIndex = scopedServices.findIndex((service) => service.id === serviceId);
    if (scopedIndex < 0) {
      return;
    }

    const targetScopedIndex = direction === 'up' ? scopedIndex - 1 : scopedIndex + 1;
    if (targetScopedIndex < 0 || targetScopedIndex >= scopedServices.length) {
      return;
    }

    const targetId = scopedServices[targetScopedIndex]?.id;
    if (!targetId) {
      return;
    }

    const next = [...sortedServices];
    const sourceIndex = next.findIndex((service) => service.id === serviceId);
    const targetIndex = next.findIndex((service) => service.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
    await onReorderServices(next.map((service) => service.id));
  };

  const handleSaveGroup = async () => {
    const name = groupForm.name.trim();
    if (!name) {
      setSheetError('Group name is required.');
      return;
    }

    setIsSavingGroup(true);
    setSheetError(null);

    try {
      const payload: MobileServiceGroupInput = { name };

      if (editingGroup) {
        await onUpdateServiceGroup(editingGroup.id, payload);
      } else {
        await onCreateServiceGroup(payload);
      }

      setIsGroupSheetVisible(false);
      setEditingGroup(null);
    } catch (saveError) {
      setSheetError(saveError instanceof Error ? saveError.message : 'Unable to save service group.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteCurrentGroup = async (groupToDelete?: MobileServiceGroupRecord | null) => {
    const targetGroup = groupToDelete ?? editingGroup;
    if (!targetGroup) {
      return;
    }

    Alert.alert(
      'Delete service group?',
      'Services in this group will move back to ungrouped.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSavingGroup(true);
              setSheetError(null);

              try {
                await onDeleteServiceGroup(targetGroup.id);
                setIsGroupSheetVisible(false);
                setEditingGroup(null);
              } catch (deleteError) {
                setSheetError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : 'Unable to delete service group.',
                );
              } finally {
                setIsSavingGroup(false);
              }
            })();
          },
        },
      ],
    );
  };

  const openEditStaff = (member: MobileStaffRecord) => {
    setEditingStaff(member);
    setStaffForm(createStaffForm(member));
    setSheetError(null);
    setIsStaffSheetVisible(true);
  };

  const toggleStaffDay = (day: number) => {
    setStaffForm((current) => {
      const isSelected = current.workDays.includes(day);
      const workDays = isSelected
        ? current.workDays.filter((currentDay) => currentDay !== day)
        : [...current.workDays, day].sort((left, right) => left - right);

      return {
        ...current,
        workDays,
        workHours: ensureWorkHoursForDays(workDays, current.workHours),
      };
    });
  };

  const handleSaveService = async () => {
    const duration = Number.parseInt(serviceForm.duration, 10);
    const price =
      serviceForm.price.trim().length > 0 ? Number.parseFloat(serviceForm.price) : null;

    if (!serviceForm.name.trim()) {
      setSheetError('Service name is required.');
      return;
    }

    if (!Number.isFinite(duration) || duration < 5) {
      setSheetError('Duration must be at least 5 minutes.');
      return;
    }

    if (serviceForm.price.trim().length > 0 && !Number.isFinite(price ?? Number.NaN)) {
      setSheetError('Price must be a valid number.');
      return;
    }

    setIsSavingService(true);
    setSheetError(null);

    try {
      const payload: MobileServiceInput = {
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        duration,
        price,
        isActive: serviceForm.isActive,
        groupId: serviceForm.groupId || null,
      };

      if (editingService) {
        await onUpdateService(editingService.id, payload);
      } else {
        await onCreateService(payload);
      }

      setIsServiceSheetVisible(false);
      setEditingService(null);
    } catch (saveError) {
      setSheetError(saveError instanceof Error ? saveError.message : 'Unable to save service.');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteCurrentService = async (serviceToDelete?: MobileServiceRecord | null) => {
    const targetService = serviceToDelete ?? editingService;
    if (!targetService) {
      return;
    }

    Alert.alert(
      'Delete service?',
      'Delete it only if you no longer need it. Existing appointment history stays in place.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSavingService(true);
              setSheetError(null);

              try {
                await onDeleteService(targetService.id);
                setIsServiceSheetVisible(false);
                setEditingService(null);
              } catch (deleteError) {
                setSheetError(
                  deleteError instanceof Error ? deleteError.message : 'Unable to delete service.',
                );
              } finally {
                setIsSavingService(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleSaveStaff = async () => {
    if (!staffForm.fullName.trim()) {
      setSheetError('Staff name is required.');
      return;
    }

    if (staffForm.workDays.length === 0) {
      setSheetError('Select at least one work day.');
      return;
    }

    const workHours = ensureWorkHoursForDays(staffForm.workDays, staffForm.workHours);
    const invalidSlot = staffForm.workDays.find((day) => {
      const slot = workHours[day];
      return !slot?.startTime || !slot?.endTime;
    });

    if (invalidSlot !== undefined) {
      setSheetError('Each selected work day needs a start and end time.');
      return;
    }

    setIsSavingStaff(true);
    setSheetError(null);

    try {
      const payload: MobileStaffInput = {
        fullName: staffForm.fullName.trim(),
        email: staffForm.email.trim() || null,
        phone: staffForm.phone.trim() || null,
        role: staffForm.role.trim() || null,
        bio: staffForm.bio.trim() || null,
        isActive: staffForm.isActive,
        workDays: staffForm.workDays,
        workHours,
        serviceIds: staffForm.serviceIds,
      };

      if (editingStaff) {
        await onUpdateStaff(editingStaff.id, payload);
      } else {
        await onCreateStaff(payload);
      }

      setIsStaffSheetVisible(false);
      setEditingStaff(null);
    } catch (saveError) {
      setSheetError(saveError instanceof Error ? saveError.message : 'Unable to save staff.');
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleDeleteCurrentStaff = async (staffToDelete?: MobileStaffRecord | null) => {
    const targetStaff = staffToDelete ?? editingStaff;
    if (!targetStaff) {
      return;
    }

    Alert.alert(
      'Delete staff member?',
      'Delete them only if they no longer need to appear in the booking roster.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSavingStaff(true);
              setSheetError(null);

              try {
                await onDeleteStaff(targetStaff.id);
                setIsStaffSheetVisible(false);
                setEditingStaff(null);
              } catch (deleteError) {
                setSheetError(
                  deleteError instanceof Error ? deleteError.message : 'Unable to delete staff.',
                );
              } finally {
                setIsSavingStaff(false);
              }
            })();
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
          <Text style={[styles.eyebrow, { color: theme.accent }]}>Services & staff</Text>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Menu and roster</Text>
          <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
            Keep the live booking menu, pricing, team availability, and assignments up to date from the app.
          </Text>

          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Services</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data?.counts.services ?? 0}</Text>
              <Text style={[styles.metricHelper, { color: theme.mutedText }]}>
                {data?.counts.activeServices ?? 0} active
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Staff</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data?.counts.staff ?? 0}</Text>
              <Text style={[styles.metricHelper, { color: theme.mutedText }]}>
                {data?.counts.activeStaff ?? 0} active
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.segmentedControl,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            {(['services', 'staff'] as const).map((tab) => {
              const selected = activeTab === tab;

              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.segmentButton,
                    selected
                      ? { backgroundColor: theme.accent, borderColor: theme.accent }
                      : { backgroundColor: 'transparent', borderColor: 'transparent' },
                  ]}
                  testID={`mobile-services-tab-${tab}`}>
                  <Text
                    style={
                      selected
                        ? styles.segmentButtonSelectedText
                        : [styles.segmentButtonText, { color: theme.text }]
                    }>
                    {tab === 'services' ? 'Services' : 'Staff'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <InlineErrorCard message={error} theme={theme} /> : null}

        {isLoading && !data ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>
              Loading services and staff...
            </Text>
          </View>
        ) : null}

        {data ? (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {activeTab === 'services' ? 'Services' : 'Staff'}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.mutedText }]}>
                  {activeTab === 'services'
                    ? 'Add, edit, pause, or clean up the services guests can book.'
                    : 'Manage who shows up for customers, which services they cover, and when they work.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={activeTab === 'services' ? openCreateService : openCreateStaff}
                style={[styles.addButton, { backgroundColor: theme.accent }]}
                testID={activeTab === 'services' ? 'mobile-add-service' : 'mobile-add-staff'}>
                <Text style={styles.addButtonText}>
                  {activeTab === 'services' ? 'Add service' : 'Add staff'}
                </Text>
              </Pressable>
            </View>

            {activeTab === 'services' ? (
              <>
                <View
                  style={[
                    styles.subsectionCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <View style={styles.subsectionHeader}>
                    <View style={styles.subsectionCopy}>
                      <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                        Service groups
                      </Text>
                      <Text style={[styles.subsectionText, { color: theme.mutedText }]}>
                        Mirror the booking sections from the web dashboard, then keep them in the right order.
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={openCreateGroup}
                      style={[styles.addButton, { backgroundColor: theme.accent }]}
                      testID="mobile-open-group-sheet">
                      <Text style={styles.addButtonText}>Add group</Text>
                    </Pressable>
                  </View>

                  {sortedGroups.length ? (
                    <View style={styles.stack}>
                      {sortedGroups.map((group, index) => (
                        <View
                          key={group.id}
                          style={[
                            styles.groupCard,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}>
                          <View style={styles.itemHeader}>
                            <View style={styles.itemCopy}>
                              <Text style={[styles.itemTitle, { color: theme.text }]}>
                                {group.name}
                              </Text>
                              <Text style={[styles.itemMeta, { color: theme.mutedText }]}>
                                {group.servicesCount} services
                              </Text>
                            </View>
                          </View>

                          <View style={styles.actionRow}>
                            <Pressable
                              accessibilityRole="button"
                              disabled={index === 0}
                              onPress={() => void handleMoveGroup(group.id, 'up')}
                              style={[
                                styles.actionButton,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                index === 0 && styles.disabledButton,
                              ]}
                              testID={`mobile-group-up-${group.id}`}>
                              <Text style={[styles.actionButtonText, { color: theme.text }]}>Up</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              disabled={index === sortedGroups.length - 1}
                              onPress={() => void handleMoveGroup(group.id, 'down')}
                              style={[
                                styles.actionButton,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                index === sortedGroups.length - 1 && styles.disabledButton,
                              ]}
                              testID={`mobile-group-down-${group.id}`}>
                              <Text style={[styles.actionButtonText, { color: theme.text }]}>Down</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => openEditGroup(group)}
                              style={[
                                styles.actionButton,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                              ]}
                              testID={`mobile-group-edit-${group.id}`}>
                              <Text style={[styles.actionButtonText, { color: theme.text }]}>Rename</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => void handleDeleteCurrentGroup(group)}
                              style={[
                                styles.actionButton,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                              ]}
                              testID={`mobile-group-delete-${group.id}`}>
                              <Text style={[styles.actionButtonText, { color: theme.danger }]}>Delete</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.noticeCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.noticeTitle, { color: theme.text }]}>No groups yet</Text>
                      <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                        Leave everything ungrouped for a flat list, or create sections like Manicures and Pedicures.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.stack}>
                  {sortedServices.length ? (
                    <>
                      {sortedGroups.map((group) => {
                        const groupServices = sortedServices.filter(
                          (service) => service.groupId === group.id,
                        );

                        if (!groupServices.length) {
                          return null;
                        }

                        return (
                          <View
                            key={group.id}
                            style={[
                              styles.subsectionCard,
                              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                              {group.name}
                            </Text>
                            <View style={styles.stack}>
                              {groupServices.map((service, index) => (
                                <View
                                  key={service.id}
                                  style={[
                                    styles.itemCard,
                                    { backgroundColor: theme.surface, borderColor: theme.border },
                                  ]}>
                                  <View style={styles.itemHeader}>
                                    <View style={styles.itemCopy}>
                                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                                        {service.name}
                                      </Text>
                                      <Text style={[styles.itemMeta, { color: theme.mutedText }]}>
                                        {service.durationLabel} · {service.priceLabel}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.statusBadge,
                                        {
                                          backgroundColor: service.isActive ? theme.accentSoft : theme.surfaceMuted,
                                          borderColor: theme.border,
                                        },
                                      ]}>
                                      <Text
                                        style={[
                                          styles.statusBadgeText,
                                          { color: service.isActive ? theme.accent : theme.mutedText },
                                        ]}>
                                        {service.isActive ? 'Active' : 'Paused'}
                                      </Text>
                                    </View>
                                  </View>

                                  {service.description ? (
                                    <Text style={[styles.itemDescription, { color: theme.mutedText }]}>
                                      {service.description}
                                    </Text>
                                  ) : null}

                                  <View style={styles.actionRow}>
                                    <Pressable
                                      accessibilityRole="button"
                                      disabled={index === 0}
                                      onPress={() => void handleMoveService(service.id, 'up', group.id)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                        index === 0 && styles.disabledButton,
                                      ]}
                                      testID={`mobile-service-up-${service.id}`}>
                                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Up</Text>
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      disabled={index === groupServices.length - 1}
                                      onPress={() => void handleMoveService(service.id, 'down', group.id)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                        index === groupServices.length - 1 && styles.disabledButton,
                                      ]}
                                      testID={`mobile-service-down-${service.id}`}>
                                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Down</Text>
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() => openEditService(service)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                      ]}>
                                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() => void handleDeleteCurrentService(service)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                      ]}>
                                      <Text style={[styles.actionButtonText, { color: theme.danger }]}>
                                        Delete
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}

                      {sortedServices.some((service) => !service.groupId) ? (
                        <View
                          style={[
                            styles.subsectionCard,
                            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                          ]}>
                          <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                            Other services
                          </Text>
                          <View style={styles.stack}>
                            {sortedServices
                              .filter((service) => !service.groupId)
                              .map((service, index, ungroupedServices) => (
                                <View
                                  key={service.id}
                                  style={[
                                    styles.itemCard,
                                    { backgroundColor: theme.surface, borderColor: theme.border },
                                  ]}>
                                  <View style={styles.itemHeader}>
                                    <View style={styles.itemCopy}>
                                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                                        {service.name}
                                      </Text>
                                      <Text style={[styles.itemMeta, { color: theme.mutedText }]}>
                                        {service.durationLabel} · {service.priceLabel}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.statusBadge,
                                        {
                                          backgroundColor: service.isActive ? theme.accentSoft : theme.surfaceMuted,
                                          borderColor: theme.border,
                                        },
                                      ]}>
                                      <Text
                                        style={[
                                          styles.statusBadgeText,
                                          { color: service.isActive ? theme.accent : theme.mutedText },
                                        ]}>
                                        {service.isActive ? 'Active' : 'Paused'}
                                      </Text>
                                    </View>
                                  </View>

                                  {service.description ? (
                                    <Text style={[styles.itemDescription, { color: theme.mutedText }]}>
                                      {service.description}
                                    </Text>
                                  ) : null}

                                  <View style={styles.actionRow}>
                                    <Pressable
                                      accessibilityRole="button"
                                      disabled={index === 0}
                                      onPress={() => void handleMoveService(service.id, 'up', null)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                        index === 0 && styles.disabledButton,
                                      ]}
                                      testID={`mobile-service-up-${service.id}`}>
                                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Up</Text>
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      disabled={index === ungroupedServices.length - 1}
                                      onPress={() => void handleMoveService(service.id, 'down', null)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                        index === ungroupedServices.length - 1 && styles.disabledButton,
                                      ]}
                                      testID={`mobile-service-down-${service.id}`}>
                                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Down</Text>
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() => openEditService(service)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                      ]}>
                                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() => void handleDeleteCurrentService(service)}
                                      style={[
                                        styles.actionButton,
                                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                      ]}>
                                      <Text style={[styles.actionButtonText, { color: theme.danger }]}>
                                        Delete
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>
                              ))}
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View
                      style={[
                        styles.noticeCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.noticeTitle, { color: theme.text }]}>No services yet</Text>
                      <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                        Add your first service here so the mobile app matches the live booking menu.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.stack}>
                {sortedStaff.length ? (
                  sortedStaff.map((member) => (
                    <View
                      key={member.id}
                      style={[
                        styles.itemCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <View style={styles.itemHeader}>
                        <View style={styles.itemCopy}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>
                            {member.fullName}
                          </Text>
                          <Text style={[styles.itemMeta, { color: theme.mutedText }]}>
                            {member.role ?? 'Team member'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: member.isActive ? theme.accentSoft : theme.surface,
                              borderColor: theme.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: member.isActive ? theme.accent : theme.mutedText },
                            ]}>
                            {member.isActive ? 'Active' : 'Paused'}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.itemDescription, { color: theme.mutedText }]}>
                        {member.phoneDisplay || member.email || 'No contact details'}
                      </Text>
                      {member.bio ? (
                        <Text style={[styles.itemDescription, { color: theme.mutedText }]}>
                          {member.bio}
                        </Text>
                      ) : null}
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {member.workDaysLabel}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {member.workHoursLabel}
                      </Text>

                      <View style={styles.groupRow}>
                        {member.serviceNames.length ? (
                          member.serviceNames.map((serviceName) => (
                            <View
                              key={`${member.id}-${serviceName}`}
                              style={[
                                styles.groupPill,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                              ]}>
                              <Text style={[styles.groupPillText, { color: theme.text }]}>
                                {serviceName}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <View
                            style={[
                              styles.groupPill,
                              { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.groupPillText, { color: theme.mutedText }]}>
                              All services
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.actionRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => openEditStaff(member)}
                          style={[
                            styles.actionButton,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void handleDeleteCurrentStaff(member)}
                          style={[
                            styles.actionButton,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}>
                          <Text style={[styles.actionButtonText, { color: theme.danger }]}>
                            Delete
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      styles.noticeCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.noticeTitle, { color: theme.text }]}>No staff yet</Text>
                    <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                      Add your team here so the native app can manage the same roster as the web dashboard.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <FullScreenSheet
        onClose={() => {
          setIsGroupSheetVisible(false);
          setEditingGroup(null);
          setSheetError(null);
        }}
        subtitle="Organize booking sections and keep the public menu in the same order as the web app."
        title={editingGroup ? 'Rename group' : 'Add group'}
        visible={isGroupSheetVisible}>
        <ScrollView contentContainerStyle={styles.sheetContent} style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} theme={theme} /> : null}

          <FieldLabel label="Group name" themeText={theme.text} />
          <TextInput
            onChangeText={(value) => setGroupForm({ name: value })}
            placeholder="Manicures"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={groupForm.name}
          />
        </ScrollView>
        <View style={[styles.sheetFooter, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {editingGroup ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSavingGroup}
              onPress={() => void handleDeleteCurrentGroup(editingGroup)}
              style={[styles.destructiveFooterButton, { borderColor: theme.border }]}>
              <Text style={styles.destructiveFooterButtonText}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSavingGroup}
            onPress={() => void handleSaveGroup()}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-save-group">
            <Text style={styles.footerPrimaryButtonText}>
              {isSavingGroup ? 'Saving...' : editingGroup ? 'Save group' : 'Add group'}
            </Text>
          </Pressable>
        </View>
      </FullScreenSheet>

      <FullScreenSheet
        onClose={() => {
          setIsServiceSheetVisible(false);
          setEditingService(null);
          setSheetError(null);
        }}
        subtitle="Set the service details customers book against."
        title={editingService ? 'Edit service' : 'Add service'}
        visible={isServiceSheetVisible}>
        <ScrollView contentContainerStyle={styles.sheetContent} style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} theme={theme} /> : null}

          <FieldLabel label="Service name" themeText={theme.text} />
          <TextInput
            onChangeText={(value) => setServiceForm((current) => ({ ...current, name: value }))}
            placeholder="Classic manicure"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={serviceForm.name}
          />

          <FieldLabel label="Description" themeText={theme.text} />
          <TextInput
            multiline
            onChangeText={(value) => setServiceForm((current) => ({ ...current, description: value }))}
            placeholder="Optional service details"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.formInput,
              styles.multilineInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
            textAlignVertical="top"
            value={serviceForm.description}
          />

          <View style={styles.inlineInputRow}>
            <View style={styles.inlineInputCell}>
              <FieldLabel label="Duration (min)" themeText={theme.text} />
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => setServiceForm((current) => ({ ...current, duration: value }))}
                placeholder="60"
                placeholderTextColor={theme.mutedText}
                style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={serviceForm.duration}
              />
            </View>
            <View style={styles.inlineInputCell}>
              <FieldLabel label="Price" themeText={theme.text} />
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => setServiceForm((current) => ({ ...current, price: value }))}
                placeholder="45"
                placeholderTextColor={theme.mutedText}
                style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={serviceForm.price}
              />
            </View>
          </View>

          <FieldLabel label="Service group" themeText={theme.text} />
          <View style={styles.optionRow}>
            <FilterChip
              label="Ungrouped"
              onPress={() => setServiceForm((current) => ({ ...current, groupId: '' }))}
              selected={!serviceForm.groupId}
              theme={theme}
            />
            {data?.groups.map((group) => (
              <FilterChip
                key={group.id}
                label={group.name}
                onPress={() => setServiceForm((current) => ({ ...current, groupId: group.id }))}
                selected={serviceForm.groupId === group.id}
                theme={theme}
              />
            ))}
          </View>

          <View style={[styles.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Active for booking</Text>
              <Text style={[styles.toggleText, { color: theme.mutedText }]}>
                {serviceForm.isActive ? 'Customers can book this service right now.' : 'This service is paused from booking.'}
              </Text>
            </View>
            <Switch
              onValueChange={(value) => setServiceForm((current) => ({ ...current, isActive: value }))}
              value={serviceForm.isActive}
            />
          </View>
        </ScrollView>
        <View style={[styles.sheetFooter, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {editingService ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSavingService}
              onPress={() => void handleDeleteCurrentService(editingService)}
              style={[styles.destructiveFooterButton, { borderColor: theme.border }]}>
              <Text style={styles.destructiveFooterButtonText}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSavingService}
            onPress={() => void handleSaveService()}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-save-service">
            <Text style={styles.footerPrimaryButtonText}>
              {isSavingService ? 'Saving...' : editingService ? 'Save service' : 'Add service'}
            </Text>
          </Pressable>
        </View>
      </FullScreenSheet>

      <FullScreenSheet
        onClose={() => {
          setIsStaffSheetVisible(false);
          setEditingStaff(null);
          setSheetError(null);
        }}
        subtitle="Set contact details, assignments, and work coverage."
        title={editingStaff ? 'Edit staff' : 'Add staff'}
        visible={isStaffSheetVisible}>
        <ScrollView contentContainerStyle={styles.sheetContent} style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} theme={theme} /> : null}

          <FieldLabel label="Full name" themeText={theme.text} />
          <TextInput
            onChangeText={(value) => setStaffForm((current) => ({ ...current, fullName: value }))}
            placeholder="Taylor Smith"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={staffForm.fullName}
          />

          <FieldLabel label="Role" themeText={theme.text} />
          <TextInput
            onChangeText={(value) => setStaffForm((current) => ({ ...current, role: value }))}
            placeholder="Stylist"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={staffForm.role}
          />

          <FieldLabel label="Email" themeText={theme.text} />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) => setStaffForm((current) => ({ ...current, email: value }))}
            placeholder="taylor@example.com"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={staffForm.email}
          />

          <FieldLabel label="Phone" themeText={theme.text} />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={(value) => setStaffForm((current) => ({ ...current, phone: value }))}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={staffForm.phone}
          />

          <FieldLabel label="Brief bio (optional)" themeText={theme.text} />
          <TextInput
            maxLength={500}
            multiline
            onChangeText={(value) => setStaffForm((current) => ({ ...current, bio: value }))}
            placeholder="Example: Senior stylist specializing in gel manicures and natural nail care."
            placeholderTextColor={theme.mutedText}
            style={[
              styles.formInput,
              styles.multilineInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
            textAlignVertical="top"
            value={staffForm.bio}
          />
          <Text style={[styles.helperText, { color: theme.mutedText }]}>
            This appears on booking pages when customers choose a team member.
          </Text>

          <View style={[styles.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Active on roster</Text>
              <Text style={[styles.toggleText, { color: theme.mutedText }]}>
                {staffForm.isActive ? 'This team member is bookable in the app and on the web.' : 'This team member is paused from active booking.'}
              </Text>
            </View>
            <Switch
              onValueChange={(value) => setStaffForm((current) => ({ ...current, isActive: value }))}
              value={staffForm.isActive}
            />
          </View>

          <FieldLabel label="Service coverage" themeText={theme.text} />
          <Text style={[styles.helperText, { color: theme.mutedText }]}>
            Leave all services unselected to keep this team member available for every service.
          </Text>
          <View style={styles.optionRow}>
            {data?.services.length ? (
              data.services.map((service) => {
                const selected = staffForm.serviceIds.includes(service.id);
                return (
                  <FilterChip
                    key={service.id}
                    label={service.name}
                    onPress={() =>
                      setStaffForm((current) => ({
                        ...current,
                        serviceIds: selected
                          ? current.serviceIds.filter((serviceId) => serviceId !== service.id)
                          : [...current.serviceIds, service.id],
                      }))
                    }
                    selected={selected}
                    theme={theme}
                  />
                );
              })
            ) : (
              <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                Add a service first to assign coverage.
              </Text>
            )}
          </View>

          <FieldLabel label="Work days" themeText={theme.text} />
          <View style={styles.optionRow}>
            {DAY_OPTIONS.map((day) => (
              <FilterChip
                key={day.value}
                label={day.label}
                onPress={() => toggleStaffDay(day.value)}
                selected={staffForm.workDays.includes(day.value)}
                theme={theme}
              />
            ))}
          </View>

          <FieldLabel label="Hours by day" themeText={theme.text} />
          <View style={styles.scheduleStack}>
            {staffForm.workDays
              .slice()
              .sort((left, right) => left - right)
              .map((day) => (
                <View
                  key={day}
                  style={[
                    styles.scheduleRow,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.scheduleDayLabel, { color: theme.text }]}>
                    {DAY_OPTIONS.find((option) => option.value === day)?.label ?? `Day ${day}`}
                  </Text>
                  <View style={styles.scheduleInputs}>
                    <TextInput
                      autoCapitalize="none"
                      onChangeText={(value) =>
                        setStaffForm((current) => ({
                          ...current,
                          workHours: {
                            ...current.workHours,
                            [day]: {
                              startTime: value,
                              endTime: current.workHours[day]?.endTime ?? '17:00',
                            },
                          },
                        }))
                      }
                      placeholder="09:00"
                      placeholderTextColor={theme.mutedText}
                      style={[
                        styles.scheduleInput,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text },
                      ]}
                      value={staffForm.workHours[day]?.startTime ?? '09:00'}
                    />
                    <Text style={[styles.scheduleDash, { color: theme.mutedText }]}>to</Text>
                    <TextInput
                      autoCapitalize="none"
                      onChangeText={(value) =>
                        setStaffForm((current) => ({
                          ...current,
                          workHours: {
                            ...current.workHours,
                            [day]: {
                              startTime: current.workHours[day]?.startTime ?? '09:00',
                              endTime: value,
                            },
                          },
                        }))
                      }
                      placeholder="17:00"
                      placeholderTextColor={theme.mutedText}
                      style={[
                        styles.scheduleInput,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text },
                      ]}
                      value={staffForm.workHours[day]?.endTime ?? '17:00'}
                    />
                  </View>
                </View>
              ))}
          </View>
        </ScrollView>
        <View style={[styles.sheetFooter, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {editingStaff ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSavingStaff}
              onPress={() => void handleDeleteCurrentStaff(editingStaff)}
              style={[styles.destructiveFooterButton, { borderColor: theme.border }]}>
              <Text style={styles.destructiveFooterButtonText}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSavingStaff}
            onPress={() => void handleSaveStaff()}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-save-staff">
            <Text style={styles.footerPrimaryButtonText}>
              {isSavingStaff ? 'Saving...' : editingStaff ? 'Save staff' : 'Add staff'}
            </Text>
          </Pressable>
        </View>
      </FullScreenSheet>
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
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 112,
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
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  metricHelper: {
    fontSize: 14,
    lineHeight: 18,
  },
  segmentedControl: {
    borderWidth: 1,
    padding: 4,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  segmentButtonSelectedText: {
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
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
  },
  subsectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  subsectionHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  subsectionCopy: {
    flex: 1,
    gap: 4,
  },
  subsectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  subsectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  addButton: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  groupPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  stack: {
    gap: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemCopy: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  itemMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 72,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  sheetScreen: {
    flex: 1,
  },
  sheetHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 28,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  headerCloseButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  formInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 22,
  },
  multilineInput: {
    minHeight: 110,
    paddingTop: 16,
    paddingBottom: 16,
  },
  inlineInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inlineInputCell: {
    flex: 1,
    gap: 8,
  },
  toggleCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  toggleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  optionPillSelectedText: {
    color: '#f8fffc',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  emptyInlineText: {
    fontSize: 14,
    lineHeight: 20,
  },
  scheduleStack: {
    gap: 10,
  },
  scheduleRow: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  scheduleDayLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  scheduleInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 18,
  },
  scheduleDash: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  sheetFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
  },
  footerPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  footerPrimaryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  destructiveFooterButton: {
    minWidth: 108,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  destructiveFooterButtonText: {
    color: '#b42318',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
});
