import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  MobileBusiness,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileReferralsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileAccountScreen } from '@/components/mobile-account-screen';
import { MobileFundsScreen } from '@/components/mobile-funds-screen';
import { MobileHomeScreen } from '@/components/mobile-home-screen';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';

export type MobileAppTab = 'home' | 'referrals' | 'funds' | 'account';

type MobileAppShellProps = {
  activeTab: MobileAppTab;
  business: MobileBusiness;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  homeError: string | null;
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
  isHomeRefreshing: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  onChangeTab: (tab: MobileAppTab) => void;
  onOpenFunds: () => void;
  onOpenReferrals: () => void;
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
  { key: 'referrals', label: 'Referrals' },
  { key: 'funds', label: 'Funds' },
  { key: 'account', label: 'Account' },
];

export function MobileAppShell({
  activeTab,
  business,
  funds,
  fundsError,
  home,
  homeError,
  isFundsLoading,
  isFundsRefreshing,
  isHomeRefreshing,
  isReferralsLoading,
  isReferralsRefreshing,
  onChangeTab,
  onOpenFunds,
  onOpenReferrals,
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
              onOpenFunds={onOpenFunds}
              onOpenReferrals={onOpenReferrals}
              onRefresh={onRefreshHome}
            />
          ) : null}

          {activeTab === 'referrals' ? (
            <MobileReferralsScreen
              business={business}
              data={referrals}
              error={referralsError}
              isLoading={isReferralsLoading}
              isRefreshing={isReferralsRefreshing}
              onOpenFunds={onOpenFunds}
              onRefresh={onRefreshReferrals}
              onShare={onShareReferral}
            />
          ) : null}

          {activeTab === 'funds' ? (
            <MobileFundsScreen
              business={business}
              data={funds}
              error={fundsError}
              isLoading={isFundsLoading}
              isRefreshing={isFundsRefreshing}
              onRefresh={onRefreshFunds}
            />
          ) : null}

          {activeTab === 'account' ? (
            <MobileAccountScreen
              business={business}
              isReferralOnly={business.businessType === 'Referral Partner'}
              payoutReady={funds?.payoutReady ?? false}
              trialDaysRemaining={home.trialDaysRemaining}
              onOpenFunds={onOpenFunds}
              onSignOut={onSignOut}
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
