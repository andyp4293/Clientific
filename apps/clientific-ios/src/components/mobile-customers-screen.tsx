import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  Pressable,
} from 'react-native';
import type { MobileCustomersSummary } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileCustomersScreenProps = {
  data: MobileCustomersSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  searchDraft: string;
  onChangeSearchDraft: (value: string) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRefresh: () => Promise<void>;
};

function getSmsStatusLabel(customer: {
  smsConsent: boolean;
  smsOptedOut: boolean;
  phoneDisplay: string | null;
}) {
  if (!customer.phoneDisplay) return 'No phone';
  if (customer.smsOptedOut) return 'Opted out';
  if (customer.smsConsent) return 'SMS ready';
  return 'SMS not approved';
}

export function MobileCustomersScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  searchDraft,
  onChangeSearchDraft,
  onNextPage,
  onPreviousPage,
  onRefresh,
}: MobileCustomersScreenProps) {
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
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Customers</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Customer records</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Search and page through the database instead of loading everything at once.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeSearchDraft}
          placeholder="Search by name, email, or phone"
          placeholderTextColor={theme.mutedText}
          style={[
            styles.searchInput,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text },
          ]}
          testID="mobile-customers-search"
          value={searchDraft}
        />
      </View>

      {error ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Couldn&apos;t load customers</Text>
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
            Loading customers...
          </Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.paginationCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.paginationCopy}>
              <Text style={[styles.paginationTitle, { color: theme.text }]}>
                {data?.totalCustomers ?? 0} customers
              </Text>
              <Text style={[styles.paginationText, { color: theme.mutedText }]}>
                Page {data?.currentPage ?? 1} of {data?.totalPages ?? 1}
              </Text>
            </View>

            <View style={styles.paginationButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={!data || data.currentPage <= 1}
                onPress={onPreviousPage}
                style={[
                  styles.pageButton,
                  { borderColor: theme.border, opacity: !data || data.currentPage <= 1 ? 0.5 : 1 },
                ]}
                testID="mobile-customers-previous">
                <Text style={[styles.pageButtonText, { color: theme.text }]}>Prev</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!data || data.currentPage >= data.totalPages}
                onPress={onNextPage}
                style={[
                  styles.pageButton,
                  { borderColor: theme.border, opacity: !data || data.currentPage >= data.totalPages ? 0.5 : 1 },
                ]}
                testID="mobile-customers-next">
                <Text style={[styles.pageButtonText, { color: theme.text }]}>Next</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.stack}>
            {data?.customers.length ? (
              data.customers.map((customer) => (
                <View
                  key={customer.id}
                  style={[
                    styles.customerCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <View style={styles.customerHeader}>
                    <View style={styles.customerIdentity}>
                      <Text style={[styles.customerName, { color: theme.text }]}>
                        {customer.name}
                      </Text>
                      <Text style={[styles.customerMeta, { color: theme.mutedText }]}>
                        {customer.phoneDisplay ?? customer.email ?? 'No contact info'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: theme.accentSoft, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.statusPillText, { color: theme.accent }]}>
                        {getSmsStatusLabel(customer)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.customerStats}>
                    <Text style={[styles.customerMeta, { color: theme.mutedText }]}>
                      Joined {customer.joinedLabel}
                    </Text>
                    <Text style={[styles.customerMeta, { color: theme.mutedText }]}>
                      Last visit {customer.lastVisitLabel}
                    </Text>
                    <Text style={[styles.customerMeta, { color: theme.mutedText }]}>
                      Visits {customer.visitsCount} · Spent {customer.totalSpentLabel}
                    </Text>
                  </View>

                  <View style={styles.groupRow}>
                    {customer.groups.length ? (
                      customer.groups.map((group) => (
                        <View
                          key={group.id}
                          style={[
                            styles.groupPill,
                            {
                              backgroundColor: group.promotionSmsEnabled
                                ? theme.accentSoft
                                : theme.surfaceMuted,
                              borderColor: theme.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.groupPillText,
                              { color: group.promotionSmsEnabled ? theme.accent : theme.text },
                            ]}>
                            {group.name}
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
                          Ungrouped
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
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}>
                <Text style={[styles.noticeTitle, { color: theme.text }]}>No customers found</Text>
                <Text style={[styles.noticeText, { color: theme.mutedText }]}>
                  Try a different name, email, or phone search.
                </Text>
              </View>
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
  searchInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 15,
    lineHeight: 20,
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
  paginationCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  paginationCopy: {
    gap: 4,
  },
  paginationTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  paginationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  pageButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  stack: {
    gap: 12,
  },
  customerCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  customerHeader: {
    gap: 10,
  },
  customerIdentity: {
    gap: 4,
  },
  customerName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  customerMeta: {
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
  statusPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  customerStats: {
    gap: 4,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
});
