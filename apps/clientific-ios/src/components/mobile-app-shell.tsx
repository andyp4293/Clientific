import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  MobileAnalyticsRange,
  MobileAnalyticsSummary,
  MobileAppointmentsSummary,
  MobileBillingSummary,
  MobileBusiness,
  MobileBusinessHoursSummary,
  MobileBusinessHoursUpdateInput,
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
  MobileRedeemLookupResponse,
  MobileRedeemResult,
  MobileReferralsSummary,
  MobileReviewsSummary,
  MobileServicesSummary,
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
  analytics: MobileAnalyticsSummary | null;
  analyticsError: string | null;
  appointments: MobileAppointmentsSummary | null;
  appointmentsError: string | null;
  billing: MobileBillingSummary | null;
  billingError: string | null;
  business: MobileBusiness;
  businessHours: MobileBusinessHoursSummary | null;
  businessHoursError: string | null;
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
  isAnalyticsLoading: boolean;
  isAnalyticsRefreshing: boolean;
  isAppointmentsLoading: boolean;
  isAppointmentsRefreshing: boolean;
  isBillingLoading: boolean;
  isBillingPortalOpening: boolean;
  isBillingRefreshing: boolean;
  isBusinessHoursLoading: boolean;
  isBusinessHoursRefreshing: boolean;
  isBusinessHoursSaving: boolean;
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
  isReviewsLoading: boolean;
  isReviewsRefreshing: boolean;
  isSavingBusinessProfile: boolean;
  isServicesLoading: boolean;
  isServicesRefreshing: boolean;
  onChangeAnalyticsRange: (range: MobileAnalyticsRange) => void;
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
  onLookupRedeemCode: (code: string) => Promise<MobileRedeemLookupResponse>;
  onNextCheckInsDate: () => void;
  onNextAppointmentsDate: () => void;
  onNextCustomersPage: () => void;
  onOpenBillingPortal: () => Promise<void>;
  onOpenExternalRoute: (path: string) => Promise<void>;
  onOpenExternalUrl: (url: string) => Promise<void>;
  onOpenAppointments: () => void;
  onOpenCustomers: () => void;
  onOpenDeals: () => void;
  onOpenFunds: () => void;
  onOpenReferrals: () => void;
  onPreviousCheckInsDate: () => void;
  onPreviousAppointmentsDate: () => void;
  onPreviousCustomersPage: () => void;
  onRedeemCode: (input: { code: string; transactionAmount?: number | null }) => Promise<MobileRedeemResult>;
  onRefreshAnalytics: () => Promise<void>;
  onRefreshBilling: () => Promise<void>;
  onRefreshBusinessHours: () => Promise<void>;
  onRefreshBusinessProfile: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshAppointments: () => Promise<void>;
  onRefreshCustomers: () => Promise<void>;
  onRefreshDeals: () => Promise<void>;
  onRefreshFunds: () => Promise<void>;
  onRefreshHome: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onRefreshReviews: () => Promise<void>;
  onRefreshServices: () => Promise<void>;
  onSaveBusinessHours: (input: MobileBusinessHoursUpdateInput) => Promise<void>;
  onSaveBusinessProfile: (input: MobileOnboardingInput) => Promise<void>;
  onShareDeal: (deal: MobileDealsSummary['deals'][number]) => Promise<void>;
  onShareReferral: () => Promise<void>;
  onShareReviewSurvey: () => Promise<void>;
  onSignOut: () => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
  reviews: MobileReviewsSummary | null;
  reviewsError: string | null;
  services: MobileServicesSummary | null;
  servicesError: string | null;
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
  analytics,
  analyticsError,
  appointments,
  appointmentsError,
  billing,
  billingError,
  business,
  businessHours,
  businessHoursError,
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
  isAnalyticsLoading,
  isAnalyticsRefreshing,
  isAppointmentsLoading,
  isAppointmentsRefreshing,
  isBillingLoading,
  isBillingPortalOpening,
  isBillingRefreshing,
  isBusinessHoursLoading,
  isBusinessHoursRefreshing,
  isBusinessHoursSaving,
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
  isReviewsLoading,
  isReviewsRefreshing,
  isSavingBusinessProfile,
  isServicesLoading,
  isServicesRefreshing,
  onChangeAnalyticsRange,
  moreSection,
  onChangeCustomersSearchDraft,
  onChangeMoreSection,
  onChangeTab,
  onCreateCheckIn,
  onJumpCheckInsToToday,
  onJumpAppointmentsToToday,
  onLookupCheckIn,
  onLookupRedeemCode,
  onNextCheckInsDate,
  onNextAppointmentsDate,
  onNextCustomersPage,
  onOpenBillingPortal,
  onOpenExternalRoute,
  onOpenExternalUrl,
  onOpenAppointments,
  onOpenCustomers,
  onOpenDeals,
  onOpenFunds,
  onOpenReferrals,
  onPreviousCheckInsDate,
  onPreviousAppointmentsDate,
  onPreviousCustomersPage,
  onRedeemCode,
  onRefreshAnalytics,
  onRefreshBilling,
  onRefreshBusinessHours,
  onRefreshBusinessProfile,
  onRefreshCheckIns,
  onRefreshAppointments,
  onRefreshCustomers,
  onRefreshDeals,
  onRefreshFunds,
  onRefreshHome,
  onRefreshReferrals,
  onRefreshReviews,
  onRefreshServices,
  onSaveBusinessHours,
  onSaveBusinessProfile,
  onShareDeal,
  onShareReferral,
  onShareReviewSurvey,
  onSignOut,
  referrals,
  referralsError,
  reviews,
  reviewsError,
  services,
  servicesError,
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
              analytics={analytics}
              analyticsError={analyticsError}
              billing={billing}
              billingError={billingError}
              business={business}
              businessHours={businessHours}
              businessHoursError={businessHoursError}
              businessProfile={businessProfile}
              businessProfileError={businessProfileError}
              checkIns={checkIns}
              checkInsError={checkInsError}
              funds={funds}
              fundsError={fundsError}
              home={home}
              isAnalyticsLoading={isAnalyticsLoading}
              isAnalyticsRefreshing={isAnalyticsRefreshing}
              isBillingLoading={isBillingLoading}
              isBillingPortalOpening={isBillingPortalOpening}
              isBillingRefreshing={isBillingRefreshing}
              isBusinessHoursLoading={isBusinessHoursLoading}
              isBusinessHoursRefreshing={isBusinessHoursRefreshing}
              isBusinessHoursSaving={isBusinessHoursSaving}
              isBusinessProfileLoading={isBusinessProfileLoading}
              isCheckInsLoading={isCheckInsLoading}
              isCheckInsRefreshing={isCheckInsRefreshing}
              isFundsLoading={isFundsLoading}
              isFundsRefreshing={isFundsRefreshing}
              isReferralsLoading={isReferralsLoading}
              isReferralsRefreshing={isReferralsRefreshing}
              isReviewsLoading={isReviewsLoading}
              isReviewsRefreshing={isReviewsRefreshing}
              isSavingBusinessProfile={isSavingBusinessProfile}
              isServicesLoading={isServicesLoading}
              isServicesRefreshing={isServicesRefreshing}
              onChangeAnalyticsRange={onChangeAnalyticsRange}
              onChangeSection={onChangeMoreSection}
              onCreateCheckIn={onCreateCheckIn}
              onJumpCheckInsToToday={onJumpCheckInsToToday}
              onLookupCheckIn={onLookupCheckIn}
              onLookupRedeemCode={onLookupRedeemCode}
              onNextCheckInsDate={onNextCheckInsDate}
              onOpenBillingPortal={onOpenBillingPortal}
              onOpenExternalRoute={onOpenExternalRoute}
              onOpenExternalUrl={onOpenExternalUrl}
              onPreviousCheckInsDate={onPreviousCheckInsDate}
              onRedeemCode={onRedeemCode}
              onRefreshAnalytics={onRefreshAnalytics}
              onRefreshBilling={onRefreshBilling}
              onRefreshBusinessHours={onRefreshBusinessHours}
              onRefreshBusinessProfile={onRefreshBusinessProfile}
              onRefreshCheckIns={onRefreshCheckIns}
              onRefreshFunds={onRefreshFunds}
              onRefreshReferrals={onRefreshReferrals}
              onRefreshReviews={onRefreshReviews}
              onRefreshServices={onRefreshServices}
              onSaveBusinessHours={onSaveBusinessHours}
              onSaveBusinessProfile={onSaveBusinessProfile}
              onShareReferral={onShareReferral}
              onShareReviewSurvey={onShareReviewSurvey}
              onSignOut={onSignOut}
              referrals={referrals}
              referralsError={referralsError}
              reviews={reviews}
              reviewsError={reviewsError}
              services={services}
              servicesError={servicesError}
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
