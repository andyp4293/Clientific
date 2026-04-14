import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  MobileRedeemLookupResponse,
  MobileRedeemResult,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileRedeemScreenProps = {
  onLookup: (code: string) => Promise<MobileRedeemLookupResponse>;
  onRedeem: (input: { code: string; transactionAmount?: number | null }) => Promise<MobileRedeemResult>;
};

export function MobileRedeemScreen({
  onLookup,
  onRedeem,
}: MobileRedeemScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [state, setState] = useState<'idle' | 'preview' | 'success'>('idle');
  const [code, setCode] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<MobileRedeemLookupResponse | null>(null);
  const [successResult, setSuccessResult] = useState<MobileRedeemResult | null>(null);

  function reset() {
    setState('idle');
    setCode('');
    setTransactionAmount('');
    setError(null);
    setLookupResult(null);
    setSuccessResult(null);
  }

  async function handleLookup() {
    if (!code.trim()) {
      setError('Enter a redemption code first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextLookup = await onLookup(code.trim().toUpperCase());
      setLookupResult(nextLookup);
      setState('preview');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to look up that code.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRedeem() {
    if (!lookupResult) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amount =
        transactionAmount.trim().length > 0 ? Number.parseFloat(transactionAmount) : null;
      const result = await onRedeem({
        code: code.trim().toUpperCase(),
        transactionAmount: Number.isFinite(amount ?? NaN) ? amount : null,
      });
      setSuccessResult(result);
      setState('success');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Unable to redeem that code.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      style={{ backgroundColor: theme.background }}>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>Redeem</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Confirm a deal</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Look up a redemption code, review the offer, and confirm it from the front desk flow.
        </Text>
      </View>

      {state === 'idle' ? (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Redemption code</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={(value) => setCode(value.toUpperCase())}
            placeholder="AB3DEF7G"
            placeholderTextColor={theme.mutedText}
            style={[
              styles.codeInput,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text },
            ]}
            testID="mobile-redeem-code"
            value={code}
          />
          {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => void handleLookup()}
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-redeem-lookup">
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Looking up...' : 'Look up code'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {state === 'preview' && lookupResult ? (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {lookupResult.deal.title}
          </Text>
          <Text style={[styles.metaText, { color: theme.mutedText }]}>
            {lookupResult.deal.discountLabel}
          </Text>
          <Text style={[styles.metaText, { color: theme.mutedText }]}>
            {lookupResult.customer
              ? `${lookupResult.customer.name} · ${lookupResult.customer.phoneDisplay}`
              : 'No customer attached'}
          </Text>

          {lookupResult.alreadyUsed ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              This code has already been redeemed.
            </Text>
          ) : (
            <>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="decimal-pad"
                onChangeText={setTransactionAmount}
                placeholder="Sale amount (optional)"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                testID="mobile-redeem-amount"
                value={transactionAmount}
              />
              <Text style={[styles.metaText, { color: theme.mutedText }]}>
                Platform fee: {lookupResult.deal.platformFeePercent}%
              </Text>
            </>
          )}

          {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={reset}
              style={[
                styles.secondaryButton,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
              testID="mobile-redeem-cancel">
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading || lookupResult.alreadyUsed}
              onPress={() => void handleRedeem()}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: lookupResult.alreadyUsed ? theme.surfaceMuted : theme.accent,
                  flex: 1,
                  opacity: lookupResult.alreadyUsed ? 0.72 : 1,
                },
              ]}
              testID="mobile-redeem-confirm">
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Redeeming...' : 'Confirm redemption'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {state === 'success' && successResult ? (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <Text style={[styles.successTitle, { color: theme.text }]}>Redeemed</Text>
          <Text style={[styles.sectionText, { color: theme.mutedText }]}>
            {successResult.deal.title}
          </Text>
          {successResult.customer ? (
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              {successResult.customer.name}
            </Text>
          ) : null}
          {successResult.platformFeeLabel ? (
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              Platform fee recorded: {successResult.platformFeeLabel}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            testID="mobile-redeem-reset">
            <Text style={styles.primaryButtonText}>Redeem another</Text>
          </Pressable>
        </View>
      ) : null}
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
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  codeInput: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 14,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
