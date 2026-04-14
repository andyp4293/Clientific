import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  MobileBusinessHoursSummary,
  MobileBusinessHoursUpdateInput,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileBusinessHoursScreenProps = {
  data: MobileBusinessHoursSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => Promise<void>;
  onSave: (input: MobileBusinessHoursUpdateInput) => Promise<void>;
};

type BusinessHoursTab = 'hours' | 'closures';

type EditableHour = {
  dayOfWeek: number;
  label: string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

type EditableClosure = {
  date: string;
  label: string;
  formattedDate?: string;
};

export function MobileBusinessHoursScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  isSaving,
  onRefresh,
  onSave,
}: MobileBusinessHoursScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [activeTab, setActiveTab] = useState<BusinessHoursTab>('hours');
  const [localHours, setLocalHours] = useState<EditableHour[]>([]);
  const [localClosures, setLocalClosures] = useState<EditableClosure[]>([]);
  const [newClosureDate, setNewClosureDate] = useState('');
  const [newClosureLabel, setNewClosureLabel] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');

  useEffect(() => {
    if (!data) {
      return;
    }

    const nextHours = data.hours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      label: hour.label,
      isOpen: hour.isOpen,
      openTime: hour.openTime,
      closeTime: hour.closeTime,
    }));
    const nextClosures = data.closures.map((closure) => ({
      date: closure.date,
      label: closure.label ?? '',
      formattedDate: closure.formattedDate,
    }));
    const nextBaseline = JSON.stringify({ hours: nextHours, closures: nextClosures });

    setLocalHours(nextHours);
    setLocalClosures(nextClosures);
    setBaseline(nextBaseline);
  }, [data]);

  const hasChanges = useMemo(
    () =>
      baseline !==
      JSON.stringify({
        hours: localHours,
        closures: localClosures,
      }),
    [baseline, localClosures, localHours],
  );

  async function handleSave() {
    setSaveError(null);

    try {
      await onSave({
        hours: localHours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          isOpen: hour.isOpen,
          openTime: hour.isOpen ? hour.openTime : null,
          closeTime: hour.isOpen ? hour.closeTime : null,
        })),
        closures: localClosures.map((closure) => ({
          date: closure.date,
          label: closure.label.trim() || null,
        })),
      });
    } catch (issue) {
      setSaveError(issue instanceof Error ? issue.message : 'Unable to save business hours.');
    }
  }

  function handleReset() {
    if (!data) {
      return;
    }

    setLocalHours(
      data.hours.map((hour) => ({
        dayOfWeek: hour.dayOfWeek,
        label: hour.label,
        isOpen: hour.isOpen,
        openTime: hour.openTime,
        closeTime: hour.closeTime,
      })),
    );
    setLocalClosures(
      data.closures.map((closure) => ({
        date: closure.date,
        label: closure.label ?? '',
        formattedDate: closure.formattedDate,
      })),
    );
    setNewClosureDate('');
    setNewClosureLabel('');
    setSaveError(null);
  }

  function handleAddClosure() {
    const trimmedDate = newClosureDate.trim();
    if (!trimmedDate) {
      setSaveError('Add a date in YYYY-MM-DD format.');
      return;
    }

    if (localClosures.some((closure) => closure.date === trimmedDate)) {
      setSaveError('That closure date is already listed.');
      return;
    }

    setLocalClosures((current) =>
      [...current, { date: trimmedDate, label: newClosureLabel.trim() }]
        .sort((left, right) => left.date.localeCompare(right.date)),
    );
    setNewClosureDate('');
    setNewClosureLabel('');
    setSaveError(null);
  }

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Business hours</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Hours and closures</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Keep booking availability up to date in the same mobile flow your team actually uses.
        </Text>
      </View>

      {error || saveError ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Update needed</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            {saveError ?? error}
          </Text>
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
            Loading business hours...
          </Text>
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Timezone</Text>
              <Text style={[styles.metricValue, { color: theme.text }]} numberOfLines={2}>
                {data.timezoneLabel}
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Open days</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data.openDayCount}</Text>
            </View>
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={[styles.segmentedControl, { backgroundColor: theme.surfaceMuted }]}>
              {(['hours', 'closures'] as BusinessHoursTab[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    accessibilityRole="button"
                    onPress={() => setActiveTab(tab)}
                    style={[
                      styles.segmentButton,
                      {
                        backgroundColor: isActive ? theme.accent : 'transparent',
                        borderColor: isActive ? theme.accent : 'transparent',
                      },
                    ]}
                    testID={`mobile-business-hours-tab-${tab}`}>
                    <Text
                      style={[
                        styles.segmentButtonText,
                        { color: isActive ? '#f8fffc' : theme.text },
                      ]}>
                      {tab === 'hours' ? 'Weekly hours' : 'Closures'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'hours' ? (
              <View style={styles.stack}>
                {localHours.map((hour) => (
                  <View
                    key={hour.dayOfWeek}
                    style={[
                      styles.rowCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <View style={styles.rowHeader}>
                      <View style={styles.rowCopy}>
                        <Text style={[styles.rowTitle, { color: theme.text }]}>{hour.label}</Text>
                        <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}>
                          {hour.isOpen
                            ? `${hour.openTime ?? '--:--'} - ${hour.closeTime ?? '--:--'}`
                            : 'Closed'}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setLocalHours((current) =>
                            current.map((entry) =>
                              entry.dayOfWeek === hour.dayOfWeek
                                ? {
                                    ...entry,
                                    isOpen: !entry.isOpen,
                                    openTime: !entry.isOpen ? entry.openTime ?? '09:00' : entry.openTime,
                                    closeTime:
                                      !entry.isOpen ? entry.closeTime ?? '17:00' : entry.closeTime,
                                  }
                                : entry,
                            ),
                          )
                        }
                        style={[
                          styles.toggleButton,
                          {
                            backgroundColor: hour.isOpen ? theme.accentSoft : theme.surface,
                            borderColor: theme.border,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.toggleButtonText,
                            { color: hour.isOpen ? theme.accent : theme.mutedText },
                          ]}>
                          {hour.isOpen ? 'Open' : 'Closed'}
                        </Text>
                      </Pressable>
                    </View>

                    {hour.isOpen ? (
                      <View style={styles.timeRow}>
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={(value) =>
                            setLocalHours((current) =>
                              current.map((entry) =>
                                entry.dayOfWeek === hour.dayOfWeek
                                  ? { ...entry, openTime: value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="09:00"
                          placeholderTextColor={theme.mutedText}
                          style={[
                            styles.timeInput,
                            {
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                              color: theme.text,
                            },
                          ]}
                          testID={`mobile-business-hours-open-${hour.dayOfWeek}`}
                          value={hour.openTime ?? ''}
                        />
                        <Text style={[styles.timeSeparator, { color: theme.mutedText }]}>to</Text>
                        <TextInput
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={(value) =>
                            setLocalHours((current) =>
                              current.map((entry) =>
                                entry.dayOfWeek === hour.dayOfWeek
                                  ? { ...entry, closeTime: value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="17:00"
                          placeholderTextColor={theme.mutedText}
                          style={[
                            styles.timeInput,
                            {
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                              color: theme.text,
                            },
                          ]}
                          testID={`mobile-business-hours-close-${hour.dayOfWeek}`}
                          value={hour.closeTime ?? ''}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.stack}>
                <View
                  style={[
                    styles.rowCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>Add a closure date</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setNewClosureDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.textInput,
                      { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                    ]}
                    testID="mobile-business-hours-new-closure-date"
                    value={newClosureDate}
                  />
                  <TextInput
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={setNewClosureLabel}
                    placeholder="Label (optional)"
                    placeholderTextColor={theme.mutedText}
                    style={[
                      styles.textInput,
                      { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                    ]}
                    testID="mobile-business-hours-new-closure-label"
                    value={newClosureLabel}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleAddClosure}
                    style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                    testID="mobile-business-hours-add-closure">
                    <Text style={styles.primaryButtonText}>Add closure</Text>
                  </Pressable>
                </View>

                {localClosures.length ? (
                  localClosures.map((closure) => (
                    <View
                      key={closure.date}
                      style={[
                        styles.rowCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <View style={styles.rowHeader}>
                        <View style={styles.rowCopy}>
                          <Text style={[styles.rowTitle, { color: theme.text }]}>
                            {closure.formattedDate ?? closure.date}
                          </Text>
                          <Text style={[styles.rowSubtitle, { color: theme.mutedText }]}>
                            {closure.label.trim() || 'Closed all day'}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            setLocalClosures((current) =>
                              current.filter((entry) => entry.date !== closure.date),
                            )
                          }
                          style={[
                            styles.removeButton,
                            { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}
                          testID={`mobile-business-hours-remove-${closure.date}`}>
                          <Text style={[styles.removeButtonText, { color: theme.danger }]}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      styles.noticeCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.noticeTitle, { color: theme.text }]}>No closures yet</Text>
                    <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                      Add holidays and one-off closures so customers can&apos;t book those dates.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {hasChanges ? (
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={handleReset}
                style={[
                  styles.secondaryButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                testID="mobile-business-hours-reset">
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Reset</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void handleSave()}
                style={[styles.primaryButton, { backgroundColor: theme.accent, flex: 1 }]}
                testID="mobile-business-hours-save">
                <Text style={styles.primaryButtonText}>
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Text>
              </Pressable>
            </View>
          ) : null}
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
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 112,
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
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  stack: {
    gap: 12,
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  rowSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  toggleButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
    lineHeight: 18,
  },
  timeSeparator: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  removeButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
