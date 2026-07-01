import React, { useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import PressableScale from "../components/ui/PressableScale";
import AppBackground from "../components/ui/AppBackground";
import { useC } from "../lib/useTheme";
import { useT } from "../lib/i18n";
import { useOnboardingStore } from "../store/useOnboardingStore";
import { GRADIENTS, type Palette } from "../lib/theme";

const { width: SW, height: SH } = Dimensions.get("window");

interface Slide {
  icon: string;
  accent: (C: Palette) => string;
  titleKey: keyof {
    slide1_title: string; slide2_title: string; slide3_title: string;
    slide4_title: string; slide5_title: string; slide6_title: string;
    slide7_title: string; slide8_title: string;
  };
  descKey: keyof {
    slide1_desc: string; slide2_desc: string; slide3_desc: string;
    slide4_desc: string; slide5_desc: string; slide6_desc: string;
    slide7_desc: string; slide8_desc: string;
  };
  features?: string[];
}

const SLIDES: Slide[] = [
  {
    icon: "🕺",
    accent: (C) => C.accent,
    titleKey: "slide1_title",
    descKey: "slide1_desc",
    features: [],
  },
  {
    icon: "💰",
    accent: (C) => C.accent,
    titleKey: "slide2_title",
    descKey: "slide2_desc",
    features: [
      "Set monthly budgets for each month",
      "Visualize spending by category",
      "Forecast upcoming expenses",
      "See spending trends over time",
    ],
  },
  {
    icon: "📅",
    accent: (C) => C.purple,
    titleKey: "slide3_title",
    descKey: "slide3_desc",
    features: [
      "Monthly calendar with color-coded sessions",
      "Link sessions to events & expenses",
      "Training, competition, lesson types",
      "Sync sessions with your partner",
    ],
  },
  {
    icon: "🧾",
    accent: (C) => C.gold,
    titleKey: "slide4_title",
    descKey: "slide4_desc",
    features: [
      "13 expense categories (costume, flight, hotel…)",
      "Paid vs. Planned status tracking",
      "Filter by category and time period",
      "Attach expenses to events",
    ],
  },
  {
    icon: "🏆",
    accent: (C) => C.gold,
    titleKey: "slide5_title",
    descKey: "slide5_desc",
    features: [
      "Create tournaments, camps & competitions",
      "Checklists & task management",
      "File attachments (documents, PDFs)",
      "Event budget with per-event expenses",
    ],
  },
  {
    icon: "🤝",
    accent: (C) => C.accent,
    titleKey: "slide6_title",
    descKey: "slide6_desc",
    features: [
      "50 / 50 expense split calculation",
      "Proposal system (hotel, transport, training)",
      "Real-time sync via WebSocket",
      "See who owes what at a glance",
    ],
  },
  {
    icon: "📊",
    accent: (C) => C.purple,
    titleKey: "slide7_title",
    descKey: "slide7_desc",
    features: [
      "Per-judge cross analysis for each round",
      "Best & worst dances identification",
      "Final results with skating system",
      "Compare your result to all couples",
    ],
  },
  {
    icon: "🚀",
    accent: (C) => C.accent,
    titleKey: "slide8_title",
    descKey: "slide8_desc",
    features: [],
  },
];

export default function OnboardingScreen() {
  const C = useC();
  const T = useT();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const { completeOnboarding } = useOnboardingStore();

  const [currentIdx, setCurrentIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== currentIdx) setCurrentIdx(idx);
  };

  const goToSlide = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * SW, animated: true });
    setCurrentIdx(idx);
  };

  const handleNext = () => {
    if (currentIdx < SLIDES.length - 1) {
      goToSlide(currentIdx + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    completeOnboarding();
    router.replace("/");
  };

  const isLast = currentIdx === SLIDES.length - 1;
  const slide  = SLIDES[currentIdx];
  const accent = slide.accent(C);

  return (
    <View style={s.root}>
      <AppBackground />
      {/* Slide pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={s.pager}
        decelerationRate="fast"
      >
        {SLIDES.map((sl, i) => (
          <SlideView key={i} slide={sl} index={i} T={T} C={C} s={s} />
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={s.controls}>
        {/* Dot indicators */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <PressableScale key={i} onPress={() => goToSlide(i)}>
              <View
                style={[
                  s.dot,
                  i === currentIdx
                    ? [s.dotActive, { backgroundColor: accent }]
                    : { backgroundColor: C.border },
                ]}
              />
            </PressableScale>
          ))}
        </View>

        {/* Action buttons */}
        <View style={s.btnRow}>
          {!isLast ? (
            <PressableScale style={s.skipBtn} onPress={finish}>
              <Text style={[s.skipText, { color: C.t3 }]}>{T.onboarding.skip}</Text>
            </PressableScale>
          ) : <View style={s.skipBtn} />}

          <PressableScale style={s.nextBtn} onPress={handleNext}>
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.nextBtnFill}
            >
              <Text style={s.nextBtnText}>
                {isLast ? T.onboarding.getStarted : T.onboarding.next}
              </Text>
            </LinearGradient>
          </PressableScale>
        </View>

        {/* Step counter */}
        <Text style={[s.stepText, { color: C.t3 }]}>
          {currentIdx + 1} {T.onboarding.stepOf} {SLIDES.length}
        </Text>
      </View>
    </View>
  );
}

// ─── Slide View ───────────────────────────────────────────────────────────────

