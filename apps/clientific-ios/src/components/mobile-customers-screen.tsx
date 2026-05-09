import React, { useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  MobileCustomerContactFilter,
  MobileCustomerDetail,
  MobileCustomerFilters,
  MobileCustomerGroupInput,
  MobileCustomerGroupRecord,
  MobileCustomerInput,
  MobileCustomersSummary,
  MobileCustomerSmsFilter,
  MobileCustomerSmsLogSummary,
  MobileCustomerVisitFilter,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CustomersTab = 'customers' | 'groups';
type CustomerDetailTab = 'overview' | 'history' | 'messages';

type MobileCustomersScreenProps = {
  data: MobileCustomersSummary | null;
  error: string | null;
  filters: MobileCustomerFilters;
  isLoading: boolean;
  isRefreshing: boolean;
  searchDraft: string;
  onChangeFilter: (next: Partial<MobileCustomerFilters>) => void;
  onChangeSearchDraft: (value: string) => void;
  onClearFilters: () => void;
  onCreateCustomer: (input: MobileCustomerInput) => Promise<void>;
  onCreateGroup: (input: MobileCustomerGroupInput) => Promise<void>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onFetchCustomerDetail: (customerId: string) => Promise<MobileCustomerDetail>;
  onFetchCustomerMessages: (customerId: string) => Promise<MobileCustomerSmsLogSummary>;
  onGoToPage: (page: number) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRefresh: () => Promise<void>;
  onSendReviewRequest: (customerId: string) => Promise<void>;
  onSendCustomerMessage: (customerId: string, message: string) => Promise<void>;
  onUpdateCustomer: (customerId: string, input: MobileCustomerInput) => Promise<MobileCustomerDetail>;
  onUpdateGroup: (groupId: string, input: MobileCustomerGroupInput) => Promise<void>;
};

type CustomerFormState = {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  notes: string;
  dealSmsBlocked: boolean;
  groupIds: string[];
};

type GroupFormState = {
  name: string;
  promotionSmsEnabled: boolean;
};

type PaginationItem =
  | {
      type: 'page';
      page: number;
    }
  | {
      type: 'ellipsis';
      key: string;
    };

const SMS_FILTER_OPTIONS: Array<{ value: MobileCustomerSmsFilter; label: string }> = [
  { value: '', label: 'All SMS' },
  { value: 'enabled', label: 'SMS ready' },
  { value: 'opted_out', label: 'Opted out' },
  { value: 'denied', label: 'No SMS approval' },
  { value: 'no_phone', label: 'No phone' },
];

const CONTACT_FILTER_OPTIONS: Array<{ value: MobileCustomerContactFilter; label: string }> = [
  { value: '', label: 'All contacts' },
  { value: 'email', label: 'Has email' },
  { value: 'phone', label: 'Has phone' },
  { value: 'both', label: 'Has both' },
];

const VISIT_FILTER_OPTIONS: Array<{ value: MobileCustomerVisitFilter; label: string }> = [
  { value: '', label: 'All visits' },
  { value: 'visited', label: 'Visited before' },
  { value: 'never', label: 'Never visited' },
];

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: 'page' as const,
      page: index + 1,
    }));
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    items.push({ type: 'page', page });

    const nextPage = sortedPages[index + 1];
    if (nextPage && nextPage - page > 1) {
      items.push({ type: 'ellipsis', key: `${page}-${nextPage}` });
    }
  });

  return items;
}

function createEmptyCustomerForm(): CustomerFormState {
  return {
    name: '',
    email: '',
    phone: '',
    birthday: '',
    notes: '',
    dealSmsBlocked: false,
    groupIds: [],
  };
}

function createCustomerFormFromDetail(customer: MobileCustomerDetail): CustomerFormState {
  return {
    name: customer.name,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    birthday: customer.birthdayValue,
    notes: customer.notes ?? '',
    dealSmsBlocked: customer.dealSmsBlocked,
    groupIds: customer.groups.map((group) => group.id),
  };
}

function createGroupFormFromGroup(group?: MobileCustomerGroupRecord | null): GroupFormState {
  return {
    name: group?.name ?? '',
    promotionSmsEnabled: group?.promotionSmsEnabled ?? true,
  };
}

function getSmsStatusLabel(customer: {
  smsConsent: boolean;
  smsOptedOut: boolean;
  phoneDisplay: string | null;
}) {
  if (!customer.phoneDisplay) return 'No phone';
  if (customer.smsOptedOut) return 'Opted out';
  if (customer.smsConsent) return 'SMS ready';
  return 'No SMS approval';
}

function getCustomerInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getSmsStatusAppearance(
  theme: ReturnType<typeof getClientificTheme>,
  customer: {
    smsConsent: boolean;
    smsOptedOut: boolean;
    phoneDisplay: string | null;
  },
) {
  const label = getSmsStatusLabel(customer);

  if (label === 'SMS ready') {
    return {
      label,
      backgroundColor: theme.accentSoft,
      borderColor: theme.border,
      textColor: theme.accent,
    };
  }

  if (label === 'Opted out') {
    return {
      label,
      backgroundColor: 'rgba(203, 74, 104, 0.12)',
      borderColor: theme.border,
      textColor: colorFromScheme(theme, '#b42318', '#ff9ab0'),
    };
  }

  if (label === 'No phone') {
    return {
      label,
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.border,
      textColor: theme.mutedText,
    };
  }

  return {
    label,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: theme.border,
    textColor: colorFromScheme(theme, '#b45309', '#f7c46b'),
  };
}

function getDealsStatusAppearance(
  theme: ReturnType<typeof getClientificTheme>,
  customer: Pick<MobileCustomerDetail | MobileCustomersSummary['customers'][number], 'dealSmsBlocked'>,
) {
  return customer.dealSmsBlocked
    ? {
        label: 'Deals blocked',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        borderColor: theme.border,
        textColor: colorFromScheme(theme, '#b45309', '#f7c46b'),
      }
    : {
        label: 'Deals SMS allowed',
        backgroundColor: theme.surfaceMuted,
        borderColor: theme.border,
        textColor: theme.text,
      };
}

function colorFromScheme(
  theme: ReturnType<typeof getClientificTheme>,
  lightColor: string,
  darkColor: string,
) {
  return theme.background === '#f3f8f7' ? lightColor : darkColor;
}

function buildResultsSummary(data: MobileCustomersSummary | null) {
  if (!data || data.totalCustomers === 0) {
    return 'No customers yet';
  }

  const start = (data.currentPage - 1) * data.pageSize + 1;
  const end = Math.min(data.currentPage * data.pageSize, data.totalCustomers);
  return `${start}-${end} of ${data.totalCustomers} shown`;
}

