import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  MobileAiReceptionistUpdateInput,
  MobileAiReceptionistSummary,
  MobileAppointmentInput,
  MobileAppointmentUpdateInput,
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
  MobileCustomerViewSummary,
  MobileCustomerDetail,
  MobileCustomerFilters,
  MobileCustomerGroupInput,
  MobileCustomerInput,
  MobileCustomerRecord,
  MobileCustomerSmsLogSummary,
  MobileCustomersSummary,
  MobileDealsSummary,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileOnboardingInput,
  MobileRedeemLookupResponse,
  MobileRedeemResult,
  MobileReferralsSummary,
  MobileReviewsSummary,
  MobileServiceGroupInput,
  MobileServiceInput,
  MobileServicesSummary,
  MobileStaffInput,
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
  aiReceptionist: MobileAiReceptionistSummary | null;
  aiReceptionistError: string | null;
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
  customerView: MobileCustomerViewSummary | null;
  customerViewError: string | null;
  customers: MobileCustomersSummary | null;
  customersError: string | null;
  customerFilters: MobileCustomerFilters;
  customersSearchDraft: string;
  deals: MobileDealsSummary | null;
  dealsError: string | null;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  homeError: string | null;
  isAiReceptionistLoading: boolean;
  isAiReceptionistRefreshing: boolean;
  isAiReceptionistSaving: boolean;
  isAppointmentsLoading: boolean;
  isAppointmentComposerLoading: boolean;
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
  isCustomerViewLoading: boolean;
  isCustomerViewRefreshing: boolean;
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
  onChangeCustomerFilters: (next: Partial<MobileCustomerFilters>) => void;
  moreSection: MobileMoreSection;
  onChangeCustomersSearchDraft: (value: string) => void;
  onChangeMoreSection: (section: MobileMoreSection) => void;
  onChangeTab: (tab: MobileAppTab) => void;
  onCreateAppointment: (input: MobileAppointmentInput) => Promise<void>;
  onCreateAppointmentCustomer: (input: MobileCustomerInput) => Promise<MobileCustomerRecord>;
  onCreateCustomer: (input: MobileCustomerInput) => Promise<void>;
  onCreateCustomerGroup: (input: MobileCustomerGroupInput) => Promise<void>;
  onCreateCheckIn: (
    input: MobileCheckInSubmissionInput,
  ) => Promise<MobileCheckInMutationResponse>;
  onCreateService: (input: MobileServiceInput) => Promise<void>;
  onCreateServiceGroup: (input: MobileServiceGroupInput) => Promise<void>;
  onCreateStaff: (input: MobileStaffInput) => Promise<void>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
  onDeleteCustomerGroup: (groupId: string) => Promise<void>;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
  onDeleteServiceGroup: (groupId: string) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onFetchCustomerDetail: (customerId: string) => Promise<MobileCustomerDetail>;
  onFetchCustomerMessages: (customerId: string) => Promise<MobileCustomerSmsLogSummary>;
  onGoToCustomersPage: (page: number) => void;
  onJumpCheckInsToToday: () => void;
  onJumpAppointmentsToToday: () => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onLookupRedeemCode: (code: string) => Promise<MobileRedeemLookupResponse>;
  onNextCheckInsDate: () => void;
  onNextAppointmentsDate: () => void;
  onNextCustomersPage: () => void;
  onOpenBillingPortal: () => Promise<void>;
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
  onRefreshAiReceptionist: () => Promise<void>;
  onRefreshBilling: () => Promise<void>;
  onRefreshBusinessHours: () => Promise<void>;
  onRefreshBusinessProfile: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshAppointments: () => Promise<void>;
  onRefreshCustomerView: () => Promise<void>;
  onRefreshCustomers: () => Promise<void>;
  onRefreshDeals: () => Promise<void>;
  onRefreshFunds: () => Promise<void>;
  onRefreshHome: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onRefreshReviews: () => Promise<void>;
  onRefreshServices: () => Promise<void>;
  onSaveAiReceptionist: (input: MobileAiReceptionistUpdateInput) => Promise<void>;
  onSaveBusinessHours: (input: MobileBusinessHoursUpdateInput) => Promise<void>;
  onSaveBusinessProfile: (input: MobileOnboardingInput) => Promise<void>;
  onSendReviewRequest: (customerId: string) => Promise<void>;
  onSendCustomerMessage: (customerId: string, message: string) => Promise<void>;
  onShareCustomerViewLink: (label: string, url: string) => Promise<void>;
  onShareDeal: (deal: MobileDealsSummary['deals'][number]) => Promise<void>;
  onShareReferral: () => Promise<void>;
  onShareReviewSurvey: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateCustomer: (
    customerId: string,
    input: MobileCustomerInput,
  ) => Promise<MobileCustomerDetail>;
  onUpdateCustomerGroup: (
    groupId: string,
    input: MobileCustomerGroupInput,
  ) => Promise<void>;
  onUpdateAppointment: (
    appointmentId: string,
    input: MobileAppointmentUpdateInput,
  ) => Promise<void>;
  onUpdateServiceGroup: (
    groupId: string,
    input: MobileServiceGroupInput,
  ) => Promise<void>;
  onUpdateService: (serviceId: string, input: MobileServiceInput) => Promise<void>;
  onUpdateStaff: (staffId: string, input: MobileStaffInput) => Promise<void>;
  onReorderServiceGroups: (ids: string[]) => Promise<void>;
  onReorderServices: (ids: string[]) => Promise<void>;
  appointmentComposerCustomers: MobileCustomerRecord[];
  appointmentComposerError: string | null;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
  reviews: MobileReviewsSummary | null;
  reviewsError: string | null;
  services: MobileServicesSummary | null;
  servicesError: string | null;
  onLoadAppointmentComposerResources: () => Promise<void>;
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
  aiReceptionist,
  aiReceptionistError,
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
  customerView,
  customerViewError,
  customers,
  customersError,
  customerFilters,
  customersSearchDraft,
  deals,
  dealsError,
  funds,
  fundsError,
  home,
  homeError,
  isAiReceptionistLoading,
  isAiReceptionistRefreshing,
  isAiReceptionistSaving,
  isAppointmentsLoading,
  isAppointmentComposerLoading,
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
  isCustomerViewLoading,
  isCustomerViewRefreshing,
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
  onChangeCustomerFilters,
  moreSection,
  onChangeCustomersSearchDraft,
  onChangeMoreSection,
  onChangeTab,
  onCreateAppointment,
  onCreateAppointmentCustomer,
  onCreateCustomer,
  onCreateCustomerGroup,
  onCreateCheckIn,
  onCreateService,
  onCreateServiceGroup,
  onCreateStaff,
  onDeleteCustomer,
  onDeleteCustomerGroup,
  onDeleteAppointment,
  onDeleteService,
  onDeleteServiceGroup,
  onDeleteStaff,
  onFetchCustomerDetail,
  onFetchCustomerMessages,
  onGoToCustomersPage,
  onJumpCheckInsToToday,
  onJumpAppointmentsToToday,
  onLookupCheckIn,
  onLookupRedeemCode,
  onNextCheckInsDate,
  onNextAppointmentsDate,
  onNextCustomersPage,
  onOpenBillingPortal,
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
  onRefreshAiReceptionist,
  onRefreshBilling,
  onRefreshBusinessHours,
  onRefreshBusinessProfile,
  onRefreshCheckIns,
  onRefreshAppointments,
  onRefreshCustomerView,
  onRefreshCustomers,
  onRefreshDeals,
  onRefreshFunds,
  onRefreshHome,
  onRefreshReferrals,
  onRefreshReviews,
  onRefreshServices,
  onSaveAiReceptionist,
  onSaveBusinessHours,
  onSaveBusinessProfile,
  onSendReviewRequest,
  onSendCustomerMessage,
  onShareCustomerViewLink,
  onShareDeal,
  onShareReferral,
  onShareReviewSurvey,
  onSignOut,
  onUpdateAppointment,
  onUpdateCustomer,
  onUpdateCustomerGroup,
  onUpdateServiceGroup,
  onUpdateService,
  onUpdateStaff,
  onReorderServiceGroups,
  onReorderServices,
  appointmentComposerCustomers,
  appointmentComposerError,
  referrals,
  referralsError,
  reviews,
  reviewsError,
  services,
  servicesError,
  onLoadAppointmentComposerResources,
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
              composerCustomers={appointmentComposerCustomers}
              composerError={appointmentComposerError}
              data={appointments}
              error={appointmentsError}
              isComposerLoading={isAppointmentComposerLoading}
              isLoading={isAppointmentsLoading}
              isRefreshing={isAppointmentsRefreshing}
              servicesSummary={services}
              onCreateAppointment={onCreateAppointment}
              onCreateAppointmentCustomer={onCreateAppointmentCustomer}
              onDeleteAppointment={onDeleteAppointment}
              onJumpToToday={onJumpAppointmentsToToday}
              onLoadComposerResources={onLoadAppointmentComposerResources}
              onNextDate={onNextAppointmentsDate}
              onPreviousDate={onPreviousAppointmentsDate}
              onRefresh={onRefreshAppointments}
              onUpdateAppointment={onUpdateAppointment}
            />
          ) : null}

          {activeTab === 'customers' ? (
            <MobileCustomersScreen
              data={customers}
              error={customersError}
              filters={customerFilters}
              isLoading={isCustomersLoading}
              isRefreshing={isCustomersRefreshing}
              onChangeFilter={onChangeCustomerFilters}
              searchDraft={customersSearchDraft}
              onChangeSearchDraft={onChangeCustomersSearchDraft}
              onClearFilters={() => {
                onChangeCustomerFilters({
                  group: '',
                  sms: '',
                  contact: '',
                  visit: '',
                });
              }}
              onCreateCustomer={onCreateCustomer}
              onCreateGroup={onCreateCustomerGroup}
              onDeleteCustomer={onDeleteCustomer}
              onDeleteGroup={onDeleteCustomerGroup}
              onFetchCustomerDetail={onFetchCustomerDetail}
              onFetchCustomerMessages={onFetchCustomerMessages}
              onGoToPage={onGoToCustomersPage}
              onNextPage={onNextCustomersPage}
              onPreviousPage={onPreviousCustomersPage}
              onRefresh={onRefreshCustomers}
              onSendReviewRequest={onSendReviewRequest}
              onSendCustomerMessage={onSendCustomerMessage}
              onUpdateCustomer={onUpdateCustomer}
              onUpdateGroup={onUpdateCustomerGroup}
            />
          ) : null}

          {activeTab === 'deals' ? (
            <MobileDealsScreen
              data={deals}
              error={dealsError}
              isLoading={isDealsLoading}
              isRefreshing={isDealsRefreshing}
              onOpenFunds={onOpenFunds}
              onOpenUrl={onOpenExternalUrl}
              onRefresh={onRefreshDeals}
              onShareDeal={onShareDeal}
            />
          ) : null}

          {activeTab === 'more' ? (
            <MobileMoreScreen
              activeSection={moreSection}
              aiReceptionist={aiReceptionist}
              aiReceptionistError={aiReceptionistError}
              billing={billing}
              billingError={billingError}
              business={business}
              businessHours={businessHours}
              businessHoursError={businessHoursError}
              businessProfile={businessProfile}
              businessProfileError={businessProfileError}
              checkIns={checkIns}
              checkInsError={checkInsError}
              customerView={customerView}
              customerViewError={customerViewError}
              funds={funds}
              fundsError={fundsError}
              home={home}
              isAiReceptionistLoading={isAiReceptionistLoading}
              isAiReceptionistRefreshing={isAiReceptionistRefreshing}
              isAiReceptionistSaving={isAiReceptionistSaving}
              isBillingLoading={isBillingLoading}
              isBillingPortalOpening={isBillingPortalOpening}
              isBillingRefreshing={isBillingRefreshing}
              isBusinessHoursLoading={isBusinessHoursLoading}
              isBusinessHoursRefreshing={isBusinessHoursRefreshing}
              isBusinessHoursSaving={isBusinessHoursSaving}
              isBusinessProfileLoading={isBusinessProfileLoading}
              isCheckInsLoading={isCheckInsLoading}
              isCheckInsRefreshing={isCheckInsRefreshing}
              isCustomerViewLoading={isCustomerViewLoading}
              isCustomerViewRefreshing={isCustomerViewRefreshing}
              isFundsLoading={isFundsLoading}
              isFundsRefreshing={isFundsRefreshing}
              isReferralsLoading={isReferralsLoading}
              isReferralsRefreshing={isReferralsRefreshing}
              isReviewsLoading={isReviewsLoading}
              isReviewsRefreshing={isReviewsRefreshing}
              isSavingBusinessProfile={isSavingBusinessProfile}
              isServicesLoading={isServicesLoading}
              isServicesRefreshing={isServicesRefreshing}
              onChangeSection={onChangeMoreSection}
              onCreateCheckIn={onCreateCheckIn}
              onCreateService={onCreateService}
              onCreateServiceGroup={onCreateServiceGroup}
              onCreateStaff={onCreateStaff}
              onDeleteService={onDeleteService}
              onDeleteServiceGroup={onDeleteServiceGroup}
              onDeleteStaff={onDeleteStaff}
              onJumpCheckInsToToday={onJumpCheckInsToToday}
              onLookupCheckIn={onLookupCheckIn}
              onLookupRedeemCode={onLookupRedeemCode}
              onNextCheckInsDate={onNextCheckInsDate}
              onOpenBillingPortal={onOpenBillingPortal}
              onOpenExternalUrl={onOpenExternalUrl}
              onPreviousCheckInsDate={onPreviousCheckInsDate}
              onRedeemCode={onRedeemCode}
              onRefreshAiReceptionist={onRefreshAiReceptionist}
              onRefreshBilling={onRefreshBilling}
              onRefreshBusinessHours={onRefreshBusinessHours}
              onRefreshBusinessProfile={onRefreshBusinessProfile}
              onRefreshCheckIns={onRefreshCheckIns}
              onRefreshCustomerView={onRefreshCustomerView}
              onRefreshFunds={onRefreshFunds}
              onRefreshReferrals={onRefreshReferrals}
              onRefreshReviews={onRefreshReviews}
              onRefreshServices={onRefreshServices}
              onSaveAiReceptionist={onSaveAiReceptionist}
              onSaveBusinessHours={onSaveBusinessHours}
              onSaveBusinessProfile={onSaveBusinessProfile}
              onShareCustomerViewLink={onShareCustomerViewLink}
              onShareReferral={onShareReferral}
              onShareReviewSurvey={onShareReviewSurvey}
              onSignOut={onSignOut}
              onReorderServiceGroups={onReorderServiceGroups}
              onReorderServices={onReorderServices}
              onUpdateServiceGroup={onUpdateServiceGroup}
              onUpdateService={onUpdateService}
              onUpdateStaff={onUpdateStaff}
              referrals={referrals}
              referralsError={referralsError}
              reviews={reviews}
              reviewsError={reviewsError}
              services={services}
              servicesError={servicesError}
            />
          ) : null}
        </View>

        <View style={styles.tabBarWrap}>
          <View
            style={[
              styles.tabBar,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            testID="mobile-tab-bar">
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
                      backgroundColor: isActive ? theme.accentSoft : 'transparent',
                    },
                  ]}
                  testID={`mobile-tab-${tab.key}`}>
                  <View
                    style={[
                      styles.tabIconBadge,
                      {
                        backgroundColor: isActive ? theme.surface : 'transparent',
                        borderColor: isActive ? theme.border : 'transparent',
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
  tabBarWrap: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#09131f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  tabIconBadge: {
    width: 36,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
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
