import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import {
  useWdsfStore,
  ELO_PER_POINT,
  type CoupleRating,
  type CategoryRating,
  type CoupleRatingComponent,
  type DeepEventSignal,
  type TournamentTier,
} from "../../store/useWdsfStore";
import PressableScale from "../../components/ui/PressableScale";
import GradientButton from "../../components/ui/GradientButton";
import Hint from "../../components/ui/Hint";
import { GRADIENTS, SHADOWS, glow, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import { useT } from "../../lib/i18n";

// ─── Tier visuals (shared language with the tournament-rating cards) ───────────
type GradTuple = readonly [string, string, ...string[]];
const TIER_GRADIENTS: Record<TournamentTier, GradTuple> = {
  S: GRADIENTS.gold,
  A: GRADIENTS.brand,
  B: GRADIENTS.purple,
  C: ["#0EA5E9", "#38BDF8", "#22D3EE"],
  D: ["#64748B", "#94A3B8", "#94A3B8"],
  Unrated: ["#64748B", "#94A3B8", "#94A3B8"],
};
const TIER_NAME: Record<TournamentTier, string> = {
  S: "World Elite", A: "Top Contender", B: "Strong", C: "Developing", D: "Emerging", Unrated: "Unrated",
};
function tierColor(tier: TournamentTier, C: Palette): string {
  switch (tier) {
    case "S": return C.gold;
    case "A": return C.accent;
    case "B": return C.purple;
    case "C": return "#0EA5E9";
    default:  return C.t2;
  }
}

export default function RatingScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const profile = useWdsfStore((st) => st.profile);
  const categories = useWdsfStore((st) => st.coupleCategories);
  const loading = useWdsfStore((st) => st.coupleRatingLoading);
  const error = useWdsfStore((st) => st.coupleRatingError);
  const fetchProfile = useWdsfStore((st) => st.fetchProfile);
  const fetchCoupleRating = useWdsfStore((st) => st.fetchCoupleRating);

  const [selected, setSelected] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Ensure link state is known, then compute the rating (cached server-side).
      (async () => {
        await fetchProfile();
        if (useWdsfStore.getState().profile) fetchCoupleRating();
      })();
    }, [fetchProfile, fetchCoupleRating]),
  );

  // Resolve the selected category (default to the primary / first one).
  const current = useMemo(() => {
    if (!categories || categories.length === 0) return null;
    return categories.find((c) => c.combinedType === selected) ?? categories[0];
  }, [categories, selected]);

  // Not linked → invite to connect WDSF first.
  if (!profile && !loading) {
    return (
      <View style={s.center}>
        <View style={s.emptyIcon}><Text style={s.emptyIconText}>★</Text></View>
        <Text style={s.emptyTitle}>No WDSF profile linked</Text>
        <Text style={s.emptySub}>
          Connect your World DanceSport profile to unlock your couple rating, world rank
          and regional standing.
        </Text>
        <GradientButton onPress={() => router.push("/wdsf-profile")} contentStyle={{ paddingVertical: 13, paddingHorizontal: 26 }}>
          <Text style={s.primaryBtnText}>Connect WDSF Profile</Text>
        </GradientButton>
      </View>
    );
  }

  if (loading && !current) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={s.loadingText}>Analysing your results…{"\n"}Tiers, upsets and world ranking</Text>
      </View>
    );
  }

  if (error && !current) {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>Couldn’t compute your rating</Text>
        <Text style={s.emptySub}>{error}</Text>
        <PressableScale style={s.retryBtn} onPress={() => fetchCoupleRating(true)}>
          <Text style={s.retryBtnText}>↺ Try again</Text>
        </PressableScale>
      </View>
    );
  }

  if (!current || !categories) return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;

  return (
    <RatingView
      rating={current.rating}
      categories={categories}
      selected={current.combinedType}
      onSelect={setSelected}
      loading={loading}
      onRefresh={() => fetchCoupleRating(true)}
    />
  );
}

// ─── Category tabs ──────────────────────────────────────────────────────────────

