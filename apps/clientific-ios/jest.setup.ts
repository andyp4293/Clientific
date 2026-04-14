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
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}));

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
