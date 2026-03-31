import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type {
  MobileBusiness,
  MobileCheckInLookupResponse,
  MobileCheckInMutationResponse,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileReferralsSummary,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileAccountScreen } from '@/components/mobile-account-screen';
import { MobileCheckinsScreen } from '@/components/mobile-checkins-screen';
import { MobileFundsScreen } from '@/components/mobile-funds-screen';
import { MobileNavIcon, type MobileNavIconName } from '@/components/mobile-nav-icon';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';

export type MobileMoreSection = 'checkins' | 'referrals' | 'funds' | 'account';

type MobileMoreScreenProps = {
  activeSection: MobileMoreSection;
  business: MobileBusiness;
  checkIns: MobileCheckInsSummary | null;
  checkInsError: string | null;
  funds: MobileFundsSummary | null;
  fundsError: string | null;
  home: MobileHomeSummary;
  isCheckInsLoading: boolean;
  isCheckInsRefreshing: boolean;
  isFundsLoading: boolean;
  isFundsRefreshing: boolean;
  isReferralsLoading: boolean;
  isReferralsRefreshing: boolean;
  onChangeSection: (section: MobileMoreSection) => void;
  onCreateCheckIn: (
    input: MobileCheckInSubmissionInput,
  ) => Promise<MobileCheckInMutationResponse>;
  onJumpCheckInsToToday: () => void;
  onLookupCheckIn: (phone: string) => Promise<MobileCheckInLookupResponse>;
  onNextCheckInsDate: () => void;
  onRefreshFunds: () => Promise<void>;
  onRefreshCheckIns: () => Promise<void>;
  onRefreshReferrals: () => Promise<void>;
  onPreviousCheckInsDate: () => void;
  onShareReferral: () => Promise<void>;
  onSignOut: () => Promise<void>;
  referrals: MobileReferralsSummary | null;
  referralsError: string | null;
};

const SECTIONS: Array<{ key: MobileMoreSection; label: string; icon: MobileNavIconName }> = [
  { key: 'checkins', label: 'Check-ins', icon: 'checkins' },
  { key: 'referrals', label: 'Referrals', icon: 'referrals' },
  { key: 'funds', label: 'Funds', icon: 'funds' },
  { key: 'account', label: 'Account', icon: 'account' },
];

export function MobileMoreScreen({
  activeSection,
  business,
  checkIns,
  checkInsError,
  funds,
  fundsError,
  home,
  isCheckInsLoading,
  isCheckInsRefreshing,
  isFundsLoading,
  isFundsRefreshing,
  isReferralsLoading,
  isReferralsRefreshing,
  onChangeSection,
  onCreateCheckIn,
  onJumpCheckInsToToday,
  onLookupCheckIn,
  onNextCheckInsDate,
  onPreviousCheckInsDate,
  onRefreshFunds,
  onRefreshCheckIns,
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
      <ScrollView
        horizontal
        contentContainerStyle={styles.segmentScroller}
        showsHorizontalScrollIndicator={false}
        style={styles.segmentScroll}>
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
                  backgroundColor: isActive ? theme.accentSoft : theme.surface,
                  borderColor: isActive ? theme.accentSoft : theme.border,
                },
              ]}
              testID={`mobile-more-${section.key}`}>
              <MobileNavIcon
                color={isActive ? theme.accent : theme.mutedText}
                name={section.icon}
                size={16}
              />
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
      </ScrollView>

      <View style={styles.content}>
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
  segmentScroll: {
    flexGrow: 0,
    marginTop: 18,
    marginBottom: 6,
  },
  segmentScroller: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 8,
    flexDirection: 'row',
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
