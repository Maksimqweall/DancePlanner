import { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, Modal, TextInput, Switch, StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useProjectStore, type CreateProjectInput } from "../../../store/useProjectStore";
import {
  EVENT_TYPE_META, EVENT_TYPE_ORDER, formatDate, formatMoney, currencySymbol,
} from "../../../lib/display";
import type { EventType, Project } from "../../../lib/types";
import { ApiError } from "../../../lib/api";
import { DateField } from "../../../components/DateTimeField";
import PressableScale from "../../../components/ui/PressableScale";
import { AnimatedProgress } from "../../../components/ui/AnimatedProgress";
import { stagger, type Palette } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useT } from "../../../lib/i18n";
import AppBackground from "../../../components/ui/AppBackground";

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

function getProjectStatus(project: Project): "upcoming" | "active" | "past" {
  const now = new Date();
  const start = new Date(project.date);
  const end = project.endDate ? new Date(project.endDate) : new Date(project.date);
  if (end < now) return "past";
  if (start <= now) return "active";
  return "upcoming";
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default function ProjectsScreen() {
  const router = useRouter();
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { projects, refreshProjects, createProject } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { refreshProjects(); }, [refreshProjects]));

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const upcoming = projects.filter(p => getProjectStatus(p) === "upcoming").length;
    const active = projects.filter(p => getProjectStatus(p) === "active").length;
    const past = projects.filter(p => getProjectStatus(p) === "past").length;
    const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
    const totalExpenses = projects.reduce((s, p) => s + (p._count?.expenses ?? 0), 0);
    return { upcoming, active, past, totalBudget, totalExpenses, total: projects.length };
  }, [projects]);

  return (
    <View style={styles.screen}>
      <AppBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).springify().damping(16).stiffness(140)} style={styles.titleRow}>
          <Text style={styles.pageTitle}>{T.events.title}</Text>
          <PressableScale style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.addBtnText}>{T.events.addNew}</Text>
          </PressableScale>
        </Animated.View>

        {/* ── Summary strip ────────────────────────────────────────────────── */}
        {projects.length > 0 && (
          <Animated.View entering={FadeInDown.delay(60).springify().damping(16).stiffness(140)}>
            <View style={styles.summaryCard}>
              <SummaryChip label={T.events.total} value={String(stats.total)} color={C.t1} icon="🏆" />
              <View style={styles.summaryDivider} />
              {stats.active > 0 ? (
                <>
                  <SummaryChip label={T.events.active} value={String(stats.active)} color={C.gold} icon="⚡" />
                  <View style={styles.summaryDivider} />
                </>
              ) : null}
              <SummaryChip label={T.events.upcoming} value={String(stats.upcoming)} color={C.accent} icon="📅" />
              {stats.totalBudget > 0 ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryChip label={T.events.budget} value={formatMoney(stats.totalBudget)} color={C.gold} icon="💰" />
                </>
              ) : null}
            </View>
          </Animated.View>
        )}

        {/* ── Project list ──────────────────────────────────────────────────── */}
        {projects.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(120).springify().damping(16).stiffness(140)} style={styles.emptyCard}>
            <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🏆</Text>
            <Text style={styles.emptyTitle}>{T.events.noEvents}</Text>
            <Text style={styles.emptyText}>{T.events.noEventsDesc}</Text>
          </Animated.View>
        ) : (
          projects.map((p, i) => (
            <ProjectRow key={p.id} project={p} index={i} onPress={() => router.push(`/project/${p.id}`)} />
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <NewProjectModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={createProject}
        onCreated={id => router.push(`/project/${id}`)}
      />
    </View>
  );
}

function SummaryChip({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipIcon}>{icon}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ProjectRow({ project, onPress, index = 0 }: { project: Project; onPress: () => void; index?: number }) {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const meta = EVENT_TYPE_META[project.type] ?? EVENT_TYPE_META.TOURNAMENT;
  const counts = project._count;
  const status = getProjectStatus(project);

  const now = new Date();
  const start = new Date(project.date);
  const end = project.endDate ? new Date(project.endDate) : start;
  const timeProgress = status === "active" && project.endDate
    ? Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())))
    : 0;
  const daysLeft = status === "upcoming" ? daysUntil(project.date) : 0;

  const statusColor = status === "active" ? C.gold : status === "upcoming" ? C.accent : C.t3;
  const statusLabel = status === "active" ? T.events.active : status === "upcoming" ? T.events.upcoming : T.events.past;
  const statusBg = status === "active" ? C.goldFade : status === "upcoming" ? C.accentFade : C.elevated;

  return (
    <Animated.View
      entering={index < 8 ? FadeInDown.delay(stagger(index, 90) + 80).springify().damping(16).stiffness(140) : undefined}
      style={{ opacity: status === "past" ? 0.6 : 1 }}
    >
      <PressableScale onPress={onPress} style={[styles.projectCard, status === "active" && styles.projectCardActive]}>
        {/* Colored top band for active */}
        {status === "active" && <View style={[styles.activeBand, { backgroundColor: C.goldFade }]} />}

        <View style={styles.projectHeader}>
          <View style={styles.projectLeft}>
            <View style={[styles.projectIconWrapper, status === "active" && { borderWidth: 2, borderColor: C.goldBorder }]}>
              <Text style={styles.projectIcon}>{meta.icon}</Text>
            </View>
            <View style={styles.projectInfo}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.projectMeta}>{meta.label} · {formatDate(project.date)}</Text>
              {project.location ? <Text style={styles.projectLocation}>📍 {project.location}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {project.budget != null && <Text style={styles.projectBudget}>{formatMoney(project.budget)}</Text>}
            {status === "upcoming" && daysLeft > 0 && (
              <View style={styles.daysChip}>
                <Text style={styles.daysText}>{T.events.inDays} {daysLeft}d</Text>
              </View>
            )}
          </View>
        </View>

        {/* Time progress bar for active multi-day events */}
        {status === "active" && project.endDate && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={styles.progressLabel}>{T.events.eventProgress}</Text>
              <Text style={[styles.progressLabel, { color: C.gold }]}>{Math.round(timeProgress * 100)}%</Text>
            </View>
            <AnimatedProgress
              progress={timeProgress}
              track={C.elevated}
              fill={C.gold}
              height={5}
              delay={index * 60 + 300}
              duration={900}
            />
          </View>
        )}

        {/* Stat chips */}
        {counts && (counts.attachments > 0 || counts.checklist > 0 || counts.expenses > 0) ? (
          <View style={styles.projectStats}>
            {counts.attachments > 0 && <StatChip label={`${counts.attachments} ${T.events.filesLabel}`} />}
            {counts.checklist > 0 && <StatChip label={`${counts.checklist} ${T.events.tasksLabel}`} />}
            {counts.expenses > 0 && <StatChip label={`${counts.expenses} ${T.events.expensesLabel}`} />}
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

function StatChip({ label }: { label: string }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipText}>{label}</Text>
    </View>
  );
}

