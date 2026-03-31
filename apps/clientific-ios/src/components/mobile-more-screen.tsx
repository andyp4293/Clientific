import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type {
  MobileBusiness,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileReferralsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileAccountScreen } from '@/components/mobile-account-screen';
import { MobileFundsScreen } from '@/components/mobile-funds-screen';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';

export type MobileMoreSection = 'referrals' | 'funds' | 'account';

type MobileMoreScreenProps = {
  activeSection: MobileMoreSection;
  business: MobileBusiness;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  onChangeSection: (section: MobileMoreSection) => void;
  onRefreshFunds: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onShareReferral: () => Promise<void>;
  onSignOut: () => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
};

const SECTIONS: Array<{ key: MobileMoreSection; label: string }> = [
  { key: 'referrals', label: 'Referrals' },
  { key: 'funds', label: 'Funds' },
  { key: 'account', label: 'Account' },
];

export function MobileMoreScreen({
  activeSection,
  business,
  funds,
  fundsError,
  home,
  isFundsLoading,
  isFundsRefreshing,
  isReferralsLoading,
  isReferralsRefreshing,
  onChangeSection,
  onRefreshFunds,
  onRefreshReferrals,
  onShareReferral,
  onSignOut,
  referrals,
  referralsError,
}: MobileMoreScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.segmentCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.key;

          return (
            <Pressable
              key={section.key}
              accessibilityRole="button"
              onPress={() => onChangeSection(section.key)}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: isActive ? theme.accentSoft : 'transparent',
                },
              ]}
              testID={`mobile-more-${section.key}`}>
              <Text
                style={[
                  styles.segmentText,
                  { color: isActive ? theme.accent : theme.mutedText },
                ]}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {activeSection === 'referrals' ? (
          <MobileReferralsScreen
            business={business}
            data={referrals}
            error={referralsError}
            isLoading={isReferralsLoading}
            isRefreshing={isReferralsRefreshing}
            onOpenFunds={() => onChangeSection('funds')}
            onRefresh={onRefreshReferrals}
            onShare={onShareReferral}
          />
        ) : null}

        {activeSection === 'funds' ? (
          <MobileFundsScreen
            business={business}
            data={funds}
            error={fundsError}
            isLoading={isFundsLoading}
            isRefreshing={isFundsRefreshing}
            onRefresh={onRefreshFunds}
          />
        ) : null}

        {activeSection === 'account' ? (
          <MobileAccountScreen
            business={business}
            isReferralOnly={business.businessType === 'Referral Partner'}
            payoutReady={funds?.payoutReady ?? false}
            trialDaysRemaining={home.trialDaysRemaining}
            onOpenFunds={() => onChangeSection('funds')}
            onSignOut={onSignOut}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentCard: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 24,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
});
