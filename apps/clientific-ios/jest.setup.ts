jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockFeatherIcon({
    color,
    name,
    size,
  }: {
    color?: string;
    name?: string;
    size?: number;
  }) {
    return React.createElement(
      Text,
      {
        accessibilityRole: 'image',
        style: { color, fontSize: size },
      },
      name,
    );
  };
});

let mockExpoIsDevice = true;

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockExpoIsDevice;
  },
  __setIsDevice(value: boolean) {
    mockExpoIsDevice = value;
  },
  modelName: 'iPhone 17 Pro',
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    ios: {
      bundleIdentifier: 'app.clientific.mobile',
    },
    extra: {
      eas: {
        projectId: 'project-123',
      },
    },
  },
  easConfig: {
    projectId: 'project-123',
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test-token]' })),
  getBadgeCountAsync: jest.fn(async () => 0),
  setBadgeCountAsync: jest.fn(async () => true),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  const insets = { top: 59, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 430, height: 932 };

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, props, children),
    initialWindowMetrics: {
      insets,
      frame,
    },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});

let mockSecureStoreState: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreState[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockSecureStoreState[key];
  }),
  __reset() {
    mockSecureStoreState = {};
  },
  __setItem(key: string, value: string) {
    mockSecureStoreState[key] = value;
  },
}));

export {};
