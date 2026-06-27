import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
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
  MobileCustomerBroadcastInput,
  MobileCustomerBroadcastResult,
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
  MobileNotificationsSummary,
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
import type { MobilePushPermissionStatus } from '@/lib/mobile-push-notifications';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  appStoreOffering: PurchasesOffering | null;
  billing: MobileBillingSummary | null;
  billingNotice: string | null;
  billingPurchaseError: string | null;
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
  isBillingOfferingLoading: boolean;
  isBillingRefreshing: boolean;
  isManagingSubscription: boolean;
  isBusinessHoursLoading: boolean;
  isBusinessHoursRefreshing: boolean;
  isBusinessHoursSaving: boolean;
  isBusinessProfileLoading: boolean;
  isDeletingAccount: boolean;
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
  isNotificationsLoading: boolean;
  isNotificationsMarkingRead: boolean;
  isNotificationsRefreshing: boolean;
  isPurchasingSubscription: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  isRestoringSubscription: boolean;
  isReviewsLoading: boolean;
  isReviewsRefreshing: boolean;
  isSavingBusinessProfile: boolean;
  isServicesLoading: boolean;
  isServicesRefreshing: boolean;
  onChangeCustomerFilters: (next: Partial<MobileCustomerFilters>) => void;
  moreSection: MobileMoreSection;
  notifications: MobileNotificationsSummary | null;
  notificationsError: string | null;
  notificationsPermissionStatus: MobilePushPermissionStatus;
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
  onDeleteAccount: () => Promise<void>;
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
  onSelectAppointmentsDate: (dateKey: string) => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onLookupRedeemCode: (code: string) => Promise<MobileRedeemLookupResponse>;
  onNextCheckInsDate: () => void;
  onSelectCheckInsDate: (dateKey: string) => void;
  onNextAppointmentsDate: () => void;
  onNextCustomersPage: () => void;
  onManageSubscription: () => Promise<void>;
  onOpenExternalUrl: (url: string) => Promise<void>;
  onOpenAppointments: () => void;
  onOpenCustomers: () => void;
  onOpenDeals: () => void;
  onOpenFunds: () => void;
  onOpenReferrals: () => void;
  onEnablePushNotifications: () => Promise<void>;
  onOpenNotification: (notificationId: string) => Promise<void>;
  onPreviousCheckInsDate: () => void;
  onPreviousAppointmentsDate: () => void;
  onPreviousCustomersPage: () => void;
  onPurchasePackage: (aPackage: PurchasesPackage) => Promise<void>;
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
  onRefreshNotifications: () => Promise<void>;
  onMarkNotificationsRead: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onRefreshReviews: () => Promise<void>;
  onRefreshServices: () => Promise<void>;
  onRestorePurchases: () => Promise<void>;
  onSaveAiReceptionist: (input: MobileAiReceptionistUpdateInput) => Promise<void>;
  onSaveBusinessHours: (input: MobileBusinessHoursUpdateInput) => Promise<void>;
  onSaveBusinessProfile: (input: MobileOnboardingInput) => Promise<void>;
  onSendReviewRequest: (customerId: string) => Promise<void>;
  onSendCustomerMessage: (customerId: string, message: string) => Promise<void>;
  onPreviewCustomerBroadcast: (
    input: MobileCustomerBroadcastInput,
  ) => Promise<MobileCustomerBroadcastResult>;
  onSendCustomerBroadcast: (
    input: MobileCustomerBroadcastInput,
  ) => Promise<MobileCustomerBroadcastResult>;
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
  appStoreOffering,
  billing,
  billingNotice,
  billingPurchaseError,
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
  isBillingOfferingLoading,
  isBillingRefreshing,
  isManagingSubscription,
  isBusinessHoursLoading,
  isBusinessHoursRefreshing,
  isBusinessHoursSaving,
  isBusinessProfileLoading,
  isDeletingAccount,
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
  isNotificationsLoading,
  isNotificationsMarkingRead,
  isNotificationsRefreshing,
  isPurchasingSubscription,
  isReferralsLoading,
  isReferralsRefreshing,
  isRestoringSubscription,
  isReviewsLoading,
  isReviewsRefreshing,
  isSavingBusinessProfile,
  isServicesLoading,
  isServicesRefreshing,
  onChangeCustomerFilters,
  moreSection,
  notifications,
  notificationsError,
  notificationsPermissionStatus,
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
  onDeleteAccount,
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
  onSelectAppointmentsDate,
  onLookupCheckIn,
  onLookupRedeemCode,
  onNextCheckInsDate,
  onSelectCheckInsDate,
  onNextAppointmentsDate,
  onNextCustomersPage,
  onManageSubscription,
  onOpenExternalUrl,
  onOpenAppointments,
  onOpenCustomers,
  onOpenDeals,
  onOpenFunds,
  onOpenReferrals,
  onEnablePushNotifications,
  onOpenNotification,
  onPreviousCheckInsDate,
  onPreviousAppointmentsDate,
  onPreviousCustomersPage,
  onPurchasePackage,
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
  onRefreshNotifications,
  onMarkNotificationsRead,
  onRefreshReferrals,
  onRefreshReviews,
  onRefreshServices,
  onRestorePurchases,
  onSaveAiReceptionist,
  onSaveBusinessHours,
  onSaveBusinessProfile,
  onSendReviewRequest,
  onSendCustomerMessage,
  onPreviewCustomerBroadcast,
  onSendCustomerBroadcast,
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
  const subscriptionLocked = home.subscription.requiresPurchase;
  const staffViewer = home.viewer?.role === 'staff' ? home.viewer : null;
  const isStaffMode = Boolean(staffViewer);

  if (isStaffMode) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.content}>
            <MobileScheduleScreen
              accessMode="staff"
              composerCustomers={appointmentComposerCustomers}
              composerError={appointmentComposerError}
              data={appointments}
              error={appointmentsError}
              isComposerLoading={isAppointmentComposerLoading}
              isLoading={isAppointmentsLoading}
              isRefreshing={isAppointmentsRefreshing}
              notificationsError={notificationsError}
              notificationsPermissionStatus={notificationsPermissionStatus}
              servicesSummary={null}
              staffViewerName={staffViewer?.staffName}
              onCreateAppointment={onCreateAppointment}
              onCreateAppointmentCustomer={onCreateAppointmentCustomer}
              onDeleteAppointment={onDeleteAppointment}
              onJumpToToday={onJumpAppointmentsToToday}
              onLoadComposerResources={async () => undefined}
              onNextDate={onNextAppointmentsDate}
              onEnablePushNotifications={onEnablePushNotifications}
              onPreviousDate={onPreviousAppointmentsDate}
              onSelectDate={onSelectAppointmentsDate}
              onRefresh={onRefreshAppointments}
              onSignOut={onSignOut}
              onUpdateAppointment={onUpdateAppointment}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          {activeTab === 'dashboard' ? (
            <MobileHomeScreen
              error={homeError}
              isRefreshing={isHomeRefreshing}
              notificationsError={notificationsError}
              notificationsPermissionStatus={notificationsPermissionStatus}
              summary={home}
              onEnablePushNotifications={onEnablePushNotifications}
              onOpenAppointments={onOpenAppointments}
              onOpenCheckIns={() => {
                onChangeTab('more');
                onChangeMoreSection('checkins');
              }}
              onOpenCustomers={onOpenCustomers}
              onOpenDeals={onOpenDeals}
              onOpenFunds={onOpenFunds}
              onOpenReferrals={onOpenReferrals}
              onOpenBilling={() => {
                onChangeMoreSection('billing');
                onChangeTab('more');
              }}
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
              onSelectDate={onSelectAppointmentsDate}
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
              onPreviewCustomerBroadcast={onPreviewCustomerBroadcast}
              onSendCustomerBroadcast={onSendCustomerBroadcast}
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
              appStoreOffering={appStoreOffering}
              aiReceptionist={aiReceptionist}
              aiReceptionistError={aiReceptionistError}
              billing={billing}
              billingNotice={billingNotice}
              billingPurchaseError={billingPurchaseError}
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
              isBillingOfferingLoading={isBillingOfferingLoading}
              isBillingRefreshing={isBillingRefreshing}
              isManagingSubscription={isManagingSubscription}
              isBusinessHoursLoading={isBusinessHoursLoading}
              isBusinessHoursRefreshing={isBusinessHoursRefreshing}
              isBusinessHoursSaving={isBusinessHoursSaving}
              isBusinessProfileLoading={isBusinessProfileLoading}
              isDeletingAccount={isDeletingAccount}
              isCheckInsLoading={isCheckInsLoading}
              isCheckInsRefreshing={isCheckInsRefreshing}
              isCustomerViewLoading={isCustomerViewLoading}
              isCustomerViewRefreshing={isCustomerViewRefreshing}
              isFundsLoading={isFundsLoading}
              isFundsRefreshing={isFundsRefreshing}
              isNotificationsLoading={isNotificationsLoading}
              isNotificationsMarkingRead={isNotificationsMarkingRead}
              isNotificationsRefreshing={isNotificationsRefreshing}
              isPurchasingSubscription={isPurchasingSubscription}
              isReferralsLoading={isReferralsLoading}
              isReferralsRefreshing={isReferralsRefreshing}
              isRestoringSubscription={isRestoringSubscription}
              isReviewsLoading={isReviewsLoading}
              isReviewsRefreshing={isReviewsRefreshing}
              isSavingBusinessProfile={isSavingBusinessProfile}
              isServicesLoading={isServicesLoading}
              isServicesRefreshing={isServicesRefreshing}
              notifications={notifications}
              notificationsError={notificationsError}
              notificationsPermissionStatus={notificationsPermissionStatus}
              subscriptionLocked={subscriptionLocked}
              onChangeSection={onChangeMoreSection}
              onCreateCheckIn={onCreateCheckIn}
              onCreateService={onCreateService}
              onCreateServiceGroup={onCreateServiceGroup}
              onCreateStaff={onCreateStaff}
              onDeleteAccount={onDeleteAccount}
              onDeleteService={onDeleteService}
              onDeleteServiceGroup={onDeleteServiceGroup}
              onDeleteStaff={onDeleteStaff}
              onJumpCheckInsToToday={onJumpCheckInsToToday}
              onLookupCheckIn={onLookupCheckIn}
              onLookupRedeemCode={onLookupRedeemCode}
              onNextCheckInsDate={onNextCheckInsDate}
              onSelectCheckInsDate={onSelectCheckInsDate}
              onManageSubscription={onManageSubscription}
              onOpenExternalUrl={onOpenExternalUrl}
              onPreviousCheckInsDate={onPreviousCheckInsDate}
              onPurchasePackage={onPurchasePackage}
              onRedeemCode={onRedeemCode}
              onRefreshAiReceptionist={onRefreshAiReceptionist}
              onRefreshBilling={onRefreshBilling}
              onRefreshBusinessHours={onRefreshBusinessHours}
              onRefreshBusinessProfile={onRefreshBusinessProfile}
              onRefreshCheckIns={onRefreshCheckIns}
              onRefreshCustomerView={onRefreshCustomerView}
              onRefreshFunds={onRefreshFunds}
              onEnablePushNotifications={onEnablePushNotifications}
              onOpenNotification={onOpenNotification}
              onRefreshNotifications={onRefreshNotifications}
              onMarkNotificationsRead={onMarkNotificationsRead}
              onRefreshReferrals={onRefreshReferrals}
              onRefreshReviews={onRefreshReviews}
              onRefreshServices={onRefreshServices}
              onRestorePurchases={onRestorePurchases}
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
              const tabUnreadCount = tab.key === 'more' ? notifications?.unreadCount ?? 0 : 0;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: isActive,
                    disabled:
                      subscriptionLocked && tab.key !== 'dashboard' && tab.key !== 'more',
                  }}
                  onPress={() => {
                    if (tab.key === 'more') {
                      onChangeMoreSection('menu');
                    }

                    onChangeTab(tab.key);
                  }}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: isActive
                        ? theme.accentSoft
                        : subscriptionLocked && tab.key !== 'dashboard' && tab.key !== 'more'
                          ? theme.surfaceMuted
                          : 'transparent',
                      opacity:
                        subscriptionLocked && tab.key !== 'dashboard' && tab.key !== 'more'
                          ? 0.72
                          : 1,
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
                    {tabUnreadCount > 0 ? (
                      <View
                        style={[
                          styles.tabNotificationBadge,
                          { backgroundColor: theme.accent },
                        ]}
                        testID={`mobile-tab-badge-${tab.key}`}>
                        <Text style={styles.tabNotificationBadgeText}>
                          {tabUnreadCount > 9 ? '9+' : tabUnreadCount}
                        </Text>
                      </View>
                    ) : null}
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
    position: 'relative',
  },
  tabNotificationBadge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabNotificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
