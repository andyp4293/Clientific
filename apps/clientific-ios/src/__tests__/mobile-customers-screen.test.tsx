import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileCustomersScreen } from '@/components/mobile-customers-screen';
import type { MobileCustomerFilters, MobileCustomersSummary } from '@/lib/clientific-api';

const filters: MobileCustomerFilters = {
  group: '',
  sms: '',
  contact: '',
  visit: '',
};

const data: MobileCustomersSummary = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  search: '',
  filters,
  currentPage: 1,
  totalPages: 3,
  totalCustomers: 55,
  pageSize: 20,
  groups: [
    {
      id: 'group-1',
      name: 'VIP',
      promotionSmsEnabled: true,
      membersCount: 12,
    },
  ],
  customers: [
    {
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '+15551234567',
      phoneDisplay: '(555) 123-4567',
      joinedLabel: 'Mar 18, 2026',
      lastVisitLabel: 'Mar 29, 2026',
      totalSpentLabel: '$120.00',
      segment: 'VIP',
      segmentLabel: 'VIP',
      smsConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      visitsCount: 3,
      groups: [],
    },
  ],
};

function renderScreen() {
  return render(
    <MobileCustomersScreen
      data={data}
      error={null}
      filters={filters}
      isLoading={false}
      isRefreshing={false}
      searchDraft=""
      onChangeFilter={jest.fn()}
      onChangeSearchDraft={jest.fn()}
      onClearFilters={jest.fn()}
      onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
      onCreateGroup={jest.fn().mockResolvedValue(undefined)}
      onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
      onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
      onFetchCustomerDetail={jest.fn().mockResolvedValue({
        id: 'cust-1',
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        phone: '+15551234567',
        phoneDisplay: '(555) 123-4567',
        birthdayValue: '',
        birthdayLabel: 'Not provided',
        notes: null,
        segment: 'VIP',
        segmentLabel: 'VIP',
        joinedLabel: 'Mar 18, 2026',
        lastVisitLabel: 'Mar 29, 2026',
        totalSpentLabel: '$120.00',
        smsConsent: true,
        smsOptedOut: false,
        dealSmsBlocked: false,
        visitsCount: 3,
        appointmentsCount: 1,
        groups: [],
        checkIns: [],
        appointments: [],
      })}
      onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
      onGoToPage={jest.fn()}
      onNextPage={jest.fn()}
      onPreviousPage={jest.fn()}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onSendReviewRequest={jest.fn().mockResolvedValue(undefined)}
      onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
      onUpdateCustomer={jest.fn().mockResolvedValue({
        id: 'cust-1',
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        phone: '+15551234567',
        phoneDisplay: '(555) 123-4567',
        birthdayValue: '',
        birthdayLabel: 'Not provided',
        notes: null,
        segment: 'VIP',
        segmentLabel: 'VIP',
        joinedLabel: 'Mar 18, 2026',
        lastVisitLabel: 'Mar 29, 2026',
        totalSpentLabel: '$120.00',
        smsConsent: true,
        smsOptedOut: false,
        dealSmsBlocked: false,
        visitsCount: 3,
        appointmentsCount: 1,
        groups: [],
        checkIns: [],
        appointments: [],
      })}
      onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
    />,
  );
}

