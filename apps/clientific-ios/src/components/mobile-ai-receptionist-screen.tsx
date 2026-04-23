import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  MobileAiReceptionistFaq,
  MobileAiReceptionistSummary,
  MobileAiReceptionistUpdateInput,
} from '@/lib/clientific-api';
import { formatPhoneForDialing } from '@/lib/clientific-phone';
import { getAiReceptionistUpgradeSummary } from '@/lib/mobile-billing-copy';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MobileAiReceptionistScreenProps = {
  data: MobileAiReceptionistSummary | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  onRefresh: () => Promise<void>;
  onSave: (input: MobileAiReceptionistUpdateInput) => Promise<void>;
};

type DraftState = {
  aiReceptionistEnabled: boolean;
  aiReceptionistSpanishEnabled: boolean;
  aiReceptionistPhone: string;
  aiReceptionistGreeting: string;
  smsAiGreeting: string;
  aiReceptionistFaq: MobileAiReceptionistFaq[];
};

function buildDraft(data: MobileAiReceptionistSummary): DraftState {
  return {
    aiReceptionistEnabled: data.aiReceptionistEnabled,
    aiReceptionistSpanishEnabled: data.aiReceptionistSpanishEnabled,
    aiReceptionistPhone: data.aiReceptionistPhone ?? '',
    aiReceptionistGreeting: data.aiReceptionistGreeting ?? '',
    smsAiGreeting: data.smsAiGreeting ?? '',
    aiReceptionistFaq: data.aiReceptionistFaq.length
      ? data.aiReceptionistFaq
      : [],
  };
}

function serializeDraft(draft: DraftState) {
  return JSON.stringify({
    aiReceptionistEnabled: draft.aiReceptionistEnabled,
    aiReceptionistSpanishEnabled: draft.aiReceptionistSpanishEnabled,
    aiReceptionistPhone: draft.aiReceptionistPhone.trim(),
    aiReceptionistGreeting: draft.aiReceptionistGreeting.trim(),
    smsAiGreeting: draft.smsAiGreeting.trim(),
    aiReceptionistFaq: draft.aiReceptionistFaq.map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    })),
  });
}

