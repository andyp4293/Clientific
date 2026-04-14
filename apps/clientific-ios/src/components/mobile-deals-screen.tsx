import React from 'react';
import * as Clipboard from 'expo-clipboard';
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
import {
  getClientificWebUrl,
  type MobileDealRecord,
  type MobileDealsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileDealsScreenProps = {
  data: MobileDealsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onOpenFunds: () => void;
  onOpenUrl: (url: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onShareDeal: (deal: MobileDealRecord) => Promise<void>;
};

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

export function MobileDealsScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onOpenFunds,
  onOpenUrl,
  onRefresh,
  onShareDeal,
}: MobileDealsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Deals</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Mobile deal board</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Keep active offers, purchase-link readiness, and performance in the same flow as the web app.
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
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Total</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data?.counts.total ?? 0}</Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Live</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data?.counts.live ?? 0}</Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Scheduled</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.counts.scheduled ?? 0}
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Ended</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data?.counts.ended ?? 0}</Text>
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Offers</Text>
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
                        <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Redeemed</Text>
                        <Text style={[styles.metaValue, { color: theme.text }]}>{deal.redemptionsCount}</Text>
                      </View>
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
                        onPress={() =>
                          void Clipboard.setStringAsync(`${getClientificWebUrl()}${deal.linkPath}`)
                        }
                        style={[styles.actionButton, { borderColor: theme.border }]}
                        testID={`mobile-deal-copy-${deal.id}`}>
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>Copy link</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void onOpenUrl(`${getClientificWebUrl()}${deal.linkPath}`)}
                        style={[styles.actionButton, { borderColor: theme.border }]}
                        testID={`mobile-deal-open-${deal.id}`}>
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>Open</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={[styles.emptyState, { color: theme.mutedText }]}>
                No deals yet. Create them on the web dashboard and they&apos;ll show up here.
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
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
    letterSpacing: 1.3,
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
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
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
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 15,
    lineHeight: 20,
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
    minWidth: 92,
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
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
