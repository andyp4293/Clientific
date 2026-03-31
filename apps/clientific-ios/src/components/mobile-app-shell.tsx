import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  MobileAppointmentsSummary,
  MobileBusiness,
  MobileBusinessProfile,
  MobileCheckInLookupResponse,
  MobileCheckInMutationResponse,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
  MobileCustomersSummary,
  MobileDealsSummary,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileOnboardingInput,
  MobileReferralsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileCustomersScreen } from '@/components/mobile-customers-screen';
import { MobileDealsScreen } from '@/components/mobile-deals-screen';
import { MobileHomeScreen } from '@/components/mobile-home-screen';
import { MobileMoreScreen, type MobileMoreSection } from '@/components/mobile-more-screen';
import { MobileNavIcon, type MobileNavIconName } from '@/components/mobile-nav-icon';
import { MobileScheduleScreen } from '@/components/mobile-schedule-screen';

export type MobileAppTab = 'dashboard' | 'appointments' | 'customers' | 'deals' | 'more';

type MobileAppShellProps = {
  activeTab: MobileAppTab;
  appointments: MobileAppointmentsSummary | null;
  appointmentsError: string | null;
  business: MobileBusiness;
  businessProfile: MobileBusinessProfile | null;
  businessProfileError: string | null;
  checkIns: MobileCheckInsSummary | null;
  checkInsError: string | null;
  customers: MobileCustomersSummary | null;
  customersError: string | null;
  customersSearchDraft: string;
  deals: MobileDealsSummary | null;
  dealsError: string | null;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  homeError: string | null;
  isAppointmentsLoading: boolean;
  isAppointmentsRefreshing: boolean;
  isBusinessProfileLoading: boolean;
  isCheckInsLoading: boolean;
  isCheckInsRefreshing: boolean;
  isCustomersLoading: boolean;
  isCustomersRefreshing: boolean;
  isDealsLoading: boolean;
  isDealsRefreshing: boolean;
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
  isHomeRefreshing: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  isSavingBusinessProfile: boolean;
  moreSection: MobileMoreSection;
  onChangeCustomersSearchDraft: (value: string) => void;
  onChangeMoreSection: (section: MobileMoreSection) => void;
  onChangeTab: (tab: MobileAppTab) => void;
  onCreateCheckIn: (
    input: MobileCheckInSubmissionInput,
  ) => Promise<MobileCheckInMutationResponse>;
  onJumpCheckInsToToday: () => void;
  onJumpAppointmentsToToday: () => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onNextCheckInsDate: () => void;
  onNextAppointmentsDate: () => void;
  onNextCustomersPage: () => void;
  onOpenExternalRoute: (path: string) => Promise<void>;
  onOpenAppointments: () => void;
  onOpenCustomers: () => void;
  onOpenDeals: () => void;
  onOpenFunds: () => void;
  onOpenReferrals: () => void;
  onPreviousCheckInsDate: () => void;
  onPreviousAppointmentsDate: () => void;
  onPreviousCustomersPage: () => void;
  onRefreshBusinessProfile: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshAppointments: () => Promise<void>;
  onRefreshCustomers: () => Promise<void>;
  onRefreshDeals: () => Promise<void>;
  onRefreshFunds: () => Promise<void>;
  onRefreshHome: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onSaveBusinessProfile: (input: MobileOnboardingInput) => Promise<void>;
  onShareDeal: (deal: MobileDealsSummary['deals'][number]) => Promise<void>;
  onShareReferral: () => Promise<void>;
  onSignOut: () => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
};

const TAB_LABELS: Array<{ key: MobileAppTab; label: string; icon: MobileNavIconName }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'appointments', label: 'Appointments', icon: 'appointments' },
  { key: 'customers', label: 'Customers', icon: 'customers' },
  { key: 'deals', label: 'Deals', icon: 'deals' },
  { key: 'more', label: 'More', icon: 'more' },
];

