import { useEffect } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastStore } from "../store/useToastStore";
import { useC } from "../lib/useTheme";

const AUTO_HIDE_MS = 4200;
const OFFSCREEN = -160;

// Global in-app toast host. Mount once near the top of the authenticated tree;
// it overlays every screen and listens to useToastStore.
export default function Toast() {
  const toast  = useToastStore((s) => s.toast);
  const hide   = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const C      = useC();

  const translateY = useSharedValue(OFFSCREEN);
  const opacity    = useSharedValue(0);

  const dismiss = () => {
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(OFFSCREEN, { duration: 220 }, (finished) => {
      if (finished) runOnJS(hide)();
    });
  };

  useEffect(() => {
    if (!toast) return;
    translateY.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.7 });
    opacity.value    = withTiming(1, { duration: 200 });
    const timer = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
    // re-run whenever a new toast is pushed (id changes)
  }, [toast?.id]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }, animStyle]}
    >
      <Pressable
        onPress={dismiss}
        style={[styles.card, { backgroundColor: C.card, borderColor: C.accentBorder, shadowColor: "#000" }]}
      >
        {toast.icon ? <Text style={styles.icon}>{toast.icon}</Text> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: C.t1 }]} numberOfLines={1}>{toast.title}</Text>
          {toast.body ? (
            <Text style={[styles.body, { color: C.t2 }]} numberOfLines={2}>{toast.body}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    alignItems: "center",
    zIndex: 1000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 460,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  icon: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  body: { fontSize: 12.5, fontWeight: "500", marginTop: 2, lineHeight: 17 },
});
