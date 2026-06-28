import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  useWdsfStore,
  type LeaderboardRow,
  type LeaderboardCategory,
  type TournamentTier,
} from "../../store/useWdsfStore";
import PressableScale from "../../components/ui/PressableScale";
import GradientButton from "../../components/ui/GradientButton";
import Hint from "../../components/ui/Hint";
import { GRADIENTS, SHADOWS, glow, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import { useT } from "../../lib/i18n";

// ─── Tier visuals (shared language with the Rating screen) ─────────────────────
type GradTuple = readonly [string, string, ...string[]];
const TIER_GRADIENTS: Record<TournamentTier, GradTuple> = {
  S: GRADIENTS.gold,
  A: GRADIENTS.brand,
  B: GRADIENTS.purple,
  C: ["#0EA5E9", "#38BDF8", "#22D3EE"],
  D: ["#64748B", "#94A3B8", "#94A3B8"],
  Unrated: ["#64748B", "#94A3B8", "#94A3B8"],
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

// Medal colours for the podium / top-3 badges.
const MEDALS: GradTuple[] = [
  GRADIENTS.gold,           // 1st
  ["#9CA3AF", "#D1D5DB"],   // 2nd — silver
  ["#B45309", "#D97706"],   // 3rd — bronze
];

export default function LeaderboardScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const t = useT();
  const profile = useWdsfStore((st) => st.profile);
  const board = useWdsfStore((st) => st.leaderboard);
  const categories = useWdsfStore((st) => st.leaderboardCategories);
  const category = useWdsfStore((st) => st.leaderboardCategory);
  const loading = useWdsfStore((st) => st.leaderboardLoading);
  const error = useWdsfStore((st) => st.leaderboardError);
  const fetchProfile = useWdsfStore((st) => st.fetchProfile);
  const fetchLeaderboard = useWdsfStore((st) => st.fetchLeaderboard);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchLeaderboard();
    }, [fetchProfile, fetchLeaderboard]),
  );

  const onRefresh = useCallback(
    () => fetchLeaderboard({ category: category ?? undefined, force: true }),
    [fetchLeaderboard, category],
  );
  const onSelectCategory = useCallback(
    (ct: string) => fetchLeaderboard({ category: ct }),
    [fetchLeaderboard],
  );

  if (loading && !board) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={s.loadingText}>{t.leaderboard.loading}</Text>
      </View>
    );
  }

  if (error && !board) {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>{t.leaderboard.errorTitle}</Text>
        <Text style={s.emptySub}>{error}</Text>
        <PressableScale style={s.retryBtn} onPress={onRefresh}>
          <Text style={s.retryBtnText}>↺ {t.leaderboard.retry}</Text>
        </PressableScale>
      </View>
    );
  }

  // No categories at all → nobody is ranked yet (or no one linked).
  if (board && board.length === 0 && (!categories || categories.length === 0)) {
    return (
      <View style={s.center}>
        <View style={s.emptyIcon}><Text style={s.emptyIconText}>🏆</Text></View>
        <Text style={s.emptyTitle}>{t.leaderboard.emptyTitle}</Text>
        <Text style={s.emptySub}>{t.leaderboard.emptySub}</Text>
        {!profile ? (
          <GradientButton onPress={() => router.push("/wdsf-profile")} contentStyle={{ paddingVertical: 13, paddingHorizontal: 26 }}>
            <Text style={s.primaryBtnText}>{t.leaderboard.connect}</Text>
          </GradientButton>
        ) : null}
      </View>
    );
  }

  if (!board) return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;

  return (
    <LeaderboardView
      rows={board}
      categories={categories ?? []}
      selected={category}
      onSelectCategory={onSelectCategory}
      loading={loading}
      onRefresh={onRefresh}
    />
  );
}

// ─── Category selector ──────────────────────────────────────────────────────────

