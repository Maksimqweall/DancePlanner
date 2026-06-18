import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  children: React.ReactNode;
  scaleTo?: number;
}

export default function PressableScale({ children, scaleTo = 0.97, style, ...props }: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[animStyle, style as any]}
      onPressIn={() => { scale.value = withSpring(scaleTo, { damping: 15, stiffness: 350 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 350 }); }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
