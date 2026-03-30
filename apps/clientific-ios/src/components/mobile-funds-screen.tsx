import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type { MobileBusiness, MobileFundsSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileFundsScreenProps = {
  business: MobileBusiness;
  data: MobileFundsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
};

export function MobileFundsScreen({
  business,
  data,
  error,
  isLoading,
  isRefreshing,
  onRefresh,
}: MobileFundsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const isReferralOnly = business.businessType === 'Referral Partner';

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Funds</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>
          {data?.payoutReady ? 'Payouts are live' : 'Payout setup still needs attention'}
        </Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          {data?.setupMessage ??
            (isReferralOnly
              ? 'Referral earnings move here once Stripe finishes reviewing your payout setup.'
              : 'Deal and referral earnings move here once Stripe finishes reviewing your payout setup.')}
        </Text>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t refresh funds</Text>
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
            Loading payout balances...
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Available now</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.availableBalanceLabel ?? '$0.00'}
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>On the way</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.pendingBalanceLabel ?? '$0.00'}
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Referral pending</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.referralPendingTransferLabel ?? '$0.00'}
              </Text>
            </View>
            {!isReferralOnly ? (
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}>
                <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Deals pending</Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {data?.dealPendingTransferLabel ?? '$0.00'}
                </Text>
              </View>
            ) : null}
          </View>

          {!data?.payoutReady && data?.requirementTasks.length ? (
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>What&apos;s still open</Text>
              {data.requirementTasks.map((task) => (
                <Text key={task} style={[styles.taskItem, { color: theme.mutedText }]}>
                  - {task}
                </Text>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Payout details</Text>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Bank account</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data?.bankAccountSummary ?? 'No bank account saved yet'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Schedule</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data?.payoutScheduleSummary ?? 'Not configured yet'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Referral moved</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {data?.referralTransferredLabel ?? '$0.00'}
              </Text>
            </View>
            {!isReferralOnly ? (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Deals moved</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {data?.dealTransferredLabel ?? '$0.00'}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent payouts</Text>
            {data?.recentPayouts.length ? (
              data.recentPayouts.map((payout) => (
                <View
                  key={payout.id}
                  style={[styles.payoutRow, { borderColor: theme.border }]}>
                  <View style={styles.payoutCopy}>
                    <Text style={[styles.payoutAmount, { color: theme.text }]}>
                      {payout.amountLabel}
                    </Text>
                    <Text style={[styles.payoutMeta, { color: theme.mutedText }]}>
                      {payout.arrivalDateLabel} · {payout.destinationLabel}
                    </Text>
                  </View>
                  <Text style={[styles.payoutStatus, { color: theme.accent }]}>
                    {payout.statusLabel}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyState, { color: theme.mutedText }]}>
                No payouts have landed yet.
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
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47.8%',
    minHeight: 120,
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
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  sectionCard: {
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
  taskItem: {
    fontSize: 14,
    lineHeight: 20,
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
  payoutRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
  },
  payoutCopy: {
    flex: 1,
    gap: 4,
  },
  payoutAmount: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  payoutMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  payoutStatus: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
  },
});
