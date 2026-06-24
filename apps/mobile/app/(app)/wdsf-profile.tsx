import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useWdsfStore,
  type WdsfProfile,
  type WdsfCompetition,
  type WdsfPartner,
  type CompetitionAnalytics,
  type PrelimRound,
  type FinalResult,
  type Score3Round,
} from "../../store/useWdsfStore";
import PressableScale from "../../components/ui/PressableScale";
import type { Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

const WDSF_SEARCH_URL = "https://www.worlddancesport.org/Athletes";
const { width: SW } = Dimensions.get("window");

export default function WdsfProfileScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const { profile, loading, error, fetchProfile, linkByMin, linkByUrl, refresh, unlink } = useWdsfStore();

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  if (loading && !profile) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={s.loadingText}>Searching WDSF database...</Text>
      </View>
    );
  }

  if (!profile) {
    return <SetupScreen linkByMin={linkByMin} linkByUrl={linkByUrl} loading={loading} error={error} />;
  }

  return <ProfileView profile={profile} loading={loading} onRefresh={refresh} onUnlink={unlink} />;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function SetupScreen({
  linkByMin, linkByUrl, loading, error,
}: {
  linkByMin: (min: string) => Promise<void>;
  linkByUrl: (url: string, min?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [min, setMin]         = useState("");
  const [url, setUrl]         = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const handleLinkMin = async () => {
    if (!min.trim()) { Alert.alert("Enter your MIN", "Please enter your WDSF Member ID Number."); return; }
    try { await linkByMin(min.trim()); } catch { /* error shown from store */ }
  };

  const handleLinkUrl = async () => {
    if (!url.trim() || !url.includes("worlddancesport.org/Athletes/")) {
      Alert.alert("Invalid URL", "Please paste your full WDSF profile URL.");
      return;
    }
    try { await linkByUrl(url.trim(), min.trim() || undefined); } catch { /* error shown */ }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.setupContent} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.setupHero}>
        <View style={s.wdsfLogoBox}>
          <Text style={s.wdsfLogoText}>WDSF</Text>
        </View>
        <Text style={s.setupTitle}>Connect WDSF Profile</Text>
        <Text style={s.setupSub}>
          Link your World DanceSport Federation profile to see your competition history,
          ranking, partners and licence status in Dance Planner.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.setupCard}>
        <Text style={s.inputLabel}>Member ID Number (MIN)</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. 10003769"
          placeholderTextColor={C.t3}
          value={min}
          onChangeText={setMin}
          keyboardType="numeric"
          autoCapitalize="none"
        />
        <Text style={s.inputHint}>
          Find your MIN at{" "}
          <Text style={s.link} onPress={() => Linking.openURL(WDSF_SEARCH_URL)}>
            worlddancesport.org/Athletes
          </Text>
        </Text>
        {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}
        <PressableScale style={s.primaryBtn} onPress={handleLinkMin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.primaryBtnText}>Search my profile</Text>}
        </PressableScale>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(400)}>
        <PressableScale onPress={() => setShowUrl(v => !v)} style={s.toggleRow}>
          <Text style={s.toggleText}>{showUrl ? "▾" : "▸"} Paste profile URL manually</Text>
        </PressableScale>
        {showUrl ? (
          <View style={s.setupCard}>
            <Text style={s.inputLabel}>WDSF profile URL</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: "top" }]}
              placeholder="https://www.worlddancesport.org/Athletes/Your-Name-uuid..."
              placeholderTextColor={C.t3}
              value={url}
              onChangeText={setUrl}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.inputHint}>
              Open your profile on worlddancesport.org and copy the URL from the address bar.
            </Text>
            <PressableScale style={s.primaryBtn} onPress={handleLinkUrl} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Link this profile</Text>}
            </PressableScale>
          </View>
        ) : null}
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Profile view ─────────────────────────────────────────────────────────────

