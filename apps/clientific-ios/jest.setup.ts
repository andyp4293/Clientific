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

export {};
