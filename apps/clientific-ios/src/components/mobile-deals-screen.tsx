import React, { useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import {
  getClientificWebUrl,
  type MobileDealInput,
  type MobileDealRecord,
  type MobileDealsSummary,
  type MobileServicesSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileDealsScreenProps = {
  data: MobileDealsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isDealComposerLoading: boolean;
  onCreateDeal: (input: MobileDealInput) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onLoadDealComposerResources: () => Promise<void>;
  onOpenFunds: () => void;
  onOpenUrl: (url: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onShareDeal: (deal: MobileDealRecord) => Promise<void>;
  onUpdateDeal: (dealId: string, input: Partial<MobileDealInput>) => Promise<void>;
  servicesSummary: MobileServicesSummary | null;
  initialSheetMode?: 'create';
};

type DealFormState = {
  title: string;
  description: string;
  discountType: MobileDealInput['discountType'];
  discountValue: string;
  serviceScope: MobileDealInput['serviceScope'];
  eligibleServiceIds: string[];
  newCustomersOnly: boolean;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  maxRedemptions: string;
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function createDefaultDealForm(): DealFormState {
  const startsAt = formatDateKey(new Date());

  return {
    title: '',
    description: '',
    discountType: 'percent_off',
    discountValue: '20',
    serviceScope: 'all_services',
    eligibleServiceIds: [],
    newCustomersOnly: false,
    active: true,
    startsAt,
    expiresAt: addDays(startsAt, 1),
    maxRedemptions: '',
  };
}

function createDealFormFromDeal(deal: MobileDealRecord): DealFormState {
  return {
    title: deal.title,
    description: deal.description ?? '',
    discountType: deal.discountType,
    discountValue: deal.discountType === 'free_service' ? '' : String(deal.discountValue),
    serviceScope: deal.discountType === 'free_service' ? 'selected_services' : deal.serviceScope,
    eligibleServiceIds: deal.eligibleServices.map((service) => service.id),
    newCustomersOnly: deal.newCustomersOnly,
    active: deal.active,
    startsAt: deal.startsAtValue,
    expiresAt: deal.expiresAtValue,
    maxRedemptions: deal.maxRedemptions ? String(deal.maxRedemptions) : '',
  };
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getReadableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getStatusColors(
  tone: MobileDealRecord['statusTone'],
  theme: ReturnType<typeof getClientificTheme>,
) {
  if (tone === 'live') {
    return {
      backgroundColor: theme.accentSoft,
      textColor: theme.accent,
    };
  }

  if (tone === 'scheduled') {
    return {
      backgroundColor: theme.surfaceMuted,
      textColor: theme.text,
    };
  }

  return {
    backgroundColor: theme.surfaceMuted,
    textColor: theme.mutedText,
  };
}

function FieldLabel({ label, themeText }: { label: string; themeText: string }) {
  return <Text style={[styles.fieldLabel, { color: themeText }]}>{label}</Text>;
}

function OptionPill({
  label,
  onPress,
  selected,
  testID,
  theme,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  testID?: string;
  theme: ReturnType<typeof getClientificTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.optionPill,
        selected
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
      testID={testID}>
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
          {
            backgroundColor: theme.background,
            paddingTop: safeTop,
            paddingBottom: safeBottom,
          },
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
            testID="mobile-deals-sheet-close">
            <Text style={[styles.headerCloseButtonText, { color: theme.text }]}>Close</Text>
          </Pressable>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MobileDealsScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  isDealComposerLoading,
  onCreateDeal,
  onDeleteDeal,
  onLoadDealComposerResources,
  onOpenFunds,
  onOpenUrl,
  onRefresh,
  onShareDeal,
  onUpdateDeal,
  servicesSummary,
  initialSheetMode,
}: MobileDealsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [editingDeal, setEditingDeal] = useState<MobileDealRecord | null>(null);
  const [form, setForm] = useState<DealFormState>(createDefaultDealForm);
  const [isSheetVisible, setIsSheetVisible] = useState(initialSheetMode === 'create');
  const [isSavingDeal, setIsSavingDeal] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const activeServices = useMemo(
    () => (servicesSummary?.services ?? []).filter((service) => service.isActive),
    [servicesSummary?.services],
  );
  const dealUrl = (deal: MobileDealRecord) => `${getClientificWebUrl()}${deal.linkPath}`;

  const openCreateDeal = () => {
    const nextForm = createDefaultDealForm();
    if (activeServices.length === 1) {
      nextForm.eligibleServiceIds = [activeServices[0].id];
    }
    setEditingDeal(null);
    setForm(nextForm);
    setSheetError(null);
    setIsSheetVisible(true);
    void onLoadDealComposerResources().catch((loadError) => {
      setSheetError(getReadableError(loadError, 'Unable to load service choices.'));
    });
  };

  const openEditDeal = (deal: MobileDealRecord) => {
    setEditingDeal(deal);
    setForm(createDealFormFromDeal(deal));
    setSheetError(null);
    setIsSheetVisible(true);
    void onLoadDealComposerResources().catch((loadError) => {
      setSheetError(getReadableError(loadError, 'Unable to load service choices.'));
    });
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
    setEditingDeal(null);
    setSheetError(null);
  };

  const updateDiscountType = (discountType: DealFormState['discountType']) => {
    setForm((current) => {
      if (discountType === 'free_service') {
        return {
          ...current,
          discountType,
          discountValue: '',
          serviceScope: 'selected_services',
          eligibleServiceIds:
            current.eligibleServiceIds.length > 1
              ? current.eligibleServiceIds.slice(0, 1)
              : current.eligibleServiceIds,
        };
      }

      return {
        ...current,
        discountType,
        discountValue: current.discountValue || (discountType === 'percent_off' ? '20' : '10'),
      };
    });
  };

  const toggleEligibleService = (serviceId: string) => {
    setForm((current) => {
      const selected = current.eligibleServiceIds.includes(serviceId);
      if (current.discountType === 'free_service') {
        return {
          ...current,
          eligibleServiceIds: selected ? [] : [serviceId],
        };
      }

      return {
        ...current,
        eligibleServiceIds: selected
          ? current.eligibleServiceIds.filter((id) => id !== serviceId)
          : [...current.eligibleServiceIds, serviceId],
      };
    });
  };

  const buildPayload = () => {
    const title = form.title.trim();
    const description = form.description.trim();
    const startsAt = parseDateKey(form.startsAt);
    const expiresAt = parseDateKey(form.expiresAt);
    const discountValue =
      form.discountType === 'free_service' ? 0 : Number.parseFloat(form.discountValue);
    const maxRedemptions =
      form.maxRedemptions.trim().length > 0
        ? Number.parseInt(form.maxRedemptions, 10)
        : null;

    if (!title) {
      throw new Error('Deal title is required.');
    }
    if (form.discountType !== 'free_service' && !Number.isFinite(discountValue)) {
      throw new Error('Add a valid discount amount.');
    }
    if (form.discountType === 'percent_off' && (discountValue <= 0 || discountValue > 100)) {
      throw new Error('Percent discounts must be between 1 and 100.');
    }
    if (form.discountType === 'amount_off' && discountValue <= 0) {
      throw new Error('Dollar discounts must be greater than 0.');
    }
    if (!startsAt || !expiresAt) {
      throw new Error('Use dates like 2026-07-14.');
    }
    if (expiresAt.getTime() <= startsAt.getTime()) {
      throw new Error('End date must be after the start date.');
    }
    if (form.discountType === 'free_service' && form.eligibleServiceIds.length !== 1) {
      throw new Error('Free service deals must target exactly one service.');
    }
    if (form.serviceScope === 'selected_services' && form.eligibleServiceIds.length === 0) {
      throw new Error('Choose at least one eligible service.');
    }
    if (maxRedemptions !== null && (!Number.isFinite(maxRedemptions) || maxRedemptions < 1)) {
      throw new Error('Max purchases must be at least 1.');
    }

    return {
      title,
      description: description || null,
      active: form.active,
      discountType: form.discountType,
      discountValue,
      deliveryType: 'purchase_link' as const,
      serviceScope: form.serviceScope,
      eligibleServiceIds:
        form.serviceScope === 'selected_services' ? form.eligibleServiceIds : [],
      newCustomersOnly: form.newCustomersOnly,
      startsAt: form.startsAt,
      expiresAt: form.expiresAt,
      maxRedemptions,
    } satisfies MobileDealInput;
  };

  const saveDeal = async () => {
    Keyboard.dismiss();

    let payload: MobileDealInput;
    try {
      payload = buildPayload();
    } catch (validationError) {
      setSheetError(getReadableError(validationError, 'Fix the deal details before saving.'));
      return;
    }

    setIsSavingDeal(true);
    setSheetError(null);

    try {
      if (editingDeal) {
        await onUpdateDeal(editingDeal.id, payload);
      } else {
        await onCreateDeal(payload);
      }

      closeSheet();
    } catch (saveError) {
      setSheetError(getReadableError(saveError, 'Unable to save deal.'));
    } finally {
      setIsSavingDeal(false);
    }
  };

  const toggleDealActive = async (deal: MobileDealRecord) => {
    try {
      await onUpdateDeal(deal.id, { active: !deal.active });
    } catch (toggleError) {
      setSheetError(getReadableError(toggleError, 'Unable to update deal.'));
    }
  };

  const confirmDeleteDeal = (deal: MobileDealRecord) => {
    Alert.alert(
      'Delete deal?',
      'This removes the promotion from the mobile and web deal board.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDeleteDeal(deal.id);
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
              <Text style={[styles.eyebrow, { color: theme.accent }]}>Deals</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Mobile deal board</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openCreateDeal}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}
              testID="mobile-open-deal-sheet">
              <Text style={styles.primaryButtonText}>New deal</Text>
            </Pressable>
          </View>
          <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
            Create purchase-link offers, keep them live, and share customer-ready links from the app.
          </Text>
        </View>

        {!data?.payoutReady ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>Paid deals still need payouts</Text>
            <Text style={[styles.noticeText, { color: theme.mutedText }]}>
              {data?.payoutSetupMessage ??
                'Open funds to finish payout setup before you publish paid purchase-link deals.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenFunds}
              style={[styles.inlineButton, { backgroundColor: theme.accent }]}
              testID="mobile-deals-open-funds">
              <Text style={styles.inlineButtonText}>Open funds</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load deals</Text>
            <Text style={[styles.noticeText, { color: theme.mutedText }]}>{error}</Text>
          </View>
        ) : null}

        {sheetError && !isSheetVisible ? (
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>Deal update failed</Text>
            <Text style={[styles.noticeText, { color: theme.mutedText }]}>{sheetError}</Text>
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
              Loading deals...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              {[
                ['Total', data?.counts.total ?? 0],
                ['Live', data?.counts.live ?? 0],
                ['Scheduled', data?.counts.scheduled ?? 0],
                ['Ended', data?.counts.ended ?? 0],
              ].map(([label, value]) => (
                <View
                  key={String(label)}
                  style={[
                    styles.metricCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.metricLabel, { color: theme.mutedText }]}>
                    {String(label)}
                  </Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>{String(value)}</Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionCopy}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Offers</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.mutedText }]}>
                    Manage the same purchase-link promotions your customers can buy or claim.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={openCreateDeal}
                  style={[styles.addButton, { backgroundColor: theme.accent }]}
                  testID="mobile-open-deal-sheet-secondary">
                  <Text style={styles.addButtonText}>Create</Text>
                </Pressable>
              </View>

              {data?.deals.length ? (
                data.deals.map((deal) => {
                  const statusColors = getStatusColors(deal.statusTone, theme);

                  return (
                    <View
                      key={deal.id}
                      style={[styles.dealCard, { borderColor: theme.border }]}
                      testID={`mobile-deal-${deal.id}`}>
                      <View style={styles.dealHeader}>
                        <View style={styles.dealCopy}>
                          <Text style={[styles.dealTitle, { color: theme.text }]}>{deal.title}</Text>
                          <Text style={[styles.dealSubtitle, { color: theme.mutedText }]}>
                            {deal.discountLabel} · {deal.deliveryLabel}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: statusColors.backgroundColor, borderColor: theme.border },
                          ]}>
                          <Text style={[styles.statusText, { color: statusColors.textColor }]}>
                            {deal.statusLabel}
                          </Text>
                        </View>
                      </View>

                      {deal.description ? (
                        <Text style={[styles.dealDescription, { color: theme.mutedText }]}>
                          {deal.description}
                        </Text>
                      ) : null}

                      <View style={styles.metaGrid}>
                        <View style={styles.metaBlock}>
                          <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Window</Text>
                          <Text style={[styles.metaValue, { color: theme.text }]}>{deal.windowLabel}</Text>
                        </View>
                        <View style={styles.metaBlock}>
                          <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Revenue</Text>
                          <Text style={[styles.metaValue, { color: theme.text }]}>{deal.revenueLabel}</Text>
                        </View>
                        <View style={styles.metaBlock}>
                          <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Purchases</Text>
                          <Text style={[styles.metaValue, { color: theme.text }]}>{deal.purchasesCount}</Text>
                        </View>
                        <View style={styles.metaBlock}>
                          <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Sold</Text>
                          <Text style={[styles.metaValue, { color: theme.text }]}>
                            {deal.redemptionCount}
                            {deal.maxRedemptions ? ` / ${deal.maxRedemptions}` : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.groupRow}>
                        <View
                          style={[
                            styles.groupPill,
                            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                          ]}>
                          <Text style={[styles.groupPillText, { color: theme.text }]}>
                            {deal.serviceScope === 'all_services'
                              ? 'Any active service'
                              : deal.eligibleServices.map((service) => service.name).join(', ') ||
                                'Selected services'}
                          </Text>
                        </View>
                        {deal.newCustomersOnly ? (
                          <View
                            style={[
                              styles.groupPill,
                              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.groupPillText, { color: theme.mutedText }]}>
                              New customers only
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.actionRow}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void onShareDeal(deal)}
                          style={[styles.actionButton, { borderColor: theme.border }]}
                          testID={`mobile-deal-share-${deal.id}`}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>Share</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void Clipboard.setStringAsync(dealUrl(deal))}
                          style={[styles.actionButton, { borderColor: theme.border }]}
                          testID={`mobile-deal-copy-${deal.id}`}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>Copy</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void onOpenUrl(dealUrl(deal))}
                          style={[styles.actionButton, { borderColor: theme.border }]}
                          testID={`mobile-deal-open-${deal.id}`}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>Open</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => openEditDeal(deal)}
                          style={[styles.actionButton, { borderColor: theme.border }]}
                          testID={`mobile-deal-edit-${deal.id}`}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void toggleDealActive(deal)}
                          style={[styles.actionButton, { borderColor: theme.border }]}
                          testID={`mobile-deal-toggle-${deal.id}`}>
                          <Text style={[styles.actionButtonText, { color: theme.text }]}>
                            {deal.active ? 'Pause' : 'Publish'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => confirmDeleteDeal(deal)}
                          style={[styles.actionButton, { borderColor: theme.border }]}
                          testID={`mobile-deal-delete-${deal.id}`}>
                          <Text style={[styles.actionButtonText, { color: theme.danger }]}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.noticeTitle, { color: theme.text }]}>No deals yet</Text>
                  <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                    Start the first purchase-link offer directly from the mobile app.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openCreateDeal}
                    style={[styles.inlineButton, { backgroundColor: theme.accent }]}
                    testID="mobile-empty-create-deal">
                    <Text style={styles.inlineButtonText}>Create deal</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <FullScreenSheet
        onClose={closeSheet}
        subtitle="Create or update customer-ready purchase-link offers from the app."
        title={editingDeal ? 'Edit deal' : 'New deal'}
        visible={isSheetVisible}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: theme.background }}>
          {sheetError ? (
            <View
              style={[
                styles.noticeCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}>
              <Text style={[styles.noticeTitle, { color: theme.danger }]}>Fix before saving</Text>
              <Text style={[styles.noticeText, { color: theme.text }]}>{sheetError}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <FieldLabel label="Title" themeText={theme.mutedText} />
            <TextInput
              onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
              placeholder="20% off gel manicures"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.input,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
              testID="mobile-deal-title-input"
              value={form.title}
            />
          </View>

          <View style={styles.fieldGroup}>
            <FieldLabel label="Discount" themeText={theme.mutedText} />
            <View style={styles.optionRow}>
              <OptionPill
                label="% off"
                onPress={() => updateDiscountType('percent_off')}
                selected={form.discountType === 'percent_off'}
                testID="mobile-deal-discount-percent"
                theme={theme}
              />
              <OptionPill
                label="$ off"
                onPress={() => updateDiscountType('amount_off')}
                selected={form.discountType === 'amount_off'}
                testID="mobile-deal-discount-amount"
                theme={theme}
              />
              <OptionPill
                label="Free service"
                onPress={() => updateDiscountType('free_service')}
                selected={form.discountType === 'free_service'}
                testID="mobile-deal-discount-free"
                theme={theme}
              />
            </View>
          </View>

          {form.discountType !== 'free_service' ? (
            <View style={styles.fieldGroup}>
              <FieldLabel
                label={form.discountType === 'percent_off' ? 'Percent off' : 'Amount off'}
                themeText={theme.mutedText}
              />
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => setForm((current) => ({ ...current, discountValue: value }))}
                placeholder={form.discountType === 'percent_off' ? '20' : '10'}
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                ]}
                testID="mobile-deal-discount-value-input"
                value={form.discountValue}
              />
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <FieldLabel label="Applies to" themeText={theme.mutedText} />
            <View style={styles.optionRow}>
              <OptionPill
                label="Any active service"
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    serviceScope: 'all_services',
                    eligibleServiceIds: [],
                  }))
                }
                selected={form.serviceScope === 'all_services'}
                testID="mobile-deal-service-scope-all"
                theme={theme}
              />
              <OptionPill
                label="Selected services"
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    serviceScope: 'selected_services',
                    eligibleServiceIds:
                      current.eligibleServiceIds.length === 0 && activeServices.length === 1
                        ? [activeServices[0].id]
                        : current.eligibleServiceIds,
                  }))
                }
                selected={form.serviceScope === 'selected_services'}
                testID="mobile-deal-service-scope-selected"
                theme={theme}
              />
            </View>
          </View>

          {form.serviceScope === 'selected_services' ? (
            <View style={styles.fieldGroup}>
              <FieldLabel label="Eligible services" themeText={theme.mutedText} />
              {isDealComposerLoading && !servicesSummary ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator color={theme.accent} />
                  <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                    Loading services...
                  </Text>
                </View>
              ) : activeServices.length ? (
                <View style={styles.optionRow}>
                  {activeServices.map((service) => (
                    <OptionPill
                      key={service.id}
                      label={service.name}
                      onPress={() => toggleEligibleService(service.id)}
                      selected={form.eligibleServiceIds.includes(service.id)}
                      testID={`mobile-deal-service-${service.id}`}
                      theme={theme}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                  Add active services before limiting a deal to selected services.
                </Text>
              )}
            </View>
          ) : null}

          <View style={styles.twoColumnFields}>
            <View style={styles.flexField}>
              <FieldLabel label="Start date" themeText={theme.mutedText} />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setForm((current) => ({ ...current, startsAt: value }))}
                placeholder="2026-07-14"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                ]}
                testID="mobile-deal-starts-at-input"
                value={form.startsAt}
              />
            </View>
            <View style={styles.flexField}>
              <FieldLabel label="End date" themeText={theme.mutedText} />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setForm((current) => ({ ...current, expiresAt: value }))}
                placeholder="2026-07-21"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                ]}
                testID="mobile-deal-expires-at-input"
                value={form.expiresAt}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <FieldLabel label="Max purchases" themeText={theme.mutedText} />
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => setForm((current) => ({ ...current, maxRedemptions: value }))}
              placeholder="Unlimited"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.input,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
              testID="mobile-deal-max-input"
              value={form.maxRedemptions}
            />
          </View>

          <View style={styles.fieldGroup}>
            <FieldLabel label="Description" themeText={theme.mutedText} />
            <TextInput
              multiline
              onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
              placeholder="Optional details customers should know"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.textArea,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
              ]}
              testID="mobile-deal-description-input"
              value={form.description}
            />
          </View>

          <View
            style={[
              styles.switchCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: theme.text }]}>New customers only</Text>
              <Text style={[styles.switchText, { color: theme.mutedText }]}>
                Only phones not already saved as customers can buy or claim this promotion.
              </Text>
            </View>
            <Switch
              onValueChange={(value) =>
                setForm((current) => ({ ...current, newCustomersOnly: value }))
              }
              testID="mobile-deal-new-customers-toggle"
              thumbColor="#ffffff"
              trackColor={{ false: theme.border, true: theme.accent }}
              value={form.newCustomersOnly}
            />
          </View>

          <View
            style={[
              styles.switchCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: theme.text }]}>Publish deal</Text>
              <Text style={[styles.switchText, { color: theme.mutedText }]}>
                Keep this off when you want a draft that is not visible to customers yet.
              </Text>
            </View>
            <Switch
              onValueChange={(value) => setForm((current) => ({ ...current, active: value }))}
              testID="mobile-deal-active-toggle"
              thumbColor="#ffffff"
              trackColor={{ false: theme.border, true: theme.accent }}
              value={form.active}
            />
          </View>
        </ScrollView>
        <View
          style={[
            styles.sheetFooter,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Pressable
            accessibilityRole="button"
            disabled={isSavingDeal}
            onPress={closeSheet}
            style={[styles.footerButton, { borderColor: theme.border }]}
            testID="mobile-cancel-deal">
            <Text style={[styles.footerButtonText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSavingDeal}
            onPress={() => void saveDeal()}
            style={[
              styles.footerButton,
              styles.footerPrimaryButton,
              { backgroundColor: theme.accent, borderColor: theme.accent },
              isSavingDeal && styles.disabledButton,
            ]}
            testID="mobile-save-deal">
            <Text style={styles.footerPrimaryButtonText}>
              {isSavingDeal ? 'Saving...' : editingDeal ? 'Save deal' : 'Create deal'}
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
    gap: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  noticeTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  inlineButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  inlineButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  loadingCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },
  loadingInline: {
    flexDirection: 'row',
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
    width: '47%',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  addButton: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  dealCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  dealCopy: {
    flex: 1,
    gap: 4,
  },
  dealTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  dealSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  dealDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaBlock: {
    width: '47%',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 16,
    flexGrow: 1,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 10,
  },
  sheetScreen: {
    flex: 1,
  },
  sheetHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  headerCloseButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerCloseButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionPillText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  optionPillSelectedText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  twoColumnFields: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
    gap: 8,
  },
  switchCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  switchText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  sheetFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    borderWidth: 1,
    borderRadius: 16,
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimaryButton: {
    borderWidth: 1,
  },
  footerButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  footerPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