function ProfileView({
  profile, loading, onRefresh, onUnlink,
}: {
  profile: WdsfProfile;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onUnlink: () => Promise<void>;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [imgError, setImgError] = useState(false);
  const [selectedComp, setSelectedComp] = useState<WdsfCompetition | null>(null);

  const currentPartners = profile.partners.filter(p => p.status === "current");
  const formerPartners  = profile.partners.filter(p => p.status === "former");
  const isActive = profile.licenseStatus?.toLowerCase().includes("active") ?? false;
  const updatedAgo = profile.fetchedAt ? formatAgo(new Date(profile.fetchedAt)) : null;

  // Summary stats
  const numericPlaces = profile.competitions
    .map(c => parseInt(c.place ?? "", 10))
    .filter(n => !isNaN(n) && n > 0);
  const avgPlace  = numericPlaces.length
    ? (numericPlaces.reduce((s, v) => s + v, 0) / numericPlaces.length).toFixed(1)
    : "—";
  const finalsCount = numericPlaces.filter(p => p <= 6).length;
  const bestDance   = "—"; // filled from analytics when loaded

  const handleUnlink = () => {
    if (Platform.OS === "web") { onUnlink(); return; }
    Alert.alert("Unlink WDSF Profile", "Remove your WDSF connection from Dance Planner?", [
      { text: "Cancel", style: "cancel" },
      { text: "Unlink", style: "destructive", onPress: onUnlink },
    ]);
  };

  return (
    <>
      <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>

        {/* Hero card */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.heroCard}>
          <View style={s.heroPhotoWrap}>
            {!imgError ? (
              <Image
                source={{ uri: profile.photoUrl }}
                style={s.heroPhoto}
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={[s.heroPhoto, s.heroPhotoFallback]}>
                <Text style={s.heroPhotoFallbackText}>
                  {profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={s.heroBadge}><Text style={s.heroBadgeText}>WDSF</Text></View>
          </View>
          <Text style={s.heroName}>{profile.name}</Text>
          {profile.represents ? <Text style={s.heroCountry}>{profile.represents}</Text> : null}
          {profile.licenseStatus ? (
            <View style={[s.licenseBadge, { backgroundColor: isActive ? C.accentFade : `${C.red}18`, borderColor: isActive ? C.accentBorder : `${C.red}40` }]}>
              <Text style={[s.licenseBadgeText, { color: isActive ? C.accent : C.red }]}>
                {isActive ? "✓ " : "✗ "}{profile.licenseStatus}
                {profile.licenseExpiry ? ` · expires ${profile.licenseExpiry}` : ""}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Summary stats strip */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)} style={s.statsRow}>
          <StatBox label="Tournaments" value={profile.competitions.length > 0 ? String(profile.competitions.length) : "—"} />
          <View style={s.statsDivider} />
          <StatBox label="Avg Place"   value={avgPlace} />
          <View style={s.statsDivider} />
          <StatBox label="Finals"      value={finalsCount > 0 ? String(finalsCount) : "—"} />
          <View style={s.statsDivider} />
          <StatBox label="Best Place"  value={bestPlace(profile.competitions)} />
        </Animated.View>

        {/* General info */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.profileSection}>
          <SectionHeader title="General Information" />
          <View style={s.sectionCard}>
            <InfoRow label="Name"        value={profile.firstName || profile.name.split(" ")[0]} />
            <InfoRow label="Surname"     value={profile.lastName  || profile.name.split(" ").slice(1).join(" ")} />
            <InfoRow label="Nationality" value={profile.nationality} />
            <InfoRow label="Represents"  value={profile.represents} />
            <InfoRow label="MIN"         value={profile.min} isLast={!profile.ageGroup && !profile.licenseDivision} />
            {profile.ageGroup        ? <InfoRow label="Age group" value={profile.ageGroup} /> : null}
            {profile.licenseDivision ? <InfoRow label="Division"  value={profile.licenseDivision} isLast={!profile.licenseStatus} /> : null}
            {profile.licenseStatus   ? (
              <InfoRow
                label="License"
                value={[
                  profile.licenseStatus,
                  profile.licenseExpiry ? `expires ${profile.licenseExpiry}` : null,
                ].filter(Boolean).join(" · ")}
                highlight={isActive}
                isLast
              />
            ) : null}
          </View>
        </Animated.View>

        {/* Partners */}
        {profile.partners.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(110).duration(400)} style={s.profileSection}>
            <SectionHeader
              title="Partners"
              subtitle={`${profile.partners.length} total · ${currentPartners.length} active`}
            />
            <View style={s.sectionCard}>
              {currentPartners.map((p, i) => (
                <PartnerRow key={`c${i}`} partner={p} isLast={i === currentPartners.length - 1 && formerPartners.length === 0} />
              ))}
              {formerPartners.map((p, i) => (
                <PartnerRow key={`f${i}`} partner={p} isLast={i === formerPartners.length - 1} />
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Competition results */}
        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={s.profileSection}>
          <SectionHeader
            title="Competition Results"
            subtitle={profile.competitions.length > 0 ? `${profile.competitions.length} entries · tap for analytics` : undefined}
          />
          {profile.competitions.length > 0 ? (
            <View style={s.sectionCard}>
              {profile.competitions.map((c, i) => (
                <CompetitionRow
                  key={i}
                  comp={c}
                  isLast={i === profile.competitions.length - 1}
                  onPress={c.competitionUrl ? () => setSelectedComp(c) : undefined}
                />
              ))}
            </View>
          ) : (
            <View style={[s.sectionCard, { padding: 20 }]}>
              <Text style={{ color: C.t3, textAlign: "center", fontSize: 14 }}>
                Competition data could not be loaded.{"\n"}Tap Refresh to try again.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(170).duration(400)} style={[s.actions, s.profileSection]}>
          {updatedAgo ? <Text style={s.updatedText}>Last updated {updatedAgo}</Text> : null}
          <PressableScale style={s.refreshBtn} onPress={onRefresh} disabled={loading}>
            {loading ? <ActivityIndicator color={C.accent} size="small" /> : <Text style={s.refreshBtnText}>↺ Refresh from WDSF</Text>}
          </PressableScale>
          <PressableScale style={s.unlinkBtn} onPress={handleUnlink}>
            <Text style={s.unlinkBtnText}>Unlink profile</Text>
          </PressableScale>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Analytics modal */}
      {selectedComp ? (
        <CompetitionAnalyticsModal
          comp={selectedComp}
          onClose={() => setSelectedComp(null)}
        />
      ) : null}
    </>
  );
}

// ─── Competition Analytics Modal ──────────────────────────────────────────────

function CompetitionAnalyticsModal({
  comp,
  onClose,
}: {
  comp: WdsfCompetition;
  onClose: () => void;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const { fetchAnalytics, analyticsCache, analyticsLoading, clearAnalyticsCache } = useWdsfStore();

  const url = comp.competitionUrl!;
  const isLoading  = analyticsLoading[url] ?? false;
  const analytics  = analyticsCache[url];
  const [tab, setTab] = useState<"overview" | "marks" | "scores3" | "final" | "compare">("overview");
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Auto-load on open
  useEffect(() => {
    if (!loadedOnce && url) {
      setLoadedOnce(true);
      fetchAnalytics(url);
    }
  }, [url, loadedOnce, fetchAnalytics]);

  const maxCrosses = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(1, ...analytics.danceStats.map(d => d.totalCrosses));
  }, [analytics]);

  const maxJudgeCrosses = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(1, ...analytics.judgeStats.map(j => j.totalCrosses));
  }, [analytics]);

  const tabs: { key: "overview" | "marks" | "scores3" | "final" | "compare"; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "marks",    label: "Crosses" },
    ...(analytics?.scores3 ? [{ key: "scores3" as const, label: "Scores 3.0" }] : []),
    { key: "final",    label: "Final" },
    { key: "compare",  label: "Compare" },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalBg}>
        {/* Handle */}
        <View style={s.modalHandle} />

        {/* Header */}
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.modalTitle} numberOfLines={1}>{comp.event || "Competition"}</Text>
            <Text style={s.modalSub}>{[comp.date, comp.discipline, comp.category].filter(Boolean).join(" · ")}</Text>
          </View>
          <TouchableOpacity style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabItem, tab === t.key && s.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loading */}
        {isLoading ? (
          <View style={s.analyticsCenter}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={s.loadingText}>Loading competition data...</Text>
          </View>
        ) : analytics === null ? (
          <View style={s.analyticsCenter}>
            <Text style={s.errorText}>Could not load analytics for this competition.</Text>
            <PressableScale style={[s.primaryBtn, { marginTop: 16, paddingHorizontal: 28 }]} onPress={() => { clearAnalyticsCache(url); setLoadedOnce(false); }}>
              <Text style={s.primaryBtnText}>Retry</Text>
            </PressableScale>
          </View>
        ) : analytics ? (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {tab === "overview" && <OverviewTab analytics={analytics} comp={comp} />}
            {tab === "marks"    && <CrossesTab analytics={analytics} maxCrosses={maxCrosses} maxJudge={maxJudgeCrosses} />}
            {tab === "scores3"  && <Scores3Tab scores3={analytics.scores3!} judgeNames={analytics.judgeNames} />}
            {tab === "final"    && <FinalTab final={analytics.final} final3={analytics.final3} judgeNames={analytics.judgeNames} />}
            {tab === "compare"  && <CompareTab analytics={analytics} />}
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <View style={s.analyticsCenter}>
            <Text style={s.loadingText}>Tap to load analytics</Text>
            <PressableScale style={[s.primaryBtn, { marginTop: 16, paddingHorizontal: 28 }]} onPress={() => fetchAnalytics(url)}>
              <Text style={s.primaryBtnText}>Load Analytics</Text>
            </PressableScale>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const CARD_RESET = { marginHorizontal: 0 };
const HDR_RESET  = { marginHorizontal: 0 };

function OverviewTab({ analytics, comp }: { analytics: CompetitionAnalytics; comp: WdsfCompetition }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const totalCrossesAllRounds = analytics.rounds.reduce((sum, r) => sum + r.totalCrosses, 0);
  const bestDance  = analytics.danceStats[0];
  const worstDance = analytics.danceStats[analytics.danceStats.length - 1];

  return (
    <View style={{ padding: 16, gap: 12 }}>

      {/* Couple chip */}
      <View style={s.coupleChip}>
        <Text style={s.coupleChipLabel}>Start #</Text>
        <Text style={s.coupleChipNumber}>{analytics.coupleNumber}</Text>
        <Text style={s.coupleChipName}>{analytics.coupleName}</Text>
      </View>

      {/* Big stats */}
      <View style={s.overviewGrid}>
        <BigStatCard label="Place"         value={(comp.place ?? "—").replace(/\.$/, "")}           color={C.gold}   />
        <BigStatCard label="Rounds"        value={analytics.rounds.length > 0 ? String(analytics.rounds.length) : "—"} color={C.accent} />
        <BigStatCard label="Total Crosses" value={totalCrossesAllRounds > 0 ? String(totalCrossesAllRounds) : "—"}     color={C.purple} />
        <BigStatCard label="Final"         value={analytics.reachedFinal ? "Yes" : "No"} color={analytics.reachedFinal ? C.gold : C.t2} />
      </View>

      {/* Round progression */}
      {analytics.rounds.length > 0 ? (
        <>
          <SectionHeader title="Crosses Per Round" />
          <View style={s.sectionCard}>
            {analytics.rounds.map((round, i) => {
              const max = Math.max(1, ...analytics.rounds.map(r => r.totalCrosses));
              const pct = round.totalCrosses / max;
              return (
                <View key={i} style={[s.roundRow, i < analytics.rounds.length - 1 && s.rowBorder]}>
                  <Text style={s.roundLabel}>Round {round.roundNumber}</Text>
                  <View style={s.roundBarWrap}>
                    <View style={[s.roundBar, { width: `${Math.round(pct * 100)}%`, backgroundColor: C.accent }]} />
                  </View>
                  <Text style={s.roundCrossCount}>{round.totalCrosses}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Best / Worst dances */}
      {analytics.danceStats.length > 0 ? (
        <>
          <SectionHeader title="Dance Performance" />
          <View style={s.danceCompareRow}>
            <View style={[s.danceCompareCard, { borderColor: C.gold + "50", backgroundColor: C.gold + "10" }]}>
              <Text style={[s.danceCompareIcon]}>🏆</Text>
              <Text style={[s.danceCompareLabel, { color: C.gold }]}>Best Dance</Text>
              <Text style={s.danceCompareName}>{bestDance?.dance ?? "—"}</Text>
              <Text style={s.danceCompareVal}>{bestDance?.totalCrosses ?? 0} crosses</Text>
            </View>
            <View style={[s.danceCompareCard, { borderColor: C.red + "50", backgroundColor: C.red + "10" }]}>
              <Text style={s.danceCompareIcon}>📈</Text>
              <Text style={[s.danceCompareLabel, { color: C.red }]}>Needs Work</Text>
              <Text style={s.danceCompareName}>{worstDance?.dance ?? "—"}</Text>
              <Text style={s.danceCompareVal}>{worstDance?.totalCrosses ?? 0} crosses</Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

// ─── Tab: Crosses ─────────────────────────────────────────────────────────────

function CrossesTab({ analytics, maxCrosses, maxJudge }: {
  analytics: CompetitionAnalytics;
  maxCrosses: number;
  maxJudge: number;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  // null = aggregate "All Rounds" view; number = filter to that round
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const activeRound = selectedRound !== null
    ? analytics.rounds.find(r => r.roundNumber === selectedRound) ?? null
    : null;

  // Per-round judge stats derived from the selected round's cross data
  const roundJudgeStats = useMemo(() => {
    if (!activeRound) return null;
    const map: Record<string, { total: number; possible: number }> = {};
    for (const d of activeRound.dances) {
      for (const c of d.crosses) {
        if (!c.judge) continue;
        if (!map[c.judge]) map[c.judge] = { total: 0, possible: 0 };
        map[c.judge].possible++;
        if (c.marked) map[c.judge].total++;
      }
    }
    return Object.entries(map)
      .map(([judge, { total, possible }]) => ({
        judge,
        totalCrosses: total,
        pct: possible > 0 ? Math.round((total / possible) * 100) : 0,
      }))
      .sort((a, b) => b.totalCrosses - a.totalCrosses);
  }, [activeRound]);

  // Which dance/judge data to show
  const displayDances  = activeRound ? activeRound.dances : null;
  const displayJudges  = activeRound ? roundJudgeStats   : analytics.judgeStats;
  const danceMax = displayDances
    ? Math.max(1, ...displayDances.map(d => d.totalCrosses))
    : maxCrosses;
  const judgeMax = displayJudges && displayJudges.length > 0
    ? Math.max(1, ...displayJudges.map(j => j.totalCrosses))
    : maxJudge;

  const sectionSuffix = activeRound ? ` — Round ${activeRound.roundNumber}` : " (All Rounds)";

  return (
    <View style={{ padding: 16, gap: 12 }}>

      {/* Round selector */}
      {analytics.rounds.length > 1 ? (
        <View style={s.roundFilterRow}>
          <TouchableOpacity
            style={[s.roundFilterChip, selectedRound === null && s.roundFilterChipActive]}
            onPress={() => setSelectedRound(null)}
          >
            <Text style={[s.roundFilterChipText, selectedRound === null && s.roundFilterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {analytics.rounds.map(r => (
            <TouchableOpacity
              key={r.roundNumber}
              style={[s.roundFilterChip, selectedRound === r.roundNumber && s.roundFilterChipActive]}
              onPress={() => setSelectedRound(r.roundNumber)}
            >
              <Text style={[s.roundFilterChipText, selectedRound === r.roundNumber && s.roundFilterChipTextActive]}>
                R{r.roundNumber}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Per-dance totals */}
      {(displayDances ?? analytics.danceStats).length > 0 ? (
        <>
          <SectionHeader title={`Crosses Per Dance${sectionSuffix}`} />
          <View style={s.sectionCard}>
            {(displayDances ?? analytics.danceStats).map((ds, i) => {
              const arr = displayDances ?? analytics.danceStats;
              return (
                <View key={ds.dance} style={[s.barRow, i < arr.length - 1 && s.rowBorder]}>
                  <Text style={s.barRowLabel}>{ds.dance}</Text>
                  <View style={s.barRowTrack}>
                    <View style={[s.barRowFill, { width: `${Math.round((ds.totalCrosses / danceMax) * 100)}%`, backgroundColor: C.accent }]} />
                  </View>
                  <Text style={s.barRowVal}>{ds.totalCrosses}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Judge analytics */}
      {displayJudges && displayJudges.length > 0 ? (
        <>
          <SectionHeader
            title={`Judge Analytics${sectionSuffix}`}
            subtitle="Most → fewest crosses"
          />
          <View style={s.sectionCard}>
            {displayJudges.map((js, i) => {
              const isFirst  = i === 0;
              const isLast   = i === displayJudges.length - 1;
              const barColor = isFirst ? C.gold : isLast ? C.red : C.accent;
              const nameColor = isFirst ? C.gold : isLast ? C.red : C.t1;
              return (
                <View key={js.judge} style={[s.barRow, i < displayJudges.length - 1 && s.rowBorder]}>
                  <Text style={[s.judgeNameLabel, { color: nameColor }]} numberOfLines={1}>
                    {jFullName(js.judge, analytics.judgeNames)}
                  </Text>
                  <View style={s.barRowTrack}>
                    <View style={[s.barRowFill, { width: `${Math.round((js.totalCrosses / judgeMax) * 100)}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={s.barRowVal}>{js.totalCrosses} <Text style={s.barRowPct}>({js.pct}%)</Text></Text>
                </View>
              );
            })}
          </View>
          <View style={s.judgeInsightRow}>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>🏅</Text>
              <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Most Crosses</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(displayJudges[0]?.judge, analytics.judgeNames)}</Text>
              <Text style={s.judgeInsightVal}>{displayJudges[0]?.totalCrosses}</Text>
            </View>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>📉</Text>
              <Text style={[s.judgeInsightLabel, { color: C.red }]}>Fewest Crosses</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(displayJudges[displayJudges.length - 1]?.judge, analytics.judgeNames)}</Text>
              <Text style={s.judgeInsightVal}>{displayJudges[displayJudges.length - 1]?.totalCrosses}</Text>
            </View>
          </View>
        </>
      ) : null}

      {/* Round detail breakdown */}
      {analytics.rounds.length > 0 ? (
        <>
          <SectionHeader title="Round Breakdown" subtitle="Tap a round to expand" />
          {analytics.rounds.map(round => (
            <View key={round.roundNumber} style={[s.sectionCard, { marginBottom: 8 }]}>
              <PressableScale
                onPress={() => setExpandedRound(expandedRound === round.roundNumber ? null : round.roundNumber)}
                style={s.roundHeader}
              >
                <Text style={s.roundHeaderTitle}>Round {round.roundNumber}</Text>
                <Text style={s.roundHeaderTotal}>{round.totalCrosses} crosses total</Text>
                <Text style={s.roundExpandIcon}>{expandedRound === round.roundNumber ? "▲" : "▼"}</Text>
              </PressableScale>

              {expandedRound === round.roundNumber ? (
                <View style={s.roundExpanded}>
                  {round.dances.map((d, di) => (
                    <View key={d.dance}>
                      <View style={s.roundDanceHeader}>
                        <Text style={s.roundDanceName}>{d.dance}</Text>
                        <Text style={s.roundDanceCrosses}>{d.totalCrosses} /{d.crosses.length} crosses</Text>
                      </View>
                      {d.crosses.length > 0 ? (
                        <View style={s.crossGrid}>
                          {d.crosses.map((cross, ci) => (
                            <View
                              key={ci}
                              style={[
                                s.crossCell,
                                cross.marked
                                  ? { backgroundColor: C.accentFade, borderColor: C.accentBorder }
                                  : { backgroundColor: C.elevated, borderColor: C.border },
                              ]}
                            >
                              <Text
                                style={[s.crossCellJudge, cross.marked && { color: C.accent }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.6}
                              >
                                {jLastName(cross.judge, analytics.judgeNames)}
                              </Text>
                              <Text style={[s.crossCellMark, { color: cross.marked ? C.accent : C.t3 }]}>
                                {cross.marked ? "✓" : "✗"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {di < round.dances.length - 1 ? <View style={s.rowBorder} /> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

      {analytics.rounds.length === 0 && analytics.judgeStats.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyStateText}>
            Marks data not found for couple #{analytics.coupleNumber || "?"}.{"\n\n"}
            This can happen when:{"\n"}
            • The competition hasn't published marks yet{"\n"}
            • Marks loaded via JavaScript (not in HTML){"\n"}
            • Your WDSF profile needs a refresh
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Tab: Scores 3.0 ──────────────────────────────────────────────────────────

function Scores3Tab({ scores3, judgeNames }: {
  scores3: import("../../store/useWdsfStore").Scores3Result;
  judgeNames: Record<string, string>;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [selectedRound, setSelectedRound] = useState(0);

  const round: Score3Round = scores3.rounds[selectedRound];
  if (!round) {
    return (
      <View style={[s.emptyCenter, { margin: 24 }]}>
        <Text style={s.emptyText}>No System 3.0 data available.</Text>
      </View>
    );
  }

  const hasJudgeData = round.dances.some(d => d.judgeEntries.length > 0);

  // Compute per-judge averages across all dances in this round (only when judge data exists)
  const judgeAvgMap: Record<string, { total: number; count: number }> = {};
  for (const d of round.dances) {
    for (const je of d.judgeEntries) {
      const score = je.tqPs !== null && je.mmCp !== null
        ? (je.tqPs + je.mmCp) / 2
        : (je.tqPs ?? je.mmCp ?? 0);
      if (!judgeAvgMap[je.judge]) judgeAvgMap[je.judge] = { total: 0, count: 0 };
      judgeAvgMap[je.judge].total  += score;
      judgeAvgMap[je.judge].count  += 1;
    }
  }
  const judgeAvgs = Object.entries(judgeAvgMap)
    .map(([judge, { total, count }]) => ({ judge, avg: count > 0 ? total / count : 0 }))
    .sort((a, b) => b.avg - a.avg);

  const maxJudgeAvg = Math.max(1, ...judgeAvgs.map(j => j.avg));

  // Per-dance score: use totalScore for multi-dance tables, else avg from judge entries
  const danceAvgs = round.dances.map(d => {
    let avg: number;
    if (d.totalScore > 0) {
      avg = d.totalScore;
    } else {
      const scores: number[] = [];
      for (const je of d.judgeEntries) {
        const sc = je.tqPs !== null && je.mmCp !== null
          ? (je.tqPs + je.mmCp) / 2
          : (je.tqPs ?? je.mmCp ?? 0);
        if (sc > 0) scores.push(sc);
      }
      avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }
    return { dance: d.dance, avg, place: d.place };
  }).sort((a, b) => b.avg - a.avg);
  const maxDanceAvg = Math.max(1, ...danceAvgs.map(d => d.avg));
  const totalDanceScore = danceAvgs.reduce((s, d) => s + d.avg, 0);

  // TQ&PS vs MM&CP overall averages (only meaningful when judge data present)
  let tqPsTotal = 0, tqPsCount = 0, mmCpTotal = 0, mmCpCount = 0;
  for (const d of round.dances) {
    for (const je of d.judgeEntries) {
      if (je.tqPs !== null) { tqPsTotal += je.tqPs; tqPsCount++; }
      if (je.mmCp !== null) { mmCpTotal += je.mmCp; mmCpCount++; }
    }
  }
  const tqPsAvg = tqPsCount > 0 ? tqPsTotal / tqPsCount : null;
  const mmCpAvg = mmCpCount > 0 ? mmCpTotal / mmCpCount : null;
  const hasBothCriteria = tqPsAvg !== null && mmCpAvg !== null;

  return (
    <View style={{ padding: 16, gap: 12 }}>

      {/* Round selector */}
      {scores3.rounds.length > 1 && (
        <View style={s.roundFilterRow}>
          {scores3.rounds.map((r, i) => (
            <TouchableOpacity
              key={r.roundName}
              style={[s.roundFilterChip, selectedRound === i && s.roundFilterChipActive]}
              onPress={() => setSelectedRound(i)}
            >
              <Text style={[s.roundFilterChipText, selectedRound === i && s.roundFilterChipTextActive]}>
                {r.roundName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Overall place banner */}
      {round.overallPlace > 0 && (
        <View style={s.finalPlaceBanner}>
          <Text style={s.finalPlaceNum}>{round.overallPlace}</Text>
          <Text style={s.finalPlaceLabel}>Place — {round.roundName}</Text>
        </View>
      )}

      {/* Dance scores */}
      {danceAvgs.length > 0 && (
        <>
          <SectionHeader
            title={hasJudgeData ? "Average Score Per Dance" : "Score Per Dance"}
            subtitle={hasJudgeData ? "Avg across all judges" : "Total points (all judges combined)"}
          />
          <View style={s.sectionCard}>
            {danceAvgs.map((d, i) => (
              <View key={d.dance} style={[s.barRow, i < danceAvgs.length - 1 && s.rowBorder]}>
                <Text style={[s.barRowLabel, { color: i === 0 ? C.gold : i === danceAvgs.length - 1 ? C.red : C.t1 }]}>{d.dance}</Text>
                <View style={s.barRowTrack}>
                  <View style={[s.barRowFill, { width: `${Math.round((d.avg / maxDanceAvg) * 100)}%`, backgroundColor: i === 0 ? C.gold : i === danceAvgs.length - 1 ? C.red : C.accent }]} />
                </View>
                <Text style={s.barRowVal}>
                  {d.avg.toFixed(2)}
                  {d.place > 0 ? <Text style={s.barRowPct}> (#{d.place})</Text> : null}
                </Text>
              </View>
            ))}
          </View>
          {/* Dance insight cards — always shown (judge cards shown separately only when judge data exists) */}
          <View style={s.judgeInsightRow}>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>🥇</Text>
              <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Best Dance</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{danceAvgs[0]?.dance}</Text>
              <Text style={s.judgeInsightVal}>{danceAvgs[0]?.avg.toFixed(2)}</Text>
            </View>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>📉</Text>
              <Text style={[s.judgeInsightLabel, { color: C.red }]}>Needs Work</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{danceAvgs[danceAvgs.length - 1]?.dance}</Text>
              <Text style={s.judgeInsightVal}>{danceAvgs[danceAvgs.length - 1]?.avg.toFixed(2)}</Text>
            </View>
          </View>
          {/* Total score summary (meaningful for multi-dance tables) */}
          {!hasJudgeData && (
            <View style={[s.sectionCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }]}>
              <Text style={[s.barRowLabel, { fontWeight: "600" }]}>Total Score</Text>
              <Text style={[s.barRowVal, { fontSize: 18, fontWeight: "700", color: C.accent }]}>{totalDanceScore.toFixed(2)}</Text>
            </View>
          )}
        </>
      )}

      {/* TQ&PS vs MM&CP */}
      {hasBothCriteria && (
        <>
          <SectionHeader title="Criteria Breakdown" subtitle="Technical vs Artistic average" />
          <View style={s.sectionCard}>
            {[
              { label: "TQ & PS", value: tqPsAvg!, color: C.accent },
              { label: "MM & CP", value: mmCpAvg!, color: C.purple },
            ].map((item, i) => (
              <View key={item.label} style={[s.barRow, i === 0 && s.rowBorder]}>
                <Text style={s.barRowLabel}>{item.label}</Text>
                <View style={s.barRowTrack}>
                  <View style={[s.barRowFill, { width: `${Math.round((item.value / 10) * 100)}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={s.barRowVal}>{item.value.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Judge analysis */}
      {judgeAvgs.length > 0 && (
        <>
          <SectionHeader title="Judge Scores" subtitle="Highest → lowest avg" />
          <View style={s.sectionCard}>
            {judgeAvgs.map((j, i) => {
              const isFirst  = i === 0;
              const isLast   = i === judgeAvgs.length - 1;
              const barColor = isFirst ? C.gold : isLast ? C.red : C.accent;
              const nameColor = isFirst ? C.gold : isLast ? C.red : C.t1;
              return (
                <View key={j.judge} style={[s.barRow, i < judgeAvgs.length - 1 && s.rowBorder]}>
                  <Text style={[s.judgeNameLabel, { color: nameColor }]} numberOfLines={1}>
                    {jFullName(j.judge, judgeNames)}
                  </Text>
                  <View style={s.barRowTrack}>
                    <View style={[s.barRowFill, { width: `${Math.round((j.avg / maxJudgeAvg) * 100)}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={s.barRowVal}>{j.avg.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.judgeInsightRow}>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>🏅</Text>
              <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Highest Score</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(judgeAvgs[0].judge, judgeNames)}</Text>
              <Text style={s.judgeInsightVal}>{judgeAvgs[0].avg.toFixed(2)}</Text>
            </View>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>📉</Text>
              <Text style={[s.judgeInsightLabel, { color: C.red }]}>Lowest Score</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(judgeAvgs[judgeAvgs.length - 1].judge, judgeNames)}</Text>
              <Text style={s.judgeInsightVal}>{judgeAvgs[judgeAvgs.length - 1].avg.toFixed(2)}</Text>
            </View>
          </View>
        </>
      )}

      {/* Per-dance detail with per-judge scores (only when judge data exists) */}
      {hasJudgeData && (
        <>
          <SectionHeader title="Detailed Scores" subtitle="Per dance · per judge" />
          {round.dances.map(d => (
            d.judgeEntries.length > 0 ? (
              <View key={d.dance} style={[s.sectionCard, { marginBottom: 8 }]}>
                <View style={s.roundHeader}>
                  <Text style={s.roundHeaderTitle}>{d.dance}</Text>
                  {d.place > 0
                    ? <Text style={s.roundHeaderTotal}>Place #{d.place}</Text>
                    : d.totalMarks > 0
                      ? <Text style={s.roundHeaderTotal}>{d.totalMarks} marks</Text>
                      : null}
                </View>
                <View style={s.roundExpanded}>
                  {d.judgeEntries.map((je, i) => {
                    const score = je.tqPs !== null && je.mmCp !== null
                      ? (je.tqPs + je.mmCp) / 2
                      : (je.tqPs ?? je.mmCp ?? 0);
                    return (
                      <View key={je.judge} style={[s.crossRow, i < d.judgeEntries.length - 1 && s.rowBorder]}>
                        <Text style={s.crossJudge} numberOfLines={1}>{jFullName(je.judge, judgeNames)}</Text>
                        <View style={s.crossScores3}>
                          {je.tqPs !== null && <Text style={s.score3Chip}>{`TQ ${je.tqPs.toFixed(1)}`}</Text>}
                          {je.mmCp !== null && <Text style={[s.score3Chip, { backgroundColor: C.purple + "22" }]}>{`MM ${je.mmCp.toFixed(1)}`}</Text>}
                          {je.tqPs === null && je.mmCp === null && <Text style={s.score3Chip}>{score.toFixed(2)}</Text>}
                        </View>
                        <Text style={s.crossRank}>#{je.rank}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null
          ))}
        </>
      )}
    </View>
  );
}

// ─── Tab: Final ───────────────────────────────────────────────────────────────

function FinalTab({ final, final3, judgeNames }: {
  final: FinalResult | null;
  final3: Score3Round | null;
  judgeNames: Record<string, string>;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  if (!final && !final3) {
    return (
      <View style={[s.analyticsCenter, { padding: 32 }]}>
        <Text style={{ fontSize: 32 }}>🏁</Text>
        <Text style={[s.emptyStateText, { marginTop: 12 }]}>This couple did not reach the Final.</Text>
      </View>
    );
  }

  // ── System 3.0 Final ────────────────────────────────────────────────────────
  // Also use 3.0 path when final exists but has no per-dance data (skating page was empty)
  if (final3 && (!final || final.dances.length === 0)) {
    const f3OverallPlace = final3.overallPlace > 0 ? final3.overallPlace : (final?.overallPlace ?? 0);

    const hasF3JudgeData = final3.dances.some(d => d.judgeEntries.length > 0);
    const danceAvgs = final3.dances.map(d => {
      let avg: number;
      if (d.totalScore > 0) {
        avg = d.totalScore;
      } else {
        const scores = d.judgeEntries.flatMap(je => {
          const vals: number[] = [];
          if (je.tqPs !== null) vals.push(je.tqPs);
          if (je.mmCp !== null) vals.push(je.mmCp);
          return vals;
        });
        avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      }
      return { dance: d.dance, avg, place: d.place };
    }).sort((a, b) => b.avg - a.avg);
    const maxDA = Math.max(1, ...danceAvgs.map(d => d.avg));
    const totalF3Score = danceAvgs.reduce((s, d) => s + d.avg, 0);

    const judgeAvgMap: Record<string, { total: number; count: number }> = {};
    for (const d of final3.dances) {
      for (const je of d.judgeEntries) {
        const sc = je.tqPs !== null && je.mmCp !== null ? (je.tqPs + je.mmCp) / 2 : (je.tqPs ?? je.mmCp ?? 0);
        if (!judgeAvgMap[je.judge]) judgeAvgMap[je.judge] = { total: 0, count: 0 };
        judgeAvgMap[je.judge].total += sc;
        judgeAvgMap[je.judge].count += 1;
      }
    }
    const judgeAvgs = Object.entries(judgeAvgMap)
      .map(([judge, { total, count }]) => ({ judge, avg: count > 0 ? total / count : 0 }))
      .sort((a, b) => b.avg - a.avg);
    const maxJA = Math.max(1, ...judgeAvgs.map(j => j.avg));

    return (
      <View style={{ padding: 16, gap: 12 }}>
        {f3OverallPlace > 0 && (
          <View style={s.finalPlaceBanner}>
            <Text style={s.finalPlaceNum}>{f3OverallPlace}</Text>
            <Text style={s.finalPlaceLabel}>Final Place (System 3.0)</Text>
          </View>
        )}
        <SectionHeader
          title="Dance Scores"
          subtitle={hasF3JudgeData ? "Avg across all judges" : "Total points (all judges combined)"}
        />
        <View style={s.sectionCard}>
          {danceAvgs.map((d, i) => (
            <View key={d.dance} style={[s.barRow, i < danceAvgs.length - 1 && s.rowBorder]}>
              <Text style={[s.barRowLabel, { color: i === 0 ? C.gold : i === danceAvgs.length - 1 ? C.red : C.t1 }]}>{d.dance}</Text>
              <View style={s.barRowTrack}>
                <View style={[s.barRowFill, { width: `${Math.round((d.avg / maxDA) * 100)}%`, backgroundColor: i === 0 ? C.gold : i === danceAvgs.length - 1 ? C.red : C.accent }]} />
              </View>
              <Text style={s.barRowVal}>
                {d.avg.toFixed(2)}{d.place > 0 ? <Text style={s.barRowPct}> (#{d.place})</Text> : null}
              </Text>
            </View>
          ))}
        </View>
        {/* Dance insight cards */}
        <View style={s.judgeInsightRow}>
          <View style={s.judgeInsightCard}>
            <Text style={s.judgeInsightIcon}>🥇</Text>
            <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Best Dance</Text>
            <Text style={s.judgeInsightName} numberOfLines={1}>{danceAvgs[0]?.dance}</Text>
            <Text style={s.judgeInsightVal}>{danceAvgs[0]?.avg.toFixed(2)}</Text>
          </View>
          <View style={s.judgeInsightCard}>
            <Text style={s.judgeInsightIcon}>📉</Text>
            <Text style={[s.judgeInsightLabel, { color: C.red }]}>Needs Work</Text>
            <Text style={s.judgeInsightName} numberOfLines={1}>{danceAvgs[danceAvgs.length - 1]?.dance}</Text>
            <Text style={s.judgeInsightVal}>{danceAvgs[danceAvgs.length - 1]?.avg.toFixed(2)}</Text>
          </View>
        </View>
        {/* Total score summary (when no per-judge breakdown) */}
        {!hasF3JudgeData && (
          <View style={[s.sectionCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }]}>
            <Text style={[s.barRowLabel, { fontWeight: "600" }]}>Total Score</Text>
            <Text style={[s.barRowVal, { fontSize: 18, fontWeight: "700", color: C.accent }]}>{totalF3Score.toFixed(2)}</Text>
          </View>
        )}
        {judgeAvgs.length > 0 && (
          <>
            <SectionHeader title="Judge Scores" subtitle="Highest → lowest avg" />
            <View style={s.sectionCard}>
              {judgeAvgs.map((j, i) => {
                const isFirst = i === 0; const isLast = i === judgeAvgs.length - 1;
                return (
                  <View key={j.judge} style={[s.barRow, i < judgeAvgs.length - 1 && s.rowBorder]}>
                    <Text style={[s.judgeNameLabel, { color: isFirst ? C.gold : isLast ? C.red : C.t1 }]} numberOfLines={1}>
                      {jFullName(j.judge, judgeNames)}
                    </Text>
                    <View style={s.barRowTrack}>
                      <View style={[s.barRowFill, { width: `${Math.round((j.avg / maxJA) * 100)}%`, backgroundColor: isFirst ? C.gold : isLast ? C.red : C.accent }]} />
                    </View>
                    <Text style={s.barRowVal}>{j.avg.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
            <View style={s.judgeInsightRow}>
              <View style={s.judgeInsightCard}>
                <Text style={s.judgeInsightIcon}>🏅</Text>
                <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Liked Us Most</Text>
                <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(judgeAvgs[0]?.judge, judgeNames)}</Text>
                <Text style={s.judgeInsightVal}>{judgeAvgs[0]?.avg.toFixed(2)}</Text>
              </View>
              <View style={s.judgeInsightCard}>
                <Text style={s.judgeInsightIcon}>📊</Text>
                <Text style={[s.judgeInsightLabel, { color: C.t2 }]}>Strictest Judge</Text>
                <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(judgeAvgs[judgeAvgs.length - 1]?.judge, judgeNames)}</Text>
                <Text style={s.judgeInsightVal}>{judgeAvgs[judgeAvgs.length - 1]?.avg.toFixed(2)}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }

  // At this point final is guaranteed non-null (early-return handles the null cases above)
  const f = final!;
  const maxAvg = Math.max(1, ...f.judgeAvgPlaces.map(j => j.avgPlace));

  return (
    <View style={{ padding: 16, gap: 12 }}>

      {/* Overall place */}
      <View style={s.finalPlaceBanner}>
        <Text style={s.finalPlaceNum}>{f.overallPlace || "—"}</Text>
        <Text style={s.finalPlaceLabel}>Final Place</Text>
      </View>

      {/* Per-dance places */}
      <SectionHeader title="Dance Results (Skating System)" />
      <View style={s.sectionCard}>
        {f.dances.map((d, i) => (
          <View key={d.dance} style={[s.row, i < f.dances.length - 1 && s.rowBorder]}>
            <Text style={s.rowTitle}>{d.dance}</Text>
            <View style={[s.placeBadge, d.dancePlace <= 3 && { backgroundColor: C.goldFade, borderColor: C.goldBorder }]}>
              <Text style={[s.placeText, { color: d.dancePlace === 1 ? C.gold : d.dancePlace === 2 ? "#b0b8c8" : d.dancePlace === 3 ? "#cd7f32" : C.t1 }]}>
                {d.dancePlace > 0 ? `#${d.dancePlace}` : "—"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Per-dance judge placements */}
      {f.dances.map(d => (
        d.judgeEntries.length > 0 ? (
          <View key={`jd-${d.dance}`}>
            <SectionHeader title={`${d.dance} — Judge Placements`} />
            <View style={s.sectionCard}>
              <View style={s.finalJudgeGrid}>
                {d.judgeEntries.map((je, i) => (
                  <View key={i} style={s.finalJudgeCell}>
                    <Text
                      style={s.finalJudgeLetter}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {jLastName(je.judge, judgeNames)}
                    </Text>
                    <Text style={[s.finalJudgePlace, {
                      color: je.place === 1 ? C.gold : je.place === 2 ? "#b0b8c8" : je.place === 3 ? "#cd7f32" : C.t1,
                    }]}>{je.place}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null
      ))}

      {/* Judge overall analytics */}
      {f.judgeAvgPlaces.length > 0 ? (
        <>
          <SectionHeader title="Judge Analytics (Final)" subtitle="Lower avg = judged you better" />
          <View style={s.sectionCard}>
            {f.judgeAvgPlaces.map((jd, i) => {
              const isFirst  = i === 0;
              const isLast   = i === f.judgeAvgPlaces.length - 1;
              const barColor = isFirst ? C.gold : isLast ? C.red : C.accent;
              const nameColor = isFirst ? C.gold : isLast ? C.red : C.t1;
              const barPct   = 1 - (jd.avgPlace - 1) / 5;
              return (
                <View key={jd.judge} style={[s.barRow, i < f.judgeAvgPlaces.length - 1 && s.rowBorder]}>
                  <Text style={[s.judgeNameLabel, { color: nameColor }]} numberOfLines={1}>
                    {jFullName(jd.judge, judgeNames)}
                  </Text>
                  <View style={s.barRowTrack}>
                    <View style={[s.barRowFill, { width: `${Math.round(barPct * 100)}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={s.barRowVal}>avg {jd.avgPlace.toFixed(1)}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.judgeInsightRow}>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>🏅</Text>
              <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Liked Us Most</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(f.judgeAvgPlaces[0]?.judge, judgeNames)}</Text>
              <Text style={s.judgeInsightVal}>avg {f.judgeAvgPlaces[0]?.avgPlace.toFixed(1)}</Text>
            </View>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>📊</Text>
              <Text style={[s.judgeInsightLabel, { color: C.t2 }]}>Strictest Judge</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{jLastName(f.judgeAvgPlaces[f.judgeAvgPlaces.length - 1]?.judge, judgeNames)}</Text>
              <Text style={s.judgeInsightVal}>avg {f.judgeAvgPlaces[f.judgeAvgPlaces.length - 1]?.avgPlace.toFixed(1)}</Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

// ─── Tab: Compare ─────────────────────────────────────────────────────────────

function CompareTab({ analytics }: { analytics: CompetitionAnalytics }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const myCouple = analytics.coupleNumber;
  const myName   = analytics.coupleName.toLowerCase();

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <SectionHeader
        noMargin
        title="All Couples"
        subtitle={`${analytics.allCouples.length} couples at this event`}
      />
      <View style={s.sectionCard}>
        {analytics.allCouples.slice(0, 50).map((entry, i) => {
          const isMe = (myCouple && entry.coupleNumber === myCouple)
            || entry.coupleName.toLowerCase() === myName;
          return (
            <View
              key={i}
              style={[
                s.compareRow,
                i < analytics.allCouples.length - 1 && s.rowBorder,
                isMe && { backgroundColor: C.accentFade },
              ]}
            >
              <View style={[s.compareRankBadge, isMe && { backgroundColor: C.accent }]}>
                <Text style={[s.compareRankText, isMe && { color: "#fff" }]}>
                  {entry.rank}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.compareCoupleName, isMe && { color: C.accent, fontWeight: "800" }]} numberOfLines={1}>
                  {entry.coupleName}
                  {isMe ? " ← You" : ""}
                </Text>
                <Text style={s.compareCoupleInfo}>#{entry.coupleNumber} · {entry.country}{entry.points ? ` · ${entry.points} pts` : ""}</Text>
              </View>
            </View>
          );
        })}
        {analytics.allCouples.length > 50 ? (
          <View style={s.row}>
            <Text style={{ color: C.t3, fontSize: 12, textAlign: "center", flex: 1, padding: 8 }}>
              + {analytics.allCouples.length - 50} more couples
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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

function BigStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.bigStatCard, { borderColor: color + "40" }]}>
      <Text style={[s.bigStatValue, { color }]}>{value}</Text>
      <Text style={s.bigStatLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle, noMargin }: { title: string; subtitle?: string; noMargin?: boolean }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.sectionHeaderRow, noMargin && HDR_RESET]}>
      <Text style={s.sectionHeaderTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionHeaderSub}>{subtitle}</Text> : null}
    </View>
  );
}

function InfoRow({
  label, value, highlight, isLast,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
  isLast?: boolean;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  if (!value) return null;
  return (
    <View style={[s.infoRow, !isLast && s.rowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, highlight && { color: C.accent, fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

function PartnerRow({ partner, isLast }: { partner: WdsfPartner; isLast: boolean }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const isCurrent = partner.status === "current";
  const sub = [
    partner.nationality,
    partner.represents && partner.represents !== partner.nationality ? `→ ${partner.represents}` : null,
    partner.since ? `since ${partner.since}` : null,
    partner.until ? `until ${partner.until}` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={[s.partnerDot, { backgroundColor: isCurrent ? C.accent : C.t3 }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{partner.name}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      <View style={[s.partnerStatusBadge, { backgroundColor: isCurrent ? C.accentFade : C.elevated, borderColor: isCurrent ? C.accentBorder : C.border }]}>
        <Text style={[s.partnerStatusText, { color: isCurrent ? C.accent : C.t3 }]}>
          {isCurrent ? "Active" : "Retired"}
        </Text>
      </View>
    </View>
  );
}

function CompetitionRow({ comp, isLast, onPress }: {
  comp: WdsfCompetition;
  isLast: boolean;
  onPress?: () => void;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const placeNum = comp.place ? parseInt(comp.place, 10) : null;
  const hasNumPlace = placeNum !== null && !isNaN(placeNum) && placeNum > 0;
  const placeColor = placeNum === 1 ? C.gold : placeNum === 2 ? "#b0b8c8" : placeNum === 3 ? "#cd7f32" : C.t1;
  const meta = [comp.discipline, comp.category, comp.location].filter(Boolean).join(" · ");

  const inner = (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{comp.event || "Competition"}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{[comp.date, meta].filter(Boolean).join("  ·  ")}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {hasNumPlace ? (
          <View style={[s.placeBadge, placeNum === 1 && { backgroundColor: C.goldFade, borderColor: C.goldBorder }]}>
            <Text style={[s.placeText, { color: placeColor }]}>
              {placeNum === 1 ? "🥇" : placeNum === 2 ? "🥈" : placeNum === 3 ? "🥉" : `#${comp.place}`}
            </Text>
          </View>
        ) : comp.place ? (
          <Text style={s.placeDns}>{comp.place}</Text>
        ) : null}
        {comp.competitionUrl ? <Text style={s.compAnalyticsHint}>›</Text> : null}
      </View>
    </View>
  );

  return onPress ? <PressableScale onPress={onPress}>{inner}</PressableScale> : inner;
}

// ─── Judge name helpers ───────────────────────────────────────────────────────

function jFullName(letter: string | undefined, judgeNames: Record<string, string>): string {
  if (!letter) return "";
  return judgeNames[letter] ?? letter;
}

function jLastName(letter: string | undefined, judgeNames: Record<string, string>): string {
  if (!letter) return "";
  const full = judgeNames[letter];
  if (!full) return letter;
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? full;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bestPlace(comps: WdsfCompetition[]): string {
  let best = Infinity;
  for (const c of comps) {
    const n = parseInt(c.place ?? "", 10);
    if (!isNaN(n) && n > 0 && n < best) best = n;
  }
  return isFinite(best) ? (best === 1 ? "🥇 1st" : `#${best}`) : "—";
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min  = Math.floor(diff / 60_000);
  if (min  < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr   < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: C.t2, fontSize: 14, textAlign: "center" },

  // Setup
  setupContent: { paddingHorizontal: 20, paddingTop: 32 },
  setupHero:    { alignItems: "center", marginBottom: 28 },
  wdsfLogoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: C.elevated, borderWidth: 2, borderColor: C.accentBorder,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  wdsfLogoText: { color: C.accent, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  setupTitle:   { color: C.t1, fontSize: 22, fontWeight: "800", letterSpacing: -0.4, textAlign: "center", marginBottom: 8 },
  setupSub:     { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  setupCard: {
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 16,
  },
  inputLabel: { color: C.t2, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: C.elevated, color: C.t1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  inputHint:  { color: C.t3, fontSize: 12, marginBottom: 16 },
  link:       { color: C.accent },
  errorBox:   { backgroundColor: `${C.red}18`, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText:  { color: C.red, fontSize: 13, lineHeight: 18, textAlign: "center" },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  toggleRow:  { paddingVertical: 12, alignItems: "center", marginBottom: 8 },
  toggleText: { color: C.accent, fontSize: 14 },

  // Hero
  heroCard: {
    margin: 20, backgroundColor: C.card, borderRadius: 24,
    borderWidth: 1, borderColor: C.border,
    alignItems: "center", paddingVertical: 28, paddingHorizontal: 20,
  },
  heroPhotoWrap:        { position: "relative", marginBottom: 16 },
  heroPhoto:            { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: C.accentBorder },
  heroPhotoFallback:    { backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
  heroPhotoFallbackText:{ color: C.accent, fontSize: 30, fontWeight: "800" },
  heroBadge: {
    position: "absolute", bottom: -4, right: -4,
    backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 2, borderColor: C.bg,
  },
  heroBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  heroName:      { color: C.t1, fontSize: 22, fontWeight: "800", letterSpacing: -0.4, marginBottom: 2 },
  heroCountry:   { color: C.t2, fontSize: 14, marginBottom: 14 },
  licenseBadge:  { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  licenseBadgeText: { fontSize: 12, fontWeight: "700" },

  // Stats strip
  statsRow: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, flexDirection: "row",
  },
  statBox:     { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue:   { color: C.t1, fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  statLabel:   { color: C.t3, fontSize: 10, fontWeight: "500", marginTop: 2 },
  statsDivider:{ width: 1, backgroundColor: C.border, marginVertical: 10 },

  // Sections
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6, marginTop: 4,
  },
  sectionHeaderTitle: { color: C.t1, fontSize: 15, fontWeight: "700" },
  sectionHeaderSub:   { color: C.t3, fontSize: 11 },
  sectionCard: {
    marginBottom: 8,
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  profileSection: { paddingHorizontal: 20 },

  // Rows
  infoRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel: { color: C.t3, fontSize: 13, fontWeight: "500", flex: 1 },
  infoValue: { color: C.t1, fontSize: 13, fontWeight: "600", flex: 2, textAlign: "right" },
  row:       { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowTitle:  { color: C.t1, fontSize: 14, fontWeight: "600", marginBottom: 2 },
  rowSub:    { color: C.t2, fontSize: 12 },

  // Partner
  partnerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  partnerStatusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  partnerStatusText: { fontSize: 11, fontWeight: "700" },

  // Competition
  placeBadge: {
    backgroundColor: C.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border, alignItems: "center",
  },
  placeText:        { fontSize: 13, fontWeight: "700" },
  placeDns:         { color: C.t3, fontSize: 12 },
  compAnalyticsHint:{ color: C.accent, fontSize: 18, fontWeight: "600" },

  // Actions
  actions:       { alignItems: "center", gap: 10, marginTop: 4 },
  updatedText:   { color: C.t3, fontSize: 12 },
  refreshBtn: {
    backgroundColor: C.elevated, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28,
    borderWidth: 1, borderColor: C.accentBorder, width: "100%", alignItems: "center",
  },
  refreshBtnText: { color: C.accent, fontWeight: "700", fontSize: 15 },
  unlinkBtn:      { paddingVertical: 10, width: "100%", alignItems: "center" },
  unlinkBtnText:  { color: C.red, fontSize: 13, fontWeight: "600" },

  // Modal
  modalBg: {
    flex: 1, backgroundColor: C.bg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 8,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: "center", marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { color: C.t1, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  modalSub:   { color: C.t2, fontSize: 12, marginTop: 2 },
  modalClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.elevated,
    alignItems: "center", justifyContent: "center", marginLeft: 12,
  },
  modalCloseText: { color: C.t2, fontSize: 14, fontWeight: "700" },

  // Tab bar
  tabBar: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 4,
  },
  tabItem: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: "center", backgroundColor: C.elevated,
  },
  tabItemActive: { backgroundColor: C.accentFade },
  tabLabel:      { color: C.t2, fontSize: 12, fontWeight: "600" },
  tabLabelActive:{ color: C.accent, fontWeight: "700" },

  analyticsCenter: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8,
  },
  emptyState: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 24, alignItems: "center",
  },
  emptyStateText: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Overview tab
  coupleChip: {
    backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
  },
  coupleChipLabel:  { color: C.t3, fontSize: 11, fontWeight: "600" },
  coupleChipNumber: { color: C.accent, fontSize: 18, fontWeight: "800", minWidth: 36 },
  coupleChipName:   { color: C.t1, fontSize: 14, fontWeight: "600", flex: 1 },

  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bigStatCard: {
    flex: 1, minWidth: "45%", backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, padding: 16, alignItems: "center",
  },
  bigStatValue: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  bigStatLabel: { color: C.t2, fontSize: 11, fontWeight: "600", marginTop: 4, textAlign: "center" },

  roundRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  roundLabel:     { color: C.t2, fontSize: 12, fontWeight: "600", width: 58 },
  roundBarWrap:   { flex: 1, height: 8, backgroundColor: C.elevated, borderRadius: 4, overflow: "hidden" },
  roundBar:       { height: "100%", borderRadius: 4 },
  roundCrossCount:{ color: C.t1, fontSize: 12, fontWeight: "700", width: 28, textAlign: "right" },

  danceCompareRow: { flexDirection: "row", gap: 8 },
  danceCompareCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    padding: 14, alignItems: "center", gap: 4,
  },
  danceCompareIcon:  { fontSize: 22 },
  danceCompareLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  danceCompareName:  { color: C.t1, fontSize: 14, fontWeight: "700", textAlign: "center" },
  danceCompareVal:   { color: C.t2, fontSize: 12 },

  // Crosses tab
  barRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  barRowLabel: { color: C.t1, fontSize: 13, fontWeight: "600", width: 110 },
  barRowTrack: { flex: 1, height: 8, backgroundColor: C.elevated, borderRadius: 4, overflow: "hidden" },
  barRowFill:  { height: "100%", borderRadius: 4 },
  barRowVal:   { color: C.t1, fontSize: 12, fontWeight: "700", minWidth: 54, textAlign: "right" },
  barRowPct:   { color: C.t2, fontSize: 11 },

  judgeChip: {
    width: 36, height: 24, borderRadius: 6, backgroundColor: C.elevated,
    alignItems: "center", justifyContent: "center",
  },
  judgeChipText: { color: C.t1, fontSize: 11, fontWeight: "700" },
  judgeNameLabel: { fontSize: 12, fontWeight: "600", width: 130, flexShrink: 1 },

  judgeInsightRow: { flexDirection: "row", gap: 8 },
  judgeInsightCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 12, alignItems: "center", gap: 2,
  },
  judgeInsightIcon:  { fontSize: 20 },
  judgeInsightLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  judgeInsightName:  { color: C.t1, fontSize: 16, fontWeight: "800" },
  judgeInsightVal:   { color: C.t2, fontSize: 11 },

  roundFilterRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4,
  },
  roundFilterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card,
  },
  roundFilterChipActive: {
    backgroundColor: C.accent, borderColor: C.accent,
  },
  roundFilterChipText: {
    fontSize: 13, fontWeight: "600", color: C.t2,
  },
  roundFilterChipTextActive: {
    color: "#fff",
  },

  roundHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
  },
  roundHeaderTitle: { color: C.t1, fontSize: 14, fontWeight: "700", flex: 1 },
  roundHeaderTotal: { color: C.t2, fontSize: 12 },
  roundExpandIcon:  { color: C.t3, fontSize: 12, marginLeft: 10 },

  roundExpanded: { borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 14, paddingBottom: 12 },
  roundDanceHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, paddingBottom: 6,
  },
  roundDanceName:   { color: C.t1, fontSize: 13, fontWeight: "700" },
  roundDanceCrosses:{ color: C.t2, fontSize: 12 },

  // Scores 3.0 detail rows
  crossRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 6 },
  crossJudge:  { color: C.t1, fontSize: 12, fontWeight: "600", width: 110, flexShrink: 1 },
  crossScores3:{ flexDirection: "row", flex: 1, gap: 4, flexWrap: "wrap" },
  crossRank:   { color: C.t3, fontSize: 11, fontWeight: "600", width: 28, textAlign: "right" },
  score3Chip: {
    backgroundColor: C.accent + "22",
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    fontSize: 12, fontWeight: "700", color: C.t1,
  },
  emptyCenter: { alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText:   { color: C.t3, fontSize: 14, textAlign: "center" },

  crossGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 8 },
  crossCell: {
    width: (SW - 32 - 28 - 48) / 6,
    alignItems: "center", borderRadius: 8, padding: 6,
    borderWidth: 1,
  },
  crossCellJudge: { color: C.t3, fontSize: 9, fontWeight: "700" },
  crossCellMark:  { fontSize: 12, fontWeight: "800" },

  // Final tab
  finalPlaceBanner: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.goldBorder,
    padding: 28, alignItems: "center", marginBottom: 4,
  },
  finalPlaceNum:   { color: C.gold, fontSize: 56, fontWeight: "900", letterSpacing: -2 },
  finalPlaceLabel: { color: C.t2, fontSize: 14, fontWeight: "600", marginTop: 4 },

  finalJudgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  finalJudgeCell: {
    width: (SW - 32 - 24 - 64) / 6,
    alignItems: "center", backgroundColor: C.elevated, borderRadius: 10, padding: 8,
  },
  finalJudgeLetter: { color: C.t2, fontSize: 10, fontWeight: "700" },
  finalJudgePlace:  { fontSize: 18, fontWeight: "900", marginTop: 2 },

  // Compare tab
  compareRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  compareRankBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: C.elevated,
    alignItems: "center", justifyContent: "center",
  },
  compareRankText:     { color: C.t1, fontSize: 12, fontWeight: "800" },
  compareCoupleName:   { color: C.t1, fontSize: 13, fontWeight: "600" },
  compareCoupleInfo:   { color: C.t2, fontSize: 11, marginTop: 1 },
  });
}