function CategorySelector({
  categories, selected, onSelect,
}: {
  categories: LeaderboardCategory[];
  selected: string | null;
  onSelect: (combinedType: string) => void;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  if (categories.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.catRow}
      style={s.catScroll}
    >
      {categories.map((c) => {
        const active = c.combinedType === selected;
        return (
          <PressableScale
            key={c.combinedType}
            onPress={() => onSelect(c.combinedType)}
            style={[s.catChip, active && s.catChipActive]}
          >
            <Text style={[s.catChipText, active && s.catChipTextActive]} numberOfLines={1}>{c.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

function LeaderboardView({
  rows, categories, selected, onSelectCategory, loading, onRefresh,
}: {
  rows: LeaderboardRow[];
  categories: LeaderboardCategory[];
  selected: string | null;
  onSelectCategory: (combinedType: string) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const t = useT();

  const podium = rows.length >= 3 ? rows.slice(0, 3) : [];
  const rest = podium.length ? rows.slice(3) : rows;
  const currentLabel = categories.find((c) => c.combinedType === selected)?.label ?? null;

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* Hero header */}
      <Animated.View entering={FadeInDown.duration(420)} style={s.hero}>
        <LinearGradient
          colors={[`${C.accent}22`, "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />
        <Text style={s.heroTitle}>{t.leaderboard.title}</Text>
        <Text style={s.heroSub}>{t.leaderboard.subtitle}</Text>
        <View style={s.heroPills}>
          {currentLabel ? (
            <View style={[s.heroCountPill, s.heroCatPill]}>
              <Text style={s.heroCatText}>{currentLabel}</Text>
            </View>
          ) : null}
          <View style={s.heroCountPill}>
            <Text style={s.heroCountText}>{rows.length} {t.leaderboard.dancers}</Text>
          </View>
        </View>
        <PressableScale style={s.recomputeBtn} onPress={onRefresh} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={C.accent} size="small" />
          ) : (
            <Text style={s.recomputeBtnText}>↻ {t.leaderboard.recompute}</Text>
          )}
        </PressableScale>
      </Animated.View>

      {/* Category selector */}
      <CategorySelector categories={categories} selected={selected} onSelect={onSelectCategory} />

      <Hint
        id="leaderboard.intro"
        title={t.hints.leaderboardTitle}
        text={t.hints.leaderboardText}
        gradient="gold"
        icon="spark"
      />

      {rows.length === 0 ? (
        <View style={s.emptyCatNote}>
          <Text style={s.emptyCatText}>No dancers ranked in this category yet.</Text>
        </View>
      ) : null}

      {/* Podium — top 3 */}
      {podium.length === 3 ? (
        <Animated.View entering={FadeInDown.delay(60).duration(420)} style={s.podiumRow}>
          <PodiumPillar row={podium[1]} place={2} />
          <PodiumPillar row={podium[0]} place={1} />
          <PodiumPillar row={podium[2]} place={3} />
        </Animated.View>
      ) : null}

      {/* The rest (or the whole list when < 3 entries) */}
      {rest.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(100).duration(420)} style={s.listCard}>
          {rest.map((r, i) => (
            <Row key={r.userId} row={r} isLast={i === rest.length - 1} />
          ))}
        </Animated.View>
      ) : null}

      <Text style={s.disclaimer}>{t.leaderboard.disclaimer}</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Podium pillar (top 3) ─────────────────────────────────────────────────────

function PodiumPillar({ row, place }: { row: LeaderboardRow; place: 1 | 2 | 3 }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const medal = MEDALS[place - 1];
  const color = tierColor(row.tier, C);
  const isFirst = place === 1;
  const initials = row.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <View style={[s.pillar, isFirst && s.pillarFirst]}>
      <View style={[s.avatar, isFirst && s.avatarFirst, row.isMe && { borderColor: C.accent, borderWidth: 2 }]}>
        <LinearGradient colors={medal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={[s.avatarInitials, isFirst && { fontSize: 22 }]}>{initials || "?"}</Text>
        <View style={s.medalBadge}><Text style={s.medalBadgeText}>{place}</Text></View>
      </View>
      <Text style={[s.pillarName, isFirst && { fontSize: 14 }]} numberOfLines={1}>
        {row.isMe ? "You" : row.name}
      </Text>
      {row.region ? <Text style={s.pillarRegion} numberOfLines={1}>{row.region}</Text> : null}
      <View style={[s.pillarBase, isFirst && s.pillarBaseFirst]}>
        <Text style={[s.pillarRating, { color }]}>{row.elo}</Text>
        <Text style={s.pillarTier}>Tier {row.tier}</Text>
      </View>
    </View>
  );
}

// ─── List row ──────────────────────────────────────────────────────────────────

function Row({ row, isLast }: { row: LeaderboardRow; isLast: boolean }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const color = tierColor(row.tier, C);
  const top3 = row.position <= 3;
  const medal = top3 ? MEDALS[row.position - 1] : null;
  const sub = [row.region, row.worldRank ? `World #${row.worldRank}` : null].filter(Boolean).join(" · ");

  return (
    <View style={[s.row, !isLast && s.rowBorder, row.isMe && s.rowMe]}>
      {/* Rank badge */}
      {medal ? (
        <View style={s.rankMedal}>
          <LinearGradient colors={medal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={s.rankMedalText}>{row.position}</Text>
        </View>
      ) : (
        <View style={s.rankPlain}><Text style={s.rankPlainText}>{row.position}</Text></View>
      )}

      {/* Name + meta */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.nameRow}>
          <Text style={s.rowName} numberOfLines={1}>{row.name}</Text>
          {row.isMe ? <View style={s.youTag}><Text style={s.youTagText}>YOU</Text></View> : null}
        </View>
        {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>

      {/* Tier + Elo */}
      <View style={s.rowRight}>
        <Text style={[s.rowRating, { color }]}>{row.elo}</Text>
        <View style={[s.tierPill, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
          <Text style={[s.tierPillText, { color }]}>{row.tier}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
    loadingText: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20 },

    // Empty / error
    emptyIcon: {
      width: 72, height: 72, borderRadius: 22, backgroundColor: C.elevated,
      borderWidth: 2, borderColor: C.accentBorder, alignItems: "center", justifyContent: "center",
    },
    emptyIconText: { fontSize: 32 },
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
    hero: {
      margin: 20, marginBottom: 10, backgroundColor: C.card, borderRadius: 24,
      borderWidth: 1, borderColor: C.border, alignItems: "center",
      paddingVertical: 24, paddingHorizontal: 20, overflow: "hidden",
      ...SHADOWS.md, ...glow(C.accent, 24, 0.22),
    },
    heroTitle: { color: C.t1, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
    heroSub: { color: C.t2, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },
    heroPills: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap", justifyContent: "center" },
    heroCountPill: {
      backgroundColor: C.accentFade, borderWidth: 1, borderColor: C.accentBorder,
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    },
    heroCountText: { color: C.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    heroCatPill: { backgroundColor: C.elevated, borderColor: C.border },
    heroCatText: { color: C.t1, fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },

    // Category selector
    catScroll: { maxHeight: 52, marginBottom: 4 },
    catRow: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
    catChip: {
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    },
    catChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
    catChipText: { color: C.t2, fontSize: 13, fontWeight: "700" },
    catChipTextActive: { color: C.accent },

    // Empty category note
    emptyCatNote: { paddingHorizontal: 20, paddingVertical: 24, alignItems: "center" },
    emptyCatText: { color: C.t3, fontSize: 13, textAlign: "center" },
    recomputeBtn: {
      marginTop: 12, minHeight: 34, justifyContent: "center", alignItems: "center",
      backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
      borderRadius: 12, paddingHorizontal: 18, paddingVertical: 8,
    },
    recomputeBtnText: { color: C.t1, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },

    // Podium
    podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, paddingHorizontal: 20, marginBottom: 12 },
    pillar: { flex: 1, alignItems: "center" },
    pillarFirst: { marginBottom: 0 },
    avatar: {
      width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
      overflow: "hidden", marginBottom: 8,
    },
    avatarFirst: { width: 72, height: 72, borderRadius: 36 },
    avatarInitials: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
    medalBadge: {
      position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.card, borderWidth: 2, borderColor: C.bg, alignItems: "center", justifyContent: "center",
    },
    medalBadgeText: { color: C.t1, fontSize: 11, fontWeight: "900" },
    pillarName: { color: C.t1, fontSize: 13, fontWeight: "700", marginTop: 2, maxWidth: "100%" },
    pillarRegion: { color: C.t3, fontSize: 11, marginTop: 1 },
    pillarBase: {
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14,
      alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, marginTop: 8, minWidth: 84,
      ...SHADOWS.sm,
    },
    pillarBaseFirst: { paddingVertical: 14, borderColor: C.accentBorder },
    pillarRating: { fontSize: 22, fontWeight: "900", letterSpacing: -1 },
    pillarTier: { color: C.t3, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: 2 },

    // List
    listCard: {
      marginHorizontal: 20, backgroundColor: C.card, borderRadius: 18,
      borderWidth: 1, borderColor: C.border, overflow: "hidden",
      ...SHADOWS.sm,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    rowMe: { backgroundColor: C.accentFade },
    rankMedal: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    rankMedalText: { color: "#fff", fontSize: 14, fontWeight: "900" },
    rankPlain: { width: 30, alignItems: "center", justifyContent: "center" },
    rankPlainText: { color: C.t2, fontSize: 15, fontWeight: "800" },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    rowName: { color: C.t1, fontSize: 15, fontWeight: "700", flexShrink: 1 },
    youTag: { backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    youTagText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
    rowSub: { color: C.t3, fontSize: 12, marginTop: 2 },
    rowRight: { alignItems: "flex-end", gap: 4 },
    rowRating: { fontSize: 20, fontWeight: "900", letterSpacing: -0.8 },
    tierPill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1, minWidth: 24, alignItems: "center" },
    tierPillText: { fontSize: 11, fontWeight: "800" },

    disclaimer: { color: C.t3, fontSize: 11, lineHeight: 16, marginTop: 16, paddingHorizontal: 24, textAlign: "center" },
  });
}
