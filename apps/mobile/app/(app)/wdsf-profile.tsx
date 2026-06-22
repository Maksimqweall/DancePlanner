import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useWdsfStore, type WdsfProfile, type WdsfCompetition, type WdsfPartner } from "../../store/useWdsfStore";
import PressableScale from "../../components/ui/PressableScale";
import { C } from "../../lib/theme";

const WDSF_SEARCH_URL = "https://www.worlddancesport.org/Athletes";

export default function WdsfProfileScreen() {
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

// ─── Full profile view ────────────────────────────────────────────────────────

function ProfileView({
  profile, loading, onRefresh, onUnlink,
}: {
  profile: WdsfProfile;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onUnlink: () => Promise<void>;
}) {
  const [imgError, setImgError] = useState(false);
  const currentPartners = profile.partners.filter(p => p.status === "current");
  const formerPartners  = profile.partners.filter(p => p.status === "former");
  const isActive = profile.licenseStatus?.toLowerCase().includes("active") ?? false;
  const updatedAgo = profile.fetchedAt ? formatAgo(new Date(profile.fetchedAt)) : null;

  const handleUnlink = () =>
    Alert.alert("Unlink WDSF Profile", "Remove your WDSF connection from Dance Planner?", [
      { text: "Cancel", style: "cancel" },
      { text: "Unlink", style: "destructive", onPress: onUnlink },
    ]);

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>

      {/* Hero photo card */}
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

      {/* Stats */}
      <Animated.View entering={FadeInDown.delay(50).duration(400)} style={s.statsRow}>
        <StatBox label="Competitions" value={profile.competitions.length > 0 ? String(profile.competitions.length) : "—"} />
        <View style={s.statsDivider} />
        <StatBox label="Best place"   value={bestPlace(profile.competitions)} />
        <View style={s.statsDivider} />
        <StatBox label="Partners"     value={String(profile.partners.length)} />
      </Animated.View>

      {/* General info — ALL fields */}
      <Animated.View entering={FadeInDown.delay(90).duration(400)}>
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
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <SectionHeader
            title="Partners"
            subtitle={`${profile.partners.length} total · ${currentPartners.length} active`}
          />
          <View style={s.sectionCard}>
            {currentPartners.map((p, i) => (
              <PartnerRow
                key={`c${i}`}
                partner={p}
                isLast={i === currentPartners.length - 1 && formerPartners.length === 0}
              />
            ))}
            {formerPartners.map((p, i) => (
              <PartnerRow key={`f${i}`} partner={p} isLast={i === formerPartners.length - 1} />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Competition results */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <SectionHeader
          title="Competition Results"
          subtitle={profile.competitions.length > 0 ? `${profile.competitions.length} entries` : undefined}
        />
        {profile.competitions.length > 0 ? (
          <View style={s.sectionCard}>
            {profile.competitions.map((c, i) => (
              <CompetitionRow key={i} comp={c} isLast={i === profile.competitions.length - 1} />
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
      <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.actions}>
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
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeaderRow}>
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
  if (!value) return null;
  return (
    <View style={[s.infoRow, !isLast && s.rowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, highlight && { color: C.accent, fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

function PartnerRow({ partner, isLast }: { partner: WdsfPartner; isLast: boolean }) {
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

function CompetitionRow({ comp, isLast }: { comp: WdsfCompetition; isLast: boolean }) {
  const placeNum = comp.place ? parseInt(comp.place, 10) : null;
  const hasNumPlace = placeNum !== null && !isNaN(placeNum) && placeNum > 0;
  const placeColor = placeNum === 1 ? C.gold : placeNum === 2 ? "#b0b8c8" : placeNum === 3 ? "#cd7f32" : C.t1;

  const meta = [comp.discipline, comp.category, comp.location].filter(Boolean).join(" · ");

  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{comp.event || "Competition"}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{[comp.date, meta].filter(Boolean).join("  ·  ")}</Text>
      </View>
      {hasNumPlace ? (
        <View style={[s.placeBadge, placeNum === 1 && { backgroundColor: C.goldFade, borderColor: C.goldBorder }]}>
          <Text style={[s.placeText, { color: placeColor }]}>
            {placeNum === 1 ? "🥇" : placeNum === 2 ? "🥈" : placeNum === 3 ? "🥉" : `#${comp.place}`}
          </Text>
        </View>
      ) : comp.place ? (
        <Text style={s.placeDns}>{comp.place}</Text>
      ) : null}
    </View>
  );
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

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: C.t2, fontSize: 14 },

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
  errorText:  { color: C.red, fontSize: 13, lineHeight: 18 },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  toggleRow:  { paddingVertical: 12, alignItems: "center", marginBottom: 8 },
  toggleText: { color: C.accent, fontSize: 14 },

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

  statsRow: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, flexDirection: "row",
  },
  statBox:     { flex: 1, alignItems: "center", paddingVertical: 16 },
  statValue:   { color: C.t1, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statLabel:   { color: C.t3, fontSize: 11, fontWeight: "500", marginTop: 2 },
  statsDivider:{ width: 1, backgroundColor: C.border, marginVertical: 12 },

  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 20, marginBottom: 8, marginTop: 12,
  },
  sectionHeaderTitle: { color: C.t1, fontSize: 16, fontWeight: "700" },
  sectionHeaderSub:   { color: C.t3, fontSize: 12 },
  sectionCard: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },

  // General info rows
  infoRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel: { color: C.t3, fontSize: 13, fontWeight: "500", flex: 1 },
  infoValue: { color: C.t1, fontSize: 13, fontWeight: "600", flex: 2, textAlign: "right" },

  row:       { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowTitle:  { color: C.t1, fontSize: 14, fontWeight: "600", marginBottom: 2 },
  rowSub:    { color: C.t2, fontSize: 12 },

  // Partner
  partnerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  partnerStatusBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  partnerStatusText: { fontSize: 11, fontWeight: "700" },

  // Competition
  placeBadge: {
    backgroundColor: C.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border, alignItems: "center",
  },
  placeText: { fontSize: 13, fontWeight: "700" },
  placeDns:  { color: C.t3, fontSize: 12 },

  actions:       { marginHorizontal: 20, alignItems: "center", gap: 10, marginTop: 4 },
  updatedText:   { color: C.t3, fontSize: 12 },
  refreshBtn: {
    backgroundColor: C.elevated, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28,
    borderWidth: 1, borderColor: C.accentBorder, width: "100%", alignItems: "center",
  },
  refreshBtnText: { color: C.accent, fontWeight: "700", fontSize: 15 },
  unlinkBtn:      { paddingVertical: 10, width: "100%", alignItems: "center" },
  unlinkBtnText:  { color: C.red, fontSize: 13, fontWeight: "600" },
});
