import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type {
  MobileBusiness,
  MobileBusinessProfile,
  MobileCheckInLookupResponse,
  MobileCheckInMutationResponse,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileOnboardingInput,
  MobileReferralsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileCheckinsScreen } from '@/components/mobile-checkins-screen';
import { MobileFundsScreen } from '@/components/mobile-funds-screen';
import { MobileNavIcon, type MobileNavIconName } from '@/components/mobile-nav-icon';
import { MobileOnboardingScreen } from '@/components/mobile-onboarding-screen';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';

export type MobileMoreSection = 'menu' | 'checkins' | 'referrals' | 'payouts' | 'settings';

type MobileMoreMenuSection = 'operations' | 'growth' | 'account';

type MobileMoreMenuItem = {
  key: string;
  helper: string;
  icon: MobileNavIconName;
  label: string;
  kind: 'native' | 'web';
  section: MobileMoreMenuSection;
  target: MobileMoreSection | string;
};

type MobileMoreScreenProps = {
  activeSection: MobileMoreSection;
  business: MobileBusiness;
  businessProfile: MobileBusinessProfile | null;
  businessProfileError: string | null;
  checkIns: MobileCheckInsSummary | null;
  checkInsError: string | null;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  isBusinessProfileLoading: boolean;
  isCheckInsLoading: boolean;
  isCheckInsRefreshing: boolean;
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  isSavingBusinessProfile: boolean;
  onChangeSection: (section: MobileMoreSection) => void;
  onCreateCheckIn: (
    input: MobileCheckInSubmissionInput,
  ) => Promise<MobileCheckInMutationResponse>;
  onJumpCheckInsToToday: () => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onNextCheckInsDate: () => void;
  onOpenExternalRoute: (path: string) => Promise<void>;
  onPreviousCheckInsDate: () => void;
  onRefreshBusinessProfile: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshFunds: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onSaveBusinessProfile: (input: MobileOnboardingInput) => Promise<void>;
  onShareReferral: () => Promise<void>;
  onSignOut: () => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
};

const MENU_SECTION_LABELS: Record<MobileMoreMenuSection, string> = {
  operations: 'Operations',
  growth: 'Growth',
  account: 'Account',
};

const MENU_ITEMS: MobileMoreMenuItem[] = [
  {
    key: 'services',
    label: 'Services & Staff',
    helper: 'Update menus, staff, and booking setup.',
    icon: 'services',
    kind: 'web',
    section: 'operations',
    target: '/dashboard/services',
  },
  {
    key: 'checkins',
    label: 'Check-ins',
    helper: 'Run fast front-desk check-ins from the app.',
    icon: 'checkins',
    kind: 'native',
    section: 'operations',
    target: 'checkins',
  },
  {
    key: 'redeem',
    label: 'Redeem',
    helper: 'Redeem purchased deals and confirm claims.',
    icon: 'redeem',
    kind: 'web',
    section: 'operations',
    target: '/dashboard/redeem',
  },
  {
    key: 'business-hours',
    label: 'Business Hours & Closures',
    helper: 'Control hours, closures, and availability windows.',
    icon: 'businessHours',
    kind: 'web',
    section: 'operations',
    target: '/dashboard/business-hours',
  },
  {
    key: 'ai-receptionist',
    label: 'AI Receptionist',
    helper: 'Manage phone coverage and AI call settings.',
    icon: 'aiReceptionist',
    kind: 'web',
    section: 'operations',
    target: '/dashboard/ai-receptionist',
  },
  {
    key: 'preview',
    label: 'Customer View',
    helper: 'Preview what guests see before you share links.',
    icon: 'customerView',
    kind: 'web',
    section: 'operations',
    target: '/dashboard/preview',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    helper: 'Share your survey flow and review prompts.',
    icon: 'reviews',
    kind: 'web',
    section: 'growth',
    target: '/dashboard/reviews',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    helper: 'Check performance, trends, and conversion signals.',
    icon: 'analytics',
    kind: 'web',
    section: 'growth',
    target: '/dashboard/analytics',
  },
  {
    key: 'referrals',
    label: 'Refer & Earn',
    helper: 'Track credits, referrals, and your share link.',
    icon: 'referrals',
    kind: 'native',
    section: 'growth',
    target: 'referrals',
  },
  {
    key: 'payouts',
    label: 'Payouts',
    helper: 'See balance, requirements, and recent transfers.',
    icon: 'payouts',
    kind: 'native',
    section: 'growth',
    target: 'payouts',
  },
  {
    key: 'billing',
    label: 'Billing',
    helper: 'Manage plan access and subscription details.',
    icon: 'billing',
    kind: 'web',
    section: 'account',
    target: '/dashboard/settings/billing',
  },
  {
    key: 'settings',
    label: 'Settings',
    helper: 'Update business profile and app-level details.',
    icon: 'settings',
    kind: 'native',
    section: 'account',
    target: 'settings',
  },
];

