import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type { MobileBusiness, MobileReferralsSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { buildReferralInviteUrl } from '@/lib/referral-links';

type MobileReferralsScreenProps = {
  business: MobileBusiness;
  data: MobileReferralsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onOpenFunds: () => void;
  onRefresh: () => Promise<void>;
  onShare: () => Promise<void>;
};

export function MobileReferralsScreen({
  business,
  data,
  error,
  isLoading,
  isRefreshing,
  onOpenFunds,
  onRefresh,
  onShare,
}: MobileReferralsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const hasLiveInvite = Boolean(data?.payoutReady && data?.referralCode);
  const referralUrl = data?.referralCode ? buildReferralInviteUrl(data.referralCode) : null;

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Referrals</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Grow through word of mouth</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Share one business invite, track every signup, and keep an eye on recurring earnings.
        </Text>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t refresh referrals</Text>
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
            Loading referral activity...
          </Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Invite businesses</Text>

            {hasLiveInvite ? (
              <>
                <View
                  style={[
                    styles.linkCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.codeLabel, { color: theme.mutedText }]}>Referral link</Text>
                  <Text selectable style={[styles.linkValue, { color: theme.text }]}>
                    {referralUrl}
                  </Text>
                  <Text style={[styles.codeHelper, { color: theme.mutedText }]}>
                    Share the link first. If someone opens signup without the invite attached, they
                    can use the fallback code below.
                  </Text>
                </View>
                <View
                  style={[
                    styles.codeCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.codeLabel, { color: theme.mutedText }]}>Fallback code</Text>
                  <Text selectable style={[styles.codeValue, { color: theme.text }]}>
                    {data?.referralCode}
                  </Text>
                  <Text style={[styles.codeHelper, { color: theme.mutedText }]}>
                    {business.name} can still share this manually if the invite link is copied into
                    a note, card, or message without the full URL.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onShare()}
                  style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                  testID="mobile-referrals-share">
                  <Text style={styles.primaryButtonText}>Share invite</Text>
                </Pressable>
              </>
            ) : (
              <View
                style={[
                  styles.noticeCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>
                  Finish payouts before sharing
                </Text>
                <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                  {data?.payoutSetupMessage ??
                    'Referral sharing unlocks after payout setup is fully ready.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onOpenFunds}
                  style={[styles.inlineButton, { backgroundColor: theme.accent }]}
                  testID="mobile-referrals-open-funds">
                  <Text style={styles.primaryButtonText}>Go to funds</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(data?.totalCredits ?? 0)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>Earned</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.statValue, { color: theme.text }]}>{data?.activeCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>Active</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.statValue, { color: theme.text }]}>{data?.pendingCount ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>In setup</Text>
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Referral activity</Text>
            {data?.referrals.length ? (
              data.referrals.map((referral) => (
                <View
                  key={referral.id}
                  style={[styles.activityRow, { borderColor: theme.border }]}>
                  <View style={styles.activityCopy}>
                    <Text style={[styles.activityName, { color: theme.text }]}>
                      {referral.refereeName}
                    </Text>
                    <Text style={[styles.activityMeta, { color: theme.mutedText }]}>
                      {referral.startedAtLabel}
                    </Text>
                  </View>
                  <View style={styles.activityStatus}>
                    <Text style={[styles.activityStatusLabel, { color: theme.accent }]}>
                      {referral.statusLabel}
                    </Text>
                    <Text style={[styles.activityAmount, { color: theme.text }]}>
                      {referral.creditAmountLabel}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyState, { color: theme.mutedText }]}>
                No referred businesses have started yet.
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
  linkCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  codeCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  codeLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  linkValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  codeValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  codeHelper: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 16,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  activityRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
  },
  activityCopy: {
    flex: 1,
    gap: 4,
  },
  activityName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  activityMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  activityStatus: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityStatusLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  activityAmount: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
  },
});
