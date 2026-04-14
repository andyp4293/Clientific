import React, { useEffect, useRef, useState } from 'react';
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
import type { MobileReviewsSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileReviewsScreenProps = {
  data: MobileReviewsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onOpenUrl: (url: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onShareSurvey: () => Promise<void>;
};

export function MobileReviewsScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onOpenUrl,
  onRefresh,
  onShareSurvey,
}: MobileReviewsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [copiedSurveyLink, setCopiedSurveyLink] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Reviews</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Survey and review routing</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Share the same survey link you use on the web dashboard and keep public review traffic pointed the right way.
        </Text>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>
            Couldn&apos;t load review tools
          </Text>
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
            Loading review tools...
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Survey link</Text>
                <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                  {data.storeId
                    ? `Store ID ${data.storeId}`
                    : 'Set up your public business link to enable survey sharing.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!data.surveyUrl}
                onPress={() => void onShareSurvey()}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: data.surveyUrl ? theme.accent : theme.surfaceMuted,
                    opacity: data.surveyUrl ? 1 : 0.72,
                  },
                ]}
                testID="mobile-reviews-share-survey">
                <Text style={styles.primaryButtonText}>Share</Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.linkCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}>
              <Text style={[styles.linkLabel, { color: theme.mutedText }]}>Survey URL</Text>
              <Text style={[styles.linkValue, { color: theme.text }]}>
                {data.surveyUrl ?? 'No survey link available yet'}
              </Text>
              {data.surveyUrl ? (
                <View style={styles.linkActionRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void Clipboard.setStringAsync(data.surveyUrl!);
                      setCopiedSurveyLink(true);
                      if (copyTimeoutRef.current) {
                        clearTimeout(copyTimeoutRef.current);
                      }
                      copyTimeoutRef.current = setTimeout(() => setCopiedSurveyLink(false), 1600);
                    }}
                    style={[
                      styles.secondaryButton,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                    testID="mobile-reviews-copy-survey">
                    <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                      {copiedSurveyLink ? 'Copied' : 'Copy link'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void onOpenUrl(data.surveyUrl!)}
                    style={[
                      styles.secondaryButton,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                    testID="mobile-reviews-open-survey">
                    <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                      Open survey
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Public review links</Text>
            {data.publicReviewDestinations.length ? (
              data.publicReviewDestinations.map((destination) => (
                <Pressable
                  key={destination.label}
                  accessibilityRole="button"
                  onPress={() => void onOpenUrl(destination.url)}
                  style={[
                    styles.destinationCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                  testID={`mobile-reviews-open-${destination.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <View style={styles.destinationCopy}>
                    <Text style={[styles.destinationTitle, { color: theme.text }]}>
                      {destination.label}
                    </Text>
                    <Text style={[styles.destinationUrl, { color: theme.mutedText }]}>
                      {destination.url}
                    </Text>
                  </View>
                  <Text style={[styles.destinationAction, { color: theme.accent }]}>Open</Text>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                Add Google or Yelp destinations in the business settings to route five-star feedback outward.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent review requests</Text>
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              {data.recentRequestsCount} recent SMS review prompts
            </Text>
            {data.recentRequests.length ? (
              data.recentRequests.map((requestItem) => (
                <View
                  key={requestItem.id}
                  style={[styles.requestRow, { borderColor: theme.border }]}>
                  <View style={styles.requestCopy}>
                    <Text style={[styles.requestTitle, { color: theme.text }]}>
                      {requestItem.recipientLabel}
                    </Text>
                    <Text style={[styles.requestMeta, { color: theme.mutedText }]}>
                      {requestItem.createdAtLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: theme.accentSoft, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.statusBadgeText, { color: theme.accent }]}>
                      {requestItem.statusLabel}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                No review requests have gone out yet.
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
  sectionCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
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
  linkCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  linkActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  linkLabel: {
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
  primaryButton: {
    minWidth: 92,
    minHeight: 44,
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
    minHeight: 44,
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
  destinationCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  destinationCopy: {
    flex: 1,
    gap: 3,
  },
  destinationTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  destinationUrl: {
    fontSize: 13,
    lineHeight: 18,
  },
  destinationAction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  requestRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestCopy: {
    flex: 1,
    gap: 3,
  },
  requestTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  requestMeta: {
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
});