export function MobileAiReceptionistScreen({
  data,
  error,
  isLoading,
  isRefreshing,
  isSaving,
  onRefresh,
  onSave,
}: MobileAiReceptionistScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [baseline, setBaseline] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }

    const nextDraft = buildDraft(data);
    setDraft(nextDraft);
    setBaseline(serializeDraft(nextDraft));
    setSaveError(null);
  }, [data]);

  const hasChanges = useMemo(
    () => (draft ? serializeDraft(draft) !== baseline : false),
    [baseline, draft],
  );

  const statusTone =
    data?.unifiedNumber
      ? 'active'
      : data?.aiReceptionistEnabled
        ? 'pending'
        : 'disabled';
  const forwardingDialNumber = formatPhoneForDialing(data?.unifiedNumber);
  const iphoneForwardingCode = forwardingDialNumber ? `*21*${forwardingDialNumber}#` : '';

  async function submitDraft(partial?: Partial<DraftState>) {
    if (!draft) {
      return;
    }

    const nextDraft = {
      ...draft,
      ...partial,
    };

    setSaveError(null);

    try {
      await onSave({
        aiReceptionistEnabled: nextDraft.aiReceptionistEnabled,
        aiReceptionistSpanishEnabled: nextDraft.aiReceptionistSpanishEnabled,
        aiReceptionistPhone: nextDraft.aiReceptionistPhone.trim() || null,
        aiReceptionistGreeting: nextDraft.aiReceptionistGreeting.trim() || null,
        smsAiGreeting: nextDraft.smsAiGreeting.trim() || null,
        aiReceptionistFaq: nextDraft.aiReceptionistFaq
          .map((item) => ({
            question: item.question.trim(),
            answer: item.answer.trim(),
          }))
          .filter((item) => item.question || item.answer),
      });
    } catch (issue) {
      setSaveError(issue instanceof Error ? issue.message : 'Unable to save AI receptionist.');
    }
  }

  function resetDraft() {
    if (!data) {
      return;
    }

    const nextDraft = buildDraft(data);
    setDraft(nextDraft);
    setBaseline(serializeDraft(nextDraft));
    setSaveError(null);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          tintColor={theme.accent}
          onRefresh={() => void onRefresh()}
        />
      }
      style={{ backgroundColor: theme.background }}>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>AI receptionist</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Calls, SMS, and handoff settings</Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedText }]}>
          Manage the business AI number, caller transfers, and the answers your assistant gives customers.
        </Text>
      </View>

      {error || saveError ? (
        <View
          style={[
            styles.noticeCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Text style={[styles.noticeTitle, { color: theme.text }]}>Update needed</Text>
          <Text style={[styles.noticeText, { color: theme.mutedText }]}>
            {saveError ?? error}
          </Text>
        </View>
      ) : null}

      {isLoading && !data ? (
        <View
          style={[
            styles.loadingCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Loading AI receptionist...
          </Text>
        </View>
      ) : null}

      {data ? (
        !data.hasAccess ? (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upgrade required</Text>
            <Text style={[styles.sectionText, { color: theme.mutedText }]}>
              {getAiReceptionistUpgradeSummary(data.billingProvider)}
            </Text>
          </View>
        ) : draft ? (
          <>
            <View
              style={[
                styles.statusCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={styles.statusHeader}>
                <View style={styles.statusCopy}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Current status</Text>
                  <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                    {statusTone === 'active'
                      ? 'Your shared AI number is live for calls and booking texts.'
                      : statusTone === 'pending'
                        ? 'Setup is still in progress. Pull to refresh to check for the assigned number.'
                        : 'AI phone coverage is off right now.'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        statusTone === 'active'
                          ? theme.accentSoft
                          : statusTone === 'pending'
                            ? theme.surfaceMuted
                            : theme.surfaceMuted,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          statusTone === 'active' ? theme.accent : theme.text,
                      },
                    ]}>
                    {statusTone === 'active'
                      ? 'Live'
                      : statusTone === 'pending'
                        ? 'Pending'
                        : 'Disabled'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusNumberCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}>
                <Text style={[styles.statusNumberLabel, { color: theme.mutedText }]}>
                  Business AI number
                </Text>
                <Text style={[styles.statusNumberValue, { color: theme.text }]}>
                  {data.unifiedNumber ?? 'Not assigned yet'}
                </Text>
              </View>

              {forwardingDialNumber ? (
                <View
                  style={[
                    styles.forwardingTipCard,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.forwardingTipTitle, { color: theme.text }]}>
                    Forwarding shortcut
                  </Text>
                  <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                    If your carrier uses star codes, dial the destination number without the plus
                    sign.
                  </Text>
                  <Text style={[styles.forwardingTipCode, { color: theme.text }]}>
                    {iphoneForwardingCode}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void submitDraft({ aiReceptionistEnabled: !draft.aiReceptionistEnabled })}
                style={[
                  styles.primaryButton,
                  { backgroundColor: draft.aiReceptionistEnabled ? theme.surfaceMuted : theme.accent },
                ]}
                testID="mobile-ai-toggle">
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: draft.aiReceptionistEnabled ? theme.text : '#f8fffc' },
                  ]}>
                  {isSaving
                    ? 'Saving...'
                    : draft.aiReceptionistEnabled
                      ? 'Disable AI receptionist'
                      : 'Enable AI receptionist'}
                </Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Call handling</Text>
              <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                When callers ask for a real person, the AI transfers the call to this number.
              </Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.aiReceptionistSpanishEnabled }}
                onPress={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          aiReceptionistSpanishEnabled: !current.aiReceptionistSpanishEnabled,
                        }
                      : current,
                  )
                }
                style={[
                  styles.languageToggleCard,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}
                testID="mobile-ai-spanish-toggle">
                <View style={styles.languageToggleCopy}>
                  <Text style={[styles.languageToggleTitle, { color: theme.text }]}>
                    Allow Spanish callers
                  </Text>
                  <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                    Start calls with an English or Spanish choice and continue in the selected language.
                  </Text>
                </View>
                <View
                  style={[
                    styles.togglePill,
                    {
                      backgroundColor: draft.aiReceptionistSpanishEnabled
                        ? theme.accent
                        : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.togglePillText,
                      { color: draft.aiReceptionistSpanishEnabled ? '#f8fffc' : theme.text },
                    ]}>
                    {draft.aiReceptionistSpanishEnabled ? 'On' : 'Off'}
                  </Text>
                </View>
              </Pressable>
              <TextInput
                onChangeText={(value) =>
                  setDraft((current) => (current ? { ...current, aiReceptionistPhone: value } : current))
                }
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                testID="mobile-ai-forwarding-phone"
                value={draft.aiReceptionistPhone}
              />
              <TextInput
                multiline
                onChangeText={(value) =>
                  setDraft((current) => (current ? { ...current, aiReceptionistGreeting: value } : current))
                }
                placeholder={`Hi, thank you for calling ${data.business.name}. How can I help today?`}
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                testID="mobile-ai-greeting"
                value={draft.aiReceptionistGreeting}
              />
              <TextInput
                multiline
                onChangeText={(value) =>
                  setDraft((current) => (current ? { ...current, smsAiGreeting: value } : current))
                }
                placeholder={`Hi from ${data.business.name}. I can help you book by text.`}
                placeholderTextColor={theme.mutedText}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                testID="mobile-ai-sms-greeting"
                value={draft.smsAiGreeting}
              />
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}>
              <View style={styles.faqHeader}>
                <View style={styles.faqHeaderCopy}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>FAQ answers</Text>
                  <Text style={[styles.sectionText, { color: theme.mutedText }]}>
                    Add the quick answers your assistant should use on calls.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            aiReceptionistFaq: [...current.aiReceptionistFaq, { question: '', answer: '' }],
                          }
                        : current,
                    )
                  }
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                  testID="mobile-ai-add-faq">
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Add FAQ</Text>
                </Pressable>
              </View>

              {draft.aiReceptionistFaq.length ? (
                draft.aiReceptionistFaq.map((item, index) => (
                  <View
                    key={`faq-${index}`}
                    style={[
                      styles.faqCard,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}>
                    <TextInput
                      onChangeText={(value) =>
                        setDraft((current) => {
                          if (!current) return current;
                          const nextFaq = [...current.aiReceptionistFaq];
                          nextFaq[index] = { ...nextFaq[index], question: value };
                          return { ...current, aiReceptionistFaq: nextFaq };
                        })
                      }
                      placeholder="Question"
                      placeholderTextColor={theme.mutedText}
                      style={[
                        styles.textInput,
                        styles.faqInput,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      testID={`mobile-ai-faq-question-${index}`}
                      value={item.question}
                    />
                    <TextInput
                      multiline
                      onChangeText={(value) =>
                        setDraft((current) => {
                          if (!current) return current;
                          const nextFaq = [...current.aiReceptionistFaq];
                          nextFaq[index] = { ...nextFaq[index], answer: value };
                          return { ...current, aiReceptionistFaq: nextFaq };
                        })
                      }
                      placeholder="Answer"
                      placeholderTextColor={theme.mutedText}
                      style={[
                        styles.textArea,
                        styles.faqInput,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                      testID={`mobile-ai-faq-answer-${index}`}
                      value={item.answer}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                aiReceptionistFaq: current.aiReceptionistFaq.filter((_, faqIndex) => faqIndex !== index),
                              }
                            : current,
                        )
                      }
                      style={[
                        styles.removeButton,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      testID={`mobile-ai-remove-faq-${index}`}>
                      <Text style={[styles.removeButtonText, { color: theme.text }]}>Remove</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                  No FAQ answers added yet.
                </Text>
              )}
            </View>

            <View style={styles.footerActions}>
              <Pressable
                accessibilityRole="button"
                disabled={!hasChanges || isSaving}
                onPress={resetDraft}
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: hasChanges && !isSaving ? 1 : 0.55,
                  },
                ]}
                testID="mobile-ai-reset">
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Reset</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!hasChanges || isSaving}
                onPress={() => void submitDraft()}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: hasChanges ? theme.accent : theme.surfaceMuted,
                    opacity: hasChanges && !isSaving ? 1 : 0.65,
                  },
                ]}
                testID="mobile-ai-save">
                <Text style={styles.primaryButtonText}>
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null
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
  loadingCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusNumberCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  statusNumberLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusNumberValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  forwardingTipCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  forwardingTipTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  forwardingTipCode: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  languageToggleCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  languageToggleCopy: {
    flex: 1,
    gap: 6,
  },
  languageToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  textArea: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  faqCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  faqInput: {
    minHeight: 46,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#f8fffc',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  togglePill: {
    minWidth: 54,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  removeButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
