import React from 'react';
import Feather from '@expo/vector-icons/Feather';

export type MobileNavIconName =
  | 'dashboard'
  | 'appointments'
  | 'customers'
  | 'deals'
  | 'more'
  | 'checkins'
  | 'referrals'
  | 'funds'
  | 'account';

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
  checkins: 'check-square',
  referrals: 'send',
  funds: 'dollar-sign',
  account: 'user',
};

export function MobileNavIcon({
  color,
  name,
  size = 20,
}: MobileNavIconProps) {
  return <Feather color={color} name={ICON_MAP[name]} size={size} />;
}
