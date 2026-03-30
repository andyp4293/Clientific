import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import type { MobileBusiness } from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';

type MobileAccountScreenProps = {
  business: MobileBusiness;
  isReferralOnly: boolean;
  payoutReady: boolean;
  trialDaysRemaining: number | null;
  onOpenFunds: () => void;
  onSignOut: () => Promise<void>;
};

export function MobileAccountScreen({
  business,
  isReferralOnly,
  payoutReady,
  trialDaysRemaining,
  onOpenFunds,
  onSignOut,
}: MobileAccountScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      style={{ backgroundColor: theme.background }}>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Account</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>{business.name}</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          {isReferralOnly
            ? 'Referral partner mobile access keeps invite sharing and payout status close by.'
            : 'Business access keeps referrals, funds, and the daily snapshot close by.'}
        </Text>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Business details</Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Email</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{business.email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Business type</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>
            {business.businessType ?? 'Business'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Setup status</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>
            {business.onboardingComplete ? 'Business profile ready' : 'Business profile incomplete'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Payout status</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>
            {payoutReady ? 'Payouts are live' : 'Payout setup still needs attention'}
          </Text>
        </View>
        {trialDaysRemaining !== null ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.mutedText }]}>Trial</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {trialDaysRemaining} days remaining
            </Text>
          </View>
        ) : null}
      </View>

      {!payoutReady ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Funds still need review</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            Referral sharing and live payouts stay limited until Stripe setup is fully ready.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenFunds}
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            testID="mobile-account-open-funds">
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Open funds</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void onSignOut()}
        style={[styles.primaryButton, { backgroundColor: theme.accent }]}
        testID="mobile-account-signout">
        <Text style={styles.primaryButtonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  noticeTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
});
