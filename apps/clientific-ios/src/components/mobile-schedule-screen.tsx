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
import type { MobileAppointmentsSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileScheduleScreenProps = {
  data: MobileAppointmentsSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onJumpToToday: () => void;
  onNextDate: () => void;
  onPreviousDate: () => void;
  onRefresh: () => Promise<void>;
};

function formatDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

export function MobileScheduleScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onJumpToToday,
  onNextDate,
  onPreviousDate,
  onRefresh,
}: MobileScheduleScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const isViewingToday = data?.selectedDate === formatDateKey(new Date());

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Appointments</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>
          {data?.dateLabel ?? 'Daily appointments'}
        </Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Review bookings in the same streamlined mobile flow as the web dashboard.
        </Text>

        <View style={styles.dateRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onPreviousDate}
            style={[styles.dateButton, { borderColor: theme.border }]}
            testID="mobile-schedule-previous">
            <Text style={[styles.dateButtonText, { color: theme.text }]}>Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onJumpToToday}
            style={[
              styles.dateButton,
              isViewingToday
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            testID="mobile-schedule-today"
            accessibilityState={{ selected: isViewingToday }}
          >
            <Text
              style={
                isViewingToday
                  ? styles.dateButtonPrimaryText
                  : [styles.dateButtonText, { color: theme.accent }]
              }>
              Today
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onNextDate}
            style={[styles.dateButton, { borderColor: theme.border }]}
            testID="mobile-schedule-next">
            <Text style={[styles.dateButtonText, { color: theme.text }]}>Next</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load schedule</Text>
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
            Loading appointments...
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
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Pending</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.counts.pending ?? 0}
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Confirmed</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {data?.counts.confirmed ?? 0}
              </Text>
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
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Appointments</Text>
            {data?.appointments.length ? (
              data.appointments.map((appointment) => (
                <View
                  key={appointment.id}
                  style={[styles.appointmentRow, { borderColor: theme.border }]}>
                  <View style={styles.timeBlock}>
                    <Text style={[styles.timeLabel, { color: theme.text }]}>
                      {appointment.startTimeLabel}
                    </Text>
                    <Text style={[styles.timeMeta, { color: theme.mutedText }]}>
                      {appointment.endTimeLabel}
                    </Text>
                  </View>

                  <View style={styles.appointmentCopy}>
                    <Text style={[styles.appointmentName, { color: theme.text }]}>
                      {appointment.customerName}
                    </Text>
                    <Text style={[styles.appointmentMeta, { color: theme.mutedText }]}>
                      {appointment.serviceName}
                      {appointment.staffName ? ` · ${appointment.staffName}` : ''}
                    </Text>
                    <Text style={[styles.appointmentMeta, { color: theme.mutedText }]}>
                      {appointment.sourceLabel}
                      {appointment.notes ? ` · ${appointment.notes}` : ''}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: theme.accentSoft, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.statusLabel, { color: theme.accent }]}>
                      {appointment.statusLabel}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyState, { color: theme.mutedText }]}>
                Nothing is booked for this day yet.
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
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  dateButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  dateButtonPrimaryText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
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
    gap: 10,
    alignItems: 'center',
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
    minHeight: 104,
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
  appointmentRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 10,
  },
  timeBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  timeMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  appointmentCopy: {
    gap: 4,
  },
  appointmentName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  appointmentMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  emptyState: {
    fontSize: 14,
    lineHeight: 20,
  },
});
