import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  type Score3JudgeEntry,
  type Score3Components,
  type Scores3Result,
  type RankingEntry,
  type CoupleScores,
} from "../../store/useWdsfStore";
import PressableScale from "../../components/ui/PressableScale";
import GradientButton from "../../components/ui/GradientButton";
import { LinearGradient } from "expo-linear-gradient";
import { GRADIENTS, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import { useT } from "../../lib/i18n";
import { useToastStore } from "../../store/useToastStore";

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
  const t = useT();
  const showToast = useToastStore((st) => st.show);
  const [min, setMin]         = useState("");
  const [url, setUrl]         = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const announceLinked = () =>
    showToast({ icon: "🕺", title: t.toasts.wdsfLinkedTitle, body: t.toasts.wdsfLinkedBody });

  const handleLinkMin = async () => {
    if (!min.trim()) { Alert.alert("Enter your MIN", "Please enter your WDSF Member ID Number."); return; }
    try { await linkByMin(min.trim()); announceLinked(); } catch { /* error shown from store */ }
  };

  const handleLinkUrl = async () => {
    if (!url.trim() || !url.includes("worlddancesport.org/Athletes/")) {
      Alert.alert("Invalid URL", "Please paste your full WDSF profile URL.");
      return;
    }
    try { await linkByUrl(url.trim(), min.trim() || undefined); announceLinked(); } catch { /* error shown */ }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.setupContent} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.setupHero}>
        <LinearGradient colors={GRADIENTS.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.wdsfLogoBox}>
          <Text style={[s.wdsfLogoText, { color: "#fff" }]}>WDSF</Text>
        </LinearGradient>
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
        <GradientButton onPress={handleLinkMin} disabled={loading} contentStyle={{ paddingVertical: 14 }}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.primaryBtnText}>Search my profile</Text>}
        </GradientButton>
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
            <GradientButton onPress={handleLinkUrl} disabled={loading} contentStyle={{ paddingVertical: 14 }}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>Link this profile</Text>}
            </GradientButton>
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
  const [showProgress, setShowProgress] = useState(false);

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
          <LinearGradient
            colors={["rgba(99,102,241,0.20)", "rgba(168,85,247,0.10)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          />
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
          {profile.competitions.length > 1 ? (
            <PressableScale style={s.progressBtn} onPress={() => setShowProgress(true)}>
              <Text style={s.progressBtnText}>📊  Progress & compare tournaments</Text>
            </PressableScale>
          ) : null}
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

      {/* Progress & cross-tournament comparison */}
      {showProgress ? (
        <ProgressModal
          competitions={profile.competitions}
          onClose={() => setShowProgress(false)}
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

// ─── Cross-tournament Progress & Compare ──────────────────────────────────────

const COMP_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function parseCompDate(sDate: string): number {
  if (!sDate) return 0;
  const t = Date.parse(sDate);
  if (!isNaN(t)) return t;
  const m = sDate.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mi = COMP_MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return new Date(parseInt(m[3], 10), mi, parseInt(m[1], 10)).getTime();
  }
  const y = sDate.match(/(\d{4})/);
  return y ? new Date(parseInt(y[1], 10), 0, 1).getTime() : 0;
}
function numOrNull(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}
function shortEventLabel(c: WdsfCompetition): string {
  const loc = c.location ? c.location.split(/[-,(]/)[0].trim() : "";
  if (loc && loc.length <= 14) return loc;
  return (c.event || loc || "Event").slice(0, 14);
}
function fmtYear(t: number | undefined): string {
  return t ? String(new Date(t).getFullYear()) : "";
}

function ProgressModal({ competitions, onClose }: { competitions: WdsfCompetition[]; onClose: () => void }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<"trends" | "dances" | "compare" | "judges">("trends");

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalHandle} />
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.modalTitle} numberOfLines={1}>Progress & Compare</Text>
            <Text style={s.modalSub}>{competitions.length} tournaments</Text>
          </View>
          <TouchableOpacity style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={s.tabBar}>
          {([{ key: "trends", label: "Trends" }, { key: "dances", label: "Dances" }, { key: "compare", label: "Compare 2" }, { key: "judges", label: "Judges" }] as const).map(t => (
            <TouchableOpacity key={t.key} style={[s.tabItem, tab === t.key && s.tabItemActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {tab === "trends" && <TrendsView competitions={competitions} />}
          {tab === "dances" && <DanceDynamicsView competitions={competitions} />}
          {tab === "compare" && <CompareEventsView competitions={competitions} />}
          {tab === "judges" && <JudgeRankingView competitions={competitions} />}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// Detect the dance style of a competition (ignore age categories like Adult/U21).
function danceStyle(c: WdsfCompetition): "Standard" | "Latin" | null {
  const t = `${c.discipline} ${c.category} ${c.event}`.toLowerCase();
  if (/\bstandard\b|\bstd\b|\bballroom\b|\bsmooth\b|\bmodern\b/.test(t)) return "Standard";
  if (/\blatin\b|\blat\b|\brhythm\b/.test(t)) return "Latin";
  return null;
}

function TrendsView({ competitions }: { competitions: WdsfCompetition[] }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const styleTabs = useMemo(() => {
    const set = new Set<string>();
    for (const c of competitions) { const st = danceStyle(c); if (st) set.add(st); }
    return ["All", ...["Standard", "Latin"].filter(x => set.has(x))];
  }, [competitions]);
  const [disc, setDisc] = useState("All");
  const [selBar, setSelBar] = useState<number | null>(null);

  const items = competitions
    .map(c => ({ comp: c, place: numOrNull(c.place), points: numOrNull(c.points), time: parseCompDate(c.date), style: danceStyle(c) }))
    .filter(it => disc === "All" || it.style === disc);

  const chrono = [...items].sort((a, b) => (a.time || 0) - (b.time || 0));
  const placed = chrono.filter(it => it.place != null) as { comp: WdsfCompetition; place: number; points: number | null; time: number; style: string | null }[];
  const best = placed.length ? Math.min(...placed.map(it => it.place)) : null;
  const avg = placed.length ? placed.reduce((sum, it) => sum + it.place, 0) / placed.length : null;
  const maxPlace = placed.length ? Math.max(...placed.map(it => it.place)) : 1;
  const wins = placed.filter(it => it.place === 1).length;
  const sel = selBar != null ? chrono[selBar] : null;

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {styleTabs.length > 1 && (
        <View style={s.roundFilterRow}>
          {styleTabs.map(d => (
            <TouchableOpacity key={d} style={[s.roundFilterChip, disc === d && s.roundFilterChipActive]} onPress={() => { setDisc(d); setSelBar(null); }}>
              <Text style={[s.roundFilterChipText, disc === d && s.roundFilterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.judgeInsightRow}>
        <View style={s.judgeInsightCard}>
          <Text style={s.judgeInsightIcon}>📋</Text>
          <Text style={[s.judgeInsightLabel, { color: C.accent }]}>Events</Text>
          <Text style={s.judgeInsightVal}>{items.length}</Text>
        </View>
        <View style={s.judgeInsightCard}>
          <Text style={s.judgeInsightIcon}>🏆</Text>
          <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Best place</Text>
          <Text style={s.judgeInsightVal}>{best != null ? `#${best}` : "—"}</Text>
        </View>
        <View style={s.judgeInsightCard}>
          <Text style={s.judgeInsightIcon}>📊</Text>
          <Text style={[s.judgeInsightLabel, { color: C.t2 }]}>Avg place</Text>
          <Text style={s.judgeInsightVal}>{avg != null ? avg.toFixed(1) : "—"}</Text>
        </View>
      </View>

      {placed.length > 1 && (
        <>
          <SectionHeader title="Placement over time" subtitle="Tap a bar to see the result" />
          <View style={[s.sectionCard, { padding: 14 }]}>
            <View style={{ minHeight: 36, marginBottom: 8 }}>
              {sel ? (
                <>
                  <Text style={{ color: C.t1, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>{sel.comp.event || "Competition"}</Text>
                  <Text style={{ color: C.t3, fontSize: 11 }} numberOfLines={1}>
                    {[sel.comp.date, sel.place != null ? `Place #${sel.place}` : "—", sel.style].filter(Boolean).join(" · ")}
                  </Text>
                </>
              ) : (
                <Text style={{ color: C.t3, fontSize: 12 }}>Taller = better placement · {wins} win{wins === 1 ? "" : "s"} · tap a bar</Text>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: 64, gap: 3 }}>
              {chrono.map((it, i) => {
                const h = it.place != null ? Math.max(0.08, (maxPlace + 1 - it.place) / maxPlace) : 0.04;
                const isSel = selBar === i;
                const col = it.place == null ? C.border : it.place === 1 ? C.gold : C.accent;
                return (
                  <TouchableOpacity key={i} activeOpacity={0.6} onPress={() => setSelBar(isSel ? null : i)} style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}>
                    <View style={{ height: `${Math.round(h * 100)}%`, borderRadius: 3, backgroundColor: col, opacity: it.place == null ? 0.4 : isSel ? 1 : it.place === 1 ? 0.95 : 0.7, borderWidth: isSel ? 2 : 0, borderColor: C.t1 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: C.t3, fontSize: 11 }}>{fmtYear(chrono[0]?.time)}</Text>
              <Text style={{ color: C.t3, fontSize: 11 }}>{fmtYear(chrono[chrono.length - 1]?.time)}</Text>
            </View>
          </View>
        </>
      )}

      <SectionHeader title="Results" subtitle={`${items.length} event${items.length === 1 ? "" : "s"}`} />
      <View style={s.sectionCard}>
        {[...items].sort((a, b) => (b.time || 0) - (a.time || 0)).map((it, i, arr) => {
          const p = it.place;
          const barPct = p != null ? Math.max(6, Math.round(((maxPlace + 1 - p) / maxPlace) * 100)) : 0;
          const pc = p === 1 ? C.gold : p === 2 ? "#b0b8c8" : p === 3 ? "#cd7f32" : C.t1;
          return (
            <View key={i} style={[s.barRow, i < arr.length - 1 && s.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{it.comp.event || "Competition"}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{[it.comp.date, it.style].filter(Boolean).join(" · ")}</Text>
              </View>
              <View style={{ width: 64, height: 6, borderRadius: 3, backgroundColor: C.border, marginHorizontal: 8, overflow: "hidden" }}>
                <View style={{ width: `${barPct}%`, height: "100%", backgroundColor: pc, borderRadius: 3 }} />
              </View>
              <Text style={[s.barRowVal, { color: pc, width: 40, textAlign: "right" }]}>{p != null ? `#${p}` : (it.comp.place || "—")}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DanceDynamicsView({ competitions }: { competitions: WdsfCompetition[] }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const fetchAnalytics = useWdsfStore(st => st.fetchAnalytics);
  const cache = useWdsfStore(st => st.analyticsCache);
  const loadingMap = useWdsfStore(st => st.analyticsLoading);

  const styleTabs = useMemo(() => {
    const set = new Set<string>();
    for (const c of competitions) { const st = danceStyle(c); if (st) set.add(st); }
    return ["All", ...["Standard", "Latin"].filter(x => set.has(x))];
  }, [competitions]);
  const [disc, setDisc] = useState("All");
  const [n, setN] = useState(10);

  const pool = useMemo(() => competitions
    .filter(c => c.competitionUrl && (disc === "All" || danceStyle(c) === disc))
    .map(c => ({ c, time: parseCompDate(c.date) }))
    .sort((x, y) => y.time - x.time)
    .slice(0, n)
    .map(x => x.c), [competitions, disc, n]);

  const urls = pool.map(c => c.competitionUrl as string);
  const urlsKey = urls.join(",");

  useEffect(() => {
    urls.forEach(u => fetchAnalytics(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, fetchAnalytics]);

  const loaded = urls.map(u => cache[u]).filter((a): a is CompetitionAnalytics => !!a);
  const anyLoading = urls.some(u => loadingMap[u]);

  const agg3: Record<string, { sum: number; n: number }> = {};
  const agg2: Record<string, { sum: number; n: number }> = {};
  for (const a of loaded) {
    const r3 = a.final3 ?? (a.scores3 && a.scores3.rounds.length ? a.scores3.rounds[a.scores3.rounds.length - 1] : null);
    if (r3) for (const d of r3.dances) {
      if (d.totalScore > 0) {
        if (!agg3[d.dance]) agg3[d.dance] = { sum: 0, n: 0 };
        agg3[d.dance].sum += d.totalScore;
        agg3[d.dance].n += 1;
      }
    }
    for (const ds of a.danceStats) {
      if (ds.avgPerRound > 0) {
        if (!agg2[ds.dance]) agg2[ds.dance] = { sum: 0, n: 0 };
        agg2[ds.dance].sum += ds.avgPerRound;
        agg2[ds.dance].n += 1;
      }
    }
  }
  const list3 = Object.entries(agg3).map(([dance, v]) => ({ dance, avg: v.sum / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);
  const list2 = Object.entries(agg2).map(([dance, v]) => ({ dance, avg: v.sum / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);

  const renderList = (title: string, sub: string, list: { dance: string; avg: number; n: number }[], digits: number) => {
    if (!list.length) return null;
    const max = Math.max(1, ...list.map(d => d.avg));
    return (
      <>
        <SectionHeader title={title} subtitle={sub} />
        <View style={s.sectionCard}>
          {list.map((d, i) => {
            const isFirst = i === 0, isLast = i === list.length - 1;
            const col = isFirst ? C.gold : isLast ? C.red : C.accent;
            return (
              <View key={d.dance} style={[s.barRow, i < list.length - 1 && s.rowBorder]}>
                <Text style={[s.barRowLabel, { color: isFirst ? C.gold : isLast ? C.red : C.t1 }]}>{d.dance}</Text>
                <View style={s.barRowTrack}><View style={[s.barRowFill, { width: `${Math.round((d.avg / max) * 100)}%`, backgroundColor: col }]} /></View>
                <Text style={s.barRowVal}>{d.avg.toFixed(digits)}<Text style={s.barRowPct}> ·{d.n}</Text></Text>
              </View>
            );
          })}
        </View>
        <View style={s.judgeInsightRow}>
          <View style={s.judgeInsightCard}>
            <Text style={s.judgeInsightIcon}>🥇</Text>
            <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Best dance</Text>
            <Text style={s.judgeInsightName} numberOfLines={1}>{list[0].dance}</Text>
            <Text style={s.judgeInsightVal}>{list[0].avg.toFixed(digits)}</Text>
          </View>
          <View style={s.judgeInsightCard}>
            <Text style={s.judgeInsightIcon}>📉</Text>
            <Text style={[s.judgeInsightLabel, { color: C.red }]}>Needs work</Text>
            <Text style={s.judgeInsightName} numberOfLines={1}>{list[list.length - 1].dance}</Text>
            <Text style={s.judgeInsightVal}>{list[list.length - 1].avg.toFixed(digits)}</Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {styleTabs.length > 1 && (
        <View style={s.roundFilterRow}>
          {styleTabs.map(d => (
            <TouchableOpacity key={d} style={[s.roundFilterChip, disc === d && s.roundFilterChipActive]} onPress={() => setDisc(d)}>
              <Text style={[s.roundFilterChipText, disc === d && s.roundFilterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={s.roundFilterRow}>
        {[5, 10, 15, 999].map(v => (
          <TouchableOpacity key={v} style={[s.roundFilterChip, n === v && s.roundFilterChipActive]} onPress={() => setN(v)}>
            <Text style={[s.roundFilterChipText, n === v && s.roundFilterChipTextActive]}>{v === 999 ? "All" : `Last ${v}`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ color: C.t3, fontSize: 12 }}>
        {loaded.length}/{urls.length} tournaments loaded{anyLoading ? " …" : ""}
      </Text>
      {anyLoading && loaded.length === 0 && <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />}

      {renderList("System 3.0 dances", "Avg score per dance · best → worst", list3, 2)}
      {renderList("System 2.0 dances", "Avg crosses per dance · best → worst", list2, 1)}

      {!anyLoading && list3.length === 0 && list2.length === 0 && (
        <View style={[s.sectionCard, { padding: 16 }]}>
          <Text style={{ color: C.t2, textAlign: "center" }}>No per-dance data found in these tournaments yet.</Text>
        </View>
      )}
    </View>
  );
}

function CompareEventsView({ competitions }: { competitions: WdsfCompetition[] }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const fetchAnalytics = useWdsfStore(st => st.fetchAnalytics);
  const cache = useWdsfStore(st => st.analyticsCache);
  const loadingMap = useWdsfStore(st => st.analyticsLoading);

  const selectable = useMemo(() => competitions.filter(c => c.competitionUrl), [competitions]);
  const [a, setA] = useState<WdsfCompetition | null>(null);
  const [b, setB] = useState<WdsfCompetition | null>(null);

  const pick = (c: WdsfCompetition) => {
    if (a?.competitionUrl === c.competitionUrl) { setA(b); setB(null); return; }
    if (b?.competitionUrl === c.competitionUrl) { setB(null); return; }
    if (!a) setA(c); else if (!b) setB(c); else { setA(c); setB(null); }
  };

  useEffect(() => { if (a?.competitionUrl) fetchAnalytics(a.competitionUrl); }, [a, fetchAnalytics]);
  useEffect(() => { if (b?.competitionUrl) fetchAnalytics(b.competitionUrl); }, [b, fetchAnalytics]);

  const aData = a?.competitionUrl ? cache[a.competitionUrl] : undefined;
  const bData = b?.competitionUrl ? cache[b.competitionUrl] : undefined;
  const loading = (a?.competitionUrl && (loadingMap[a.competitionUrl] ?? false)) || (b?.competitionUrl && (loadingMap[b.competitionUrl] ?? false));

  let body: ReactNode = null;
  if (a && b) {
    if (loading) {
      body = <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />;
    } else if (aData === null || bData === null) {
      body = <View style={[s.sectionCard, { padding: 16 }]}><Text style={{ color: C.t2, textAlign: "center" }}>Couldn't load one of the events.</Text></View>;
    } else if (aData && bData) {
      body = (
        <RoundCompareView
          a={aData}
          b={bData}
          aLabel={shortEventLabel(a)}
          bLabel={shortEventLabel(b)}
          judgeNames={{}}
          sameJudges={false}
        />
      );
    }
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <SectionHeader noMargin title="Pick two events" subtitle="Tap to set A and B, then compare by dance" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ slot: "A", comp: a }, { slot: "B", comp: b }].map(({ slot, comp }) => (
          <View key={slot} style={[s.sectionCard, { flex: 1, padding: 10, minHeight: 54, justifyContent: "center", borderColor: comp ? C.accentBorder : C.border, borderWidth: 1 }]}>
            <Text style={{ color: comp ? C.accent : C.t3, fontWeight: "800", fontSize: 11 }}>{slot}</Text>
            <Text style={{ color: comp ? C.t1 : C.t3, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{comp ? shortEventLabel(comp) : "— not set —"}</Text>
          </View>
        ))}
      </View>

      <View style={s.sectionCard}>
        {selectable.map((c, i) => {
          const sel = a?.competitionUrl === c.competitionUrl ? "A" : b?.competitionUrl === c.competitionUrl ? "B" : null;
          return (
            <TouchableOpacity key={i} onPress={() => pick(c)}>
              <View style={[s.compareRow, i < selectable.length - 1 && s.rowBorder, sel != null && { backgroundColor: C.accentFade }]}>
                <View style={[s.compareRankBadge, sel != null && { backgroundColor: C.accent }]}>
                  <Text style={[s.compareRankText, sel != null && { color: "#fff" }]}>{sel ?? "+"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.compareCoupleName, sel != null && { color: C.accent, fontWeight: "800" }]} numberOfLines={1}>{c.event || "Competition"}</Text>
                  <Text style={s.compareCoupleInfo} numberOfLines={1}>{[c.date, c.discipline, c.place ? `#${c.place}` : null].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {body}
    </View>
  );
}

// ─── Cross-tournament judge rankings ──────────────────────────────────────────
// Aggregate per-judge scores across the last N tournaments. Judges are matched by
// NAME (panels differ between events, so the letter "A" is a different person each
// time); judges without a resolved name are kept per-event so they never merge.

interface JudgeAgg { name: string; value: number; samples: number; tournaments: number }
interface JudgeRankings { q2: JudgeAgg[]; q3: JudgeAgg[]; f2: JudgeAgg[]; f3: JudgeAgg[] }

function aggregateJudgeRankings(list: CompetitionAnalytics[]): JudgeRankings {
  type Acc = { name: string; num: number; den: number; tournaments: Set<string> };

  const keyOf = (letter: string, names: Record<string, string>, slug: string) => {
    const full = names?.[letter]?.trim();
    if (full) return { key: full.toLowerCase(), name: full };
    return { key: `${slug}::${letter}`, name: letter }; // unresolved → keep per-event
  };
  const bump = (m: Map<string, Acc>, letter: string, names: Record<string, string>, slug: string, addNum: number, addDen: number) => {
    if (!letter) return;
    const { key, name } = keyOf(letter, names, slug);
    let a = m.get(key);
    if (!a) { a = { name, num: 0, den: 0, tournaments: new Set() }; m.set(key, a); }
    a.num += addNum; a.den += addDen; a.tournaments.add(slug);
  };

  const q2 = new Map<string, Acc>(), q3 = new Map<string, Acc>(), f2 = new Map<string, Acc>(), f3 = new Map<string, Acc>();

  for (const an of list) {
    const names = an.judgeNames ?? {};
    const slug = an.competitionSlug || an.rankingUrl || an.competitionName;
    for (const r of an.rounds) for (const d of r.dances) for (const c of d.crosses) {
      bump(q2, c.judge, names, slug, c.marked ? 1 : 0, 1);
    }
    if (an.scores3) for (const r of an.scores3.rounds) for (const d of r.dances) for (const je of d.judgeEntries) {
      bump(q3, je.judge, names, slug, score3JudgeMark(je), 1);
    }
    if (an.final) for (const d of an.final.dances) for (const je of d.judgeEntries) {
      bump(f2, je.judge, names, slug, je.place, 1);
    }
    if (an.final3) for (const d of an.final3.dances) for (const je of d.judgeEntries) {
      bump(f3, je.judge, names, slug, score3JudgeMark(je), 1);
    }
  }

  const finalize = (m: Map<string, Acc>, higherBetter: boolean, scale = 1): JudgeAgg[] =>
    [...m.values()]
      .filter(a => a.den > 0)
      .map(a => ({ name: a.name, value: (a.num / a.den) * scale, samples: a.den, tournaments: a.tournaments.size }))
      .sort((x, y) => (higherBetter ? y.value - x.value : x.value - y.value));

  return {
    q2: finalize(q2, true, 100), // % of possible crosses earned
    q3: finalize(q3, true),
    f2: finalize(f2, false),     // average placement, lower is better
    f3: finalize(f3, true),
  };
}

// One ranked category (best → worst). Bars are normalised so the best judge is
// always the fullest bar, regardless of whether higher or lower values are better.
function JudgeRankCategory({ title, subtitle, data, fmt, lowerBetter = false }: {
  title: string;
  subtitle: string;
  data: JudgeAgg[];
  fmt: (v: number) => string;
  lowerBetter?: boolean;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  if (data.length === 0) return null;

  // Headline best/worst prefer judges with enough data points; fall back to all.
  const MIN = 3;
  const strong = data.filter(d => d.samples >= MIN);
  const pool = strong.length >= 2 ? strong : data;
  const best = pool[0];
  const worst = pool[pool.length - 1];

  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const frac = (v: number) => {
    if (max === min) return 1;
    return lowerBetter ? (max - v) / (max - min) : (v - min) / (max - min);
  };

  return (
    <View style={{ gap: 8 }}>
      <SectionHeader noMargin title={title} subtitle={subtitle} />
      <View style={s.judgeInsightRow}>
        <View style={s.judgeInsightCard}>
          <Text style={s.judgeInsightIcon}>🏅</Text>
          <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Best</Text>
          <Text style={s.judgeInsightName} numberOfLines={1}>{best.name}</Text>
          <Text style={s.judgeInsightVal}>{fmt(best.value)} · {best.tournaments}t</Text>
        </View>
        <View style={s.judgeInsightCard}>
          <Text style={s.judgeInsightIcon}>🧊</Text>
          <Text style={[s.judgeInsightLabel, { color: C.red }]}>Strictest</Text>
          <Text style={s.judgeInsightName} numberOfLines={1}>{worst.name}</Text>
          <Text style={s.judgeInsightVal}>{fmt(worst.value)} · {worst.tournaments}t</Text>
        </View>
      </View>
      <View style={s.sectionCard}>
        {data.map((d, i) => {
          const isFirst = i === 0, isLast = i === data.length - 1;
          const col = isFirst ? C.gold : isLast ? C.red : C.t1;
          return (
            <View key={`${d.name}-${i}`} style={[s.barRow, i < data.length - 1 && s.rowBorder]}>
              <Text style={[s.judgeNameLabel, { color: col }]} numberOfLines={1}>{d.name}</Text>
              <View style={s.barRowTrack}>
                <View style={[s.barRowFill, { width: `${Math.round(Math.max(0.05, frac(d.value)) * 100)}%`, backgroundColor: col }]} />
              </View>
              <Text style={s.barRowVal}>{fmt(d.value)}</Text>
              <Text style={s.barRowPct}>{d.tournaments}t</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function JudgeRankingView({ competitions }: { competitions: WdsfCompetition[] }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const fetchAnalytics = useWdsfStore(st => st.fetchAnalytics);
  const cache = useWdsfStore(st => st.analyticsCache);

  // Most-recent-first competitions that have an analysable results URL.
  const withUrls = useMemo(
    () => competitions
      .filter(c => c.competitionUrl)
      .sort((a, b) => parseCompDate(b.date) - parseCompDate(a.date)),
    [competitions],
  );

  const [scope, setScope] = useState<5 | 10 | 15>(5);
  const targetUrls = useMemo(
    () => withUrls.slice(0, scope).map(c => c.competitionUrl!),
    [withUrls, scope],
  );
  const urlsKey = targetUrls.join("|");

  // Fetch each target's analytics (cached in the store), 4 at a time so we don't
  // hammer the WDSF site. Re-runs whenever the scope (and thus url set) changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const POOL = 4;
      for (let i = 0; i < targetUrls.length; i += POOL) {
        if (cancelled) return;
        await Promise.all(targetUrls.slice(i, i + POOL).map(u => fetchAnalytics(u)));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, fetchAnalytics]);

  const settled = targetUrls.filter(u => cache[u] !== undefined).length;
  const loaded = useMemo(
    () => targetUrls.map(u => cache[u]).filter((a): a is CompetitionAnalytics => !!a),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlsKey, cache],
  );
  const rankings = useMemo(() => aggregateJudgeRankings(loaded), [loaded]);

  const total = targetUrls.length;
  const done = settled >= total;
  const hasAny = rankings.q2.length || rankings.q3.length || rankings.f2.length || rankings.f3.length;

  if (withUrls.length === 0) {
    return (
      <View style={{ padding: 16 }}>
        <View style={[s.sectionCard, { padding: 16 }]}>
          <Text style={{ color: C.t2, textAlign: "center" }}>No tournaments with detailed score data to analyse yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 14 }}>
      <SectionHeader
        noMargin
        title="Judges across tournaments"
        subtitle={`From your last ${Math.min(scope, withUrls.length)} tournament${Math.min(scope, withUrls.length) === 1 ? "" : "s"}`}
      />

      <View style={s.roundFilterRow}>
        {([5, 10, 15] as const).map(n => (
          <TouchableOpacity
            key={n}
            style={[s.roundFilterChip, scope === n && s.roundFilterChipActive]}
            onPress={() => setScope(n)}
          >
            <Text style={[s.roundFilterChipText, scope === n && s.roundFilterChipTextActive]}>Last {n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!done && (
        <View style={[s.sectionCard, { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }]}>
          <ActivityIndicator color={C.accent} />
          <Text style={{ color: C.t2, fontSize: 13 }}>Loading tournaments… {settled}/{total}</Text>
        </View>
      )}

      {done && !hasAny ? (
        <View style={[s.sectionCard, { padding: 16 }]}>
          <Text style={{ color: C.t2, textAlign: "center" }}>No judge-level score data found in these tournaments.</Text>
        </View>
      ) : null}

      <JudgeRankCategory title="System 2.0 · Qualifying" subtitle="Crosses earned per judge · higher = liked you more" data={rankings.q2} fmt={(v) => `${v.toFixed(0)}%`} />
      <JudgeRankCategory title="System 3.0 · Qualifying" subtitle="Average mark per judge · higher = better" data={rankings.q3} fmt={(v) => v.toFixed(2)} />
      <JudgeRankCategory title="Finals · System 2.0" subtitle="Average placement per judge · lower = better" data={rankings.f2} fmt={(v) => `#${v.toFixed(1)}`} lowerBetter />
      <JudgeRankCategory title="Finals · System 3.0" subtitle="Average final score per judge · higher = better" data={rankings.f3} fmt={(v) => v.toFixed(2)} />

      {hasAny ? (
        <Text style={{ color: C.t3, fontSize: 11, paddingHorizontal: 4, lineHeight: 16 }}>
          Judges are matched by name across events. Panels differ, so many appear in only a few tournaments — the “t” count shows how many. Gold = best, red = strictest.
        </Text>
      ) : null}
    </View>
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

// Sum of a judge's marks for a dance (works for both 2-column and 4-column formats).
// A judge's mark for a dance, normalised to the 0–10 scale so values stay comparable
// across the 2-column (one combined mark) and 4-column (two criteria) layouts, even
// when a single round mixes both. Returns the mean of whatever marks the judge gave.
function score3JudgeMark(je: Score3JudgeEntry): number {
  const vals = [je.tqPs, je.mmCp, je.tq, je.mm, je.ps, je.cp].filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// Shared renderer for one System 3.0 round — full per-dance / per-judge / per-criterion breakdown.
// Handles 2-column (TQ&PS · MM&CP) and 4-column (TQ · MM · PS · CP) dances, including a mix of both.
function Score3RoundView({ round, judgeNames, placeLabel }: {
  round: Score3Round;
  judgeNames: Record<string, string>;
  placeLabel: string;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const hasJudgeData = round.dances.some(d => d.judgeEntries.length > 0);
  const isArtistic = (label: string) => /MM|CP/.test(label);
  const fmt = (v: number) => v.toFixed(2);

  // ── Per-dance totals (canonical order kept; sorted copy drives the bar chart) ──
  const danceTotals = round.dances.map(d => ({
    dance: d.dance,
    total: d.totalScore > 0 ? d.totalScore : d.judgeEntries.reduce((sum, je) => sum + score3JudgeMark(je), 0),
    place: d.place,
  }));
  const danceSorted = [...danceTotals].sort((a, b) => b.total - a.total);
  const maxDance = Math.max(1, ...danceSorted.map(d => d.total));
  const grandTotal = danceTotals.reduce((sum, d) => sum + d.total, 0);

  // ── Per-judge average mark across all dances of the round ──
  const jMap: Record<string, { total: number; count: number }> = {};
  for (const d of round.dances)
    for (const je of d.judgeEntries) {
      if (!jMap[je.judge]) jMap[je.judge] = { total: 0, count: 0 };
      jMap[je.judge].total += score3JudgeMark(je);
      jMap[je.judge].count += 1;
    }
  const judgeAvgs = Object.entries(jMap)
    .map(([judge, { total, count }]) => ({ judge, avg: count ? total / count : 0 }))
    .sort((a, b) => b.avg - a.avg);
  const maxJudge = Math.max(1, ...judgeAvgs.map(j => j.avg));

  // ── Criteria breakdown across the round ──
  // If every scored dance uses the 4-column layout, show TQ/MM/PS/CP (0–10 scale);
  // otherwise fall back to the always-defined area view TQ&PS / MM&CP (0–20 scale),
  // summing the two sub-criteria for any 4-column dances so the mix stays consistent.
  const judged = round.dances.filter(d => d.judgeEntries.length > 0);
  const allFour = judged.length > 0 && judged.every(d => d.fourCriteria);
  let critRows: { label: string; value: number }[] = [];
  let critMax = 10;
  if (allFour) {
    const defs = [["tq", "TQ"], ["mm", "MM"], ["ps", "PS"], ["cp", "CP"]] as const;
    critRows = defs.map(([key, label]) => {
      let sum = 0, n = 0;
      for (const d of judged) { const v = d.components[key]; if (v != null) { sum += v; n += 1; } }
      return { label, value: n ? sum / n : 0, n };
    }).filter(r => r.n > 0).map(({ label, value }) => ({ label, value }));
    critMax = 10;
  } else if (judged.length > 0) {
    let tps = 0, tn = 0, mcp = 0, mn = 0;
    for (const d of judged) {
      const a = d.fourCriteria ? (d.components.tq ?? 0) + (d.components.ps ?? 0) : d.components.tqPs;
      const b = d.fourCriteria ? (d.components.mm ?? 0) + (d.components.cp ?? 0) : d.components.mmCp;
      if (a != null) { tps += a; tn += 1; }
      if (b != null) { mcp += b; mn += 1; }
    }
    if (tn) critRows.push({ label: "TQ & PS", value: tps / tn });
    if (mn) critRows.push({ label: "MM & CP", value: mcp / mn });
    critMax = 20;
  }

  const chipsFor = (je: Score3JudgeEntry, fourCriteria: boolean) =>
    (fourCriteria
      ? ([["TQ", je.tq], ["PS", je.ps], ["MM", je.mm], ["CP", je.cp]] as const)
      : ([["TQ & PS", je.tqPs], ["MM & CP", je.mmCp]] as const)
    ).filter(([, v]) => v != null)
     .map(([label, v]) => ({ label: `${label} ${fmt(v as number)}`, artistic: isArtistic(label) }));

  return (
    <>
      {round.overallPlace > 0 && (
        <View style={s.finalPlaceBanner}>
          <Text style={s.finalPlaceNum}>{round.overallPlace}</Text>
          <Text style={s.finalPlaceLabel}>{placeLabel}</Text>
        </View>
      )}

      {/* Per-dance totals */}
      {danceSorted.length > 0 && (
        <>
          <SectionHeader title="Dance Scores" subtitle="Total points per dance (all judges)" />
          <View style={s.sectionCard}>
            {danceSorted.map((d, i) => (
              <View key={d.dance} style={[s.barRow, i < danceSorted.length - 1 && s.rowBorder]}>
                <Text style={[s.barRowLabel, { color: i === 0 ? C.gold : i === danceSorted.length - 1 ? C.red : C.t1 }]}>{d.dance}</Text>
                <View style={s.barRowTrack}>
                  <View style={[s.barRowFill, { width: `${Math.round((d.total / maxDance) * 100)}%`, backgroundColor: i === 0 ? C.gold : i === danceSorted.length - 1 ? C.red : C.accent }]} />
                </View>
                <Text style={s.barRowVal}>
                  {d.total.toFixed(2)}{d.place > 0 ? <Text style={s.barRowPct}> (#{d.place})</Text> : null}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.judgeInsightRow}>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>🥇</Text>
              <Text style={[s.judgeInsightLabel, { color: C.gold }]}>Best Dance</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{danceSorted[0]?.dance}</Text>
              <Text style={s.judgeInsightVal}>{danceSorted[0]?.total.toFixed(2)}</Text>
            </View>
            <View style={s.judgeInsightCard}>
              <Text style={s.judgeInsightIcon}>📉</Text>
              <Text style={[s.judgeInsightLabel, { color: C.red }]}>Needs Work</Text>
              <Text style={s.judgeInsightName} numberOfLines={1}>{danceSorted[danceSorted.length - 1]?.dance}</Text>
              <Text style={s.judgeInsightVal}>{danceSorted[danceSorted.length - 1]?.total.toFixed(2)}</Text>
            </View>
          </View>
          <View style={[s.sectionCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }]}>
            <Text style={[s.barRowLabel, { fontWeight: "600" }]}>Total Score</Text>
            <Text style={[s.barRowVal, { fontSize: 18, fontWeight: "700", color: C.accent }]}>{grandTotal.toFixed(2)}</Text>
          </View>
        </>
      )}

      {/* Criteria breakdown (component averages) */}
      {critRows.length > 0 && (
        <>
          <SectionHeader
            title="Criteria Breakdown"
            subtitle={allFour ? "Average per criterion · TQ · MM · PS · CP" : "Technical vs Artistic average"}
          />
          <View style={s.sectionCard}>
            {critRows.map((c, i) => (
              <View key={c.label} style={[s.barRow, i < critRows.length - 1 && s.rowBorder]}>
                <Text style={s.barRowLabel}>{c.label}</Text>
                <View style={s.barRowTrack}>
                  <View style={[s.barRowFill, { width: `${Math.round((c.value / critMax) * 100)}%`, backgroundColor: isArtistic(c.label) ? C.purple : C.accent }]} />
                </View>
                <Text style={s.barRowVal}>{c.value.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Judge ranking across the round */}
      {judgeAvgs.length > 0 && (
        <>
          <SectionHeader title="Judge Scores" subtitle="Avg mark given · highest → lowest" />
          <View style={s.sectionCard}>
            {judgeAvgs.map((j, i) => {
              const isFirst = i === 0, isLast = i === judgeAvgs.length - 1;
              return (
                <View key={j.judge} style={[s.barRow, i < judgeAvgs.length - 1 && s.rowBorder]}>
                  <Text style={[s.judgeNameLabel, { color: isFirst ? C.gold : isLast ? C.red : C.t1 }]} numberOfLines={1}>
                    {jFullName(j.judge, judgeNames)}
                  </Text>
                  <View style={s.barRowTrack}>
                    <View style={[s.barRowFill, { width: `${Math.round((j.avg / maxJudge) * 100)}%`, backgroundColor: isFirst ? C.gold : isLast ? C.red : C.accent }]} />
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

      {/* Detailed per-dance · per-judge · per-criterion breakdown */}
      {hasJudgeData && (
        <>
          <SectionHeader title="Detailed Scores" subtitle="Per dance · per judge · per criterion" />
          {round.dances.map(d => {
            if (!d.judgeEntries.length) return null;
            const sorted = [...d.judgeEntries].sort((a, b) => score3JudgeMark(b) - score3JudgeMark(a));
            const compChips = chipsFor(
              { judge: "", tqPs: d.components.tqPs, mmCp: d.components.mmCp, tq: d.components.tq, mm: d.components.mm, ps: d.components.ps, cp: d.components.cp, rank: 0 },
              d.fourCriteria,
            );
            return (
              <View key={d.dance} style={[s.sectionCard, { marginBottom: 8 }]}>
                <View style={s.roundHeader}>
                  <Text style={s.roundHeaderTitle}>{d.dance}</Text>
                  <Text style={s.roundHeaderTotal}>
                    {d.place > 0 ? `#${d.place}  ` : ""}{d.totalScore > 0 ? d.totalScore.toFixed(2) : ""}
                  </Text>
                </View>
                {compChips.length > 0 && (
                  <View style={[s.crossRow, s.rowBorder]}>
                    <Text style={[s.crossJudge, { color: C.t2, fontWeight: "600" }]} numberOfLines={1}>Component score</Text>
                    <View style={s.crossScores3}>
                      {compChips.map(c => (
                        <Text key={c.label} style={[s.score3Chip, c.artistic && { backgroundColor: C.purple + "22" }]}>{c.label}</Text>
                      ))}
                    </View>
                  </View>
                )}
                <View style={s.roundExpanded}>
                  {sorted.map((je, i) => {
                    const isFirst = i === 0, isLast = i === sorted.length - 1;
                    return (
                      <View key={je.judge} style={[s.crossRow, i < sorted.length - 1 && s.rowBorder]}>
                        <Text style={[s.crossJudge, { color: isFirst ? C.gold : isLast ? C.red : C.t1 }]} numberOfLines={1}>
                          {jFullName(je.judge, judgeNames)}
                        </Text>
                        <View style={s.crossScores3}>
                          {chipsFor(je, d.fourCriteria).map(ch => (
                            <Text key={ch.label} style={[s.score3Chip, ch.artistic && { backgroundColor: C.purple + "22" }]}>{ch.label}</Text>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      )}
    </>
  );
}

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

  return (
    <View style={{ padding: 16, gap: 12 }}>
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
      <Score3RoundView round={round} judgeNames={judgeNames} placeLabel={`Place — ${round.roundName}`} />
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
    const place = final3.overallPlace > 0 ? final3.overallPlace : (final?.overallPlace ?? 0);
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Score3RoundView
          round={{ ...final3, overallPlace: place }}
          judgeNames={judgeNames}
          placeLabel="Final Place (System 3.0)"
        />
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

// Which area an adjudicator evaluated for a dance.
function judgeArea(je: Score3JudgeEntry): "TQ&PS" | "MM&CP" | "" {
  if (je.tqPs != null || je.tq != null || je.ps != null) return "TQ&PS";
  if (je.mmCp != null || je.mm != null || je.cp != null) return "MM&CP";
  return "";
}

// Flatten a couple's rounds (Final first, then prelim rounds) into one list.
// ─── Unified round-by-round comparison (System 2.0 + 3.0) ─────────────────────

type SidesData = {
  rounds: PrelimRound[];
  final: FinalResult | null;
  scores3: Scores3Result | null;
  final3: Score3Round | null;
};

type RoundMetric = "crosses" | "score" | "place";
interface CmpRound {
  name: string;
  system: "2.0" | "3.0";
  metric: RoundMetric;
  higherBetter: boolean;
  danceVals: { dance: string; value: number | null }[];
  total: number | null;
  totalLabel: string;
  score3?: Score3Round;  // present for System 3.0 rounds (enables detailed comparison)
  prelim?: PrelimRound;  // present for System 2.0 qualifying rounds (per-judge crosses)
  final?: FinalResult;   // present for the System 2.0 skating final (per-judge placements)
}

function roundOrderKey(name: string): number {
  if (/final/i.test(name) && !/semi|quarter|1\/[24]/i.test(name)) return 900;
  if (/semi/i.test(name)) return 800;
  if (/quarter/i.test(name)) return 700;
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 500;
}

function buildCmpRounds(d: SidesData): CmpRound[] {
  const out: CmpRound[] = [];
  for (const r of d.rounds) {
    out.push({
      name: `Round ${r.roundNumber}`, system: "2.0", metric: "crosses", higherBetter: true,
      danceVals: r.dances.map(dd => ({ dance: dd.dance, value: dd.totalCrosses })),
      total: r.totalCrosses, totalLabel: "crosses",
      prelim: r,
    });
  }
  if (d.scores3) for (const r of d.scores3.rounds) {
    out.push({
      name: r.roundName, system: "3.0", metric: "score", higherBetter: true,
      danceVals: r.dances.map(dd => ({ dance: dd.dance, value: dd.totalScore || null })),
      total: r.dances.reduce((sum, dd) => sum + (dd.totalScore || 0), 0), totalLabel: "pts",
      score3: r,
    });
  }
  if (d.final && d.final.dances.length) {
    out.push({
      name: "Final", system: "2.0", metric: "place", higherBetter: false,
      danceVals: d.final.dances.map(dd => ({ dance: dd.dance, value: dd.dancePlace || null })),
      total: d.final.overallPlace || null, totalLabel: "place",
      final: d.final,
    });
  }
  if (d.final3 && d.final3.dances.length) {
    out.push({
      name: "Final", system: "3.0", metric: "score", higherBetter: true,
      danceVals: d.final3.dances.map(dd => ({ dance: dd.dance, value: dd.totalScore || null })),
      total: d.final3.dances.reduce((sum, dd) => sum + (dd.totalScore || 0), 0), totalLabel: "pts",
      score3: d.final3,
    });
  }
  return out.sort((x, y) => roundOrderKey(x.name) - roundOrderKey(y.name));
}

function cmpWinner(a: number | null, b: number | null, higherBetter: boolean): "a" | "b" | "tie" | null {
  if (a == null || b == null) return null;
  if (a === b) return "tie";
  const aBetter = higherBetter ? a > b : a < b;
  return aBetter ? "a" : "b";
}

// Sum each judge's crosses across a System 2.0 qualifying round (how many of that
// judge's marks landed on this couple). Used to show who each judge advanced more.
function judgeCrossTotals(r: PrelimRound): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of r.dances) {
    for (const c of d.crosses) {
      if (!c.judge) continue;
      m.set(c.judge, (m.get(c.judge) ?? 0) + (c.marked ? 1 : 0));
    }
  }
  return m;
}

// Per-judge "who did each judge favour" breakdown for a System 2.0 round.
// Only meaningful when both couples were scored by the same panel (sameJudges).
function JudgeFavorView({ myMap, rivalMap, higherBetter, aLabel, bLabel, judgeNames, kind }: {
  myMap: Map<string, number>;
  rivalMap: Map<string, number>;
  higherBetter: boolean;
  aLabel: string;
  bLabel: string;
  judgeNames: Record<string, string>;
  kind: "crosses" | "place";
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const judges = [...new Set([...myMap.keys(), ...rivalMap.keys()])];
  if (judges.length === 0) return null;

  const fmt = (v: number | null) =>
    v == null ? "—" : kind === "place" ? `#${v.toFixed(1)}` : String(v);

  const rank = (w: "a" | "b" | "tie" | null) => (w === "a" ? 0 : w === "tie" ? 1 : 2);
  const rows = judges.map((judge) => {
    const mine = myMap.get(judge) ?? null;
    const theirs = rivalMap.get(judge) ?? null;
    return { judge, mine, theirs, win: cmpWinner(mine, theirs, higherBetter) };
  }).sort((x, y) => {
    if (rank(x.win) !== rank(y.win)) return rank(x.win) - rank(y.win);
    return Math.abs((y.mine ?? 0) - (y.theirs ?? 0)) - Math.abs((x.mine ?? 0) - (x.theirs ?? 0));
  });

  const favMe    = rows.filter(r => r.win === "a").length;
  const favRival = rows.filter(r => r.win === "b").length;
  const ties     = rows.filter(r => r.win === "tie").length;

  const valCell = { width: 60, textAlign: "right" as const, fontSize: 13, fontVariant: ["tabular-nums" as const] };

  return (
    <View style={{ gap: 6 }}>
      <SectionHeader
        noMargin
        title="Judge breakdown"
        subtitle={kind === "place" ? "Avg place each judge gave · lower = better" : "Crosses each judge gave · more = better"}
      />
      <View style={s.sectionCard}>
        <View style={[s.crossRow, s.rowBorder]}>
          <Text style={[s.crossJudge, { color: C.t3, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }]}>Judge</Text>
          <Text style={[valCell, { color: C.accent, fontWeight: "800", fontSize: 11 }]} numberOfLines={1}>{aLabel}</Text>
          <Text style={[valCell, { color: C.t2, fontWeight: "800", fontSize: 11 }]} numberOfLines={1}>{bLabel}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.judge} style={[s.crossRow, i < rows.length - 1 && s.rowBorder]}>
            <Text style={[s.crossJudge, { color: C.t1, fontWeight: "600" }]} numberOfLines={1}>
              {jFullName(r.judge, judgeNames)}{r.win === "a" ? "  ★" : r.win === "b" ? "  ☆" : ""}
            </Text>
            <Text style={[valCell, { color: r.win === "a" ? C.gold : C.t1, fontWeight: r.win === "a" ? "800" : "600" }]}>{fmt(r.mine)}</Text>
            <Text style={[valCell, { color: r.win === "b" ? C.gold : C.t2, fontWeight: r.win === "b" ? "800" : "600" }]}>{fmt(r.theirs)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: C.t3, fontSize: 11, paddingHorizontal: 4 }}>
        {favMe} favoured {aLabel} · {favRival} favoured {bLabel}{ties ? ` · ${ties} tie` : ""}
      </Text>
    </View>
  );
}

function RoundCompareView({ a, b, aLabel, bLabel, judgeNames, sameJudges }: {
  a: SidesData;
  b: SidesData;
  aLabel: string;
  bLabel: string;
  judgeNames: Record<string, string>;
  sameJudges: boolean;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const ar = buildCmpRounds(a);
  const br = buildCmpRounds(b);
  const names: string[] = [];
  for (const r of [...ar, ...br]) if (!names.includes(r.name)) names.push(r.name);
  names.sort((x, y) => roundOrderKey(x) - roundOrderKey(y));

  if (names.length === 0) {
    return (
      <View style={[s.sectionCard, { padding: 16 }]}>
        <Text style={{ color: C.t2, textAlign: "center" }}>No round-by-round score data available to compare.</Text>
      </View>
    );
  }

  const valCell = { width: 60, textAlign: "right" as const, fontSize: 13, fontVariant: ["tabular-nums" as const] };
  const SystemBadge = ({ sys }: { sys: "2.0" | "3.0" }) => (
    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: sys === "3.0" ? C.accentFade : C.elevated }}>
      <Text style={{ color: sys === "3.0" ? C.accent : C.t2, fontSize: 10, fontWeight: "800" }}>SYS {sys}</Text>
    </View>
  );
  const winnerChip = (w: "a" | "b" | "tie" | null) => {
    if (!w) return null;
    const label = w === "tie" ? "Tie" : `${w === "a" ? aLabel : bLabel} ✓`;
    const col = w === "tie" ? C.t2 : C.gold;
    return <Text style={{ color: col, fontSize: 12, fontWeight: "800" }}>{label}</Text>;
  };

  const roundHeader = (name: string, sys: "2.0" | "3.0", w: "a" | "b" | "tie" | null) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
      <Text style={{ color: C.t1, fontWeight: "800", fontSize: 15 }}>{name}</Text>
      <SystemBadge sys={sys} />
      <View style={{ flex: 1 }} />
      {winnerChip(w)}
    </View>
  );

  return (
    <>
      {/* Column legend */}
      <View style={[s.sectionCard, { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14 }]}>
        <Text style={{ flex: 1, color: C.t3, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Round by round</Text>
        <Text style={[valCell, { color: C.accent, fontWeight: "800", fontSize: 11 }]} numberOfLines={1}>{aLabel}</Text>
        <Text style={[valCell, { color: C.t2, fontWeight: "800", fontSize: 11 }]} numberOfLines={1}>{bLabel}</Text>
      </View>

      {names.map(name => {
        const ra = ar.find(r => r.name === name);
        const rb = br.find(r => r.name === name);

        if (ra && rb && ra.system !== rb.system) {
          return (
            <View key={name} style={{ gap: 6 }}>
              {roundHeader(name, ra.system, null)}
              <View style={[s.sectionCard, { padding: 14, borderColor: C.gold + "55", borderWidth: 1 }]}>
                <Text style={{ color: C.t2, fontSize: 13 }}>
                  ⚠️ Scored with different systems ({aLabel}: {ra.system}, {bLabel}: {rb.system}) — these rounds can't be compared directly.
                </Text>
              </View>
            </View>
          );
        }
        if (!ra || !rb) {
          const only = ra ? aLabel : bLabel;
          const r = (ra ?? rb)!;
          return (
            <View key={name} style={{ gap: 6 }}>
              {roundHeader(name, r.system, null)}
              <View style={[s.sectionCard, { padding: 14 }]}>
                <Text style={{ color: C.t3, fontSize: 13 }}>Only {only} danced this round.</Text>
              </View>
            </View>
          );
        }

        const w = cmpWinner(ra.total, rb.total, ra.higherBetter);

        // ── System 3.0 round → detailed per-dance / per-criterion / per-judge ──
        if (ra.system === "3.0" && ra.score3 && rb.score3) {
          return (
            <View key={name} style={{ gap: 6 }}>
              {roundHeader(name, "3.0", w)}
              <Score3CompareView
                myRound={ra.score3}
                rivalRound={rb.score3}
                myLabel={aLabel}
                rivalLabel={bLabel}
                judgeNames={judgeNames}
                sameJudges={sameJudges}
              />
            </View>
          );
        }

        // ── System 2.0 round → crosses (prelim) or places (final) per dance ──
        const isPlace = ra.metric === "place";
        const danceNames: string[] = [];
        for (const dv of [...ra.danceVals, ...rb.danceVals]) if (!danceNames.includes(dv.dance)) danceNames.push(dv.dance);
        const fmt = (v: number | null) => v == null ? "—" : isPlace ? `#${v}` : String(v);
        const rowFor = (label: string, av: number | null, bv: number | null, strong: boolean, border: boolean, kk: string) => {
          const win = cmpWinner(av, bv, ra.higherBetter);
          return (
            <View key={kk} style={[s.crossRow, border && s.rowBorder]}>
              <Text style={[s.crossJudge, { color: strong ? C.t1 : C.t2, fontWeight: strong ? "700" : "500" }]} numberOfLines={1}>{label}</Text>
              <Text style={[valCell, { color: win === "a" ? C.gold : C.t1, fontWeight: win === "a" ? "800" : "600" }]}>{fmt(av)}</Text>
              <Text style={[valCell, { color: win === "b" ? C.gold : C.t2, fontWeight: win === "b" ? "800" : "600" }]}>{fmt(bv)}</Text>
            </View>
          );
        };

        return (
          <View key={name} style={{ gap: 6 }}>
            {roundHeader(name, "2.0", w)}
            <View style={s.sectionCard}>
              {rowFor(ra.metric === "place" ? "Overall place" : "Total crosses", ra.total, rb.total, true, danceNames.length > 0, "__rt")}
              {danceNames.map((dn, i) => rowFor(
                dn,
                ra.danceVals.find(x => x.dance === dn)?.value ?? null,
                rb.danceVals.find(x => x.dance === dn)?.value ?? null,
                false, i < danceNames.length - 1, `d-${dn}`,
              ))}
            </View>
            <Text style={{ color: C.t3, fontSize: 11, paddingHorizontal: 4 }}>
              {isPlace ? "Lower place = better" : "More crosses = better (judges advancing you)"}
            </Text>
            {sameJudges && ra.metric === "crosses" && ra.prelim && rb.prelim ? (
              <JudgeFavorView
                myMap={judgeCrossTotals(ra.prelim)}
                rivalMap={judgeCrossTotals(rb.prelim)}
                higherBetter
                aLabel={aLabel}
                bLabel={bLabel}
                judgeNames={judgeNames}
                kind="crosses"
              />
            ) : null}
            {sameJudges && ra.metric === "place" && ra.final && rb.final ? (
              <JudgeFavorView
                myMap={new Map(ra.final.judgeAvgPlaces.map(j => [j.judge, j.avgPlace] as const))}
                rivalMap={new Map(rb.final.judgeAvgPlaces.map(j => [j.judge, j.avgPlace] as const))}
                higherBetter={false}
                aLabel={aLabel}
                bLabel={bLabel}
                judgeNames={judgeNames}
                kind="place"
              />
            ) : null}
          </View>
        );
      })}
    </>
  );
}


// Side-by-side comparison of two couples (or two events) for one round.
function Score3CompareView({ myRound, rivalRound, myLabel, rivalLabel, judgeNames, sameJudges }: {
  myRound: Score3Round;
  rivalRound: Score3Round;
  myLabel: string;
  rivalLabel: string;
  judgeNames: Record<string, string>;
  sameJudges: boolean;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const valCell = { width: 64, textAlign: "right" as const, fontSize: 13, fontVariant: ["tabular-nums" as const] };
  const renderCmp = (key: string, label: string, mine: number | null, theirs: number | null, opts?: { strong?: boolean; border?: boolean }) => {
    const hi = mine != null && theirs != null ? (mine > theirs ? "mine" : theirs > mine ? "theirs" : "eq") : "eq";
    return (
      <View key={key} style={[s.crossRow, opts?.border && s.rowBorder]}>
        <Text style={[s.crossJudge, { color: opts?.strong ? C.t1 : C.t2, fontWeight: opts?.strong ? "700" : "500" }]} numberOfLines={1}>{label}</Text>
        <Text style={[valCell, { color: hi === "mine" ? C.gold : C.t1, fontWeight: hi === "mine" ? "800" : "600" }]}>{mine != null ? mine.toFixed(2) : "—"}</Text>
        <Text style={[valCell, { color: hi === "theirs" ? C.gold : C.t2, fontWeight: hi === "theirs" ? "800" : "600" }]}>{theirs != null ? theirs.toFixed(2) : "—"}</Text>
      </View>
    );
  };

  const myTotal = myRound.dances.reduce((sum, d) => sum + (d.totalScore || 0), 0);
  const rivalTotal = rivalRound.dances.reduce((sum, d) => sum + (d.totalScore || 0), 0);

  const dances = myRound.dances.flatMap(mine => {
    const theirs = rivalRound.dances.find(x => x.dance === mine.dance);
    return theirs ? [{ mine, theirs }] : [];
  });

  return (
    <>
      {/* Column header + overall total */}
      <View style={s.sectionCard}>
        <View style={[s.crossRow, s.rowBorder]}>
          <Text style={[s.crossJudge, { color: C.t3, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }]}>Total score</Text>
          <Text style={[valCell, { color: C.accent, fontWeight: "800", fontSize: 11 }]} numberOfLines={1}>{myLabel}</Text>
          <Text style={[valCell, { color: C.t2, fontWeight: "800", fontSize: 11 }]} numberOfLines={1}>{rivalLabel}</Text>
        </View>
        {renderCmp("__total", "Overall", myTotal, rivalTotal, { strong: true })}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 14, paddingBottom: 8 }}>
          <Text style={{ color: myTotal >= rivalTotal ? C.gold : C.red, fontWeight: "700", fontSize: 12 }}>
            {myTotal >= rivalTotal ? "▲ " : "▼ "}{Math.abs(myTotal - rivalTotal).toFixed(2)}
          </Text>
        </View>
      </View>

      {dances.length === 0 && (
        <View style={[s.sectionCard, { padding: 16 }]}>
          <Text style={{ color: C.t2, textAlign: "center" }}>No matching dances to compare in this round.</Text>
        </View>
      )}

      {dances.map(({ mine, theirs }) => {
        const four = mine.fourCriteria;
        const diff = (mine.totalScore || 0) - (theirs.totalScore || 0);
        const critDefs: { key: keyof Score3Components; label: string }[] = four
          ? [{ key: "tq", label: "TQ" }, { key: "mm", label: "MM" }, { key: "ps", label: "PS" }, { key: "cp", label: "CP" }]
          : [{ key: "tqPs", label: "TQ & PS" }, { key: "mmCp", label: "MM & CP" }];

        // Per-judge marks (same panel only)
        const myJ = new Map(mine.judgeEntries.map(j => [j.judge, j] as const));
        const thJ = new Map(theirs.judgeEntries.map(j => [j.judge, j] as const));
        const judgeRows = [...new Set([...myJ.keys(), ...thJ.keys()])].map(n => {
          const a = myJ.get(n), b = thJ.get(n);
          return {
            judge: n,
            area: judgeArea(a ?? b!),
            mine: a ? score3JudgeMark(a) : null,
            theirs: b ? score3JudgeMark(b) : null,
          };
        }).sort((x, y) => (y.mine ?? -1) - (x.mine ?? -1));

        return (
          <View key={mine.dance} style={[s.sectionCard, { marginBottom: 8 }]}>
            <View style={s.roundHeader}>
              <Text style={s.roundHeaderTitle}>{mine.dance}</Text>
              <Text style={[s.roundHeaderTotal, { color: diff > 0 ? C.gold : diff < 0 ? C.red : C.t2 }]}>
                {diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "= "}{diff !== 0 ? Math.abs(diff).toFixed(2) : ""}
              </Text>
            </View>
            {renderCmp(`${mine.dance}-total`, "Dance total", mine.totalScore || null, theirs.totalScore || null, { strong: true, border: true })}
            {critDefs.map((d, i) => renderCmp(
              `${mine.dance}-${d.key}`, d.label, mine.components[d.key], theirs.components[d.key],
              { border: i < critDefs.length - 1 || (sameJudges && judgeRows.length > 0) },
            ))}
            {sameJudges && judgeRows.map((j, i) => renderCmp(
              `${mine.dance}-j-${j.judge}`,
              `${jLastName(j.judge, judgeNames)}${j.area ? ` · ${j.area}` : ""}`,
              j.mine, j.theirs,
              { border: i < judgeRows.length - 1 },
            ))}
          </View>
        );
      })}
    </>
  );
}

function CompareTab({ analytics }: { analytics: CompetitionAnalytics }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const fetchCoupleScores   = useWdsfStore(st => st.fetchCoupleScores);
  const coupleScoresCache   = useWdsfStore(st => st.coupleScoresCache);
  const coupleScoresLoading = useWdsfStore(st => st.coupleScoresLoading);

  const myCouple = analytics.coupleNumber;
  const myNameL  = analytics.coupleName.toLowerCase();

  const [selected, setSelected] = useState<RankingEntry | null>(null);

  const key = selected ? `${analytics.rankingUrl}|${selected.coupleNumber}` : "";
  const rival: CoupleScores | null | undefined = selected ? coupleScoresCache[key] : undefined;
  const rivalLoading = selected ? (coupleScoresLoading[key] ?? false) : false;

  useEffect(() => {
    if (selected) fetchCoupleScores(analytics.rankingUrl, selected.coupleNumber);
  }, [selected, analytics.rankingUrl, fetchCoupleScores]);

  if (selected) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ color: C.accent, fontSize: 15, fontWeight: "600" }}>‹ All couples</Text>
        </TouchableOpacity>

        <View style={[s.sectionCard, { padding: 14, gap: 4 }]}>
          <Text style={{ color: C.accent, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>You · #{myCouple} {analytics.coupleName}</Text>
          <Text style={{ color: C.t2, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>vs · #{selected.coupleNumber} {selected.coupleName}</Text>
          <Text style={{ color: C.t3, fontSize: 12 }}>{selected.country}{selected.points ? ` · ${selected.points} pts` : ""} · rank {selected.rank}</Text>
        </View>

        {rivalLoading && <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />}
        {!rivalLoading && rival === null && (
          <View style={[s.sectionCard, { padding: 16 }]}>
            <Text style={{ color: C.t2, textAlign: "center" }}>Couldn't load this couple's scores.</Text>
          </View>
        )}
        {!rivalLoading && rival && (
          <RoundCompareView
            a={analytics}
            b={rival}
            aLabel="You"
            bLabel={`#${selected.coupleNumber}`}
            judgeNames={analytics.judgeNames}
            sameJudges
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <SectionHeader noMargin title="All Couples" subtitle="Tap a couple to compare scores" />
      <View style={s.sectionCard}>
        {analytics.allCouples.slice(0, 50).map((entry, i) => {
          const isMe = (myCouple && entry.coupleNumber === myCouple) || entry.coupleName.toLowerCase() === myNameL;
          const inner = (
            <View
              style={[
                s.compareRow,
                i < analytics.allCouples.length - 1 && s.rowBorder,
                isMe && { backgroundColor: C.accentFade },
              ]}
            >
              <View style={[s.compareRankBadge, isMe && { backgroundColor: C.accent }]}>
                <Text style={[s.compareRankText, isMe && { color: "#fff" }]}>{entry.rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.compareCoupleName, isMe && { color: C.accent, fontWeight: "800" }]} numberOfLines={1}>
                  {entry.coupleName}{isMe ? " ← You" : ""}
                </Text>
                <Text style={s.compareCoupleInfo}>#{entry.coupleNumber} · {entry.country}{entry.points ? ` · ${entry.points} pts` : ""}</Text>
              </View>
              {!isMe && <Text style={s.compAnalyticsHint}>›</Text>}
            </View>
          );
          return isMe
            ? <View key={i}>{inner}</View>
            : <TouchableOpacity key={i} onPress={() => setSelected(entry)}>{inner}</TouchableOpacity>;
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

  progressBtn: {
    backgroundColor: C.accentFade, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.accentBorder, marginBottom: 10, alignItems: "center",
  },
  progressBtnText: { color: C.accent, fontWeight: "700", fontSize: 14 },

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
