import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useScheduleStore, monthKeyOf } from "../../../store/useScheduleStore";
import { useProjectStore } from "../../../store/useProjectStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import { useAuthStore } from "../../../store/useAuthStore";
import SessionFormModal from "../../../components/SessionFormModal";
import {
  SESSION_META,
  EVENT_TYPE_META,
  CATEGORY_META,
  dayKey,
  formatMoney,
} from "../../../lib/display";
import type { Project, ScheduleEntry } from "../../../lib/types";
import PressableScale from "../../../components/ui/PressableScale";
import { C } from "../../../lib/theme";

const PROJECT_COLOR = C.purple;

function daysBetweenIso(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${startIso.slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${endIso.slice(0, 10)}T00:00:00.000Z`);
  for (let i = 0; i < 366 && t <= end; i++) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayHeading(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const calendarTheme = {
  calendarBackground: C.bg,
  monthTextColor: C.t1,
  textMonthFontWeight: "bold" as const,
  textMonthFontSize: 16,
  dayTextColor: "#e4e4e7",
  textDisabledColor: C.t3,
  todayTextColor: C.accent,
  arrowColor: C.accent,
  textSectionTitleColor: C.t3,
  textDayFontSize: 13,
};

const ZOOM_HEIGHT = [42, 66, 96, 128];
const ZOOM_LABELS = [0, 0, 2, 4];
const MAX_ZOOM = ZOOM_HEIGHT.length - 1;

export default function CalendarScreen() {
  const router = useRouter();
  const { viewMonth, entries, monthExpenses, fetchMonth, createEntry, updateEntry, deleteEntry } =
    useScheduleStore();
  const { projects, refreshProjects } = useProjectStore();
  const { couple, createProposal } = usePartnerStore();
  const myId = useAuthStore((s) => s.user?.id);
  const { width } = useWindowDimensions();

  const [selectedDay, setSelectedDay] = useState<string>(todayKey());
  const [zoom, setZoom] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchMonth(viewMonth);
      refreshProjects();
    }, [viewMonth, fetchMonth, refreshProjects])
  );

  const totals = useMemo(() => {
    const trainings = entries.filter((e) => SESSION_META[e.type]?.isTraining).length;
    let paid = 0, planned = 0;
    for (const e of monthExpenses) {
      if (e.status === "PAID") paid += e.amount;
      else planned += e.amount;
    }
    return { trainings, paid, planned };
  }, [entries, monthExpenses]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    for (const e of entries) {
      const keys = e.endDate ? daysBetweenIso(e.date, e.endDate) : [dayKey(e.date)];
      for (const k of keys) (map[k] ??= []).push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [entries]);

  const projectsByDay = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const p of projects) {
      const keys = daysBetweenIso(p.date, p.endDate ?? p.date);
      for (const k of keys) (map[k] ??= []).push(p);
    }
    return map;
  }, [projects]);

  const dayEntries = entriesByDay[selectedDay] ?? [];
  const dayProjects = projectsByDay[selectedDay] ?? [];
  const standaloneExpenses = useMemo(() => {
    const linked = new Set(entries.map((e) => e.expenseId).filter(Boolean));
    return monthExpenses.filter((x) => dayKey(x.date) === selectedDay && !linked.has(x.id));
  }, [entries, monthExpenses, selectedDay]);

  const cellWidth = Math.floor((width - 12) / 7);
  const cellHeight = ZOOM_HEIGHT[zoom];
  const labelCount = ZOOM_LABELS[zoom];

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (entry: ScheduleEntry) => {
    // Partner entries are read-only — only edit your own
    if (entry.userId !== myId) return;
    setEditing(entry);
    setModalOpen(true);
  };
  const onSubmit = async (input: Parameters<typeof createEntry>[0]) => {
    if (editing) await updateEntry(editing.id, input);
    else await createEntry(input);
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll}>
        <View style={styles.topPad}>
          <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.calHeader}>
            <Text style={styles.monthTitle} numberOfLines={1}>
              {monthLabel(viewMonth)}
            </Text>
            <View style={styles.zoomRow}>
              <ZoomBtn label="−" disabled={zoom === 0} onPress={() => setZoom((z) => Math.max(0, z - 1))} />
              <ZoomBtn label="+" disabled={zoom === MAX_ZOOM} onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.statsRow}>
            <StatPill label="Trainings" value={String(totals.trainings)} />
            <StatPill label="Spent" value={formatMoney(totals.paid)} />
            <StatPill label="Planned" value={formatMoney(totals.planned)} gold />
          </Animated.View>
        </View>

        <Calendar
          key={`${viewMonth}-${zoom}`}
          current={`${viewMonth}-01`}
          firstDay={1}
          enableSwipeMonths
          theme={calendarTheme}
          style={{ backgroundColor: C.bg }}
          onMonthChange={(m) => fetchMonth(monthKeyOf(new Date(m.year, m.month - 1, 1)))}
          dayComponent={({ date, state }: any) => {
            if (!date) return <View style={{ width: cellWidth, height: cellHeight }} />;
            return (
              <DayCell
                dayNum={date.day}
                dateString={date.dateString}
                state={state}
                entries={entriesByDay[date.dateString] ?? []}
                projects={projectsByDay[date.dateString] ?? []}
                selected={date.dateString === selectedDay}
                onPress={() => setSelectedDay(date.dateString)}
                width={cellWidth}
                height={cellHeight}
                labelCount={labelCount}
                myId={myId}
              />
            );
          }}
        />

        {/* Day agenda */}
        <View style={styles.agenda}>
          <View style={styles.agendaHeader}>
            <Text style={styles.agendaTitle} numberOfLines={1}>
              {dayHeading(selectedDay)}
            </Text>
            <PressableScale style={styles.addBtn} onPress={openNew}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </PressableScale>
          </View>

          {dayEntries.length === 0 && standaloneExpenses.length === 0 && dayProjects.length === 0 ? (
            <Text style={styles.emptyDay}>Nothing planned. Tap "+ Add" to schedule a session.</Text>
          ) : null}

          {dayProjects.map((p, i) => {
            const meta = EVENT_TYPE_META[p.type] ?? EVENT_TYPE_META.TOURNAMENT;
            return (
              <Animated.View
                key={p.id}
                entering={i < 4 ? FadeInDown.delay(i * 60).duration(350) : undefined}
              >
                <PressableScale
                  onPress={() => router.push(`/project/${p.id}`)}
                  style={styles.projectRow}
                >
                  <Text style={styles.projectRowIcon}>{meta.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectRowTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.projectRowMeta}>
                      {meta.label}{p.location ? ` · ${p.location}` : ""}
                    </Text>
                  </View>
                  <Text style={{ color: C.purple, fontSize: 16 }}>›</Text>
                </PressableScale>
              </Animated.View>
            );
          })}

          {dayEntries.map((e, i) => (
            <Animated.View
              key={e.id}
              entering={i < 6 ? FadeInDown.delay(i * 55).duration(350) : undefined}
            >
              <SessionRow
                entry={e}
                onPress={() => openEdit(e)}
                myId={myId}
                partnerName={couple?.partner.firstName}
              />
            </Animated.View>
          ))}

          {standaloneExpenses.map((x) => {
            const meta = CATEGORY_META[x.category] ?? CATEGORY_META.OTHER;
            return (
              <View key={x.id} style={styles.expenseRow}>
                <Text style={styles.expenseIcon}>{meta.icon}</Text>
                <Text style={styles.expenseLabel} numberOfLines={1}>
                  {x.title || meta.label}
                </Text>
                <Text style={[styles.expenseAmount, x.status === "PLANNED" && { color: C.gold }]}>
                  {formatMoney(x.amount)}
                </Text>
              </View>
            );
          })}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      <SessionFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
        onProposal={couple ? createProposal : undefined}
        onDelete={editing ? () => deleteEntry(editing.id) : undefined}
        defaultDate={selectedDay}
        initial={editing}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        hasPartner={!!couple}
        partnerName={couple ? couple.partner.firstName : undefined}
      />
    </View>
  );
}

function ZoomBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.zoomBtn, disabled && styles.zoomBtnDisabled]}
    >
      <Text style={[styles.zoomBtnText, disabled && { color: C.t3 }]}>{label}</Text>
    </PressableScale>
  );
}

function DayCell({
  dayNum, state, entries, projects, selected, onPress, width, height, labelCount, myId,
}: {
  dayNum: number; dateString: string; state: string;
  entries: ScheduleEntry[]; projects: Project[];
  selected: boolean; onPress: () => void;
  width: number; height: number; labelCount: number; myId?: string;
}) {
  const disabled = state === "disabled";
  const isToday = state === "today";
  const labels = [
    ...projects.map((p) => ({ id: `p-${p.id}`, color: PROJECT_COLOR, text: p.title })),
    ...entries.map((e) => {
      const isPartner = myId && e.userId !== myId;
      const baseColor = SESSION_META[e.type]?.dot ?? "#9ca3af";
      return {
        id: e.id,
        // Partner entries shown with accent teal so they're distinguishable
        color: isPartner ? C.accent : baseColor,
        text: `${e.startTime ? `${e.startTime} ` : ""}${e.title}`,
      };
    }),
  ];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.94}
      style={[
        { width, height, paddingHorizontal: 2, paddingTop: 4 },
        selected && { backgroundColor: C.accentFade, borderRadius: 10 },
      ]}
    >
      <Text
        style={[
          styles.dayNum,
          disabled && { color: C.t3 },
          isToday && { color: C.accent, fontWeight: '700' },
        ]}
      >
        {dayNum}
      </Text>
      {labelCount > 0 ? (
        <View style={{ marginTop: 2 }}>
          {labels.slice(0, labelCount).map((l) => (
            <View
              key={l.id}
              style={{ backgroundColor: `${l.color}33`, borderRadius: 3, paddingHorizontal: 2, marginBottom: 1 }}
            >
              <Text numberOfLines={1} style={{ fontSize: 8, color: l.color }}>{l.text}</Text>
            </View>
          ))}
          {labels.length > labelCount ? (
            <Text style={{ fontSize: 8, color: C.t3 }}>+{labels.length - labelCount}</Text>
          ) : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          {labels.slice(0, 4).map((l) => (
            <View
              key={l.id}
              style={{ width: 5, height: 5, borderRadius: 3, marginHorizontal: 1, backgroundColor: l.color }}
            />
          ))}
        </View>
      )}
    </PressableScale>
  );
}

function StatPill({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, gold && { color: C.gold }]}>{value}</Text>
    </View>
  );
}

function SessionRow({
  entry,
  onPress,
  myId,
  partnerName,
}: {
  entry: ScheduleEntry;
  onPress: () => void;
  myId?: string;
  partnerName?: string;
}) {
  const meta = SESSION_META[entry.type] ?? SESSION_META.OTHER;
  const isPartner = Boolean(myId && entry.userId !== myId);

  const time = entry.endDate
    ? `${entry.date.slice(0, 10)} – ${entry.endDate.slice(0, 10)}`
    : entry.allDay
      ? "All day"
      : [entry.startTime, entry.endTime].filter(Boolean).join(" – ") || "Anytime";

  const paidByLabel = entry.expense && myId && partnerName
    ? entry.expense.userId === myId ? "you paid" : `${partnerName} paid`
    : null;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={isPartner ? 1 : 0.97}
      style={[
        styles.sessionRow,
        isPartner && styles.sessionRowPartner,
      ]}
    >
      <View style={[styles.sessionIcon, { backgroundColor: meta.dot ? `${meta.dot}22` : C.elevated }]}>
        <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: isPartner ? 2 : 0 }}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{entry.title}</Text>
          {isPartner && partnerName ? (
            <View style={styles.partnerChip}>
              <Text style={styles.partnerChipText}>{partnerName}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sessionMeta}>
          {time}{entry.location ? ` · ${entry.location}` : ""}
        </Text>
      </View>
      {entry.expense ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={entry.expense.status === "PLANNED" ? { color: C.gold, fontWeight: '600' } : { color: C.t1, fontWeight: '600' }}>
            {formatMoney(entry.expense.amount)}
          </Text>
          {paidByLabel ? (
            <Text style={styles.paidByLabel}>{paidByLabel}</Text>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  topPad: { paddingHorizontal: 20, paddingTop: 16 },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthTitle: { color: C.t1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, flex: 1 },
  zoomRow: { flexDirection: 'row', gap: 8 },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  zoomBtnDisabled: { opacity: 0.4 },
  zoomBtnText: { color: C.t1, fontSize: 18, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 0,
  },
  statPill: { flex: 1, alignItems: 'center' },
  statLabel: { color: C.t3, fontSize: 11, fontWeight: '500', letterSpacing: 0.3, marginBottom: 4 },
  statValue: { color: C.t1, fontSize: 16, fontWeight: '700' },
  agenda: { paddingHorizontal: 20, paddingTop: 16 },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  agendaTitle: { color: C.t1, fontSize: 17, fontWeight: '700', flex: 1 },
  addBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyDay: { color: C.t3, fontSize: 14, marginBottom: 16, lineHeight: 20 },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.purpleFade,
    borderWidth: 1,
    borderColor: C.purpleBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  projectRowIcon: { fontSize: 20 },
  projectRowTitle: { color: C.t1, fontWeight: '600', fontSize: 15 },
  projectRowMeta: { color: C.purple, fontSize: 13, opacity: 0.8 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  sessionRowPartner: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentFade,
  },
  partnerChip: {
    backgroundColor: C.accentBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  partnerChipText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: { color: C.t1, fontWeight: '600', fontSize: 15 },
  sessionMeta: { color: C.t2, fontSize: 13, marginTop: 2 },
  paidByLabel: { color: C.t3, fontSize: 11, marginTop: 2 },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${C.card}99`,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  expenseIcon: { fontSize: 18 },
  expenseLabel: { flex: 1, color: C.t2, fontSize: 14 },
  expenseAmount: { color: C.t1, fontWeight: '600', fontSize: 14 },
  dayNum: { textAlign: 'center', fontSize: 12, color: '#e4e4e7' },
});