function NewProjectModal({
  visible, onClose, onCreate, onCreated,
}: {
  visible: boolean; onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<Project>;
  onCreated: (id: string) => void;
}) {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("TOURNAMENT");
  const [date, setDate] = useState(todayISO());
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState(todayISO());
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle(""); setType("TOURNAMENT"); setDate(todayISO());
    setMultiDay(false); setEndDate(todayISO()); setLocation(""); setBudget(""); setError(null);
  };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError(T.events.errorTitle); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError(T.events.errorDate); return; }
    if (multiDay && endDate < date) { setError(T.events.errorEndDate); return; }
    const budgetValue = budget ? Number(budget.replace(",", ".")) : null;
    setSubmitting(true);
    try {
      const project = await onCreate({
        title: title.trim(), type,
        date: new Date(`${date}T00:00:00.000Z`).toISOString(),
        endDate: multiDay ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
        location: location.trim() || null,
        budget: budgetValue && budgetValue > 0 ? budgetValue : null,
      });
      close(); onCreated(project.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : T.events.errorCreate);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{T.events.newEventModal}</Text>
              <PressableScale onPress={close} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </PressableScale>
            </View>

            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

            <Text style={styles.fieldLabel}>{T.events.titleField}</Text>
            <TextInput
              style={styles.input}
              placeholder={T.events.titlePlaceholder}
              placeholderTextColor={C.t3}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>{T.events.typeField}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                {EVENT_TYPE_ORDER.map(t => {
                  const m = EVENT_TYPE_META[t];
                  const active = t === type;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => setType(t)}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {m.icon} {m.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>{multiDay ? T.events.startDate : T.events.dateField}</Text>
            <View style={{ marginBottom: 14 }}><DateField value={date} onChange={setDate} /></View>

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>{T.events.multiDay}</Text>
              <Switch
                value={multiDay}
                onValueChange={v => { setMultiDay(v); if (v && endDate < date) setEndDate(date); }}
                trackColor={{ true: C.accent, false: C.elevated }}
                thumbColor="#fff"
              />
            </View>

            {multiDay ? (
              <>
                <Text style={styles.fieldLabel}>{T.events.endDate}</Text>
                <View style={{ marginBottom: 14 }}><DateField value={endDate} onChange={setEndDate} /></View>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>{T.events.locationField}</Text>
            <TextInput style={styles.input} placeholder={T.events.locationPlaceholder} placeholderTextColor={C.t3} value={location} onChangeText={setLocation} />

            <Text style={styles.fieldLabel}>{T.events.budgetField} {currencySymbol()} ({T.common.add.toLowerCase()})</Text>
            <TextInput style={styles.input} placeholder={T.events.budgetPlaceholder} placeholderTextColor={C.t3} keyboardType="decimal-pad" value={budget} onChangeText={setBudget} />

            <PressableScale style={styles.submitBtn} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnText}>{submitting ? T.events.creating : T.events.createEvent}</Text>
            </PressableScale>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { color: C.t1, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  addBtn: { backgroundColor: C.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // Summary
  summaryCard: {
    flexDirection: "row", backgroundColor: C.card, borderRadius: 22,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center",
  },
  summaryChip: { flex: 1, alignItems: "center", gap: 2 },
  summaryChipIcon: { fontSize: 18, marginBottom: 2 },
  summaryValue: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  summaryLabel: { color: C.t3, fontSize: 11, fontWeight: "500" },
  summaryDivider: { width: 1, backgroundColor: C.border, height: 36, marginHorizontal: 4 },
  // Project card
  projectCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: C.borderStrong, overflow: "hidden",
  },
  projectCardActive: { borderColor: C.goldBorder },
  activeBand: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  projectHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  projectLeft: { flexDirection: "row", flex: 1, marginRight: 12 },
  projectIconWrapper: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.elevated,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  projectIcon: { fontSize: 22 },
  projectInfo: { flex: 1 },
  projectTitle: { color: C.t1, fontWeight: "700", fontSize: 16 },
  projectMeta: { color: C.t2, fontSize: 13 },
  projectLocation: { color: C.t3, fontSize: 12, marginTop: 2 },
  projectBudget: { color: C.gold, fontWeight: "700", fontSize: 15 },
  statusBadge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  daysChip: { backgroundColor: C.accentFade, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  daysText: { color: C.accent, fontSize: 11, fontWeight: "700" },
  progressLabel: { color: C.t3, fontSize: 11, fontWeight: "500" },
  projectStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  statChip: { backgroundColor: C.elevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  statChipText: { color: C.t3, fontSize: 12 },
  // Empty
  emptyCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.border },
  emptyTitle: { color: C.t1, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  modalSheet: { backgroundColor: C.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, maxHeight: "92%", borderWidth: 1, borderColor: C.borderStrong, borderBottomWidth: 0 },
  modalHandle: { width: 36, height: 4, backgroundColor: C.elevated, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { color: C.t1, fontSize: 20, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: C.t2, fontSize: 16 },
  errorBox: { backgroundColor: C.redFade, borderWidth: 1, borderColor: C.red, borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: "#fca5a5", fontSize: 13 },
  fieldLabel: { color: C.t2, fontSize: 13, fontWeight: "500", marginBottom: 8 },
  input: { backgroundColor: C.elevated, color: C.t1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border },
  typeChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  typeChipText: { color: C.t2, fontSize: 14 },
  typeChipTextActive: { color: C.accent, fontWeight: "600" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  submitBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
}
