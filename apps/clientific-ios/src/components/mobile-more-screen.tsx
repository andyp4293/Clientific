import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import type {
  MobileAiReceptionistSummary,
  MobileAiReceptionistUpdateInput,
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
import { MobileAiReceptionistScreen } from '@/components/mobile-ai-receptionist-screen';
import { MobileBillingScreen } from '@/components/mobile-billing-screen';
import { MobileBusinessHoursScreen } from '@/components/mobile-business-hours-screen';
import { MobileCheckinsScreen } from '@/components/mobile-checkins-screen';
import { MobileCustomerViewScreen } from '@/components/mobile-customer-view-screen';
import { MobileFundsScreen } from '@/components/mobile-funds-screen';
import { MobileNotificationsScreen } from '@/components/mobile-notifications-screen';
import { MobileNavIcon, type MobileNavIconName } from '@/components/mobile-nav-icon';
import { MobileOnboardingScreen } from '@/components/mobile-onboarding-screen';
import { MobileRedeemScreen } from '@/components/mobile-redeem-screen';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';
import { MobileReviewsScreen } from '@/components/mobile-reviews-screen';
import { MobileServicesScreen } from '@/components/mobile-services-screen';
import {
  APP_PRIVACY_URL,
  APP_SUPPORT_EMAIL,
  APP_SUPPORT_URL,
  APP_TERMS_URL,
} from '@/lib/clientific-brand';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import {
  type ClientificThemePreference,
  useClientificThemePreference,
} from '@/lib/clientific-theme-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type MobileMoreSection =
  | 'menu'
  | 'services'
  | 'checkins'
  | 'redeem'
  | 'hours'
  | 'aiReceptionist'
  | 'notifications'
  | 'customerView'
  | 'reviews'
  | 'referrals'
  | 'payouts'
  | 'billing'
  | 'settings';

type MobileMoreMenuSection = 'operations' | 'growth' | 'account';

type MobileMoreMenuItem = {
  key: string;
  helper: string;
  icon: MobileNavIconName;
  label: string;
  section: MobileMoreMenuSection;
  target: MobileMoreSection;
};

function getNotificationsMenuCopy(
  status: MobilePushPermissionStatus,
  unreadCount: number,
) {
  if (status === 'granted') {
    return unreadCount
      ? `${unreadCount} unread alerts are waiting on this phone.`
      : 'Push alerts are on for this phone and ready for new appointments.';
  }

  if (status === 'denied') {
    return 'Push alerts are off on this phone. Open notification settings to turn them back on.';
  }

  return 'Finish notification setup so owners get a pop-up when someone books.';
}

type MobileMoreScreenProps = {
  activeSection: MobileMoreSection;
  appStoreOffering: PurchasesOffering | null;
  aiReceptionist: MobileAiReceptionistSummary | null;
  aiReceptionistError: string | null;
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
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  isAiReceptionistLoading: boolean;
  isAiReceptionistRefreshing: boolean;
  isAiReceptionistSaving: boolean;
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
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
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
  notifications: MobileNotificationsSummary | null;
  notificationsError: string | null;
  notificationsPermissionStatus: MobilePushPermissionStatus;
  subscriptionLocked: boolean;
  billingNotice: string | null;
  billingPurchaseError: string | null;
  onChangeSection: (section: MobileMoreSection) => void;
  onCreateCheckIn: (
    input: MobileCheckInSubmissionInput,
  ) => Promise<MobileCheckInMutationResponse>;
  onCreateServiceGroup: (input: MobileServiceGroupInput) => Promise<void>;
  onCreateService: (input: MobileServiceInput) => Promise<void>;
  onCreateStaff: (input: MobileStaffInput) => Promise<void>;
  onDeleteServiceGroup: (groupId: string) => Promise<void>;
  onDeleteService: (serviceId: string) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onJumpCheckInsToToday: () => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onLookupRedeemCode: (code: string) => Promise<MobileRedeemLookupResponse>;
  onNextCheckInsDate: () => void;
  onOpenExternalUrl: (url: string) => Promise<void>;
  onManageSubscription: () => Promise<void>;
  onPreviousCheckInsDate: () => void;
  onPurchasePackage: (aPackage: PurchasesPackage) => Promise<void>;
  onRedeemCode: (input: {
    code: string;
    transactionAmount?: number | null;
  }) => Promise<MobileRedeemResult>;
  onRefreshAiReceptionist: () => Promise<void>;
  onRefreshBilling: () => Promise<void>;
  onRefreshBusinessHours: () => Promise<void>;
  onRefreshBusinessProfile: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshCustomerView: () => Promise<void>;
  onRefreshFunds: () => Promise<void>;
  onEnablePushNotifications: () => Promise<void>;
  onOpenNotification: (notificationId: string) => Promise<void>;
  onRefreshNotifications: () => Promise<void>;
  onMarkNotificationsRead: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onRefreshReviews: () => Promise<void>;
  onRefreshServices: () => Promise<void>;
  onRestorePurchases: () => Promise<void>;
  onSaveAiReceptionist: (input: MobileAiReceptionistUpdateInput) => Promise<void>;
  onSaveBusinessHours: (input: MobileBusinessHoursUpdateInput) => Promise<void>;
  onSaveBusinessProfile: (input: MobileOnboardingInput) => Promise<void>;
  onShareCustomerViewLink: (label: string, url: string) => Promise<void>;
  onShareReferral: () => Promise<void>;
  onShareReviewSurvey: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onReorderServiceGroups: (ids: string[]) => Promise<void>;
  onReorderServices: (ids: string[]) => Promise<void>;
  onUpdateServiceGroup: (
    groupId: string,
    input: MobileServiceGroupInput,
  ) => Promise<void>;
  onUpdateService: (serviceId: string, input: MobileServiceInput) => Promise<void>;
  onUpdateStaff: (staffId: string, input: MobileStaffInput) => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
  reviews: MobileReviewsSummary | null;
  reviewsError: string | null;
  services: MobileServicesSummary | null;
  servicesError: string | null;
};

const MENU_SECTION_LABELS: Record<MobileMoreMenuSection, string> = {
  operations: 'Operations',
  growth: 'Growth',
  account: 'Account',
};

const THEME_OPTIONS: Array<{
  description: string;
  label: string;
  value: ClientificThemePreference;
}> = [
  {
    label: 'System',
    value: 'system',
    description: 'Follow the iPhone appearance automatically.',
  },
  {
    label: 'Light',
    value: 'light',
    description: 'Keep the app bright all the time.',
  },
  {
    label: 'Dark',
    value: 'dark',
    description: 'Use the darker app theme all the time.',
  },
];

const MENU_ITEMS: MobileMoreMenuItem[] = [
  {
    key: 'services',
    label: 'Services & Staff',
    helper: 'Review the live menu, pricing, and staff setup.',
    icon: 'services',
    section: 'operations',
    target: 'services',
  },
  {
    key: 'checkins',
    label: 'Check-ins',
    helper: 'Run fast front-desk check-ins from the app.',
    icon: 'checkins',
    section: 'operations',
    target: 'checkins',
  },
  {
    key: 'redeem',
    label: 'Redeem',
    helper: 'Redeem purchased deals and confirm claims.',
    icon: 'redeem',
    section: 'operations',
    target: 'redeem',
  },
  {
    key: 'business-hours',
    label: 'Business Hours & Closures',
    helper: 'Control hours, closures, and availability windows.',
    icon: 'businessHours',
    section: 'operations',
    target: 'hours',
  },
  {
    key: 'ai-receptionist',
    label: 'AI Receptionist',
    helper: 'Manage phone coverage and AI call settings.',
    icon: 'aiReceptionist',
    section: 'operations',
    target: 'aiReceptionist',
  },
  {
    key: 'notifications',
    label: 'Notifications & Alerts',
    helper: 'Review owner alerts and manage push notifications on this phone.',
    icon: 'notifications',
    section: 'account',
    target: 'notifications',
  },
  {
    key: 'preview',
    label: 'Customer View',
    helper: 'Preview what guests see before you share links.',
    icon: 'customerView',
    section: 'operations',
    target: 'customerView',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    helper: 'Share your survey flow and review prompts.',
    icon: 'reviews',
    section: 'growth',
    target: 'reviews',
  },
  {
    key: 'referrals',
    label: 'Refer & Earn',
    helper: 'Track credits, referrals, and your share link.',
    icon: 'referrals',
    section: 'growth',
    target: 'referrals',
  },
  {
    key: 'payouts',
    label: 'Payouts',
    helper: 'See balance, requirements, and recent transfers.',
    icon: 'payouts',
    section: 'growth',
    target: 'payouts',
  },
  {
    key: 'billing',
    label: 'Billing',
    helper: 'Review plan access, billing source, and invoices.',
    icon: 'billing',
    section: 'account',
    target: 'billing',
  },
  {
    key: 'settings',
    label: 'Settings',
    helper: 'Update business profile and app-level details.',
    icon: 'settings',
    section: 'account',
    target: 'settings',
  },
];

export function MobileMoreScreen({
  activeSection,
  appStoreOffering,
  aiReceptionist,
  aiReceptionistError,
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
  funds,
  fundsError,
  home,
  isAiReceptionistLoading,
  isAiReceptionistRefreshing,
  isAiReceptionistSaving,
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
  isFundsLoading,
  isFundsRefreshing,
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
  notifications,
  notificationsError,
  notificationsPermissionStatus,
  subscriptionLocked,
  billingNotice,
  billingPurchaseError,
  onChangeSection,
  onCreateCheckIn,
  onCreateServiceGroup,
  onCreateService,
  onCreateStaff,
  onDeleteServiceGroup,
  onDeleteService,
  onDeleteStaff,
  onDeleteAccount,
  onJumpCheckInsToToday,
  onLookupCheckIn,
  onLookupRedeemCode,
  onNextCheckInsDate,
  onOpenExternalUrl,
  onManageSubscription,
  onPreviousCheckInsDate,
  onPurchasePackage,
  onRedeemCode,
  onRefreshAiReceptionist,
  onRefreshBilling,
  onRefreshBusinessHours,
  onRefreshBusinessProfile,
  onRefreshCheckIns,
  onRefreshCustomerView,
  onRefreshFunds,
  onEnablePushNotifications,
  onOpenNotification,
  onRefreshNotifications,
  onMarkNotificationsRead,
  onRefreshReferrals,
  onRefreshReviews,
  onRefreshServices,
  onRestorePurchases,
  onSaveAiReceptionist,
  onSaveBusinessHours,
  onSaveBusinessProfile,
  onShareCustomerViewLink,
  onShareReferral,
  onShareReviewSurvey,
  onSignOut,
  onReorderServiceGroups,
  onReorderServices,
  onUpdateServiceGroup,
  onUpdateService,
  onUpdateStaff,
  referrals,
  referralsError,
  reviews,
  reviewsError,
  services,
  servicesError,
}: MobileMoreScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const { themePreference, setThemePreference } = useClientificThemePreference();
  const notificationsMenuCopy = getNotificationsMenuCopy(
    notificationsPermissionStatus,
    notifications?.unreadCount ?? 0,
  );
  const lockedTargets = new Set<MobileMoreSection>([
    'services',
    'checkins',
    'redeem',
    'hours',
    'aiReceptionist',
    'customerView',
    'reviews',
    'referrals',
    'payouts',
  ]);

  if (activeSection === 'menu') {
    return (
      <ScrollView
        contentContainerStyle={[styles.menuContainer, { backgroundColor: theme.background }]}
        style={{ backgroundColor: theme.background }}>
        <View
          style={[
            styles.accountCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Text style={[styles.accountEyebrow, { color: theme.accent }]}>More</Text>
          <Text style={[styles.accountTitle, { color: theme.text }]}>{business.name}</Text>
          <Text style={[styles.accountSubtitle, { color: theme.mutedText }]}>
            Open the rest of your business tools from one place.
          </Text>
          <View style={styles.accountMetaRow}>
            <View
              style={[
                styles.accountMetaBadge,
                { backgroundColor: theme.accentSoft, borderColor: theme.border },
              ]}>
              <Text style={[styles.accountMetaText, { color: theme.accent }]}>
                {business.businessType ?? 'Business'}
              </Text>
            </View>
            {home.trialDaysRemaining !== null ? (
              <View
                style={[
                  styles.accountMetaBadge,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.accountMetaText, { color: theme.text }]}>
                  {home.trialDaysRemaining} days left
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {subscriptionLocked ? (
          <View
            style={[
              styles.lockedNoticeCard,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
            testID="mobile-more-subscription-locked">
            <Text style={[styles.lockedNoticeTitle, { color: theme.text }]}>
              Finish billing setup first
            </Text>
            <Text style={[styles.lockedNoticeText, { color: theme.mutedText }]}>
              Billing is the only unlocked area right now. Start the 14-day App Store trial there to unlock booking, CRM, reminders, analytics, deals, referrals, and secure payouts. Pro and Premium also add AI receptionist phone coverage.
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => onChangeSection('notifications')}
          style={[
            styles.notificationsCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          testID="mobile-more-notification-settings-card">
          <View style={styles.notificationsCardHeader}>
            <View
              style={[
                styles.notificationsIconBadge,
                { backgroundColor: theme.accentSoft, borderColor: theme.border },
              ]}>
              <MobileNavIcon color={theme.accent} name="notifications" size={18} />
            </View>
            <View style={styles.notificationsCardCopy}>
              <Text style={[styles.notificationsCardEyebrow, { color: theme.accent }]}>
                Alerts
              </Text>
              <Text style={[styles.notificationsCardTitle, { color: theme.text }]}>
                Notification settings
              </Text>
              <Text style={[styles.notificationsCardText, { color: theme.mutedText }]}>
                {notificationsMenuCopy}
              </Text>
            </View>
            {notifications?.unreadCount ? (
              <View
                style={[
                  styles.unreadPill,
                  { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}>
                <Text style={styles.unreadPillText}>
                  {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
                </Text>
              </View>
            ) : (
              <MobileNavIcon color={theme.mutedText} name="more" size={18} />
            )}
          </View>
        </Pressable>

        <View
          style={[
            styles.appearanceCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          testID="mobile-more-appearance-card">
          <Text style={[styles.appearanceEyebrow, { color: theme.accent }]}>Appearance</Text>
          <Text style={[styles.appearanceTitle, { color: theme.text }]}>Theme mode</Text>
          <Text style={[styles.appearanceSubtitle, { color: theme.mutedText }]}>
            Match the web app with light, dark, or automatic system mode.
          </Text>
          <View style={styles.appearanceOptions}>
            {THEME_OPTIONS.map((option) => {
              const isSelected = themePreference === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => void setThemePreference(option.value)}
                  style={[
                    styles.appearanceOption,
                    {
                      backgroundColor: isSelected ? theme.accentSoft : theme.surfaceMuted,
                      borderColor: isSelected ? theme.accent : theme.border,
                    },
                  ]}
                  testID={`mobile-theme-option-${option.value}`}>
                  <View style={styles.appearanceOptionHeader}>
                    <Text
                      style={[
                        styles.appearanceOptionLabel,
                        { color: isSelected ? theme.accent : theme.text },
                      ]}>
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <View
                        style={[
                          styles.appearanceOptionBadge,
                          { backgroundColor: theme.accent },
                        ]}>
                        <Text style={styles.appearanceOptionBadgeText}>Active</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.appearanceOptionDescription, { color: theme.mutedText }]}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {(['operations', 'growth', 'account'] as MobileMoreMenuSection[]).map((section) => (
          <View key={section} style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
              {MENU_SECTION_LABELS[section]}
            </Text>
            <View style={styles.sectionItems}>
              {MENU_ITEMS.filter((item) => item.section === section).map((item) => {
                const isLocked = subscriptionLocked && lockedTargets.has(item.target);

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isLocked }}
                    onPress={() => onChangeSection(item.target)}
                    style={[
                      styles.menuItem,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: isLocked ? 0.65 : 1,
                      },
                    ]}
                    testID={`mobile-more-menu-${item.key}`}>
                    <View
                      style={[
                        styles.menuIconBadge,
                        { backgroundColor: theme.accentSoft },
                      ]}>
                      <MobileNavIcon color={theme.accent} name={item.icon} size={18} />
                    </View>
                    <View style={styles.menuCopy}>
                      <Text style={[styles.menuTitle, { color: theme.text }]}>{item.label}</Text>
                      <Text style={[styles.menuHelper, { color: theme.mutedText }]}>
                        {item.target === 'notifications'
                          ? notificationsMenuCopy
                          : isLocked
                            ? 'Unlock this in Billing first.'
                            : item.helper}
                      </Text>
                    </View>
                    {item.target === 'notifications' && notifications?.unreadCount ? (
                      <View
                        style={[
                          styles.unreadPill,
                          { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}>
                        <Text style={styles.unreadPillText}>
                          {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
                        </Text>
                      </View>
                    ) : isLocked ? (
                      <View
                        style={[
                          styles.lockedPill,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        ]}>
                        <Text style={[styles.lockedPillText, { color: theme.text }]}>
                          Locked
                        </Text>
                      </View>
                    ) : (
                      <MobileNavIcon color={theme.mutedText} name="more" size={18} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>Legal & Support</Text>
          <View style={styles.sectionItems}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void onOpenExternalUrl(APP_PRIVACY_URL)}
              style={[
                styles.menuItem,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              testID="mobile-more-privacy-policy">
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: theme.accentSoft },
                ]}>
                <MobileNavIcon color={theme.accent} name="legal" size={18} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuTitle, { color: theme.text }]}>Privacy Policy</Text>
                <Text style={[styles.menuHelper, { color: theme.mutedText }]}>
                  Review how Clientific handles business, customer, and mobile app data.
                </Text>
              </View>
              <MobileNavIcon color={theme.mutedText} name="more" size={18} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void onOpenExternalUrl(APP_TERMS_URL)}
              style={[
                styles.menuItem,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              testID="mobile-more-terms-of-service">
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: theme.accentSoft },
                ]}>
                <MobileNavIcon color={theme.accent} name="legal" size={18} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuTitle, { color: theme.text }]}>Terms of Service</Text>
                <Text style={[styles.menuHelper, { color: theme.mutedText }]}>
                  Read the current service terms for the web platform and iPhone app.
                </Text>
              </View>
              <MobileNavIcon color={theme.mutedText} name="more" size={18} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void onOpenExternalUrl(APP_SUPPORT_URL)}
              style={[
                styles.menuItem,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              testID="mobile-more-support">
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: theme.accentSoft },
                ]}>
                <MobileNavIcon color={theme.accent} name="support" size={18} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuTitle, { color: theme.text }]}>Support</Text>
                <Text style={[styles.menuHelper, { color: theme.mutedText }]}>
                  Open the support page or contact {APP_SUPPORT_EMAIL} if you need help.
                </Text>
              </View>
              <MobileNavIcon color={theme.mutedText} name="more" size={18} />
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void onSignOut()}
          style={[
            styles.signOutButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          testID="mobile-more-signout">
          <Text style={[styles.signOutText, { color: theme.danger }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.subscreenContainer, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.subscreenHeader,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChangeSection('menu')}
          style={[
            styles.backButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          testID="mobile-more-back">
          <Text style={[styles.backButtonText, { color: theme.text }]}>Back</Text>
        </Pressable>
        <Text style={[styles.subscreenTitle, { color: theme.text }]}>
          {getSubscreenTitle(activeSection)}
        </Text>
      </View>

      <View style={styles.subscreenBody}>
        {activeSection === 'services' ? (
          <MobileServicesScreen
            data={services}
            error={servicesError}
            isLoading={isServicesLoading}
            isRefreshing={isServicesRefreshing}
            onCreateServiceGroup={onCreateServiceGroup}
            onCreateService={onCreateService}
            onCreateStaff={onCreateStaff}
            onDeleteServiceGroup={onDeleteServiceGroup}
            onDeleteService={onDeleteService}
            onDeleteStaff={onDeleteStaff}
            onRefresh={onRefreshServices}
            onReorderServiceGroups={onReorderServiceGroups}
            onReorderServices={onReorderServices}
            onUpdateServiceGroup={onUpdateServiceGroup}
            onUpdateService={onUpdateService}
            onUpdateStaff={onUpdateStaff}
          />
        ) : null}

        {activeSection === 'checkins' ? (
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

        {activeSection === 'redeem' ? (
          <MobileRedeemScreen onLookup={onLookupRedeemCode} onRedeem={onRedeemCode} />
        ) : null}

        {activeSection === 'hours' ? (
          <MobileBusinessHoursScreen
            data={businessHours}
            error={businessHoursError}
            isLoading={isBusinessHoursLoading}
            isRefreshing={isBusinessHoursRefreshing}
            isSaving={isBusinessHoursSaving}
            onRefresh={onRefreshBusinessHours}
            onSave={onSaveBusinessHours}
          />
        ) : null}

        {activeSection === 'aiReceptionist' ? (
          <MobileAiReceptionistScreen
            data={aiReceptionist}
            error={aiReceptionistError}
            isLoading={isAiReceptionistLoading}
            isRefreshing={isAiReceptionistRefreshing}
            isSaving={isAiReceptionistSaving}
            onRefresh={onRefreshAiReceptionist}
            onSave={onSaveAiReceptionist}
          />
        ) : null}

        {activeSection === 'notifications' ? (
          <MobileNotificationsScreen
            data={notifications}
            error={notificationsError}
            isLoading={isNotificationsLoading}
            isMarkingRead={isNotificationsMarkingRead}
            isRefreshing={isNotificationsRefreshing}
            permissionStatus={notificationsPermissionStatus}
            onEnablePush={onEnablePushNotifications}
            onMarkAllRead={onMarkNotificationsRead}
            onOpenNotification={async (notification) => {
              await onOpenNotification(notification.id);
            }}
            onRefresh={onRefreshNotifications}
          />
        ) : null}

        {activeSection === 'customerView' ? (
          <MobileCustomerViewScreen
            data={customerView}
            error={customerViewError}
            isLoading={isCustomerViewLoading}
            isRefreshing={isCustomerViewRefreshing}
            onOpenUrl={onOpenExternalUrl}
            onRefresh={onRefreshCustomerView}
            onShareLink={onShareCustomerViewLink}
          />
        ) : null}

        {activeSection === 'reviews' ? (
          <MobileReviewsScreen
            data={reviews}
            error={reviewsError}
            isLoading={isReviewsLoading}
            isRefreshing={isReviewsRefreshing}
            onOpenUrl={onOpenExternalUrl}
            onRefresh={onRefreshReviews}
            onShareSurvey={onShareReviewSurvey}
          />
        ) : null}

        {activeSection === 'referrals' ? (
          <MobileReferralsScreen
            business={business}
            data={referrals}
            error={referralsError}
            isLoading={isReferralsLoading}
            isRefreshing={isReferralsRefreshing}
            onOpenFunds={() => onChangeSection('payouts')}
            onRefresh={onRefreshReferrals}
            onShare={onShareReferral}
          />
        ) : null}

        {activeSection === 'payouts' ? (
          <MobileFundsScreen
            business={business}
            data={funds}
            error={fundsError}
            isLoading={isFundsLoading}
            isRefreshing={isFundsRefreshing}
            onRefresh={onRefreshFunds}
          />
        ) : null}

        {activeSection === 'billing' ? (
          <MobileBillingScreen
            appStoreOffering={appStoreOffering}
            data={billing}
            error={billingError}
            isLoading={isBillingLoading}
            isLoadingOffering={isBillingOfferingLoading}
            isManagingSubscription={isManagingSubscription}
            isPurchasingSubscription={isPurchasingSubscription}
            isRefreshing={isBillingRefreshing}
            isRestoringSubscription={isRestoringSubscription}
            notice={billingNotice}
            onManageSubscription={onManageSubscription}
            onOpenUrl={onOpenExternalUrl}
            onPurchasePackage={onPurchasePackage}
            onRefresh={onRefreshBilling}
            onRestorePurchases={onRestorePurchases}
            purchaseError={billingPurchaseError}
          />
        ) : null}

        {activeSection === 'settings' ? (
          isBusinessProfileLoading || !businessProfile ? (
            <View
              style={[
                styles.loadingCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.loadingTitle, { color: theme.text }]}>Loading settings</Text>
              <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                Pulling in the business profile details you can edit on mobile.
              </Text>
              {businessProfileError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void onRefreshBusinessProfile()}
                  style={[styles.loadingButton, { backgroundColor: theme.accent }]}
                  testID="mobile-more-settings-retry">
                  <Text style={styles.loadingButtonText}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <MobileOnboardingScreen
              context="settings"
              error={businessProfileError}
              isDeletingAccount={isDeletingAccount}
              isSaving={isSavingBusinessProfile}
              onBack={() => onChangeSection('menu')}
              onDeleteAccount={onDeleteAccount}
              profile={businessProfile}
              onSignOut={onSignOut}
              onSubmit={onSaveBusinessProfile}
            />
          )
        ) : null}
      </View>
    </View>
  );
}

function getSubscreenTitle(section: Exclude<MobileMoreSection, 'menu'>) {
  switch (section) {
    case 'services':
      return 'Services & Staff';
    case 'checkins':
      return 'Check-ins';
    case 'redeem':
      return 'Redeem';
    case 'hours':
      return 'Business Hours';
    case 'aiReceptionist':
      return 'AI Receptionist';
    case 'notifications':
      return 'Notifications & Alerts';
    case 'customerView':
      return 'Customer View';
    case 'reviews':
      return 'Reviews';
    case 'referrals':
      return 'Refer & Earn';
    case 'payouts':
      return 'Payouts';
    case 'billing':
      return 'Billing';
    case 'settings':
      return 'Settings';
    default:
      return 'More';
  }
}

const styles = StyleSheet.create({
  menuContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 18,
  },
  accountCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
  },
  appearanceCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  notificationsCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  notificationsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  notificationsIconBadge: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsCardCopy: {
    flex: 1,
    gap: 3,
  },
  notificationsCardEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  notificationsCardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  notificationsCardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  appearanceEyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  appearanceTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  appearanceSubtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  appearanceOptions: {
    gap: 10,
  },
  appearanceOption: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  appearanceOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  appearanceOptionLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  appearanceOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  appearanceOptionBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  appearanceOptionBadgeText: {
    color: '#f8fffc',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  accountEyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  accountTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  accountSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  accountMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 4,
  },
  accountMetaBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  accountMetaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  lockedNoticeCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  lockedNoticeTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  lockedNoticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  sectionItems: {
    gap: 10,
  },
  menuItem: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: {
    flex: 1,
    gap: 3,
  },
  menuTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  menuHelper: {
    fontSize: 13,
    lineHeight: 18,
  },
  lockedPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lockedPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  unreadPill: {
    minWidth: 32,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signOutButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  subscreenContainer: {
    flex: 1,
  },
  subscreenHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  backButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  subscreenTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  subscreenBody: {
    flex: 1,
  },
  loadingCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 10,
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  loadingButton: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
  },
  loadingButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
});