describe('MobileCustomersScreen', () => {
  it('wires search and pagination controls', () => {
    const onChangeSearchDraft = jest.fn();
    const onNextPage = jest.fn();

    render(
      <MobileCustomersScreen
        data={data}
        error={null}
        filters={filters}
        isLoading={false}
        isRefreshing={false}
        searchDraft=""
        onChangeFilter={jest.fn()}
        onChangeSearchDraft={onChangeSearchDraft}
        onClearFilters={jest.fn()}
        onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
        onCreateGroup={jest.fn().mockResolvedValue(undefined)}
        onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
        onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
        onFetchCustomerDetail={jest.fn().mockResolvedValue(null)}
        onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
        onGoToPage={jest.fn()}
        onNextPage={onNextPage}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSendReviewRequest={jest.fn().mockResolvedValue(undefined)}
        onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
        onUpdateCustomer={jest.fn().mockResolvedValue(null)}
        onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-customers-search'), 'jord');
    fireEvent.press(screen.getByTestId('mobile-customers-next'));

    expect(onChangeSearchDraft).toHaveBeenCalledWith('jord');
    expect(onNextPage).toHaveBeenCalled();
    expect(screen.getByText('Filter customers')).toBeTruthy();
    expect(screen.getByText('1-20 of 55 shown')).toBeTruthy();
    expect(screen.getByText('3 pages')).toBeTruthy();
    expect(screen.getByTestId('mobile-customers-pagination-label')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('mobile-customers-pagination-buttons').props.style),
    ).toMatchObject({
      width: '100%',
      borderRadius: 22,
    });
  });

  it('hides the pager tray when all customers fit on one page', () => {
    render(
      <MobileCustomersScreen
        data={{
          ...data,
          totalPages: 1,
          totalCustomers: 8,
          pageSize: 20,
        }}
        error={null}
        filters={filters}
        isLoading={false}
        isRefreshing={false}
        searchDraft=""
        onChangeFilter={jest.fn()}
        onChangeSearchDraft={jest.fn()}
        onClearFilters={jest.fn()}
        onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
        onCreateGroup={jest.fn().mockResolvedValue(undefined)}
        onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
        onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
        onFetchCustomerDetail={jest.fn().mockResolvedValue(null)}
        onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
        onGoToPage={jest.fn()}
        onNextPage={jest.fn()}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSendReviewRequest={jest.fn().mockResolvedValue(undefined)}
        onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
        onUpdateCustomer={jest.fn().mockResolvedValue(null)}
        onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('1 page')).toBeTruthy();
    expect(screen.queryByTestId('mobile-customers-pagination-buttons')).toBeNull();
    expect(screen.queryByTestId('mobile-customers-pagination-label')).toBeNull();
  });

  it('switches to the groups tab and shows customer groups', async () => {
    renderScreen();

    fireEvent.press(screen.getByRole('tab', { name: 'Groups 1' }));

    await waitFor(() => {
      expect(screen.getByText('Promotion SMS on')).toBeTruthy();
      expect(screen.getByText('VIP')).toBeTruthy();
    });
  });

  it('opens the filtered customer list for a selected group on mobile', async () => {
    const onChangeFilter = jest.fn();
    const onChangeSearchDraft = jest.fn();

    render(
      <MobileCustomersScreen
        data={data}
        error={null}
        filters={filters}
        isLoading={false}
        isRefreshing={false}
        searchDraft="vip"
        onChangeFilter={onChangeFilter}
        onChangeSearchDraft={onChangeSearchDraft}
        onClearFilters={jest.fn()}
        onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
        onCreateGroup={jest.fn().mockResolvedValue(undefined)}
        onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
        onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
        onFetchCustomerDetail={jest.fn().mockResolvedValue(null)}
        onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
        onGoToPage={jest.fn()}
        onNextPage={jest.fn()}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSendReviewRequest={jest.fn().mockResolvedValue(undefined)}
        onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
        onUpdateCustomer={jest.fn().mockResolvedValue(null)}
        onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByRole('tab', { name: 'Groups 1' }));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-group-view-members-group-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mobile-group-view-members-group-1'));

    expect(onChangeSearchDraft).toHaveBeenCalledWith('');
    expect(onChangeFilter).toHaveBeenCalledWith({
      group: 'group-1',
      sms: '',
      contact: '',
      visit: '',
    });
    expect(screen.getByRole('tab', { name: 'Customers 55' })).toBeTruthy();
  });

  it('previews and confirms a subscriber broadcast without sending on the first tap', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onPreviewCustomerBroadcast = jest.fn().mockResolvedValue({
      dryRun: true,
      target: 'all',
      eligibleCount: 3,
      skippedDuplicateCount: 0,
      skippedInvalidPhoneCount: 0,
      disabledGroupCount: 0,
      selectedGroups: [],
      recipientsPreview: [],
      sent: 0,
      failed: 0,
    });
    const onSendCustomerBroadcast = jest.fn().mockResolvedValue({
      dryRun: false,
      target: 'all',
      eligibleCount: 3,
      skippedDuplicateCount: 0,
      skippedInvalidPhoneCount: 0,
      disabledGroupCount: 0,
      selectedGroups: [],
      recipientsPreview: [],
      sent: 3,
      failed: 0,
    });

    render(
      <MobileCustomersScreen
        data={data}
        error={null}
        filters={filters}
        isLoading={false}
        isRefreshing={false}
        searchDraft=""
        onChangeFilter={jest.fn()}
        onChangeSearchDraft={jest.fn()}
        onClearFilters={jest.fn()}
        onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
        onCreateGroup={jest.fn().mockResolvedValue(undefined)}
        onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
        onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
        onFetchCustomerDetail={jest.fn().mockResolvedValue(null)}
        onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
        onGoToPage={jest.fn()}
        onNextPage={jest.fn()}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSendReviewRequest={jest.fn().mockResolvedValue(undefined)}
        onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
        onPreviewCustomerBroadcast={onPreviewCustomerBroadcast}
        onSendCustomerBroadcast={onSendCustomerBroadcast}
        onUpdateCustomer={jest.fn().mockResolvedValue(null)}
        onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-customers-broadcast-open'));

    await waitFor(() => {
      expect(onPreviewCustomerBroadcast).toHaveBeenCalledWith({
        target: 'all',
        groupIds: [],
      });
      expect(screen.getByTestId('mobile-broadcast-eligible-count').props.children).toBe('3');
    });

    fireEvent.changeText(screen.getByTestId('mobile-broadcast-message'), 'We have openings today.');
    expect(
      screen.getByText(
        'Clientific Studio: We have openings today. Reply STOP to opt out, HELP for help.',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-broadcast-send'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Send SMS broadcast?',
      'Exact SMS:\nClientific Studio: We have openings today. Reply STOP to opt out, HELP for help.\n\nThis will send one text message to 3 opted-in SMS subscribers. This action cannot be undone.',
      expect.any(Array),
    );
    expect(onSendCustomerBroadcast).not.toHaveBeenCalled();

    const cancelButton = (alertSpy.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void }>).find(
      (button) => button.text === 'Cancel',
    );
    cancelButton?.onPress?.();
    expect(onSendCustomerBroadcast).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('mobile-broadcast-send'));
    const sendButton = (alertSpy.mock.calls[1][2] as Array<{ text?: string; onPress?: () => void }>).find(
      (button) => button.text === 'Send broadcast',
    );
    expect(sendButton).toMatchObject({ style: 'destructive' });
    await act(async () => {
      sendButton?.onPress?.();
    });

    await waitFor(() => {
      expect(onSendCustomerBroadcast).toHaveBeenCalledWith({
        target: 'all',
        groupIds: [],
        message: 'We have openings today.',
      });
      expect(screen.getByText('Broadcast sent to 3 SMS subscribers.')).toBeTruthy();
    });

    alertSpy.mockRestore();
  });

  it('shows no sms approval wording for customers without sms consent', async () => {
    render(
      <MobileCustomersScreen
        data={{
          ...data,
          customers: [
            {
              ...data.customers[0],
              smsConsent: false,
              smsOptedOut: false,
            },
          ],
        }}
        error={null}
        filters={filters}
        isLoading={false}
        isRefreshing={false}
        searchDraft=""
        onChangeFilter={jest.fn()}
        onChangeSearchDraft={jest.fn()}
        onClearFilters={jest.fn()}
        onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
        onCreateGroup={jest.fn().mockResolvedValue(undefined)}
        onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
        onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
        onFetchCustomerDetail={jest.fn().mockResolvedValue(null)}
        onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
        onGoToPage={jest.fn()}
        onNextPage={jest.fn()}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSendReviewRequest={jest.fn().mockResolvedValue(undefined)}
        onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
        onUpdateCustomer={jest.fn().mockResolvedValue(null)}
        onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => {
      const badge = screen.getAllByText('No SMS approval').at(-1)!;
      const badgeContainer = badge.parent?.parent ?? badge.parent;
      expect(badge).toBeTruthy();
      expect(StyleSheet.flatten(badgeContainer?.props.style)).toMatchObject({
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
      });
    });
  });

  it('shows richer customer record badges and groups like the web customers view', () => {
    renderScreen();

    expect(screen.getByText('Deals SMS allowed')).toBeTruthy();
    expect(screen.getAllByText('VIP').length).toBeGreaterThan(0);
    expect(screen.getByText('Joined')).toBeTruthy();
    expect(screen.getByText('Spent')).toBeTruthy();
  });

  it('lets the business send a review request from customer detail', async () => {
    const onSendReviewRequest = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileCustomersScreen
        data={data}
        error={null}
        filters={filters}
        isLoading={false}
        isRefreshing={false}
        searchDraft=""
        onChangeFilter={jest.fn()}
        onChangeSearchDraft={jest.fn()}
        onClearFilters={jest.fn()}
        onCreateCustomer={jest.fn().mockResolvedValue(undefined)}
        onCreateGroup={jest.fn().mockResolvedValue(undefined)}
        onDeleteCustomer={jest.fn().mockResolvedValue(undefined)}
        onDeleteGroup={jest.fn().mockResolvedValue(undefined)}
        onFetchCustomerDetail={jest.fn().mockResolvedValue({
          id: 'cust-1',
          name: 'Jordan Lee',
          email: 'jordan@example.com',
          phone: '+15551234567',
          phoneDisplay: '(555) 123-4567',
          birthdayValue: '',
          birthdayLabel: 'Not provided',
          notes: null,
          segment: 'VIP',
          segmentLabel: 'VIP',
          joinedLabel: 'Mar 18, 2026',
          lastVisitLabel: 'Mar 29, 2026',
          totalSpentLabel: '$120.00',
          smsConsent: true,
          smsOptedOut: false,
          dealSmsBlocked: false,
          visitsCount: 3,
          appointmentsCount: 1,
          groups: [],
          checkIns: [],
          appointments: [],
        })}
        onFetchCustomerMessages={jest.fn().mockResolvedValue({ logs: [], quota: null })}
        onGoToPage={jest.fn()}
        onNextPage={jest.fn()}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSendReviewRequest={onSendReviewRequest}
        onSendCustomerMessage={jest.fn().mockResolvedValue(undefined)}
        onUpdateCustomer={jest.fn().mockResolvedValue(null)}
        onUpdateGroup={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByText('View'));

    await waitFor(() => {
      expect(screen.getByText('Request review')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Request review'));

    await waitFor(() => {
      expect(onSendReviewRequest).toHaveBeenCalledWith('cust-1');
      expect(screen.getByText('Review request sent to Jordan Lee.')).toBeTruthy();
    });
  });

  it('closes the customer detail sheet from the header close button', async () => {
    renderScreen();

    fireEvent.press(screen.getByText('View'));

    await waitFor(() => {
      expect(screen.getByText('Request review')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mobile-customers-sheet-close'));

    await waitFor(() => {
      expect(screen.queryByText('Request review')).toBeNull();
      expect(screen.queryByText('Review the customer profile, recent history, and direct message activity.')).toBeNull();
    });
  });
});
