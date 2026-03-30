import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  MobileDashboardSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileDashboardScreenProps = {
  error: string | null;
  isRefreshing: boolean;
  summary: MobileDashboardSummary;
  onOpenWorkspace: () => void;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function MobileDashboardScreen({
  error,
  isRefreshing,
  summary,
  onOpenWorkspace,
  onRefresh,
  onSignOut,
}: MobileDashboardScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      style={{ backgroundColor: theme.background }}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>Native Dashboard</Text>
          <Text style={[styles.title, { color: theme.text }]}>{summary.business.name}</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Real mobile data now, with the remaining workspace still one tap away while we
            replace more screens.
          </Text>
        </View>
      </View>

      {!summary.business.onboardingComplete ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Finish business setup</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            Your profile is missing a few business details. You can finish setup from the full
            workspace.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t refresh yet</Text>
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
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming today</Text>
        {summary.upcomingAppointments.length > 0 ? (
          summary.upcomingAppointments.map((appointment) => (
            <View
              key={appointment.id}
              style={[
                styles.appointmentRow,
                { borderColor: theme.border },
              ]}>
              <View style={styles.appointmentCopy}>
                <Text style={[styles.appointmentName, { color: theme.text }]}>
                  {appointment.customerName}
                </Text>
                <Text style={[styles.appointmentMeta, { color: theme.mutedText }]}>
                  {appointment.serviceName} · {appointment.startTimeLabel}
                </Text>
              </View>
              <Text style={[styles.statusPill, { color: theme.accent }]}>
                {appointment.status}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyState, { color: theme.mutedText }]}>
            No appointments are scheduled for today yet.
          </Text>
        )}
      </View>

      <View style={styles.actionStack}>
        <Pressable
          onPress={() => void onRefresh()}
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, opacity: isRefreshing ? 0.75 : 1 },
          ]}
          testID="mobile-dashboard-refresh">
          <Text style={styles.primaryButtonText}>
            {isRefreshing ? 'Refreshing…' : 'Refresh dashboard'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenWorkspace}
          style={[
            styles.secondaryButton,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
          testID="mobile-dashboard-open-workspace">
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
            Open full workspace
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void onSignOut()}
          style={[
            styles.tertiaryButton,
            { borderColor: theme.border },
          ]}
          testID="mobile-dashboard-signout">
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
    gap: 18,
  },
  header: {
    gap: 10,
  },
  headerCopy: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  subtitle: {
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
    lineHeight: 22,
    fontWeight: '700',
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    width: '47.5%',
    minHeight: 126,
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
    fontSize: 32,
    lineHeight: 38,
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
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  appointmentRow: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  actionStack: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButton: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
