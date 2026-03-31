import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  MobileAppointmentsSummary,
  MobileBusiness,
  MobileCheckInLookupResponse,
  MobileCheckInMutationResponse,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
  MobileCustomersSummary,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileReferralsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileCheckinsScreen } from '@/components/mobile-checkins-screen';
import { MobileCustomersScreen } from '@/components/mobile-customers-screen';
import { MobileHomeScreen } from '@/components/mobile-home-screen';
import { MobileMoreScreen, type MobileMoreSection } from '@/components/mobile-more-screen';
import { MobileScheduleScreen } from '@/components/mobile-schedule-screen';

export type MobileAppTab = 'home' | 'schedule' | 'checkins' | 'customers' | 'more';

type MobileAppShellProps = {
  activeTab: MobileAppTab;
  appointments: MobileAppointmentsSummary | null;
  appointmentsError: string | null;
  business: MobileBusiness;
  checkIns: MobileCheckInsSummary | null;
  checkInsError: string | null;
  customers: MobileCustomersSummary | null;
  customersError: string | null;
  customersSearchDraft: string;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  homeError: string | null;
  isAppointmentsLoading: boolean;
  isAppointmentsRefreshing: boolean;
  isCheckInsLoading: boolean;
  isCheckInsRefreshing: boolean;
  isCustomersLoading: boolean;
  isCustomersRefreshing: boolean;
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
  isHomeRefreshing: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  moreSection: MobileMoreSection;
  onChangeCustomersSearchDraft: (value: string) => void;
  onChangeMoreSection: (section: MobileMoreSection) => void;
  onChangeTab: (tab: MobileAppTab) => void;
  onCreateCheckIn: (
    input: MobileCheckInSubmissionInput,
  ) => Promise<MobileCheckInMutationResponse>;
  onJumpAppointmentsToToday: () => void;
  onJumpCheckInsToToday: () => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onNextAppointmentsDate: () => void;
  onNextCheckInsDate: () => void;
  onNextCustomersPage: () => void;
  onOpenCheckIns: () => void;
  onOpenCustomers: () => void;
  onOpenFunds: () => void;
  onOpenReferrals: () => void;
  onOpenSchedule: () => void;
  onPreviousAppointmentsDate: () => void;
  onPreviousCheckInsDate: () => void;
  onPreviousCustomersPage: () => void;
  onRefreshAppointments: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshCustomers: () => Promise<void>;
  onRefreshFunds: () => Promise<void>;
  onRefreshHome: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onShareReferral: () => Promise<void>;
  onSignOut: () => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
};

const TAB_LABELS: Array<{ key: MobileAppTab; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'customers', label: 'Customers' },
  { key: 'more', label: 'More' },
];

export function MobileAppShell({
  activeTab,
  appointments,
  appointmentsError,
  business,
  checkIns,
  checkInsError,
  customers,
  customersError,
  customersSearchDraft,
  funds,
  fundsError,
  home,
  homeError,
  isAppointmentsLoading,
  isAppointmentsRefreshing,
  isCheckInsLoading,
  isCheckInsRefreshing,
  isCustomersLoading,
  isCustomersRefreshing,
  isFundsLoading,
  isFundsRefreshing,
  isHomeRefreshing,
  isReferralsLoading,
  isReferralsRefreshing,
  moreSection,
  onChangeCustomersSearchDraft,
  onChangeMoreSection,
  onChangeTab,
  onCreateCheckIn,
  onJumpAppointmentsToToday,
  onJumpCheckInsToToday,
  onLookupCheckIn,
  onNextAppointmentsDate,
  onNextCheckInsDate,
  onNextCustomersPage,
  onOpenCheckIns,
  onOpenCustomers,
  onOpenFunds,
  onOpenReferrals,
  onOpenSchedule,
  onPreviousAppointmentsDate,
  onPreviousCheckInsDate,
  onPreviousCustomersPage,
  onRefreshAppointments,
  onRefreshCheckIns,
  onRefreshCustomers,
  onRefreshFunds,
  onRefreshHome,
  onRefreshReferrals,
  onShareReferral,
  onSignOut,
  referrals,
  referralsError,
}: MobileAppShellProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          {activeTab === 'home' ? (
            <MobileHomeScreen
              error={homeError}
              isRefreshing={isHomeRefreshing}
              summary={home}
              onOpenCheckIns={onOpenCheckIns}
              onOpenCustomers={onOpenCustomers}
              onOpenFunds={onOpenFunds}
              onOpenReferrals={onOpenReferrals}
              onOpenSchedule={onOpenSchedule}
              onRefresh={onRefreshHome}
            />
          ) : null}

          {activeTab === 'schedule' ? (
            <MobileScheduleScreen
              data={appointments}
              error={appointmentsError}
              isLoading={isAppointmentsLoading}
              isRefreshing={isAppointmentsRefreshing}
              onJumpToToday={onJumpAppointmentsToToday}
              onNextDate={onNextAppointmentsDate}
              onPreviousDate={onPreviousAppointmentsDate}
              onRefresh={onRefreshAppointments}
            />
          ) : null}

          {activeTab === 'checkins' ? (
            <MobileCheckinsScreen
              data={checkIns}
              error={checkInsError}
              isLoading={isCheckInsLoading}
              isRefreshing={isCheckInsRefreshing}
              onJumpToToday={onJumpCheckInsToToday}
              onLookup={onLookupCheckIn}
              onNextDate={onNextCheckInsDate}
              onPreviousDate={onPreviousCheckInsDate}
              onRefresh={onRefreshCheckIns}
              onSubmit={onCreateCheckIn}
            />
          ) : null}

          {activeTab === 'customers' ? (
            <MobileCustomersScreen
              data={customers}
              error={customersError}
              isLoading={isCustomersLoading}
              isRefreshing={isCustomersRefreshing}
              searchDraft={customersSearchDraft}
              onChangeSearchDraft={onChangeCustomersSearchDraft}
              onNextPage={onNextCustomersPage}
              onPreviousPage={onPreviousCustomersPage}
              onRefresh={onRefreshCustomers}
            />
          ) : null}

          {activeTab === 'more' ? (
            <MobileMoreScreen
              activeSection={moreSection}
              business={business}
              funds={funds}
              fundsError={fundsError}
              home={home}
              isFundsLoading={isFundsLoading}
              isFundsRefreshing={isFundsRefreshing}
              isReferralsLoading={isReferralsLoading}
              isReferralsRefreshing={isReferralsRefreshing}
              onChangeSection={onChangeMoreSection}
              onRefreshFunds={onRefreshFunds}
              onRefreshReferrals={onRefreshReferrals}
              onShareReferral={onShareReferral}
              onSignOut={onSignOut}
              referrals={referrals}
              referralsError={referralsError}
            />
          ) : null}
        </View>

        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          {TAB_LABELS.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                onPress={() => onChangeTab(tab.key)}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isActive ? theme.accentSoft : 'transparent',
                  },
                ]}
                testID={`mobile-tab-${tab.key}`}>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? theme.accent : theme.mutedText },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
