import React, { useState } from 'react';
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
import type { MobileServicesSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileServicesScreenProps = {
  data: MobileServicesSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
};

type ServicesTab = 'services' | 'staff';

export function MobileServicesScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  onRefresh,
}: MobileServicesScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [activeTab, setActiveTab] = useState<ServicesTab>('services');

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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Services & staff</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Menus and team coverage</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Review the live service menu, pricing, and the staff setup customers book against.
        </Text>
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load services</Text>
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
            Loading services and staff...
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
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Services</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data.counts.services}</Text>
              <Text style={[styles.metricHelper, { color: theme.mutedText }]}>
                {data.counts.activeServices} active
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Staff</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{data.counts.staff}</Text>
              <Text style={[styles.metricHelper, { color: theme.mutedText }]}>
                {data.counts.activeStaff} active
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.segmentedCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={[styles.segmentedControl, { backgroundColor: theme.surfaceMuted }]}>
              {(['services', 'staff'] as ServicesTab[]).map((tab) => {
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
                    testID={`mobile-services-tab-${tab}`}>
                    <Text
                      style={[
                        styles.segmentButtonText,
                        { color: isActive ? '#f8fffc' : theme.text },
                      ]}>
                      {tab === 'services' ? 'Services' : 'Staff'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'services' ? (
              <>
                <View style={styles.groupRow}>
                  {data.groups.length ? (
                    data.groups.map((group) => (
                      <View
                        key={group.id}
                        style={[
                          styles.groupPill,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        ]}>
                        <Text style={[styles.groupPillText, { color: theme.text }]}>
                          {group.name} · {group.servicesCount}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View
                      style={[
                        styles.groupPill,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.groupPillText, { color: theme.mutedText }]}>
                        No service groups yet
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.stack}>
                  {data.services.length ? (
                    data.services.map((service) => (
                      <View
                        key={service.id}
                        style={[
                          styles.itemCard,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        ]}>
                        <View style={styles.itemHeader}>
                          <View style={styles.itemCopy}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>
                              {service.name}
                            </Text>
                            <Text style={[styles.itemMeta, { color: theme.mutedText }]}>
                              {service.durationLabel} · {service.priceLabel}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: service.isActive
                                  ? theme.accentSoft
                                  : theme.surface,
                                borderColor: theme.border,
                              },
                            ]}>
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: service.isActive ? theme.accent : theme.mutedText },
                              ]}>
                              {service.isActive ? 'Active' : 'Paused'}
                            </Text>
                          </View>
                        </View>

                        {service.description ? (
                          <Text style={[styles.itemDescription, { color: theme.mutedText }]}>
                            {service.description}
                          </Text>
                        ) : null}

                        <View style={styles.metaRow}>
                          <Text style={[styles.metaText, { color: theme.mutedText }]}>
                            {service.groupName ?? 'Ungrouped'}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View
                      style={[
                        styles.noticeCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.noticeTitle, { color: theme.text }]}>No services yet</Text>
                      <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                        Add services on the web dashboard and they&apos;ll show up here automatically.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.stack}>
                {data.staff.length ? (
                  data.staff.map((member) => (
                    <View
                      key={member.id}
                      style={[
                        styles.itemCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      ]}>
                      <View style={styles.itemHeader}>
                        <View style={styles.itemCopy}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>
                            {member.fullName}
                          </Text>
                          <Text style={[styles.itemMeta, { color: theme.mutedText }]}>
                            {member.role ?? 'Team member'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: member.isActive ? theme.accentSoft : theme.surface,
                              borderColor: theme.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: member.isActive ? theme.accent : theme.mutedText },
                            ]}>
                            {member.isActive ? 'Active' : 'Paused'}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.itemDescription, { color: theme.mutedText }]}>
                        {member.phoneDisplay || member.email || 'No contact details'}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {member.workDaysLabel}
                      </Text>
                      <Text style={[styles.metaText, { color: theme.mutedText }]}>
                        {member.workHoursLabel}
                      </Text>

                      <View style={styles.groupRow}>
                        {member.serviceNames.length ? (
                          member.serviceNames.map((serviceName) => (
                            <View
                              key={`${member.id}-${serviceName}`}
                              style={[
                                styles.groupPill,
                                { backgroundColor: theme.surface, borderColor: theme.border },
                              ]}>
                              <Text style={[styles.groupPillText, { color: theme.text }]}>
                                {serviceName}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <View
                            style={[
                              styles.groupPill,
                              { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}>
                            <Text style={[styles.groupPillText, { color: theme.mutedText }]}>
                              All services
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      styles.noticeCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.noticeTitle, { color: theme.text }]}>No staff yet</Text>
                    <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                      Team members will appear here once they&apos;re added on the business dashboard.
                    </Text>
                  </View>
                )}
              </View>
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
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  metricHelper: {
    fontSize: 14,
    lineHeight: 18,
  },
  segmentedCard: {
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
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  stack: {
    gap: 12,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemCopy: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  itemMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
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
