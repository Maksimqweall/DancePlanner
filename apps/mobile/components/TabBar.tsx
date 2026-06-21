import React, { useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { C, SPRING } from '../lib/theme';
import { usePartnerStore } from '../store/usePartnerStore';

type TabBarRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabBarRoute[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    navigate: (name: string) => void;
    emit: (args: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
  };
};

const TAB_HEIGHT = 50;
const H_PAD = 6;

function HomeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
        stroke={color} strokeWidth="1.75"
        strokeLinejoin="round" strokeLinecap="round"
      />
    </Svg>
  );
}

function CalendarIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2.5" stroke={color} strokeWidth="1.75" />
      <Path d="M16 2V6M8 2V6M3 10H21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

function WalletIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V7Z"
        stroke={color} strokeWidth="1.75"
      />
      <Path d="M2 10H22" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Circle cx="16.5" cy="14.5" r="1" fill={color} />
    </Svg>
  );
}

function TrophyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 21H16M12 17V21M8.5 4H15.5L14 12C14 14.2 13.1 17 12 17C10.9 17 10 14.2 10 12L8.5 4Z"
        stroke={color} strokeWidth="1.75"
        strokeLinejoin="round" strokeLinecap="round"
      />
      <Path
        d="M8.5 5H5V9C5 10.7 6.3 12 8 12M15.5 5H19V9C19 10.7 17.7 12 16 12"
        stroke={color} strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function UsersIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.75" />
      <Path
        d="M3 19C3 16.2 5.7 14 9 14C12.3 14 15 16.2 15 19"
        stroke={color} strokeWidth="1.75" strokeLinecap="round"
      />
      <Path
        d="M16 11C17.7 11 19 9.7 19 8C19 6.3 17.7 5 16 5"
        stroke={color} strokeWidth="1.75" strokeLinecap="round"
      />
      <Path
        d="M19 14C20.7 14.8 22 16.2 22 19"
        stroke={color} strokeWidth="1.75" strokeLinecap="round"
      />
    </Svg>
  );
}

const ICONS: Record<string, React.ComponentType<{ color: string; size?: number }>> = {
  index: HomeIcon,
  calendar: CalendarIcon,
  expenses: WalletIcon,
  projects: TrophyIcon,
  partner: UsersIcon,
};

const badge = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: C.card,
  },
  dotText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

export default function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pendingCount = usePartnerStore((s) => s.pendingCount);

  const containerW = width - 32;
  const tabW = containerW / state.routes.length;
  const pillX = useSharedValue(state.index * tabW);

  useEffect(() => {
    pillX.value = withSpring(state.index * tabW, SPRING.pill);
  }, [state.index, tabW]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View
      style={{
        backgroundColor: C.bg,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          backgroundColor: C.card,
          borderRadius: 22,
          padding: H_PAD,
          height: TAB_HEIGHT + H_PAD * 2,
          borderWidth: 1,
          borderColor: C.border,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Animated.View
          style={[
            pillStyle,
            {
              position: 'absolute',
              top: H_PAD,
              left: H_PAD,
              width: tabW,
              height: TAB_HEIGHT,
              backgroundColor: C.accent,
              borderRadius: 16,
              opacity: 0.95,
            },
          ]}
        />

        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? HomeIcon;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const showBadge = route.name === 'partner' && pendingCount > 0;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                height: TAB_HEIGHT,
                zIndex: 1,
              }}
            >
              <View style={{ position: 'relative' }}>
                <Icon color={focused ? '#ffffff' : C.t3} size={22} />
                {showBadge ? (
                  <View style={badge.dot}>
                    {pendingCount > 9 ? null : (
                      <Text style={badge.dotText}>{pendingCount}</Text>
                    )}
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
