import React from 'react';
import Feather from '@expo/vector-icons/Feather';

export type MobileNavIconName =
  | 'dashboard'
  | 'appointments'
  | 'customers'
  | 'deals'
  | 'more'
  | 'services'
  | 'checkins'
  | 'redeem'
  | 'businessHours'
  | 'aiReceptionist'
  | 'reviews'
  | 'analytics'
  | 'referrals'
  | 'payouts'
  | 'customerView'
  | 'billing'
  | 'settings'
  | 'account'
  | 'legal'
  | 'support';

type MobileNavIconProps = {
  color: string;
  name: MobileNavIconName;
  size?: number;
};

const ICON_MAP: Record<MobileNavIconName, React.ComponentProps<typeof Feather>['name']> = {
  dashboard: 'home',
  appointments: 'calendar',
  customers: 'users',
  deals: 'tag',
  more: 'more-horizontal',
  services: 'briefcase',
  checkins: 'check-square',
  redeem: 'crosshair',
  businessHours: 'clock',
  aiReceptionist: 'phone-call',
  reviews: 'star',
  analytics: 'bar-chart-2',
  referrals: 'send',
  payouts: 'dollar-sign',
  customerView: 'eye',
  billing: 'credit-card',
  settings: 'settings',
  account: 'user',
  legal: 'shield',
  support: 'help-circle',
};

export function MobileNavIcon({
  color,
  name,
  size = 20,
}: MobileNavIconProps) {
  return <Feather color={color} name={ICON_MAP[name]} size={size} />;
}
