import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { MobileHomeSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileHomeScreenProps = {
  error: string | null;
  isRefreshing: boolean;
  summary: MobileHomeSummary;
  onOpenDeals: () => void;
  onOpenCheckIns: () => void;
  onOpenCustomers: () => void;
  onOpenFunds: () => void;
  onOpenReferrals: () => void;
  onOpenAppointments: () => void;
  onOpenBilling: () => void;
  onRefresh: () => Promise<void>;
};

export function MobileHomeScreen({
  error,
  isRefreshing,
  summary,
  onOpenDeals,
  onOpenCheckIns,
  onOpenCustomers,
  onOpenFunds,
  onOpenReferrals,
  onOpenAppointments,
  onOpenBilling,
  onRefresh,
}: MobileHomeScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const isReferralOnly = summary.business.businessType === 'Referral Partner';

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
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>Business hub</Text>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{summary.business.name}</Text>
          <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
            {isReferralOnly
              ? 'Track referral performance and payout readiness in a cleaner mobile flow.'
              : 'Keep referrals, payout status, and today’s appointments in one mobile-first view.'}
          </Text>
        </View>

        {summary.trialDaysRemaining !== null ? (
          <View
            style={[
              styles.inlinePill,
              { backgroundColor: theme.accentSoft, borderColor: theme.border },
            ]}>
            <Text style={[styles.inlinePillText, { color: theme.accent }]}>
              {summary.trialDaysRemaining} days left in trial
            </Text>
          </View>
        ) : null}
      </View>

      {summary.subscription.requiresPurchase ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Start your App Store trial</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            Finish subscription setup in Billing to unlock appointments, customers, deals, and the rest of your business tools.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenBilling}
            style={[styles.inlineButton, { backgroundColor: theme.accent }]}
            testID="mobile-home-open-billing">
            <Text style={styles.inlineButtonText}>Open billing</Text>
          </Pressable>
        </View>
      ) : null}

      {!summary.business.onboardingComplete ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Finish your business profile</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            Add the missing business details so payments, referrals, and your live profile stay ready.
          </Text>
        </View>
      ) : null}

      {!summary.referralSnapshot.payoutReady ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Referral sharing is still locked</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            {summary.referralSnapshot.setupMessage ??
              'Payout setup needs a little more attention before you can share your invite.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenFunds}
            style={[styles.inlineButton, { backgroundColor: theme.accent }]}
            testID="mobile-home-open-funds">
            <Text style={styles.inlineButtonText}>Review funds</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t refresh home</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.metricsGrid}>
        {summary.metrics.map((metric) => (
          <View
            key={metric.label}
            style={[
              styles.metricCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.metricLabel, { color: theme.mutedText }]}>{metric.label}</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{metric.value}</Text>
            <Text style={[styles.metricHelper, { color: theme.mutedText }]}>{metric.helper}</Text>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Run the day</Text>
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              Open the same business tools you already use on the mobile dashboard.
            </Text>
          </View>
        </View>

        <View style={styles.quickActionGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenAppointments}
            style={[
              styles.quickActionCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-home-open-appointments">
            <Text style={[styles.quickActionTitle, { color: theme.text }]}>Appointments</Text>
            <Text style={[styles.quickActionText, { color: theme.mutedText }]}>
              Review today&apos;s bookings
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onOpenCheckIns}
            style={[
              styles.quickActionCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-home-open-checkins">
            <Text style={[styles.quickActionTitle, { color: theme.text }]}>Check-ins</Text>
            <Text style={[styles.quickActionText, { color: theme.mutedText }]}>
              Log guest arrivals fast
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onOpenCustomers}
            style={[
              styles.quickActionCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-home-open-customers">
            <Text style={[styles.quickActionTitle, { color: theme.text }]}>Customers</Text>
            <Text style={[styles.quickActionText, { color: theme.mutedText }]}>
              Search and review records
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onOpenDeals}
            style={[
              styles.quickActionCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-home-open-deals">
            <Text style={[styles.quickActionTitle, { color: theme.text }]}>Deals</Text>
            <Text style={[styles.quickActionText, { color: theme.mutedText }]}>
              Watch live offers and share links
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Referrals</Text>
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              {summary.referralSnapshot.payoutReady
                ? 'Your invite is live and ready to share.'
                : 'Payouts need to be ready before invite sharing unlocks.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenReferrals}
            style={[
              styles.ghostButton,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-home-open-referrals">
            <Text style={[styles.ghostButtonText, { color: theme.text }]}>Open</Text>
          </Pressable>
        </View>

        <View style={styles.snapshotRow}>
          <View style={styles.snapshotMetric}>
            <Text style={[styles.snapshotValue, { color: theme.text }]}>
              {summary.referralSnapshot.activeCount}
            </Text>
            <Text style={[styles.snapshotLabel, { color: theme.mutedText }]}>Active</Text>
          </View>
          <View style={styles.snapshotMetric}>
            <Text style={[styles.snapshotValue, { color: theme.text }]}>
              {summary.referralSnapshot.pendingCount}
            </Text>
            <Text style={[styles.snapshotLabel, { color: theme.mutedText }]}>In setup</Text>
          </View>
          <View style={styles.snapshotMetric}>
            <Text style={[styles.snapshotValue, { color: theme.text }]}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(summary.referralSnapshot.lifetimeCredits)}
            </Text>
            <Text style={[styles.snapshotLabel, { color: theme.mutedText }]}>Earned</Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Today</Text>
        {summary.todayAppointments.length > 0 ? (
          summary.todayAppointments.map((appointment) => (
            <View
              key={appointment.id}
              style={[styles.appointmentRow, { borderColor: theme.border }]}>
              <View style={styles.appointmentCopy}>
                <Text style={[styles.appointmentName, { color: theme.text }]}>
                  {appointment.customerName}
                </Text>
                <Text style={[styles.appointmentMeta, { color: theme.mutedText }]}>
                  {appointment.serviceName} at {appointment.startTimeLabel}
                </Text>
              </View>
              <Text style={[styles.statusPill, { color: theme.accent }]}>
                {appointment.status}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyState, { color: theme.mutedText }]}>
            No appointments are on the board yet today.
          </Text>
        )}
      </View>
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
    gap: 14,
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  inlinePill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inlinePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  inlineButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  inlineButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47.8%',
    minHeight: 122,
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
    lineHeight: 34,
    fontWeight: '800',
  },
  metricHelper: {
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
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ghostButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ghostButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 12,
  },
  snapshotMetric: {
    flex: 1,
    gap: 4,
  },
  quickActionGrid: {
    gap: 10,
  },
  quickActionCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  quickActionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  quickActionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  snapshotValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  snapshotLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  appointmentRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
  },
  appointmentCopy: {
    flex: 1,
    gap: 4,
  },
  appointmentName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  appointmentMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusPill: {
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