export function MobileAppShell({
  activeTab,
  appointments,
  appointmentsError,
  business,
  businessProfile,
  businessProfileError,
  checkIns,
  checkInsError,
  customers,
  customersError,
  customersSearchDraft,
  deals,
  dealsError,
  funds,
  fundsError,
  home,
  homeError,
  isAppointmentsLoading,
  isAppointmentsRefreshing,
  isBusinessProfileLoading,
  isCheckInsLoading,
  isCheckInsRefreshing,
  isCustomersLoading,
  isCustomersRefreshing,
  isDealsLoading,
  isDealsRefreshing,
  isFundsLoading,
  isFundsRefreshing,
  isHomeRefreshing,
  isReferralsLoading,
  isReferralsRefreshing,
  isSavingBusinessProfile,
  moreSection,
  onChangeCustomersSearchDraft,
  onChangeMoreSection,
  onChangeTab,
  onCreateCheckIn,
  onJumpCheckInsToToday,
  onJumpAppointmentsToToday,
  onLookupCheckIn,
  onNextCheckInsDate,
  onNextAppointmentsDate,
  onNextCustomersPage,
  onOpenExternalRoute,
  onOpenAppointments,
  onOpenCustomers,
  onOpenDeals,
  onOpenFunds,
  onOpenReferrals,
  onPreviousCheckInsDate,
  onPreviousAppointmentsDate,
  onPreviousCustomersPage,
  onRefreshBusinessProfile,
  onRefreshCheckIns,
  onRefreshAppointments,
  onRefreshCustomers,
  onRefreshDeals,
  onRefreshFunds,
  onRefreshHome,
  onRefreshReferrals,
  onSaveBusinessProfile,
  onShareDeal,
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
          {activeTab === 'dashboard' ? (
            <MobileHomeScreen
              error={homeError}
              isRefreshing={isHomeRefreshing}
              summary={home}
              onOpenAppointments={onOpenAppointments}
              onOpenCheckIns={() => {
                onChangeTab('more');
                onChangeMoreSection('checkins');
              }}
              onOpenCustomers={onOpenCustomers}
              onOpenDeals={onOpenDeals}
              onOpenFunds={onOpenFunds}
              onOpenReferrals={onOpenReferrals}
              onRefresh={onRefreshHome}
            />
          ) : null}

          {activeTab === 'appointments' ? (
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

          {activeTab === 'deals' ? (
            <MobileDealsScreen
              data={deals}
              error={dealsError}
              isLoading={isDealsLoading}
              isRefreshing={isDealsRefreshing}
              onOpenFunds={onOpenFunds}
              onRefresh={onRefreshDeals}
              onShareDeal={onShareDeal}
            />
          ) : null}

          {activeTab === 'more' ? (
            <MobileMoreScreen
              activeSection={moreSection}
              business={business}
              businessProfile={businessProfile}
              businessProfileError={businessProfileError}
              checkIns={checkIns}
              checkInsError={checkInsError}
              funds={funds}
              fundsError={fundsError}
              home={home}
              isBusinessProfileLoading={isBusinessProfileLoading}
              isCheckInsLoading={isCheckInsLoading}
              isCheckInsRefreshing={isCheckInsRefreshing}
              isFundsLoading={isFundsLoading}
              isFundsRefreshing={isFundsRefreshing}
              isReferralsLoading={isReferralsLoading}
              isReferralsRefreshing={isReferralsRefreshing}
              isSavingBusinessProfile={isSavingBusinessProfile}
              onChangeSection={onChangeMoreSection}
              onCreateCheckIn={onCreateCheckIn}
              onJumpCheckInsToToday={onJumpCheckInsToToday}
              onLookupCheckIn={onLookupCheckIn}
              onNextCheckInsDate={onNextCheckInsDate}
              onOpenExternalRoute={onOpenExternalRoute}
              onPreviousCheckInsDate={onPreviousCheckInsDate}
              onRefreshBusinessProfile={onRefreshBusinessProfile}
              onRefreshCheckIns={onRefreshCheckIns}
              onRefreshFunds={onRefreshFunds}
              onRefreshReferrals={onRefreshReferrals}
              onSaveBusinessProfile={onSaveBusinessProfile}
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
                onPress={() => {
                  if (tab.key === 'more') {
                    onChangeMoreSection('menu');
                  }

                  onChangeTab(tab.key);
                }}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: 'transparent',
                  },
                ]}
                testID={`mobile-tab-${tab.key}`}>
                <View
                  style={[
                    styles.tabIconBadge,
                    {
                      backgroundColor: isActive ? theme.accentSoft : 'transparent',
                    },
                  ]}>
                  <MobileNavIcon
                    color={isActive ? theme.accent : theme.mutedText}
                    name={tab.icon}
                    size={20}
                  />
                </View>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  tabIconBadge: {
    width: 40,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
