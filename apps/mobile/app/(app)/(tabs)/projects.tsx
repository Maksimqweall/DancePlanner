import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useProjectStore, type CreateProjectInput } from "../../../store/useProjectStore";
import {
  EVENT_TYPE_META,
  EVENT_TYPE_ORDER,
  formatDate,
  formatMoney,
} from "../../../lib/display";
import type { EventType, Project } from "../../../lib/types";
import { ApiError } from "../../../lib/api";
import { DateField } from "../../../components/DateTimeField";
import PressableScale from "../../../components/ui/PressableScale";
import { C } from "../../../lib/theme";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { projects, refreshProjects, createProject } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshProjects();
    }, [refreshProjects])
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.titleRow}>
          <Text style={styles.pageTitle}>Events</Text>
          <PressableScale style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.addBtnText}>+ New</Text>
          </PressableScale>
        </Animated.View>

        {projects.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.emptyCard}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🏆</Text>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Create a tournament or training camp to organize tickets,
              bookings and a prep checklist.
            </Text>
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
        onCreated={(id) => router.push(`/project/${id}`)}
      />
    </View>
  );
}

function ProjectRow({ project, onPress, index = 0 }: { project: Project; onPress: () => void; index?: number }) {
  const meta = EVENT_TYPE_META[project.type] ?? EVENT_TYPE_META.TOURNAMENT;
  const counts = project._count;
  const isPast = new Date(project.endDate ?? project.date) < new Date();

  return (
    <Animated.View
      entering={index < 8 ? FadeInDown.delay(index * 60 + 80).duration(380) : undefined}
      style={{ opacity: isPast ? 0.55 : 1 }}
    >
      <PressableScale onPress={onPress} style={styles.projectCard}>
        <View style={styles.projectHeader}>
          <View style={styles.projectLeft}>
            <View style={styles.projectIconWrapper}>
              <Text style={styles.projectIcon}>{meta.icon}</Text>
            </View>
            <View style={styles.projectInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                {isPast ? (
                  <View style={styles.pastBadge}>
                    <Text style={styles.pastBadgeText}>Past</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.projectMeta}>{meta.label} · {formatDate(project.date)}</Text>
              {project.location ? (
                <Text style={styles.projectLocation}>📍 {project.location}</Text>
              ) : null}
            </View>
          </View>
          {project.budget != null && (
            <Text style={styles.projectBudget}>{formatMoney(project.budget)}</Text>
          )}
        </View>
        {counts && (counts.attachments > 0 || counts.checklist > 0 || counts.expenses > 0) ? (
          <View style={styles.projectStats}>
            {counts.attachments > 0 ? (
              <StatChip label={`${counts.attachments} file${counts.attachments !== 1 ? 's' : ''}`} />
            ) : null}
            {counts.checklist > 0 ? (
              <StatChip label={`${counts.checklist} task${counts.checklist !== 1 ? 's' : ''}`} />
            ) : null}
            {counts.expenses > 0 ? (
              <StatChip label={`${counts.expenses} expense${counts.expenses !== 1 ? 's' : ''}`} />
            ) : null}
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipText}>{label}</Text>
    </View>
  );
}

function NewProjectModal({
  visible,
  onClose,
  onCreate,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateProjectInput) => Promise<Project>;
  onCreated: (id: string) => void;
}) {
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
    if (!title.trim()) { setError("Enter a title"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Date must be YYYY-MM-DD"); return; }
    if (multiDay && endDate < date) { setError("End date must be on or after start date"); return; }
    const budgetValue = budget ? Number(budget.replace(",", ".")) : null;
    setSubmitting(true);
    try {
      const project = await onCreate({
        title: title.trim(),
        type,
        date: new Date(`${date}T00:00:00.000Z`).toISOString(),
        endDate: multiDay ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
        location: location.trim() || null,
        budget: budgetValue && budgetValue > 0 ? budgetValue : null,
      });
      close();
      onCreated(project.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create project");
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
              <Text style={styles.modalTitle}>New event</Text>
              <PressableScale onPress={close} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </PressableScale>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Vienna Open Championship"
              placeholderTextColor={C.t3}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
                {EVENT_TYPE_ORDER.map((t) => {
                  const meta = EVENT_TYPE_META[t];
                  const active = t === type;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => setType(t)}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {meta.icon} {meta.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>{multiDay ? "Start date" : "Date"}</Text>
            <View style={{ marginBottom: 14 }}>
              <DateField value={date} onChange={setDate} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Multi-day event</Text>
              <Switch
                value={multiDay}
                onValueChange={(v) => { setMultiDay(v); if (v && endDate < date) setEndDate(date); }}
                trackColor={{ true: C.accent, false: C.elevated }}
                thumbColor="#fff"
              />
            </View>

            {multiDay ? (
              <>
                <Text style={styles.fieldLabel}>End date</Text>
                <View style={{ marginBottom: 14 }}>
                  <DateField value={endDate} onChange={setEndDate} />
                </View>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>Location (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="City, country"
              placeholderTextColor={C.t3}
              value={location}
              onChangeText={setLocation}
            />

            <Text style={styles.fieldLabel}>Budget € (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1200"
              placeholderTextColor={C.t3}
              keyboardType="decimal-pad"
              value={budget}
              onChangeText={setBudget}
            />

            <PressableScale style={styles.submitBtn} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnText}>
                {submitting ? "Creating…" : "Create event"}
              </Text>
            </PressableScale>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: { color: C.t1, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  addBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { color: C.t1, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: C.t2, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  projectCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectLeft: { flexDirection: 'row', flex: 1, marginRight: 12 },
  projectIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  projectIcon: { fontSize: 22 },
  projectInfo: { flex: 1 },
  projectTitle: { color: C.t1, fontWeight: '700', fontSize: 16, marginBottom: 3 },
  projectMeta: { color: C.t2, fontSize: 13 },
  projectLocation: { color: C.t3, fontSize: 12, marginTop: 2 },
  projectBudget: { color: C.gold, fontWeight: '700', fontSize: 15 },
  projectStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statChip: {
    backgroundColor: C.elevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  statChipText: { color: C.t3, fontSize: 12 },
  pastBadge: {
    backgroundColor: C.elevated,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  pastBadgeText: { color: C.t3, fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 22,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: C.elevated,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: C.t1, fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: C.t2, fontSize: 16 },
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#fca5a5', fontSize: 13 },
  fieldLabel: { color: C.t2, fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: {
    backgroundColor: C.elevated,
    color: C.t1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  typeChipText: { color: C.t2, fontSize: 14 },
  typeChipTextActive: { color: C.accent, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