export function MobileMoreScreen({
  activeSection,
  business,
  businessProfile,
  businessProfileError,
  checkIns,
  checkInsError,
  funds,
  fundsError,
  home,
  isBusinessProfileLoading,
  isCheckInsLoading,
  isCheckInsRefreshing,
  isFundsLoading,
  isFundsRefreshing,
  isReferralsLoading,
  isReferralsRefreshing,
  isSavingBusinessProfile,
  onChangeSection,
  onCreateCheckIn,
  onJumpCheckInsToToday,
  onLookupCheckIn,
  onNextCheckInsDate,
  onOpenExternalRoute,
  onPreviousCheckInsDate,
  onRefreshBusinessProfile,
  onRefreshCheckIns,
  onRefreshFunds,
  onRefreshReferrals,
  onSaveBusinessProfile,
  onShareReferral,
  onSignOut,
  referrals,
  referralsError,
}: MobileMoreScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

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
            Open the rest of the business tools from the same grouped menu you see in the web app.
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

        {(['operations', 'growth', 'account'] as MobileMoreMenuSection[]).map((section) => (
          <View key={section} style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
              {MENU_SECTION_LABELS[section]}
            </Text>
            <View style={styles.sectionItems}>
              {MENU_ITEMS.filter((item) => item.section === section).map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  onPress={() => {
                    if (item.kind === 'native') {
                      onChangeSection(item.target as MobileMoreSection);
                      return;
                    }

                    void onOpenExternalRoute(item.target as string);
                  }}
                  style={[
                    styles.menuItem,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  testID={`mobile-more-menu-${item.key}`}>
                  <View
                    style={[
                      styles.menuIconBadge,
                      {
                        backgroundColor:
                          item.kind === 'native' ? theme.accentSoft : theme.surfaceMuted,
                      },
                    ]}>
                    <MobileNavIcon
                      color={item.kind === 'native' ? theme.accent : theme.text}
                      name={item.icon}
                      size={18}
                    />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={[styles.menuTitle, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.menuHelper, { color: theme.mutedText }]}>
                      {item.helper}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.menuPill,
                      {
                        backgroundColor:
                          item.kind === 'native' ? theme.accentSoft : theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.menuPillText,
                        { color: item.kind === 'native' ? theme.accent : theme.text },
                      ]}>
                      {item.kind === 'native' ? 'App' : 'Web'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => void onSignOut()}
          style={[styles.signOutButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
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

        {activeSection === 'settings' ? (
          isBusinessProfileLoading || !businessProfile ? (
            <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
              isSaving={isSavingBusinessProfile}
              onBack={() => onChangeSection('menu')}
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
    case 'checkins':
      return 'Check-ins';
    case 'referrals':
      return 'Refer & Earn';
    case 'payouts':
      return 'Payouts';
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
  menuPill: {
    minWidth: 48,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  menuPillText: {
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
    alignItems: 'center',
    gap: 10,
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
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loadingButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
});
