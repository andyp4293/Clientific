import React from 'react';
import { ClientificNativeApp } from '@/components/clientific-native-app';
import { MobileDealsScreenshotPreview } from '@/components/mobile-deals-screenshot-preview';

export default function HomeScreen() {
  if (process.env.EXPO_PUBLIC_MOBILE_SCREENSHOT_SCENARIO === 'deals') {
    return <MobileDealsScreenshotPreview />;
  }

  return <ClientificNativeApp />;
}
