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
import type {
  MobileAnalyticsRange,
  MobileAnalyticsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileAnalyticsScreenProps = {
  data: MobileAnalyticsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onChangeRange: (range: MobileAnalyticsRange) => void;
  onRefresh: () => Promise<void>;
};

const RANGE_OPTIONS: Array<{ label: string; value: MobileAnalyticsRange }> = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

export function MobileAnalyticsScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onChangeRange,
  onRefresh,
}: MobileAnalyticsScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const maxRevenue = Math.max(...(data?.revenueByWeek.map((week) => week.revenue) ?? [1]));
  const maxServiceShare = Math.max(...(data?.topServices.map((service) => service.share) ?? [1]));

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Analytics</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Performance snapshots</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Stay on top of revenue, appointments, and customer mix without opening desktop charts.
        </Text>

        <View style={[styles.segmentedControl, { backgroundColor: theme.surfaceMuted }]}>
          {RANGE_OPTIONS.map((option) => {
            const isActive = data?.range === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => onChangeRange(option.value)}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor: isActive ? theme.accent : 'transparent',
                    borderColor: isActive ? theme.accent : 'transparent',
                  },
                ]}
                testID={`mobile-analytics-range-${option.value}`}>
                <Text
                  style={[
                    styles.segmentButtonText,
                    { color: isActive ? '#f8fffc' : theme.text },
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load analytics</Text>
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
            Loading analytics...
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.metricsGrid}>
            <MetricCard
              helper="Revenue"
              label={data.stats.totalRevenueLabel}
              theme={theme}
              title="Total"
            />
            <MetricCard
              helper="Booked"
              label={String(data.stats.totalAppointments)}
              theme={theme}
              title="Appointments"
            />
            <MetricCard
              helper="New"
              label={String(data.stats.newCustomers)}
              theme={theme}
              title="Customers"
            />
            <MetricCard
              helper="Avg per visit"
              label={data.stats.avgRevenuePerVisitLabel}
              theme={theme}
              title="Average"
            />
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Revenue by week</Text>
            {data.revenueByWeek.length ? (
              <View style={styles.chartStack}>
                {data.revenueByWeek.map((week) => (
                  <View key={week.label} style={styles.chartRow}>
                    <Text style={[styles.chartLabel, { color: theme.mutedText }]}>
                      {week.label}
                    </Text>
                    <View
                      style={[
                        styles.chartTrack,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <View
                        style={[
                          styles.chartFill,
                          {
                            backgroundColor: theme.accent,
                            width: `${Math.max(8, (week.revenue / maxRevenue) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartValue, { color: theme.text }]}>
                      {week.revenueLabel}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                No revenue data is available for this range yet.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Appointments by status</Text>
            {data.appointmentsByStatus.length ? (
              <View style={styles.tagRow}>
                {data.appointmentsByStatus.map((statusItem) => (
                  <View
                    key={statusItem.status}
                    style={[
                      styles.tagPill,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.tagTitle, { color: theme.text }]}>
                      {statusItem.label}
                    </Text>
                    <Text style={[styles.tagCount, { color: theme.accent }]}>
                      {statusItem.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                No appointments have landed in this range yet.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top services</Text>
            {data.topServices.length ? (
              <View style={styles.chartStack}>
                {data.topServices.map((service) => (
                  <View key={service.name} style={styles.serviceRow}>
                    <Text style={[styles.serviceLabel, { color: theme.text }]} numberOfLines={1}>
                      {service.name}
                    </Text>
                    <View
                      style={[
                        styles.serviceTrack,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <View
                        style={[
                          styles.serviceFill,
                          {
                            backgroundColor: theme.accent,
                            width: `${Math.max(8, (service.share / maxServiceShare) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.serviceCount, { color: theme.text }]}>{service.count}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                No service trends are available for this range yet.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Customer segments</Text>
            {data.customerSegments.length ? (
              <View style={styles.tagRow}>
                {data.customerSegments.map((segment) => (
                  <View
                    key={segment.segment}
                    style={[
                      styles.tagPill,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.tagTitle, { color: theme.text }]}>{segment.label}</Text>
                    <Text style={[styles.tagCount, { color: theme.accent }]}>{segment.count}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                No customer segment data is available yet.
              </Text>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function MetricCard({
  helper,
  label,
  theme,
  title,
}: {
  helper: string;
  label: string;
  theme: ReturnType<typeof getClientificTheme>;
  title: string;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <Text style={[styles.metricTitle, { color: theme.mutedText }]}>{title}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.metricHelper, { color: theme.mutedText }]}>{helper}</Text>
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
    gap: 10,
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
  segmentedControl: {
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
    fontSize: 12,
    lineHeight: 16,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47.6%',
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  metricTitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  metricHelper: {
    fontSize: 13,
    lineHeight: 18,
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
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chartStack: {
    gap: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chartLabel: {
    width: 62,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  chartTrack: {
    flex: 1,
    minHeight: 14,
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    borderRadius: 999,
  },
  chartValue: {
    width: 72,
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagPill: {
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  tagTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  tagCount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceLabel: {
    width: 110,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  serviceTrack: {
    flex: 1,
    minHeight: 12,
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  serviceFill: {
    height: '100%',
    borderRadius: 999,
  },
  serviceCount: {
    width: 26,
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
