import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileRedeemScreen } from '@/components/mobile-redeem-screen';

describe('MobileRedeemScreen', () => {
  it('looks up a code and confirms redemption', async () => {
    const onLookup = jest.fn().mockResolvedValue({
      deal: {
        title: 'Spring Special',
        discountType: 'percent_off',
        discountValue: 20,
        discountLabel: '20% off',
        platformFeePercent: 10,
      },
      customer: {
        name: 'Jordan Lee',
        phoneDisplay: '(555) 123-4567',
      },
      alreadyUsed: false,
    });
    const onRedeem = jest.fn().mockResolvedValue({
      success: true,
      deal: {
        title: 'Spring Special',
        discountType: 'percent_off',
        discountValue: 20,
        discountLabel: '20% off',
      },
      customer: {
        name: 'Jordan Lee',
        phoneDisplay: '(555) 123-4567',
      },
      platformFee: 4.5,
      platformFeeLabel: '$4.50',
    });

    render(<MobileRedeemScreen onLookup={onLookup} onRedeem={onRedeem} />);

    fireEvent.changeText(screen.getByTestId('mobile-redeem-code'), 'ab3def7g');
    fireEvent.press(screen.getByTestId('mobile-redeem-lookup'));

    await waitFor(() => {
      expect(screen.getByText('Spring Special')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('mobile-redeem-amount'), '45');
    fireEvent.press(screen.getByTestId('mobile-redeem-confirm'));

    await waitFor(() => {
      expect(onRedeem).toHaveBeenCalledWith({
        code: 'AB3DEF7G',
        transactionAmount: 45,
      });
    });

    expect(screen.getByText('Redeemed')).toBeTruthy();
    expect(screen.getByText('Platform fee recorded: $4.50')).toBeTruthy();
  });
});
