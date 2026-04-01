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
  hasAccess: true,
  aiReceptionistEnabled: true,
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
  it('routes upgrade prompts into billing when the plan lacks access', () => {
    const onOpenBilling = jest.fn();

    render(
      <MobileAiReceptionistScreen
        data={{ ...data, hasAccess: false, subscriptionPlan: 'starter' }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onOpenBilling={onOpenBilling}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-ai-open-billing'));
    expect(onOpenBilling).toHaveBeenCalled();
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
        onOpenBilling={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-ai-forwarding-phone'), '(555) 111-2222');
    fireEvent.press(screen.getByTestId('mobile-ai-add-faq'));
    fireEvent.changeText(screen.getByTestId('mobile-ai-faq-question-0'), 'Do you take walk-ins?');
    fireEvent.changeText(screen.getByTestId('mobile-ai-faq-answer-0'), 'Yes, when space opens up.');
    fireEvent.press(screen.getByTestId('mobile-ai-save'));

    expect(onSave).toHaveBeenCalledWith({
      aiReceptionistEnabled: true,
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
});
