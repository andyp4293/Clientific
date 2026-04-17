import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import type { MobileBillingSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileBillingScreenProps = {
  appStoreOffering: PurchasesOffering | null;
  data: MobileBillingSummary | null;
  error: string | null;
  isLoading: boolean;
  isLoadingOffering: boolean;
  isManagingSubscription: boolean;
  isPurchasingSubscription: boolean;
  isRefreshing: boolean;
  isRestoringSubscription: boolean;
  notice: string | null;
  onManageSubscription: () => Promise<void>;
  onOpenUrl: (url: string) => Promise<void>;
  onPurchasePackage: (aPackage: PurchasesPackage) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRestorePurchases: () => Promise<void>;
  purchaseError: string | null;
};

function getPackageHeadline(aPackage: PurchasesPackage) {
  const title = aPackage.product.title?.trim();
  if (title) {
    return title;
  }

  return aPackage.identifier
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getPackageSupportingCopy(aPackage: PurchasesPackage) {
  const description = aPackage.product.description?.trim();
  if (description) {
    return description;
  }

  return 'Unlock the full Clientific business workspace on iPhone with Apple-managed billing.';
}

export function MobileBillingScreen({
  appStoreOffering,
  data,
  error,
  isLoading,
  isLoadingOffering,
  isManagingSubscription,
  isPurchasingSubscription,
  isRefreshing,
  isRestoringSubscription,
  notice,
  onManageSubscription,
  onOpenUrl,
  onPurchasePackage,
  onRefresh,
  onRestorePurchases,
  purchaseError,
}: MobileBillingScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const isAppStorePurchaseMode = Boolean(data?.canPurchaseInApp);
  const isAppleManagedMode = Boolean(data?.showManageInApp);
  const availablePackages = appStoreOffering?.availablePackages ?? [];

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Billing</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Plan and invoices</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Review your current plan, billing source, and Apple or website billing controls from one place.
        </Text>
      </View>

      {notice ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.accentSoft, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Subscription setup</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>{notice}</Text>
        </View>
      ) : null}

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load billing</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>{error}</Text>
        </View>
      ) : null}

      {purchaseError ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>
            App Store billing needs attention
          </Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>{purchaseError}</Text>
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
            Loading billing...
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View
            style={[
              styles.planCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.planEyebrow, { color: theme.mutedText }]}>Current plan</Text>
            <Text style={[styles.planName, { color: theme.text }]}>{data.currentPlanName}</Text>
            <Text style={[styles.planPrice, { color: theme.text }]}>
              {data.currentPlanPriceLabel}
            </Text>
            <Text style={[styles.planSummary, { color: theme.mutedText }]}>{data.planSummary}</Text>

            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.accentSoft, borderColor: theme.border },
                ]}>
                <Text style={[styles.statusBadgeText, { color: theme.accent }]}>
                  {data.subscriptionStatusLabel}
                </Text>
              </View>
              {data.trialDaysRemaining !== null ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.statusBadgeText, { color: theme.text }]}>
                    {data.trialDaysRemaining} days left
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {isAppStorePurchaseMode ? (
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose your plan</Text>
              <Text style={[styles.detailText, { color: theme.mutedText }]}>
                Start the 14-day App Store trial, then let Apple handle renewals and receipts for the plan you choose.
              </Text>

              {isLoadingOffering ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator color={theme.accent} />
                  <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                    Loading App Store plans...
                  </Text>
                </View>
              ) : availablePackages.length ? (
                <View style={styles.packageList}>
                  {availablePackages.map((aPackage) => (
                    <View
                      key={aPackage.identifier}
                      style={[
                        styles.packageCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <View style={styles.packageHeader}>
                        <View style={styles.packageCopy}>
                          <Text style={[styles.packageTitle, { color: theme.text }]}>
                            {getPackageHeadline(aPackage)}
                          </Text>
                          <Text style={[styles.packagePrice, { color: theme.text }]}>
                            {aPackage.product.priceString}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: theme.accentSoft, borderColor: theme.border },
                          ]}>
                          <Text style={[styles.statusBadgeText, { color: theme.accent }]}>
                            14-day trial
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                        {getPackageSupportingCopy(aPackage)}
                      </Text>

                      <Pressable
                        accessibilityRole="button"
                        disabled={isPurchasingSubscription || isRestoringSubscription}
                        onPress={() => void onPurchasePackage(aPackage)}
                        style={[
                          styles.primaryButton,
                          {
                            backgroundColor:
                              isPurchasingSubscription || isRestoringSubscription
                                ? theme.border
                                : theme.accent,
                          },
                        ]}
                        testID={`mobile-billing-purchase-${aPackage.identifier}`}>
                        <Text style={styles.primaryButtonText}>
                          {isPurchasingSubscription ? 'Starting purchase...' : 'Start App Store trial'}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                  App Store plans are not available yet for this account. Pull to refresh or try again shortly.
                </Text>
              )}

              <View style={styles.inlineActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isRestoringSubscription || isPurchasingSubscription}
                  onPress={() => void onRestorePurchases()}
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      opacity: isRestoringSubscription || isPurchasingSubscription ? 0.7 : 1,
                    },
                  ]}
                  testID="mobile-billing-restore-purchases">
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    {isRestoringSubscription ? 'Restoring...' : 'Restore Purchases'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Billing access</Text>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Billing source</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data.billingProviderLabel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>
                {data.managementTitle}
              </Text>
              <Text style={[styles.detailText, { color: theme.text }]}>
                {data.managementSummary}
              </Text>
            </View>
          </View>

          {isAppleManagedMode ? (
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                App Store subscription
              </Text>
              <Text style={[styles.detailText, { color: theme.mutedText }]}>
                Restore Apple purchases if you are reinstalling, or open Apple’s subscription management view for renewals, cancellations, and plan changes.
              </Text>
              <View style={styles.inlineActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isRestoringSubscription || isManagingSubscription}
                  onPress={() => void onRestorePurchases()}
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      opacity: isRestoringSubscription || isManagingSubscription ? 0.7 : 1,
                    },
                  ]}
                  testID="mobile-billing-restore-existing-purchases">
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    {isRestoringSubscription ? 'Restoring...' : 'Restore Purchases'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isManagingSubscription || isRestoringSubscription}
                  onPress={() => void onManageSubscription()}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor:
                        isManagingSubscription || isRestoringSubscription
                          ? theme.border
                          : theme.accent,
                    },
                  ]}
                  testID="mobile-billing-manage-subscription">
                  <Text style={styles.primaryButtonText}>
                    {isManagingSubscription ? 'Opening...' : 'Manage Subscription'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Billing details</Text>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Payment method</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data.paymentMethodSummary}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Trial ends</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data.trialEndsAtLabel ?? 'No active trial'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Next billing date</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data.nextBillingDateLabel ?? 'No renewal scheduled'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Invoices</Text>
            {data.invoices.length ? (
              data.invoices.map((invoice) => (
                <View
                  key={invoice.id}
                  style={[
                    styles.invoiceCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <View style={styles.invoiceHeader}>
                    <View style={styles.invoiceCopy}>
                      <Text style={[styles.invoiceAmount, { color: theme.text }]}>
                        {invoice.amountLabel}
                      </Text>
                      <Text style={[styles.invoiceMeta, { color: theme.mutedText }]}>
                        {invoice.createdLabel ?? 'No date'} ·{' '}
                        {invoice.description ?? 'Subscription charge'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: theme.accentSoft, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.statusBadgeText, { color: theme.accent }]}>
                        {invoice.statusLabel}
                      </Text>
                    </View>
                  </View>

                  {invoice.hostedInvoiceUrl ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onOpenUrl(invoice.hostedInvoiceUrl!)}
                      style={[
                        styles.secondaryButton,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      testID={`mobile-billing-open-invoice-${invoice.id}`}>
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Open invoice
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                {data.invoiceEmptyState}
              </Text>
            )}
          </View>
        </>
      ) : null}
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
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  planEyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  planName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  planPrice: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  planSummary: {
    fontSize: 14,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  packageList: {
    gap: 12,
  },
  packageCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  packageCopy: {
    flex: 1,
    gap: 4,
  },
  packageTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  packagePrice: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  invoiceCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  invoiceCopy: {
    flex: 1,
    gap: 3,
  },
  invoiceAmount: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  invoiceMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
});
