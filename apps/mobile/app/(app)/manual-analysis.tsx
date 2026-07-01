import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useManualStore, type ManualCompetitionMeta, type ManualCompetition } from "../../store/useManualStore";
import type { WdsfCompetition } from "../../store/useWdsfStore";
import { CompetitionAnalyticsModal } from "./wdsf-profile";
import PressableScale from "../../components/ui/PressableScale";
import GradientButton from "../../components/ui/GradientButton";
import Hint from "../../components/ui/Hint";
import AppBackground from "../../components/ui/AppBackground";
import { useC } from "../../lib/useTheme";
import { stagger, type Palette } from "../../lib/theme";

// Build the synthetic `comp` the shared modal expects from a saved record's meta.
function toComp(meta: { competitionName: string; date: string | null; discipline: string | null; category: string | null; place: string | null }): WdsfCompetition {
  return {
    date: meta.date ?? "",
    event: meta.competitionName,
    location: "",
    discipline: meta.discipline ?? "",
    category: meta.category ?? "",
    place: meta.place,
    points: null,
    competitionUrl: null, // null → modal runs in manual (override) mode
  };
}

export default function ManualAnalysisScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  const { list, listLoading, analyzing, analyzeError, fetchList, analyze, getDetail, remove, fetchCoupleScores, clearError } = useManualStore();

  const [url, setUrl] = useState("");
  const [open, setOpen] = useState<ManualCompetition | null>(null);

  useFocusEffect(useCallback(() => { fetchList(); }, [fetchList]));

  const onAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    clearError();
    const result = await analyze(trimmed);
    if (result) {
      setUrl("");
      setOpen(result);
    }
  };

  const onOpen = async (meta: ManualCompetitionMeta) => {
    const detail = await getDetail(meta.id);
    if (detail) setOpen(detail);
  };

  const onDelete = (meta: ManualCompetitionMeta) => {
    Alert.alert(
      "Delete analysis",
      `Remove "${meta.competitionName}" from your saved analyses?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => remove(meta.id) },
      ],
    );
  };

  return (
    <>
      <View style={{ flex: 1 }}>
      <AppBackground />
      <ScrollView style={[s.root, { backgroundColor: "transparent" }]} contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Manual Analysis</Text>
        <Text style={s.subtitle}>
          Paste a competition results link (TopTurnier). We find your couple by your account
          name and give the same deep analysis as WDSF events — no WDSF account needed.
        </Text>

        <Hint id="manual-analysis-intro" title="How it works" text="Open the competition results, copy the page link (e.g. .../index.htm) and paste it here. Make sure your Dance Planner name matches how you're listed in the results." />

        {/* URL input */}
        <View style={s.inputCard}>
          <Text style={s.inputLabel}>Competition results URL</Text>
          <TextInput
            value={url}
            onChangeText={(t) => { setUrl(t); if (analyzeError) clearError(); }}
            placeholder="https://…/index.htm"
            placeholderTextColor={C.t3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={s.input}
            editable={!analyzing}
          />
          {analyzeError ? <Text style={s.errorText}>{analyzeError}</Text> : null}
          <GradientButton onPress={onAnalyze} disabled={analyzing || !url.trim()} contentStyle={{ flexDirection: "row", gap: 8 }}>
            {analyzing ? <ActivityIndicator color="#fff" size="small" /> : null}
            <Text style={s.analyzeBtnText}>{analyzing ? "Analyzing…" : "Analyze"}</Text>
          </GradientButton>
        </View>

        {/* Saved analyses */}
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Saved analyses</Text>
          {listLoading ? <ActivityIndicator color={C.accent} size="small" /> : null}
        </View>

        {list.length === 0 && !listLoading ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>No analyses yet. Paste a competition link above to get started.</Text>
          </View>
        ) : null}

        {list.map((c, i) => (
          <Animated.View key={c.id} entering={FadeInDown.delay(stagger(i, 90)).springify().damping(16).stiffness(140)}>
            <PressableScale style={s.card} onPress={() => onOpen(c)}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={2}>{c.competitionName}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {[c.date, c.discipline, c.category].filter(Boolean).join(" · ")}
                </Text>
                <Text style={s.cardCouple} numberOfLines={1}>
                  #{c.coupleNumber} {c.coupleName}
                </Text>
              </View>
              <View style={s.cardRight}>
                {c.place ? (
                  <View style={s.placeBadge}>
                    <Text style={s.placeBadgeLabel}>Place</Text>
                    <Text style={s.placeBadgeValue}>{c.place.replace(/\.$/, "")}</Text>
                  </View>
                ) : null}
                <TouchableOpacity onPress={() => onDelete(c)} hitSlop={10} style={s.deleteBtn}>
                  <Text style={s.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
            </PressableScale>
          </Animated.View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
      </View>

      {open ? (
        <CompetitionAnalyticsModal
          comp={toComp(open)}
          analyticsOverride={open.analytics}
          tournamentRating={open.rating}
          fetchRival={(coupleNumber) => fetchCoupleScores(open.id, coupleNumber)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    title: { color: C.t1, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
    subtitle: { color: C.t2, fontSize: 14, lineHeight: 20 },

    inputCard: {
      backgroundColor: C.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      gap: 12,
    },
    inputLabel: { color: C.t2, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
    input: {
      backgroundColor: C.elevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: C.t1,
      fontSize: 15,
    },
    errorText: { color: C.red, fontSize: 13, fontWeight: "600" },
    analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },

    sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    sectionTitle: { color: C.t1, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },

    emptyCard: {
      backgroundColor: C.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      padding: 28,
      alignItems: "center",
      gap: 10,
    },
    emptyIcon: { fontSize: 34 },
    emptyText: { color: C.t3, fontSize: 14, textAlign: "center", lineHeight: 20 },

    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
    },
    cardTitle: { color: C.t1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
    cardSub: { color: C.t3, fontSize: 12, marginTop: 3 },
    cardCouple: { color: C.accent, fontSize: 13, fontWeight: "600", marginTop: 5 },
    cardRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    placeBadge: {
      alignItems: "center",
      backgroundColor: C.accentFade,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 50,
    },
    placeBadgeLabel: { color: C.t3, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    placeBadgeValue: { color: C.accent, fontSize: 18, fontWeight: "800" },
    deleteBtn: { padding: 4 },
    deleteIcon: { fontSize: 18 },
  });
}