function CategoryTabs({
  categories, selected, onSelect,
}: {
  categories: CategoryRating[];
  selected: string;
  onSelect: (combinedType: string) => void;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  if (categories.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.tabsRow}
      style={s.tabsScroll}
    >
      {categories.map((c) => {
        const active = c.combinedType === selected;
        const color = tierColor(c.rating.tier, C);
        return (
          <PressableScale
            key={c.combinedType}
            onPress={() => onSelect(c.combinedType)}
            style={[s.tab, active && { backgroundColor: `${color}1A`, borderColor: `${color}66` }]}
          >
            <Text style={[s.tabText, active && { color }]} numberOfLines={1}>{c.label}</Text>
            <Text style={[s.tabElo, active && { color }]}>{c.rating.elo}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

function RatingView({
  rating, categories, selected, onSelect, loading, onRefresh,
}: {
  rating: CoupleRating;
  categories: CategoryRating[];
  selected: string;
  onSelect: (combinedType: string) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const C = useC();
  const t = useT();
  const s = useMemo(() => makeStyles(C), [C]);
  const color = tierColor(rating.tier, C);
  const st = rating.stats;

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>

      <CategoryTabs categories={categories} selected={selected} onSelect={onSelect} />

      <Hint
        id="rating.intro"
        title={t.hints.ratingTitle}
        text={t.hints.ratingText}
        gradient="brand"
        icon="info"
        style={{ marginTop: 16 }}
      />

      {/* Hero — circular rating gauge */}
      <Animated.View entering={FadeInDown.delay(0).duration(420)} style={s.heroCard}>
        <LinearGradient
          colors={[`${color}28`, `${color}10`, "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />
        <RatingRing elo={rating.elo} tier={rating.tier} color={color} />
        <Text style={[s.tierName, { color }]}>{TIER_NAME[rating.tier]}</Text>
        <View style={[s.tierPill, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
          <Text style={[s.tierPillText, { color }]}>Tier {rating.tier}</Text>
        </View>
        {rating.region ? <Text style={s.heroRegion}>Represents {rating.region}</Text> : null}
      </Animated.View>

      {/* Rank cards — world & regional */}
      <Animated.View entering={FadeInDown.delay(60).duration(420)} style={s.rankRow}>
        <RankCard
          label="World Rank"
          value={rating.worldRank ? `#${rating.worldRank}` : "—"}
          sub={rating.worldRank ? "WDSF World Ranking" : "Not in top-200"}
          gradient={GRADIENTS.brand}
        />
        <RankCard
          label="Regional Rank"
          value={rating.regionalRank ? `#${rating.regionalRank}` : "—"}
          sub={rating.region ? `in ${rating.region}` : "Region unknown"}
          gradient={GRADIENTS.gold}
        />
      </Animated.View>

      {/* Quick stats strip */}
      <Animated.View entering={FadeInDown.delay(100).duration(420)} style={s.statsRow}>
        <StatBox label="Avg Place" value={st.avgPlace != null ? st.avgPlace.toFixed(1) : "—"} />
        <View style={s.statsDivider} />
        <StatBox label="Finals" value={String(st.finals)} />
        <View style={s.statsDivider} />
        <StatBox label="Podiums" value={String(st.podiums)} />
        <View style={s.statsDivider} />
        <StatBox label="Wins" value={String(st.firstPlaces)} />
      </Animated.View>

      {/* Upset / form highlight strip */}
      <Animated.View entering={FadeInDown.delay(130).duration(420)} style={s.highlightRow}>
        <HighlightCard icon="▲" tint={C.accent} label="Upset wins" value={String(st.upsetWins)} hint="beat higher-ranked" />
        <HighlightCard icon="▼" tint={C.red} label="Bad losses" value={String(st.badLosses)} hint="lost to lower-ranked" />
        <HighlightCard
          icon="◷"
          tint={st.monthsSinceLast != null && st.monthsSinceLast > 4 ? C.gold : C.t2}
          label="Last danced"
          value={st.monthsSinceLast != null ? `${st.monthsSinceLast.toFixed(0)}mo` : "—"}
          hint="ago"
        />
      </Animated.View>

      {/* Components breakdown */}
      <Animated.View entering={FadeInDown.delay(160).duration(420)} style={s.section}>
        <SectionHeader title="Rating breakdown" subtitle="What lifts your score" />
        <View style={s.sectionCard}>
          {rating.components.map((c, i) => (
            <ComponentRow key={c.key} comp={c} isLast={i === rating.components.length - 1} />
          ))}
        </View>
        <Text style={s.baseNote}>
          Base Elo {Math.round(1000 + (rating.baseRating - 1) * ELO_PER_POINT)} from weighted components
          {rating.bonuses.length || rating.penalties.length ? ", before the adjustments below." : "."}
        </Text>
      </Animated.View>

      {/* Bonuses — prestige-tournament boosts */}
      {rating.bonuses.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(185).duration(420)} style={s.section}>
          <SectionHeader title="Bonuses" subtitle="Marquee tournament boosts" />
          <View style={s.sectionCard}>
            {rating.bonuses.map((b, i) => (
              <View key={b.key} style={[s.penaltyRow, i < rating.bonuses.length - 1 && s.rowBorder]}>
                <View style={s.bonusDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.penaltyLabel}>{b.label}</Text>
                  <Text style={s.penaltyDetail} numberOfLines={2}>{b.detail}</Text>
                </View>
                <Text style={s.bonusAmount}>+{Math.round(b.amount * ELO_PER_POINT)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Penalties */}
      {rating.penalties.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(190).duration(420)} style={s.section}>
          <SectionHeader title="Penalties" subtitle="What pulls your score down" />
          <View style={s.sectionCard}>
            {rating.penalties.map((p, i) => (
              <View key={p.key} style={[s.penaltyRow, i < rating.penalties.length - 1 && s.rowBorder]}>
                <View style={s.penaltyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.penaltyLabel}>{p.label}</Text>
                  <Text style={s.penaltyDetail} numberOfLines={2}>{p.detail}</Text>
                </View>
                <Text style={s.penaltyAmount}>−{Math.round(p.amount * ELO_PER_POINT)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Deep per-event analysis */}
      {rating.events.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(220).duration(420)} style={s.section}>
          <SectionHeader
            title="Recent tournaments"
            subtitle={`${rating.events.length} analysed in depth`}
          />
          <View style={s.sectionCard}>
            {rating.events.map((e, i) => (
              <EventRow key={i} ev={e} isLast={i === rating.events.length - 1} />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Refresh */}
      <Animated.View entering={FadeInDown.delay(250).duration(420)} style={s.section}>
        <PressableScale style={s.refreshBtn} onPress={onRefresh} disabled={loading}>
          {loading ? <ActivityIndicator color={C.accent} size="small" /> : <Text style={s.refreshBtnText}>↺ Recalculate rating</Text>}
        </PressableScale>
        <Text style={s.disclaimer}>
          Experimental Elo rating (chess-style, 1000–2800). Built from your average placement, the
          strength (S–D) of the fields you dance, your standing vs the WDSF World Ranking, finals &
          podiums, and form.
        </Text>
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Circular gauge ──────────────────────────────────────────────────────────

function RatingRing({ elo, tier, color }: { elo: number; tier: TournamentTier; color: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const SIZE = 168, STROKE = 13;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  // Fill the ring by where the Elo sits in the 1000–2800 scale.
  const pct = Math.max(0, Math.min(1, (elo - 1000) / 1800));
  const grad = TIER_GRADIENTS[tier];

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad[0]} />
            <Stop offset="1" stopColor={grad[grad.length - 1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={C.elevated} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          stroke="url(#ringGrad)" strokeWidth={STROKE} fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
        />
      </Svg>
      <View style={s.ringCenter}>
        <Text style={[s.ringValue, { color }]}>{elo}</Text>
        <Text style={s.ringMax}>ELO</Text>
        <Text style={s.ringTierLetter}>{tier}</Text>
      </View>
    </View>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function RankCard({ label, value, sub, gradient }: { label: string; value: string; sub: string; gradient: GradTuple }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.rankCard}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.rankAccent} />
      <Text style={s.rankLabel}>{label}</Text>
      <Text style={s.rankValue}>{value}</Text>
      <Text style={s.rankSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function HighlightCard({ icon, tint, label, value, hint }: { icon: string; tint: string; label: string; value: string; hint: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.highlightCard}>
      <Text style={[s.highlightIcon, { color: tint }]}>{icon}</Text>
      <Text style={[s.highlightValue, { color: tint }]}>{value}</Text>
      <Text style={s.highlightLabel} numberOfLines={1}>{label}</Text>
      <Text style={s.highlightHint} numberOfLines={1}>{hint}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.sectionHeaderRow}>
      <Text style={s.sectionHeaderTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionHeaderSub}>{subtitle}</Text> : null}
    </View>
  );
}

function ComponentRow({ comp, isLast }: { comp: CoupleRatingComponent; isLast: boolean }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const pct = Math.round(comp.score * 100);
  // Colour the bar by strength: strong = accent/gold, weak = red.
  const col = comp.score >= 0.66 ? C.accent : comp.score >= 0.4 ? C.gold : C.red;
  return (
    <View style={[s.compRow, !isLast && s.rowBorder]}>
      <View style={s.compTop}>
        <Text style={s.compLabel}>{comp.label}</Text>
        <Text style={s.compWeight}>{Math.round(comp.weight * 100)}%</Text>
      </View>
      <View style={s.compBarTrack}>
        <View style={[s.compBarFill, { width: `${Math.max(3, pct)}%`, backgroundColor: col }]} />
      </View>
      <Text style={s.compDetail} numberOfLines={1}>{comp.detail}</Text>
    </View>
  );
}

function EventRow({ ev, isLast }: { ev: DeepEventSignal; isLast: boolean }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.eventRow, !isLast && s.rowBorder]}>
      <View style={s.eventTierTile}>
        <LinearGradient colors={TIER_GRADIENTS[ev.tier]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={s.eventTierLetter}>{ev.tier}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.eventName} numberOfLines={1}>{ev.event || "Competition"}</Text>
        <Text style={s.eventMeta} numberOfLines={1}>
          {[ev.date, ev.myPlace ? `Place #${ev.myPlace}` : null, ev.myWorldRank ? `World #${ev.myWorldRank}` : null]
            .filter(Boolean).join(" · ")}
        </Text>
        <View style={s.chipRow}>
          {ev.upsetWins > 0 ? <Chip tint={C.accent} text={`▲ ${ev.upsetWins} upset`} /> : null}
          {ev.badLosses > 0 ? <Chip tint={C.red} text={`▼ ${ev.badLosses} loss`} /> : null}
          {ev.reachedFinal ? <Chip tint={C.gold} text="★ final" /> : null}
          {ev.roundOneExit ? <Chip tint={C.red} text="⚠ round 1" /> : null}
        </View>
      </View>
    </View>
  );
}

function Chip({ tint, text }: { tint: string; text: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.chip, { backgroundColor: `${tint}1A`, borderColor: `${tint}40` }]}>
      <Text style={[s.chipText, { color: tint }]}>{text}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
    loadingText: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20 },

    // Category tabs
    tabsScroll: { maxHeight: 60, marginTop: 12 },
    tabsRow: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
    tab: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9,
    },
    tabText: { color: C.t2, fontSize: 13, fontWeight: "700" },
    tabElo: { color: C.t3, fontSize: 12, fontWeight: "800", letterSpacing: -0.3 },

    // Empty / error
    emptyIcon: {
      width: 72, height: 72, borderRadius: 22, backgroundColor: C.elevated,
      borderWidth: 2, borderColor: C.accentBorder, alignItems: "center", justifyContent: "center",
    },
    emptyIconText: { color: C.accent, fontSize: 32, fontWeight: "900" },
    emptyTitle: { color: C.t1, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, textAlign: "center" },
    emptySub: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20 },
    errorTitle: { color: C.red, fontSize: 18, fontWeight: "800", textAlign: "center" },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    retryBtn: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.accentFade,
      borderWidth: 1, borderColor: C.accentBorder, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 22,
    },
    retryBtnText: { color: C.accent, fontSize: 14, fontWeight: "700" },

    // Hero
    heroCard: {
      margin: 20, marginBottom: 10, backgroundColor: C.card, borderRadius: 24,
      borderWidth: 1, borderColor: C.border, alignItems: "center",
      paddingVertical: 28, paddingHorizontal: 20, overflow: "hidden",
      ...SHADOWS.md, ...glow(C.accent, 26, 0.20),
    },
    ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
    ringValue: { fontSize: 42, fontWeight: "900", letterSpacing: -1.5 },
    ringMax: { color: C.t3, fontSize: 13, fontWeight: "800", letterSpacing: 2, marginTop: 1 },
    ringTierLetter: { color: C.t3, fontSize: 13, fontWeight: "800", letterSpacing: 3, marginTop: 2 },
    tierName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, marginTop: 16 },
    tierPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, marginTop: 8 },
    tierPillText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
    heroRegion: { color: C.t2, fontSize: 13, marginTop: 12 },

    // Rank cards
    rankRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 10 },
    rankCard: {
      flex: 1, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border,
      paddingVertical: 16, paddingHorizontal: 16, overflow: "hidden",
      ...SHADOWS.sm,
    },
    rankAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
    rankLabel: { color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
    rankValue: { color: C.t1, fontSize: 30, fontWeight: "900", letterSpacing: -1, marginTop: 6 },
    rankSub: { color: C.t2, fontSize: 12, marginTop: 2 },

    // Stats strip
    statsRow: {
      marginHorizontal: 20, marginBottom: 10, backgroundColor: C.card, borderRadius: 18,
      borderWidth: 1, borderColor: C.border, flexDirection: "row",
      ...SHADOWS.sm,
    },
    statBox: { flex: 1, alignItems: "center", paddingVertical: 14 },
    statValue: { color: C.t1, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
    statLabel: { color: C.t3, fontSize: 10, fontWeight: "500", marginTop: 2 },
    statsDivider: { width: 1, backgroundColor: C.border, marginVertical: 10 },

    // Highlight cards
    highlightRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 10 },
    highlightCard: {
      flex: 1, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border,
      alignItems: "center", paddingVertical: 14, paddingHorizontal: 8,
    },
    highlightIcon: { fontSize: 16, fontWeight: "900" },
    highlightValue: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
    highlightLabel: { color: C.t1, fontSize: 11, fontWeight: "700", marginTop: 3 },
    highlightHint: { color: C.t3, fontSize: 10, marginTop: 1 },

    // Sections
    section: { paddingHorizontal: 20, marginBottom: 6 },
    sectionHeaderRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: 8, marginTop: 6,
    },
    sectionHeaderTitle: { color: C.t1, fontSize: 15, fontWeight: "700" },
    sectionHeaderSub: { color: C.t3, fontSize: 11 },
    sectionCard: {
      backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden",
      ...SHADOWS.sm,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },

    // Component rows
    compRow: { paddingHorizontal: 16, paddingVertical: 13 },
    compTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    compLabel: { color: C.t1, fontSize: 14, fontWeight: "600" },
    compWeight: { color: C.t3, fontSize: 11, fontWeight: "700" },
    compBarTrack: { height: 7, borderRadius: 4, backgroundColor: C.elevated, overflow: "hidden" },
    compBarFill: { height: "100%", borderRadius: 4 },
    compDetail: { color: C.t3, fontSize: 11, marginTop: 6 },
    baseNote: { color: C.t3, fontSize: 11, marginTop: 8, paddingHorizontal: 4, lineHeight: 16 },

    // Penalties
    penaltyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
    penaltyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
    penaltyLabel: { color: C.t1, fontSize: 14, fontWeight: "600" },
    penaltyDetail: { color: C.t3, fontSize: 11, marginTop: 2 },
    penaltyAmount: { color: C.red, fontSize: 16, fontWeight: "800" },

    // Bonuses
    bonusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
    bonusAmount: { color: "#10B981", fontSize: 16, fontWeight: "800" },

    // Event rows
    eventRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    eventTierTile: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    eventTierLetter: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
    eventName: { color: C.t1, fontSize: 14, fontWeight: "600" },
    eventMeta: { color: C.t3, fontSize: 11, marginTop: 2 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
    chipText: { fontSize: 10, fontWeight: "700" },

    // Refresh
    refreshBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: C.accentFade, borderWidth: 1, borderColor: C.accentBorder,
      borderRadius: 14, paddingVertical: 14, marginTop: 4,
    },
    refreshBtnText: { color: C.accent, fontSize: 14, fontWeight: "700" },
    disclaimer: { color: C.t3, fontSize: 11, lineHeight: 16, marginTop: 12, paddingHorizontal: 4 },
  });
}
