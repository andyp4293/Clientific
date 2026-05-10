import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileAiReceptionistScreen } from '@/components/mobile-ai-receptionist-screen';

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  subscriptionPlan: 'pro',
  billingProvider: 'stripe' as const,
  hasAccess: true,
  aiReceptionistEnabled: true,
  aiReceptionistSpanishEnabled: false,
  aiReceptionistPhone: '+15557654321',
  aiReceptionistGreeting: 'Thanks for calling Clientific Studio.',
  aiReceptionistFaq: [],
  smsAiEnabled: true,
  smsAiPhoneNumber: '+18885550123',
  smsAiGreeting: 'Text us to book.',
  vapiPhoneNumber: '+18885550123',
  unifiedNumber: '+18885550123',
};

describe('MobileAiReceptionistScreen', () => {
  it('shows provider-aware upgrade guidance when the plan lacks access', () => {
    render(
      <MobileAiReceptionistScreen
        data={{ ...data, hasAccess: false, subscriptionPlan: 'starter' }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Upgrade required')).toBeTruthy();
    expect(screen.getByText(/bills on the web/i)).toBeTruthy();
  });

  it('saves edited AI receptionist settings from the native form', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileAiReceptionistScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-ai-forwarding-phone'), '(555) 111-2222');
    fireEvent.press(screen.getByTestId('mobile-ai-add-faq'));
    fireEvent.changeText(screen.getByTestId('mobile-ai-faq-question-0'), 'Do you take walk-ins?');
    fireEvent.changeText(screen.getByTestId('mobile-ai-faq-answer-0'), 'Yes, when space opens up.');
    fireEvent.press(screen.getByTestId('mobile-ai-spanish-toggle'));
    fireEvent.press(screen.getByTestId('mobile-ai-save'));

    expect(onSave).toHaveBeenCalledWith({
      aiReceptionistEnabled: true,
      aiReceptionistSpanishEnabled: true,
      aiReceptionistPhone: '(555) 111-2222',
      aiReceptionistGreeting: 'Thanks for calling Clientific Studio.',
      smsAiGreeting: 'Text us to book.',
      aiReceptionistFaq: [
        {
          question: 'Do you take walk-ins?',
          answer: 'Yes, when space opens up.',
        },
      ],
    });
  });

  it('shows the spanish caller option when enabled', () => {
    render(
      <MobileAiReceptionistScreen
        data={{ ...data, aiReceptionistSpanishEnabled: true }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Allow Spanish callers')).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('explains what each call handling field controls', () => {
    render(
      <MobileAiReceptionistScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Live transfer number')).toBeTruthy();
    expect(screen.getByText(/forwards the live call to this number/i)).toBeTruthy();
    expect(screen.getByText('Phone greeting callers hear')).toBeTruthy();
    expect(screen.getByText(/first sentence the ai says/i)).toBeTruthy();
    expect(screen.getByText('Text greeting customers receive')).toBeTruthy();
    expect(screen.getByText(/first SMS the assistant sends/i)).toBeTruthy();
  });

  it('shows a dialer-safe forwarding shortcut without the plus sign', () => {
    render(
      <MobileAiReceptionistScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Forwarding shortcut')).toBeTruthy();
    expect(screen.getByText('*21*18885550123#')).toBeTruthy();
  });
});
