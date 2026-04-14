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
import type { MobileCustomerViewSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileCustomerViewScreenProps = {
  data: MobileCustomerViewSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onOpenUrl: (url: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onShareLink: (label: string, url: string) => Promise<void>;
};

export function MobileCustomerViewScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onOpenUrl,
  onRefresh,
  onShareLink,
}: MobileCustomerViewScreenProps) {
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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Customer view</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Public links and previews</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Share the same customer-facing pages your business uses without jumping back to the web dashboard.
        </Text>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load customer view</Text>
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
            Loading customer links...
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.stack}>
            <LinkCard
              description="Send customers here to book appointments directly."
              label="Booking page"
              testIDPrefix="mobile-customer-view-booking"
              theme={theme}
              url={data.bookingUrl}
              onOpenUrl={onOpenUrl}
              onShareLink={onShareLink}
            />

            <LinkCard
              description="Preview your public business profile, services, hours, and contact details."
              label="Business profile"
              testIDPrefix="mobile-customer-view-profile"
              theme={theme}
              url={data.profileUrl}
              onOpenUrl={onOpenUrl}
              onShareLink={onShareLink}
            />

            <LinkCard
              description="See the discovery page where active Clientific deals appear."
              label="Deals discovery"
              testIDPrefix="mobile-customer-view-explore"
              theme={theme}
              url={data.exploreUrl}
              onOpenUrl={onOpenUrl}
              onShareLink={onShareLink}
            />
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Active deal pages</Text>
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              {data.deals.length
                ? `${data.deals.length} deal page${data.deals.length === 1 ? '' : 's'} ready to share`
                : 'No active deals are live right now.'}
            </Text>

            {data.deals.length ? (
              data.deals.map((deal) => (
                <View
                  key={deal.id}
                  style={[
                    styles.dealCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <View style={styles.dealCopy}>
                    <Text style={[styles.dealTitle, { color: theme.text }]}>{deal.title}</Text>
                    <Text style={[styles.dealMeta, { color: theme.mutedText }]}>
                      {deal.discountLabel}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onShareLink(deal.title, deal.url)}
                      style={[
                        styles.secondaryButton,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      testID={`mobile-customer-view-share-deal-${deal.id}`}>
                      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                        Share
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void onOpenUrl(deal.url)}
                      style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                      testID={`mobile-customer-view-open-deal-${deal.id}`}>
                      <Text style={styles.primaryButtonText}>Open</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                Launch a deal in the app to see its customer-facing page here.
              </Text>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function LinkCard({
  description,
  label,
  onOpenUrl,
  onShareLink,
  testIDPrefix,
  theme,
  url,
}: {
  description: string;
  label: string;
  onOpenUrl: (url: string) => Promise<void>;
  onShareLink: (label: string, url: string) => Promise<void>;
  testIDPrefix: string;
  theme: ReturnType<typeof getClientificTheme>;
  url: string | null;
}) {
  return (
    <View
      style={[
        styles.linkCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <Text style={[styles.linkTitle, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.linkDescription, { color: theme.mutedText }]}>{description}</Text>
      <View
        style={[
          styles.urlCard,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}>
        <Text numberOfLines={2} style={[styles.urlText, { color: theme.text }]}>
          {url ?? 'Not available yet'}
        </Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!url}
          onPress={() => {
            if (url) {
              void onShareLink(label, url);
            }
          }}
          style={[
            styles.secondaryButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: url ? 1 : 0.55,
            },
          ]}
          testID={`${testIDPrefix}-share`}>
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Share</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!url}
          onPress={() => {
            if (url) {
              void onOpenUrl(url);
            }
          }}
          style={[
            styles.primaryButton,
            { backgroundColor: url ? theme.accent : theme.surfaceMuted, opacity: url ? 1 : 0.6 },
          ]}
          testID={`${testIDPrefix}-open`}>
          <Text style={styles.primaryButtonText}>Open</Text>
        </Pressable>
      </View>
    </View>
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
  stack: {
    gap: 16,
  },
  linkCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  linkTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  linkDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  urlCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  urlText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dealCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  dealCopy: {
    gap: 4,
  },
  dealTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  dealMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
