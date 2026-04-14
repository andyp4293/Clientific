import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { MobileReviewsScreen } from '@/components/mobile-reviews-screen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  storeId: 'CF-123',
  surveyPath: '/feedback/CF-123',
  surveyUrl: 'https://www.clientific.app/feedback/CF-123',
  publicReviewDestinations: [
    {
      label: 'Google',
      url: 'https://google.com/reviews/example',
    },
  ],
  hasPublicDestinations: true,
  recentRequestsCount: 2,
  recentRequests: [
    {
      id: 'log-1',
      recipientLabel: '(555) 123-4567',
      statusLabel: 'Delivered',
      createdAtLabel: 'Apr 13, 2:00 PM',
    },
  ],
};

describe('MobileReviewsScreen', () => {
  it('supports copy and open actions for the survey link', () => {
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileReviewsScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenUrl={onOpenUrl}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onShareSurvey={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-reviews-copy-survey'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'https://www.clientific.app/feedback/CF-123',
    );

    fireEvent.press(screen.getByTestId('mobile-reviews-open-survey'));
    expect(onOpenUrl).toHaveBeenCalledWith('https://www.clientific.app/feedback/CF-123');
  });
});