function SlideView({
  slide, index, T, C, s,
}: {
  slide: Slide;
  index: number;
  T: ReturnType<typeof useT>;
  C: Palette;
  s: ReturnType<typeof makeStyles>;
}) {
  const accent = slide.accent(C);
  const title  = T.onboarding[slide.titleKey] as string;
  const desc   = T.onboarding[slide.descKey]  as string;

  // Feature bullets per slide — short technical labels kept in English (universally understood)
  const featureLabels: Record<string, string[]> = {
    slide2_title: ["Monthly budget limits", "Category breakdown charts", "Multi-month forecasts", "Weekly spending trends"],
    slide3_title: ["Color-coded calendar grid", "Session types with icons", "Event & expense linking", "Partner schedule sync"],
    slide4_title: ["13 expense categories", "Paid vs. Planned status", "Category & period filters", "Event attachment"],
    slide5_title: ["Tournament / camp creation", "Built-in checklists", "File attachments", "Per-event budget tracking"],
    slide6_title: ["50/50 expense splitting", "Proposal workflow", "Real-time WebSocket sync", "Balance overview"],
    slide7_title: ["Judge-by-judge cross analysis", "Best & worst dance insights", "Skating system final results", "Full field comparison"],
  };

  const features = featureLabels[slide.titleKey] ?? [];
  const isFirst = index === 0;
  const isLast  = index === SLIDES.length - 1;

  return (
    <View style={[s.slide, { width: SW }]}>
      {/* Icon bubble */}
      <Animated.View
        entering={FadeInDown.delay(150).springify().damping(16).stiffness(140)}
        style={[s.iconBubble, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}
      >
        <Text style={s.icon}>{slide.icon}</Text>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        entering={FadeInDown.delay(270).springify().damping(16).stiffness(140)}
        style={[s.title, { color: C.t1 }]}
      >
        {title}
      </Animated.Text>

      {/* Description */}
      <Animated.Text
        entering={FadeInDown.delay(360).springify().damping(16).stiffness(140)}
        style={[s.desc, { color: C.t2 }]}
      >
        {desc}
      </Animated.Text>

      {/* Features list */}
      {features.length > 0 ? (
        <Animated.View
          entering={FadeInUp.delay(320).duration(500)}
          style={[s.featureCard, { backgroundColor: C.card, borderColor: C.border }]}
        >
          {features.map((f, i) => (
            <View key={i} style={[s.featureRow, i < features.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
              <View style={[s.featureDot, { backgroundColor: accent }]} />
              <Text style={[s.featureText, { color: C.t1 }]}>{f}</Text>
            </View>
          ))}
        </Animated.View>
      ) : isFirst ? (
        <Animated.View
          entering={FadeInUp.delay(320).duration(500)}
          style={[s.featureCard, { backgroundColor: C.card, borderColor: C.border }]}
        >
          {[
            { icon: "💸", label: T.onboarding.welcomeFeat1 },
            { icon: "📅", label: T.onboarding.welcomeFeat2 },
            { icon: "🤝", label: T.onboarding.welcomeFeat3 },
            { icon: "📊", label: T.onboarding.welcomeFeat4 },
          ].map((item, i, arr) => (
            <View key={i} style={[s.featureRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
              <Text style={s.featureIcon}>{item.icon}</Text>
              <Text style={[s.featureText, { color: C.t1 }]}>{item.label}</Text>
            </View>
          ))}
        </Animated.View>
      ) : isLast ? (
        <Animated.View
          entering={FadeInUp.delay(320).duration(500)}
          style={[s.tipCard, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}
        >
          <Text style={[s.tipIcon]}>💡</Text>
          <Text style={[s.tipText, { color: C.t1 }]}>{T.onboarding.tip}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  const bottomPad = Platform.OS === "ios" ? 40 : 28;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.bg,
    },
    pager: {
      flex: 1,
    },
    slide: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingTop: SH * 0.06,
      paddingBottom: 20,
      gap: 20,
    },
    iconBubble: {
      width: 120,
      height: 120,
      borderRadius: 36,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    icon: {
      fontSize: 56,
    },
    title: {
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.6,
      textAlign: "center",
      lineHeight: 36,
    },
    desc: {
      fontSize: 15,
      fontWeight: "300",
      textAlign: "center",
      lineHeight: 23,
      maxWidth: 320,
    },
    featureCard: {
      width: "100%",
      borderRadius: 20,
      borderWidth: 1,
      overflow: "hidden",
      marginTop: 4,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 13,
      gap: 12,
    },
    featureDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    featureIcon: {
      fontSize: 18,
    },
    featureText: {
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
    tipCard: {
      width: "100%",
      borderRadius: 16,
      borderWidth: 1,
      padding: 18,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginTop: 4,
    },
    tipIcon: {
      fontSize: 20,
      marginTop: 1,
    },
    tipText: {
      fontSize: 14,
      lineHeight: 21,
      flex: 1,
      fontWeight: "500",
    },

    // Controls
    controls: {
      paddingHorizontal: 24,
      paddingBottom: bottomPad,
      paddingTop: 12,
      gap: 16,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    dot: {
      height: 8,
      borderRadius: 4,
      width: 8,
    },
    dotActive: {
      width: 24,
    },
    btnRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    skipBtn: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      minWidth: 80,
    },
    skipText: {
      fontSize: 15,
      fontWeight: "600",
    },
    nextBtn: {
      flex: 1,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#FF3D68",
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    nextBtnFill: {
      paddingVertical: 16,
      alignItems: "center",
    },
    nextBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    stepText: {
      fontSize: 12,
      textAlign: "center",
      fontWeight: "500",
    },
  });
}