function buildPageCountSummary(data: MobileCustomersSummary | null) {
  const totalPages = data?.totalPages ?? 1;
  return totalPages === 1 ? '1 page' : `${totalPages} pages`;
}

function buildActiveFilterLabels(
  data: MobileCustomersSummary | null,
  filters: MobileCustomerFilters,
  searchDraft: string,
) {
  const labels: string[] = [];

  if (searchDraft.trim()) {
    labels.push(`Search: ${searchDraft.trim()}`);
  }

  if (filters.group) {
    const groupLabel = data?.groups.find((group) => group.id === filters.group)?.name;
    if (groupLabel) {
      labels.push(`Group: ${groupLabel}`);
    }
  }

  if (filters.sms) {
    const option = SMS_FILTER_OPTIONS.find((entry) => entry.value === filters.sms);
    if (option) labels.push(option.label);
  }

  if (filters.contact) {
    const option = CONTACT_FILTER_OPTIONS.find((entry) => entry.value === filters.contact);
    if (option) labels.push(option.label);
  }

  if (filters.visit) {
    const option = VISIT_FILTER_OPTIONS.find((entry) => entry.value === filters.visit);
    if (option) labels.push(option.label);
  }

  return labels;
}

function renderGroupSummary(groups: Array<{ name: string }>) {
  if (groups.length === 0) {
    return 'Ungrouped';
  }

  return groups.map((group) => group.name).join(', ');
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
            style={[styles.iconButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Text style={[styles.iconButtonText, { color: theme.text }]}>Close</Text>
          </Pressable>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MobileCustomersScreen({
  data,
  error,
  filters,
  isLoading,
  isRefreshing,
  searchDraft,
  onChangeFilter,
  onChangeSearchDraft,
  onClearFilters,
  onCreateCustomer,
  onCreateGroup,
  onDeleteCustomer,
  onDeleteGroup,
  onFetchCustomerDetail,
  onFetchCustomerMessages,
  onGoToPage,
  onNextPage,
  onPreviousPage,
  onRefresh,
  onSendReviewRequest,
  onSendCustomerMessage,
  onUpdateCustomer,
  onUpdateGroup,
}: MobileCustomersScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [activeTab, setActiveTab] = useState<CustomersTab>('customers');
  const [detailTab, setDetailTab] = useState<CustomerDetailTab>('overview');
  const [isCustomerSheetVisible, setIsCustomerSheetVisible] = useState(false);
  const [isGroupSheetVisible, setIsGroupSheetVisible] = useState(false);
  const [isMessageSheetVisible, setIsMessageSheetVisible] = useState(false);
  const [isDetailSheetVisible, setIsDetailSheetVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<MobileCustomerDetail | null>(null);
  const [editingGroup, setEditingGroup] = useState<MobileCustomerGroupRecord | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<MobileCustomerDetail | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<MobileCustomerSmsLogSummary | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(createEmptyCustomerForm);
  const [groupForm, setGroupForm] = useState<GroupFormState>(createGroupFormFromGroup());
  const [messageDraft, setMessageDraft] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [isSendingReviewRequest, setIsSendingReviewRequest] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const paginationItems = useMemo(
    () => buildPaginationItems(data?.currentPage ?? 1, data?.totalPages ?? 1),
    [data?.currentPage, data?.totalPages],
  );
  const activeFilterLabels = useMemo(
    () => buildActiveFilterLabels(data, filters, searchDraft),
    [data, filters, searchDraft],
  );

  const hasActiveFilters = Boolean(
    searchDraft.trim() || filters.group || filters.sms || filters.contact || filters.visit,
  );
  const shouldShowPaginationControls = (data?.totalPages ?? 1) > 1;

  const openCreateCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm(createEmptyCustomerForm());
    setSheetError(null);
    setSheetNotice(null);
    setIsCustomerSheetVisible(true);
  };

  const openEditCustomer = (customer: MobileCustomerDetail) => {
    setEditingCustomer(customer);
    setCustomerForm(createCustomerFormFromDetail(customer));
    setSheetError(null);
    setSheetNotice(null);
    setIsCustomerSheetVisible(true);
  };

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(createGroupFormFromGroup());
    setSheetError(null);
    setSheetNotice(null);
    setIsGroupSheetVisible(true);
  };

  const openEditGroup = (group: MobileCustomerGroupRecord) => {
    setEditingGroup(group);
    setGroupForm(createGroupFormFromGroup(group));
    setSheetError(null);
    setSheetNotice(null);
    setIsGroupSheetVisible(true);
  };

  const focusGroupMembers = (group: MobileCustomerGroupRecord) => {
    setActiveTab('customers');
    setSheetNotice(`Showing customers in ${group.name}.`);
    onChangeSearchDraft('');
    onChangeFilter({
      group: group.id,
      sms: '',
      contact: '',
      visit: '',
    });
  };

  const handleOpenDetail = async (customerId: string) => {
    setSheetError(null);
    setSelectedCustomer(null);
    setSelectedMessages(null);
    setDetailTab('overview');
    setIsDetailSheetVisible(true);
    setIsDetailLoading(true);

    try {
      const detail = await onFetchCustomerDetail(customerId);
      setSelectedCustomer(detail);
    } catch (fetchError) {
      setSheetError(fetchError instanceof Error ? fetchError.message : 'Unable to load customer.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const ensureMessagesLoaded = async () => {
    if (!selectedCustomer || isMessageLoading) {
      return;
    }

    setIsMessageLoading(true);
    setSheetError(null);

    try {
      const nextMessages = await onFetchCustomerMessages(selectedCustomer.id);
      setSelectedMessages(nextMessages);
    } catch (fetchError) {
      setSheetError(
        fetchError instanceof Error ? fetchError.message : 'Unable to load message history.',
      );
    } finally {
      setIsMessageLoading(false);
    }
  };

  const handleCustomerSave = async () => {
    if (!customerForm.name.trim()) {
      setSheetError('Customer name is required.');
      return;
    }

    setIsSavingCustomer(true);
    setSheetError(null);

    try {
      const payload: MobileCustomerInput = {
        name: customerForm.name.trim(),
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        birthday: customerForm.birthday.trim() || null,
        notes: customerForm.notes.trim() || null,
        dealSmsBlocked: customerForm.dealSmsBlocked,
        groupIds: customerForm.groupIds,
      };

      if (editingCustomer) {
        const nextDetail = await onUpdateCustomer(editingCustomer.id, payload);
        setSelectedCustomer(nextDetail);
        setEditingCustomer(nextDetail);
        setSheetNotice('Customer updated.');
      } else {
        await onCreateCustomer(payload);
        setSheetNotice('Customer added.');
      }

      setIsCustomerSheetVisible(false);
      setEditingCustomer(null);
    } catch (saveError) {
      setSheetError(saveError instanceof Error ? saveError.message : 'Unable to save customer.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteCurrentCustomer = async () => {
    if (!editingCustomer) {
      return;
    }

    Alert.alert('Delete customer?', 'This permanently removes the customer record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSavingCustomer(true);
            setSheetError(null);

            try {
              await onDeleteCustomer(editingCustomer.id);
              setSelectedCustomer((current) =>
                current?.id === editingCustomer.id ? null : current,
              );
              setIsCustomerSheetVisible(false);
              setIsDetailSheetVisible(false);
              setEditingCustomer(null);
            } catch (deleteError) {
              setSheetError(
                deleteError instanceof Error ? deleteError.message : 'Unable to delete customer.',
              );
            } finally {
              setIsSavingCustomer(false);
            }
          })();
        },
      },
    ]);
  };

  const handleGroupSave = async () => {
    if (!groupForm.name.trim()) {
      setSheetError('Group name is required.');
      return;
    }

    setIsSavingGroup(true);
    setSheetError(null);

    try {
      if (editingGroup) {
        await onUpdateGroup(editingGroup.id, {
          name: groupForm.name.trim(),
          promotionSmsEnabled: groupForm.promotionSmsEnabled,
        });
      } else {
        await onCreateGroup({
          name: groupForm.name.trim(),
          promotionSmsEnabled: groupForm.promotionSmsEnabled,
        });
      }

      setIsGroupSheetVisible(false);
      setEditingGroup(null);
    } catch (saveError) {
      setSheetError(saveError instanceof Error ? saveError.message : 'Unable to save group.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteCurrentGroup = async () => {
    if (!editingGroup) {
      return;
    }

    Alert.alert(
      'Delete group?',
      'Customers stay in the database, but this group and its settings will be removed.',
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
                await onDeleteGroup(editingGroup.id);
                setIsGroupSheetVisible(false);
                setEditingGroup(null);
              } catch (deleteError) {
                setSheetError(
                  deleteError instanceof Error ? deleteError.message : 'Unable to delete group.',
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

  const handleSendMessageNow = async () => {
    if (!selectedCustomer || !messageDraft.trim()) {
      setSheetError('Message is required.');
      return;
    }

    setIsSendingMessage(true);
    setSheetError(null);

    try {
      await onSendCustomerMessage(selectedCustomer.id, messageDraft.trim());
      setMessageDraft('');
      setIsMessageSheetVisible(false);
      await ensureMessagesLoaded();
    } catch (sendError) {
      setSheetError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setIsSendingMessage(false);
    }
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
              <Text style={[styles.eyebrow, { color: theme.accent }]}>Customers</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Customer records</Text>
              <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
                Match the dashboard flow with search, filters, groups, and direct actions in one place.
              </Text>
            </View>
            <View style={styles.heroBadgeRow}>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: theme.accentSoft, borderColor: theme.border },
                ]}>
                <Text style={[styles.heroBadgeText, { color: theme.accent }]}>
                  {activeTab === 'customers'
                    ? `${data?.totalCustomers ?? 0} customers`
                    : `${data?.groups.length ?? 0} groups`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={activeTab === 'customers' ? openCreateCustomer : openCreateGroup}
                style={[styles.addButton, { backgroundColor: theme.accent }]}
                testID="mobile-customers-add">
                <Text style={styles.addButtonText}>
                  {activeTab === 'customers' ? 'Add customer' : 'Add group'}
                </Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeSearchDraft}
            placeholder="Search by name, email, or phone"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            testID="mobile-customers-search"
            value={searchDraft}
          />

          <View
            style={[
              styles.segmentedControl,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            {(['customers', 'groups'] as const).map((tab) => {
              const selected = activeTab === tab;
              const count = tab === 'customers' ? data?.totalCustomers ?? 0 : data?.groups.length ?? 0;

              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.segmentButton,
                    selected
                      ? { backgroundColor: theme.accent }
                      : { backgroundColor: 'transparent' },
                  ]}>
                  <Text
                    style={
                      selected
                        ? styles.segmentButtonSelectedText
                        : [styles.segmentButtonText, { color: theme.text }]
                    }>
                    {tab === 'customers' ? `Customers ${count}` : `Groups ${count}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {activeTab === 'customers' ? (
          <View
            style={[
              styles.filterCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.filterCardHeader}>
              <View style={styles.filterCardCopy}>
                <Text style={[styles.filterCardTitle, { color: theme.text }]}>Filter customers</Text>
                <Text style={[styles.filterCardText, { color: theme.mutedText }]}>
                  Narrow by group, texting status, contact details, and visit history.
                </Text>
              </View>
              {hasActiveFilters ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onClearFilters}
                  style={[styles.clearFiltersButton, { borderColor: theme.border }]}>
                  <Text style={[styles.clearFiltersText, { color: theme.text }]}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>

            {activeFilterLabels.length ? (
              <View style={styles.activeFilterRow}>
                {activeFilterLabels.map((label) => (
                  <View
                    key={label}
                    style={[
                      styles.activeFilterPill,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.activeFilterText, { color: theme.text }]}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.filtersStack}>
              <FilterSection title="Group" theme={theme}>
                <FilterPill
                  label="All groups"
                  onPress={() => onChangeFilter({ group: '' })}
                  selected={!filters.group}
                  theme={theme}
                />
                {data?.groups.map((group) => (
                  <FilterPill
                    key={group.id}
                    label={group.name}
                    onPress={() =>
                      onChangeFilter({ group: filters.group === group.id ? '' : group.id })
                    }
                    selected={filters.group === group.id}
                    theme={theme}
                  />
                ))}
              </FilterSection>

              <FilterSection title="SMS status" theme={theme}>
                {SMS_FILTER_OPTIONS.map((option) => (
                  <FilterPill
                    key={option.value || 'all'}
                    label={option.label}
                    onPress={() =>
                      onChangeFilter({ sms: filters.sms === option.value ? '' : option.value })
                    }
                    selected={filters.sms === option.value}
                    theme={theme}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Contact details" theme={theme}>
                {CONTACT_FILTER_OPTIONS.map((option) => (
                  <FilterPill
                    key={option.value || 'all'}
                    label={option.label}
                    onPress={() =>
                      onChangeFilter({
                        contact: filters.contact === option.value ? '' : option.value,
                      })
                    }
                    selected={filters.contact === option.value}
                    theme={theme}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Visit history" theme={theme}>
                {VISIT_FILTER_OPTIONS.map((option) => (
                  <FilterPill
                    key={option.value || 'all'}
                    label={option.label}
                    onPress={() =>
                      onChangeFilter({ visit: filters.visit === option.value ? '' : option.value })
                    }
                    selected={filters.visit === option.value}
                    theme={theme}
                  />
                ))}
              </FilterSection>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.filterCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.filterCardHeader}>
              <View style={styles.filterCardCopy}>
                <Text style={[styles.filterCardTitle, { color: theme.text }]}>Customer groups</Text>
                <Text style={[styles.filterCardText, { color: theme.mutedText }]}>
                  Organize audiences and control promotion SMS eligibility without leaving the app.
                </Text>
              </View>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.heroBadgeText, { color: theme.text }]}>
                  {data?.groups.length ?? 0} saved
                </Text>
              </View>
            </View>
          </View>
        )}

        {error ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load customers</Text>
            <Text style={[styles.noticeText, { color: theme.mutedText }]}>{error}</Text>
          </View>
        ) : null}

        {sheetNotice ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: theme.accentSoft, borderColor: theme.border },
            ]}>
            <Text style={[styles.noticeTitle, { color: theme.accent }]}>Updated</Text>
            <Text style={[styles.noticeText, { color: theme.text }]}>{sheetNotice}</Text>
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
              Loading customers...
            </Text>
          </View>
        ) : activeTab === 'customers' ? (
          <>
            <View
              style={[
                styles.paginationCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={styles.paginationCopy}>
                <Text style={[styles.paginationTitle, { color: theme.text }]}>
                  {data?.totalCustomers ?? 0} customers
                </Text>
                <View style={styles.paginationMetaRow}>
                  <Text style={[styles.paginationText, { color: theme.mutedText }]}>
                    {buildResultsSummary(data)}
                  </Text>
                  <View
                    style={[
                      styles.paginationPagePill,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.paginationPagePillText, { color: theme.text }]}>
                      {buildPageCountSummary(data)}
                    </Text>
                  </View>
                </View>
              </View>

              {shouldShowPaginationControls ? (
                <View
                  style={[
                    styles.paginationButtons,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                  testID="mobile-customers-pagination-buttons">
                  <Pressable
                    accessibilityRole="button"
                    disabled={!data || data.currentPage <= 1}
                    onPress={onPreviousPage}
                    style={[
                      styles.pageButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: !data || data.currentPage <= 1 ? 0.45 : 1,
                      },
                    ]}
                    testID="mobile-customers-previous">
                    <Feather color={theme.text} name="chevron-left" size={18} />
                  </Pressable>
                  <View style={styles.paginationCenterColumn}>
                    <Text
                      style={[styles.paginationCurrentPageLabel, { color: theme.mutedText }]}
                      testID="mobile-customers-pagination-label">
                      Page {data?.currentPage ?? 1} of {data?.totalPages ?? 1}
                    </Text>
                    <View style={styles.paginationNumbers}>
                      {paginationItems.map((item) =>
                        item.type === 'page' ? (
                          <Pressable
                            key={item.page}
                            accessibilityRole="button"
                            onPress={() => onGoToPage(item.page)}
                            style={[
                              styles.pageNumberButton,
                              data?.currentPage === item.page
                                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                                : { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}>
                            <Text
                              style={
                                data?.currentPage === item.page
                                  ? styles.pageNumberButtonSelectedText
                                  : [styles.pageNumberButtonText, { color: theme.text }]
                              }>
                              {item.page}
                            </Text>
                          </Pressable>
                        ) : (
                          <View key={item.key} style={styles.paginationEllipsisWrap}>
                            <Text style={[styles.paginationEllipsisText, { color: theme.mutedText }]}>
                              …
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!data || data.currentPage >= data.totalPages}
                    onPress={onNextPage}
                    style={[
                      styles.pageButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: !data || data.currentPage >= data.totalPages ? 0.45 : 1,
                      },
                    ]}
                    testID="mobile-customers-next">
                    <Feather color={theme.text} name="chevron-right" size={18} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.stack}>
              {data?.customers.length ? (
                data.customers.map((customer) => {
                  const smsAppearance = getSmsStatusAppearance(theme, customer);
                  const dealsAppearance = getDealsStatusAppearance(theme, customer);

                  return (
                    <View
                      key={customer.id}
                      style={[
                        styles.customerCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}>
                      <View style={styles.customerHeader}>
                        <View style={styles.customerHeaderLeft}>
                          <View
                            style={[
                              styles.customerAvatar,
                              { backgroundColor: theme.accentSoft, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.customerAvatarText, { color: theme.accent }]}>
                              {getCustomerInitials(customer.name)}
                            </Text>
                          </View>
                          <View style={styles.customerIdentity}>
                            <Text style={[styles.customerName, { color: theme.text }]}>
                              {customer.name}
                            </Text>
                            <Text style={[styles.customerMeta, { color: theme.mutedText }]}>
                              {customer.phoneDisplay ?? 'No phone on file'}
                            </Text>
                            {customer.email ? (
                              <Text style={[styles.customerSecondaryMeta, { color: theme.mutedText }]}>
                                {customer.email}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.badgesColumn}>
                          <View
                            style={[
                              styles.secondaryPill,
                              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.secondaryPillText, { color: theme.text }]}>
                              {customer.segmentLabel}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.customerBadgeRow}>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: smsAppearance.backgroundColor,
                              borderColor: smsAppearance.borderColor,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: smsAppearance.textColor },
                            ]}>
                            {smsAppearance.label}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: dealsAppearance.backgroundColor,
                              borderColor: dealsAppearance.borderColor,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: dealsAppearance.textColor },
                            ]}>
                            {dealsAppearance.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.customerStatsGrid}>
                        <View style={styles.customerStatCell}>
                          <Text style={[styles.customerStatLabel, { color: theme.mutedText }]}>Joined</Text>
                          <Text style={[styles.customerStatValue, { color: theme.text }]}>
                            {customer.joinedLabel}
                          </Text>
                        </View>
                        <View style={styles.customerStatCell}>
                          <Text style={[styles.customerStatLabel, { color: theme.mutedText }]}>Last visit</Text>
                          <Text style={[styles.customerStatValue, { color: theme.text }]}>
                            {customer.lastVisitLabel}
                          </Text>
                        </View>
                        <View style={styles.customerStatCell}>
                          <Text style={[styles.customerStatLabel, { color: theme.mutedText }]}>Visits</Text>
                          <Text style={[styles.customerStatValue, { color: theme.text }]}>
                            {customer.visitsCount}
                          </Text>
                        </View>
                        <View style={styles.customerStatCell}>
                          <Text style={[styles.customerStatLabel, { color: theme.mutedText }]}>Spent</Text>
                          <Text style={[styles.customerStatValue, { color: theme.text }]}>
                            {customer.totalSpentLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.groupBadgeWrap}>
                        {customer.groups.length ? (
                          customer.groups.map((group) => (
                            <View
                              key={group.id}
                              style={[
                                styles.groupBadge,
                                {
                                  backgroundColor: group.promotionSmsEnabled
                                    ? theme.accentSoft
                                    : theme.surfaceMuted,
                                  borderColor: theme.border,
                                },
                              ]}>
                              <Text
                                style={[
                                  styles.groupBadgeText,
                                  { color: group.promotionSmsEnabled ? theme.accent : theme.text },
                                ]}>
                                {group.name}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <View
                            style={[
                              styles.groupBadge,
                              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.groupBadgeText, { color: theme.mutedText }]}>
                              Ungrouped
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.actionRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void handleOpenDetail(customer.id)}
                          style={[styles.actionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>View</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            void (async () => {
                              try {
                                const detail = await onFetchCustomerDetail(customer.id);
                                openEditCustomer(detail);
                              } catch (fetchError) {
                                setSheetError(
                                  fetchError instanceof Error
                                    ? fetchError.message
                                    : 'Unable to load customer.',
                                );
                              }
                            })();
                          }}
                          style={[styles.actionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={!customer.phoneDisplay || !customer.smsConsent || customer.smsOptedOut}
                          onPress={() => {
                            setSelectedMessages(null);
                            setSelectedCustomer({
                              id: customer.id,
                              name: customer.name,
                              email: customer.email,
                              phone: customer.phone,
                              phoneDisplay: customer.phoneDisplay,
                              birthdayValue: '',
                              birthdayLabel: 'Not provided',
                              notes: null,
                              segment: customer.segment,
                              segmentLabel: customer.segmentLabel,
                              joinedLabel: customer.joinedLabel,
                              lastVisitLabel: customer.lastVisitLabel,
                              totalSpentLabel: customer.totalSpentLabel,
                              smsConsent: customer.smsConsent,
                              smsOptedOut: customer.smsOptedOut,
                              dealSmsBlocked: customer.dealSmsBlocked,
                              visitsCount: customer.visitsCount,
                              appointmentsCount: 0,
                              groups: customer.groups,
                              checkIns: [],
                              appointments: [],
                            });
                            setMessageDraft('');
                            setSheetError(null);
                            setIsMessageSheetVisible(true);
                          }}
                          style={[
                            styles.primaryActionButton,
                            {
                              backgroundColor:
                                customer.phoneDisplay && customer.smsConsent && !customer.smsOptedOut
                                  ? theme.accent
                                  : theme.surfaceMuted,
                              borderColor: theme.border,
                              opacity:
                                customer.phoneDisplay && customer.smsConsent && !customer.smsOptedOut
                                  ? 1
                                  : 0.6,
                            },
                          ]}>
                          <Text style={styles.primaryActionButtonText}>Text</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View
                  style={[
                    styles.noticeCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.noticeTitle, { color: theme.text }]}>No customers found</Text>
                  <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                    Try a different name, email, phone, or filter combination.
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.stack}>
            {data?.groups.length ? (
              data.groups.map((group) => (
                <View
                  key={group.id}
                  style={[
                    styles.groupCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <View style={styles.groupCardHeader}>
                    <View style={styles.groupCardIdentity}>
                      <Text style={[styles.groupTitle, { color: theme.text }]}>{group.name}</Text>
                      <Text style={[styles.groupMeta, { color: theme.mutedText }]}>
                        {group.membersCount} customer{group.membersCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: group.promotionSmsEnabled
                            ? theme.accentSoft
                            : theme.surfaceMuted,
                          borderColor: theme.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: group.promotionSmsEnabled ? theme.accent : theme.text },
                        ]}>
                        {group.promotionSmsEnabled ? 'Promotion SMS on' : 'Promotion SMS off'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.groupManageText, { color: theme.mutedText }]}>
                    Open the filtered customer list to see every member, or edit the group settings here.
                  </Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => focusGroupMembers(group)}
                      style={[styles.primaryActionButton, { backgroundColor: theme.accent, borderColor: theme.border }]}
                      testID={`mobile-group-view-members-${group.id}`}>
                      <Text style={styles.primaryActionButtonText}>View members</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openEditGroup(group)}
                      style={[styles.actionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                      testID={`mobile-group-edit-${group.id}`}>
                      <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit group</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <View
                style={[
                  styles.noticeCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>No customer groups yet</Text>
                <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                  Create your first group to organize customer audiences.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <FullScreenSheet
        onClose={() => {
          setIsCustomerSheetVisible(false);
          setEditingCustomer(null);
          setSheetError(null);
        }}
        subtitle={
          editingCustomer
            ? 'Update profile details, group assignments, and deals SMS preferences.'
            : 'Save contact details, optional birthday, notes, and customer groups.'
        }
        title={editingCustomer ? 'Edit customer' : 'Add customer'}
        visible={isCustomerSheetVisible}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          style={{ backgroundColor: theme.background }}>
          {sheetError ? (
            <InlineErrorCard message={sheetError} theme={theme} />
          ) : null}

          <FieldLabel label="Name" themeText={theme.text} />
          <TextInput
            onChangeText={(value) => setCustomerForm((current) => ({ ...current, name: value }))}
            placeholder="Jordan Lee"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={customerForm.name}
          />

          <FieldLabel label="Email" themeText={theme.text} />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) => setCustomerForm((current) => ({ ...current, email: value }))}
            placeholder="jordan@example.com"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={customerForm.email}
          />

          <FieldLabel label="Phone" themeText={theme.text} />
          <TextInput
            keyboardType="phone-pad"
            onChangeText={(value) => setCustomerForm((current) => ({ ...current, phone: value }))}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={customerForm.phone}
          />

          <FieldLabel label="Birthday" themeText={theme.text} />
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) =>
              setCustomerForm((current) => ({ ...current, birthday: value }))
            }
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={customerForm.birthday}
          />

          <FieldLabel label="Notes" themeText={theme.text} />
          <TextInput
            multiline
            onChangeText={(value) => setCustomerForm((current) => ({ ...current, notes: value }))}
            placeholder="Anything the team should know"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.formInput,
              styles.multilineInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
            textAlignVertical="top"
            value={customerForm.notes}
          />

          <View style={[styles.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Deals SMS messages</Text>
              <Text style={[styles.toggleText, { color: theme.mutedText }]}>
                {customerForm.dealSmsBlocked ? 'Blocked for this customer' : 'Allowed for this customer'}
              </Text>
            </View>
            <Switch
              onValueChange={(value) =>
                setCustomerForm((current) => ({ ...current, dealSmsBlocked: !value }))
              }
              value={!customerForm.dealSmsBlocked}
            />
          </View>

          <FieldLabel label="Customer groups" themeText={theme.text} />
          <View style={styles.optionRow}>
            {data?.groups.length ? (
              data.groups.map((group) => {
                const selected = customerForm.groupIds.includes(group.id);
                return (
                  <FilterPill
                    key={group.id}
                    label={group.name}
                    onPress={() =>
                      setCustomerForm((current) => ({
                        ...current,
                        groupIds: selected
                          ? current.groupIds.filter((groupId) => groupId !== group.id)
                          : [...current.groupIds, group.id],
                      }))
                    }
                    selected={selected}
                    theme={theme}
                  />
                );
              })
            ) : (
              <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                No groups yet.
              </Text>
            )}
          </View>
        </ScrollView>
        <View style={[styles.sheetFooter, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {editingCustomer ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSavingCustomer}
              onPress={handleDeleteCurrentCustomer}
              style={[styles.destructiveFooterButton, { borderColor: theme.border }]}>
              <Text style={styles.destructiveFooterButtonText}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSavingCustomer}
            onPress={handleCustomerSave}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.footerPrimaryButtonText}>
              {isSavingCustomer ? 'Saving...' : editingCustomer ? 'Save customer' : 'Add customer'}
            </Text>
          </Pressable>
        </View>
      </FullScreenSheet>

      <FullScreenSheet
        onClose={() => {
          setIsGroupSheetVisible(false);
          setEditingGroup(null);
          setSheetError(null);
        }}
        subtitle="Set the audience name and whether promotions can include this group."
        title={editingGroup ? 'Edit group' : 'Add group'}
        visible={isGroupSheetVisible}>
        <ScrollView contentContainerStyle={styles.sheetContent} style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} theme={theme} /> : null}

          <FieldLabel label="Group name" themeText={theme.text} />
          <TextInput
            onChangeText={(value) => setGroupForm((current) => ({ ...current, name: value }))}
            placeholder="VIP"
            placeholderTextColor={theme.mutedText}
            style={[styles.formInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={groupForm.name}
          />

          <View style={[styles.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Promotion SMS</Text>
              <Text style={[styles.toggleText, { color: theme.mutedText }]}>
                {groupForm.promotionSmsEnabled ? 'Customers in this group can receive promotion SMS.' : 'Promotion SMS is disabled for this group.'}
              </Text>
            </View>
            <Switch
              onValueChange={(value) =>
                setGroupForm((current) => ({ ...current, promotionSmsEnabled: value }))
              }
              value={groupForm.promotionSmsEnabled}
            />
          </View>
        </ScrollView>
        <View style={[styles.sheetFooter, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {editingGroup ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSavingGroup}
              onPress={handleDeleteCurrentGroup}
              style={[styles.destructiveFooterButton, { borderColor: theme.border }]}>
              <Text style={styles.destructiveFooterButtonText}>Delete</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSavingGroup}
            onPress={handleGroupSave}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.footerPrimaryButtonText}>
              {isSavingGroup ? 'Saving...' : editingGroup ? 'Save group' : 'Add group'}
            </Text>
          </Pressable>
        </View>
      </FullScreenSheet>

      <FullScreenSheet
        onClose={() => {
          setIsDetailSheetVisible(false);
          setSelectedCustomer(null);
          setSelectedMessages(null);
          setSheetError(null);
        }}
        subtitle="Review the customer profile, recent history, and direct message activity."
        title={selectedCustomer?.name ?? 'Customer profile'}
        visible={isDetailSheetVisible}>
        {isDetailLoading ? (
          <View style={[styles.loadingSheetBody, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>Loading customer...</Text>
          </View>
        ) : selectedCustomer ? (
          <>
            <View style={[styles.detailHeaderCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.detailHeaderTop}>
                <View style={styles.detailHeaderCopy}>
                  <Text style={[styles.detailMetaLine, { color: theme.mutedText }]}>
                    {selectedCustomer.phoneDisplay ?? selectedCustomer.email ?? 'No contact info'}
                  </Text>
                  <Text style={[styles.detailMetaLine, { color: theme.mutedText }]}>
                    Customer since {selectedCustomer.joinedLabel}
                  </Text>
                </View>
                <View style={styles.badgesColumn}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: getSmsStatusAppearance(theme, selectedCustomer).backgroundColor,
                        borderColor: getSmsStatusAppearance(theme, selectedCustomer).borderColor,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: getSmsStatusAppearance(theme, selectedCustomer).textColor },
                      ]}>
                      {getSmsStatusAppearance(theme, selectedCustomer).label}
                    </Text>
                  </View>
                  <View style={[styles.secondaryPill, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <Text style={[styles.secondaryPillText, { color: theme.text }]}>
                      {selectedCustomer.segmentLabel}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <MetricTile label="Visits" value={String(selectedCustomer.visitsCount)} theme={theme} />
                <MetricTile
                  label="Appointments"
                  value={String(selectedCustomer.appointmentsCount)}
                  theme={theme}
                />
                <MetricTile label="Spent" value={selectedCustomer.totalSpentLabel} theme={theme} />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openEditCustomer(selectedCustomer)}
                  style={[styles.actionButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isSendingReviewRequest ||
                    !selectedCustomer.phoneDisplay ||
                    !selectedCustomer.smsConsent ||
                    selectedCustomer.smsOptedOut
                  }
                  onPress={async () => {
                    setSheetError(null);
                    setSheetNotice(null);
                    setIsSendingReviewRequest(true);

                    try {
                      await onSendReviewRequest(selectedCustomer.id);
                      setSheetNotice(`Review request sent to ${selectedCustomer.name}.`);
                    } catch (reviewError) {
                      setSheetError(
                        reviewError instanceof Error
                          ? reviewError.message
                          : 'Unable to send the review request.',
                      );
                    } finally {
                      setIsSendingReviewRequest(false);
                    }
                  }}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor:
                        selectedCustomer.phoneDisplay &&
                        selectedCustomer.smsConsent &&
                        !selectedCustomer.smsOptedOut
                          ? theme.surfaceMuted
                          : theme.surfaceMuted,
                      borderColor: theme.border,
                      opacity:
                        selectedCustomer.phoneDisplay &&
                        selectedCustomer.smsConsent &&
                        !selectedCustomer.smsOptedOut
                          ? 1
                          : 0.6,
                    },
                  ]}>
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>
                    {isSendingReviewRequest ? 'Sending...' : 'Request review'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!selectedCustomer.phoneDisplay || !selectedCustomer.smsConsent || selectedCustomer.smsOptedOut}
                  onPress={() => {
                    setMessageDraft('');
                    setSheetError(null);
                    setIsMessageSheetVisible(true);
                  }}
                  style={[
                    styles.primaryActionButton,
                    {
                      backgroundColor:
                        selectedCustomer.phoneDisplay &&
                        selectedCustomer.smsConsent &&
                        !selectedCustomer.smsOptedOut
                          ? theme.accent
                          : theme.surfaceMuted,
                      borderColor: theme.border,
                      opacity:
                        selectedCustomer.phoneDisplay &&
                        selectedCustomer.smsConsent &&
                        !selectedCustomer.smsOptedOut
                          ? 1
                          : 0.6,
                    },
                  ]}>
                  <Text style={styles.primaryActionButtonText}>Text</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.detailTabs, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {([
                ['overview', 'Overview'],
                ['history', 'History'],
                ['messages', 'Messages'],
              ] as const).map(([tabKey, tabLabel]) => {
                const selected = detailTab === tabKey;
                return (
                  <Pressable
                    key={tabKey}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setDetailTab(tabKey);
                      if (tabKey === 'messages') {
                        void ensureMessagesLoaded();
                      }
                    }}
                    style={[
                      styles.detailTabButton,
                      selected
                        ? { backgroundColor: theme.accent }
                        : { backgroundColor: theme.surfaceMuted },
                    ]}>
                    <Text
                      style={
                        selected
                          ? styles.detailTabSelectedText
                          : [styles.detailTabText, { color: theme.text }]
                      }>
                      {tabLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} style={{ backgroundColor: theme.background }}>
              {sheetError ? <InlineErrorCard message={sheetError} theme={theme} /> : null}

              {detailTab === 'overview' ? (
                <>
                  <View style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Profile</Text>
                    <DetailLine label="Email" value={selectedCustomer.email ?? 'Not provided'} theme={theme} />
                    <DetailLine label="Phone" value={selectedCustomer.phoneDisplay ?? 'Not provided'} theme={theme} />
                    <DetailLine label="Birthday" value={selectedCustomer.birthdayLabel} theme={theme} />
                    <DetailLine label="Last visit" value={selectedCustomer.lastVisitLabel} theme={theme} />
                    <DetailLine
                      label="Deals SMS"
                      value={selectedCustomer.dealSmsBlocked ? 'Blocked by you' : 'Allowed'}
                      theme={theme}
                    />
                    <DetailLine
                      label="Groups"
                      value={renderGroupSummary(selectedCustomer.groups)}
                      theme={theme}
                    />
                    {selectedCustomer.notes ? (
                      <View style={styles.notesBlock}>
                        <Text style={[styles.detailLineLabel, { color: theme.mutedText }]}>Notes</Text>
                        <Text style={[styles.detailLineValue, { color: theme.text }]}>
                          {selectedCustomer.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Recent check-ins</Text>
                    {selectedCustomer.checkIns.length ? (
                      selectedCustomer.checkIns.map((checkIn) => (
                        <View key={checkIn.id} style={[styles.timelineRow, { borderColor: theme.border }]}>
                          <Text style={[styles.timelineTitle, { color: theme.text }]}>{checkIn.createdAtLabel}</Text>
                          <Text style={[styles.timelineMeta, { color: theme.mutedText }]}>
                            Spent {checkIn.amountSpentLabel}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                        No recent check-ins yet.
                      </Text>
                    )}
                  </View>
                </>
              ) : null}

              {detailTab === 'history' ? (
                <View style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Appointments</Text>
                  {selectedCustomer.appointments.length ? (
                    selectedCustomer.appointments.map((appointment) => (
                      <View key={appointment.id} style={[styles.timelineRow, { borderColor: theme.border }]}>
                        <Text style={[styles.timelineTitle, { color: theme.text }]}>
                          {appointment.serviceName}
                        </Text>
                        <Text style={[styles.timelineMeta, { color: theme.mutedText }]}>
                          {appointment.startTimeLabel}
                          {appointment.staffName ? ` · ${appointment.staffName}` : ''}
                        </Text>
                        <View style={[styles.secondaryPill, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                          <Text style={[styles.secondaryPillText, { color: theme.text }]}>
                            {appointment.statusLabel}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                      No appointment history yet.
                    </Text>
                  )}
                </View>
              ) : null}

              {detailTab === 'messages' ? (
                <View style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.detailSectionHeader}>
                    <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Direct messages</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isMessageLoading}
                      onPress={() => void ensureMessagesLoaded()}
                      style={[styles.inlineActionButton, { borderColor: theme.border }]}>
                      <Text style={[styles.inlineActionButtonText, { color: theme.text }]}>Refresh</Text>
                    </Pressable>
                  </View>
                  {isMessageLoading ? (
                    <View style={styles.inlineLoading}>
                      <ActivityIndicator color={theme.accent} />
                    </View>
                  ) : selectedMessages?.quota ? (
                    <Text style={[styles.detailMetaLine, { color: theme.mutedText }]}>
                      {selectedMessages.quota.remaining} of {selectedMessages.quota.limit} direct messages left. Resets {selectedMessages.quota.periodEndLabel}.
                    </Text>
                  ) : null}

                  {!selectedCustomer.phoneDisplay ? (
                    <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                      No phone number on file.
                    </Text>
                  ) : selectedMessages?.logs.length ? (
                    selectedMessages.logs.map((log) => (
                      <View key={log.id} style={[styles.timelineRow, { borderColor: theme.border }]}>
                        <Text style={[styles.timelineTitle, { color: theme.text }]}>
                          {log.messageTypeLabel}
                        </Text>
                        <Text style={[styles.timelineMeta, { color: theme.mutedText }]}>
                          {log.createdAtLabel} · {log.status}
                        </Text>
                        <Text style={[styles.timelineBody, { color: theme.text }]}>{log.message}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyInlineText, { color: theme.mutedText }]}>
                      No messages sent to this customer yet.
                    </Text>
                  )}
                </View>
              ) : null}
            </ScrollView>
          </>
        ) : null}
      </FullScreenSheet>

      <FullScreenSheet
        onClose={() => {
          setIsMessageSheetVisible(false);
          setMessageDraft('');
          setSheetError(null);
        }}
        subtitle="Send a one-off text with your business name added automatically."
        title={selectedCustomer ? `Message ${selectedCustomer.name}` : 'Send message'}
        visible={isMessageSheetVisible}>
        <ScrollView contentContainerStyle={styles.sheetContent} style={{ backgroundColor: theme.background }}>
          {sheetError ? <InlineErrorCard message={sheetError} theme={theme} /> : null}
          {selectedMessages?.quota ? (
            <View style={[styles.detailSectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.detailMetaLine, { color: theme.mutedText }]}>
                {selectedMessages.quota.remaining} of {selectedMessages.quota.limit} direct messages left this period.
              </Text>
            </View>
          ) : null}
          <FieldLabel label="Message" themeText={theme.text} />
          <TextInput
            multiline
            onChangeText={setMessageDraft}
            placeholder="Type the message you want to send"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.formInput,
              styles.messageInput,
              { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            ]}
            textAlignVertical="top"
            value={messageDraft}
          />
          <Text style={[styles.characterCount, { color: theme.mutedText }]}>
            {messageDraft.trim().length}/500
          </Text>
        </ScrollView>
        <View style={[styles.sheetFooter, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            disabled={isSendingMessage}
            onPress={handleSendMessageNow}
            style={[styles.footerPrimaryButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.footerPrimaryButtonText}>
              {isSendingMessage ? 'Sending...' : 'Send text'}
            </Text>
          </Pressable>
        </View>
      </FullScreenSheet>
    </>
  );
}

function FilterPill({
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
        styles.filterPill,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}>
      <Text
        style={
          selected
            ? styles.filterPillSelectedText
            : [styles.filterPillText, { color: theme.text }]
        }>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterSection({
  children,
  theme,
  title,
}: {
  children: React.ReactNode;
  theme: ReturnType<typeof getClientificTheme>;
  title: string;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={[styles.filterLabel, { color: theme.mutedText }]}>{title}</Text>
      <View style={styles.optionRow}>{children}</View>
    </View>
  );
}

function FieldLabel({ label, themeText }: { label: string; themeText: string }) {
  return <Text style={[styles.fieldLabel, { color: themeText }]}>{label}</Text>;
}

function InlineErrorCard({
  message,
  theme,
}: {
  message: string;
  theme: ReturnType<typeof getClientificTheme>;
}) {
  return (
    <View
      style={[
        styles.noticeCard,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}>
      <Text style={[styles.noticeTitle, { color: theme.text }]}>Something needs attention</Text>
      <Text style={[styles.noticeText, { color: theme.mutedText }]}>{message}</Text>
    </View>
  );
}

function MetricTile({
  label,
  theme,
  value,
}: {
  label: string;
  theme: ReturnType<typeof getClientificTheme>;
  value: string;
}) {
  return (
    <View style={[styles.metricTile, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <Text style={[styles.metricTileLabel, { color: theme.mutedText }]}>{label}</Text>
      <Text style={[styles.metricTileValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function DetailLine({
  label,
  theme,
  value,
}: {
  label: string;
  theme: ReturnType<typeof getClientificTheme>;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLineLabel, { color: theme.mutedText }]}>{label}</Text>
      <Text style={[styles.detailLineValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 16,
    shadowColor: '#09131f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroHeader: {
    gap: 16,
  },
  heroCopy: {
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
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroBadge: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  addButton: {
    minHeight: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    flexShrink: 0,
  },
  addButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  segmentButtonSelectedText: {
    color: '#f8fffc',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  searchInput: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
    shadowColor: '#09131f',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  filterCardCopy: {
    flex: 1,
    gap: 4,
  },
  filterCardTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  filterCardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeFilterPill: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  filtersStack: {
    gap: 14,
  },
  filterBlock: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  filterPillSelectedText: {
    color: '#f8fffc',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFiltersText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  groupSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 16,
    lineHeight: 20,
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
    paddingVertical: 28,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  paginationCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#09131f',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  paginationCopy: {
    gap: 4,
  },
  paginationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  paginationTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  paginationText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: '100%',
    gap: 12,
  },
  paginationCenterColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paginationCurrentPageLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paginationNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    minHeight: 38,
    flexWrap: 'wrap',
  },
  paginationPagePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  paginationPagePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  pageNumberButton: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  paginationEllipsisWrap: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationEllipsisText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  pageNumberButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  pageNumberButtonSelectedText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  stack: {
    gap: 14,
  },
  customerCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    shadowColor: '#09131f',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  customerHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  customerIdentity: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  customerMeta: {
    fontSize: 14,
    lineHeight: 18,
  },
  customerSecondaryMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  badgesColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  customerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
  },
  secondaryPill: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPillText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  customerStatsText: {
    fontSize: 14,
    lineHeight: 18,
  },
  customerStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  customerStatCell: {
    minWidth: '47%',
    flexGrow: 1,
    gap: 3,
  },
  customerStatLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  customerStatValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  groupBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupBadge: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
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
  primaryActionButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryActionButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    shadowColor: '#09131f',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  groupCardIdentity: {
    flex: 1,
    gap: 4,
  },
  groupTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  groupMeta: {
    fontSize: 14,
    lineHeight: 18,
  },
  groupManageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  sheetScreen: {
    flex: 1,
  },
  sheetHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
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
  iconButton: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  sheetFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
  },
  footerPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  footerPrimaryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  destructiveFooterButton: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveFooterButtonText: {
    color: '#d92d20',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  formInput: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  multilineInput: {
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 14,
  },
  messageInput: {
    minHeight: 180,
    paddingTop: 14,
    paddingBottom: 14,
  },
  toggleCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  toggleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyInlineText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingSheetBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  detailHeaderCard: {
    borderWidth: 1,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailMetaLine: {
    fontSize: 14,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  metricTileLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  metricTileValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  detailTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    gap: 6,
  },
  detailTabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  detailTabText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  detailTabSelectedText: {
    color: '#f8fffc',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  detailSectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailSectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  inlineActionButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionButtonText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
  },
  detailLine: {
    gap: 4,
  },
  detailLineLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  detailLineValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  notesBlock: {
    gap: 6,
  },
  timelineRow: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 4,
  },
  timelineTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  timelineMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  timelineBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  inlineLoading: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
});
