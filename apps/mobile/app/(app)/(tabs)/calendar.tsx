import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, Alert, Platform } from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useScheduleStore, monthKeyOf } from "../../../store/useScheduleStore";
import { useProjectStore } from "../../../store/useProjectStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import { useAuthStore } from "../../../store/useAuthStore";
import SessionFormModal from "../../../components/SessionFormModal";
import {
  SESSION_META, EVENT_TYPE_META, CATEGORY_META, dayKey, formatMoney,
} from "../../../lib/display";
import type { Project, ScheduleEntry } from "../../../lib/types";
import PressableScale from "../../../components/ui/PressableScale";
import { AnimatedBar } from "../../../components/ui/AnimatedProgress";
import { C, SHADOWS, stagger } from "../../../lib/theme";
import type { Palette } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useT } from "../../../lib/i18n";
import { useLanguageStore } from "../../../store/useLanguageStore";
import Hint from "../../../components/ui/Hint";
import AppBackground from "../../../components/ui/AppBackground";

const PROJECT_COLOR = C.purple;

const LANG_LOCALE: Record<string, string> = { en: "en-US", ru: "ru-RU", uk: "uk-UA", de: "de-DE" };

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

function monthLabel(monthKey: string, locale = "en-US"): string {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function dayHeading(day: string, locale = "en-US"): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

function makeCalendarTheme(C: Palette) {
  return {
    calendarBackground: C.bg,
    monthTextColor: C.t1,
    textMonthFontWeight: "bold" as const,
    textMonthFontSize: 16,
    dayTextColor: C.t1,
    textDisabledColor: C.t3,
    todayTextColor: C.accent,
    arrowColor: C.accent,
    textSectionTitleColor: C.t3,
    textDayFontSize: 13,
  };
}

const ZOOM_HEIGHT = [42, 66, 96, 128];
const ZOOM_LABELS = [0, 0, 2, 4];
const MAX_ZOOM = ZOOM_HEIGHT.length - 1;

export default function CalendarScreen() {
  const router = useRouter();
  const C = useC();
  const t = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const calendarTheme = useMemo(() => makeCalendarTheme(C), [C]);
  const { language } = useLanguageStore();
  const locale = LANG_LOCALE[language] ?? "en-US";

  const { viewMonth, entries, monthExpenses, fetchMonth, createEntry, updateEntry, deleteEntry, deleteDay } =
    useScheduleStore();
  const { projects, refreshProjects } = useProjectStore();
  const { couple, createProposal } = usePartnerStore();
  const myId = useAuthStore(s => s.user?.id);
  const { width } = useWindowDimensions();

  const [selectedDay, setSelectedDay] = useState<string>(todayKey());
  const [zoom, setZoom] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);

  useFocusEffect(useCallback(() => { fetchMonth(viewMonth); refreshProjects(); }, [viewMonth, fetchMonth, refreshProjects]));

  const totals = useMemo(() => {
    const trainings = entries.filter(e => SESSION_META[e.type]?.isTraining).length;
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

  // Week training strip: Mon–Sun of the current week
  const weekStrip = useMemo(() => {
    const today = new Date();
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const cnt = (entriesByDay[key] ?? []).filter(e => SESSION_META[e.type]?.isTraining).length;
      days.push({
        key,
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        trainings: cnt,
        isToday: key === todayKey(),
        isSelected: key === selectedDay,
      });
    }
    const maxT = Math.max(1, ...days.map(d => d.trainings));
    return days.map(d => ({ ...d, ratio: d.trainings > 0 ? d.trainings / maxT : 0 }));
  }, [entriesByDay, selectedDay]);

  const dayEntries = entriesByDay[selectedDay] ?? [];
  const dayProjects = projectsByDay[selectedDay] ?? [];
  const standaloneExpenses = useMemo(() => {
    const linked = new Set(entries.map(e => e.expenseId).filter(Boolean));
    return monthExpenses.filter(x => dayKey(x.date) === selectedDay && !linked.has(x.id));
  }, [entries, monthExpenses, selectedDay]);

  const cellWidth = Math.floor((width - 12) / 7);
  const cellHeight = ZOOM_HEIGHT[zoom];
  const labelCount = ZOOM_LABELS[zoom];
  const myDayEntries = dayEntries.filter(e => e.userId === myId);

  const clearDay = () => {
    if (myDayEntries.length === 0) return;
    const doDelete = () => myDayEntries.forEach(e => deleteEntry(e.id));
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert(
      "Clear day",
      `Delete all ${myDayEntries.length} session${myDayEntries.length > 1 ? "s" : ""} for ${dayHeading(selectedDay, locale)}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete all", style: "destructive", onPress: doDelete },
      ],
    );
  };

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (entry: ScheduleEntry) => {
    if (entry.userId !== myId) return;
    setEditing(entry); setModalOpen(true);
  };
  const onSubmit = async (input: Parameters<typeof createEntry>[0]) => {
    if (editing) await updateEntry(editing.id, input);
    else await createEntry(input);
  };

  return (
    <View style={styles.screen}>
      <AppBackground />
      <ScrollView style={styles.scroll}>
        <View style={styles.topPad}>

          <Hint
            id="calendar.intro"
            title={t.hints.calendarTitle}
            text={t.hints.calendarText}
            gradient="purple"
            icon="bulb"
            style={{ marginHorizontal: 0, marginBottom: 12 }}
          />

          {/* ── Header ───────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(0).springify().damping(16).stiffness(140)} style={styles.calHeader}>
            <Text style={styles.monthTitle} numberOfLines={1}>{monthLabel(viewMonth, locale)}</Text>
            <View style={styles.zoomRow}>
              <ZoomBtn label="−" disabled={zoom === 0} onPress={() => setZoom(z => Math.max(0, z - 1))} />
              <ZoomBtn label="+" disabled={zoom === MAX_ZOOM} onPress={() => setZoom(z => Math.min(MAX_ZOOM, z + 1))} />
            </View>
          </Animated.View>

          {/* ── Month stat chips ─────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(16).stiffness(140)}>
            <View style={styles.statsCard}>
              <StatChip label="Sessions" value={String(totals.trainings)} color={C.accent} icon="🏋️" />
              <View style={styles.statDivider} />
              <StatChip label="Spent" value={formatMoney(totals.paid)} color={C.t1} icon="💸" />
              {totals.planned > 0 && (
                <>
                  <View style={styles.statDivider} />
                  <StatChip label="Planned" value={formatMoney(totals.planned)} color={C.gold} icon="📋" />
                </>
              )}
            </View>
          </Animated.View>

          {/* ── Week training load strip ──────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(120).springify().damping(16).stiffness(140)}>
            <View style={styles.weekCard}>
              <Text style={styles.weekLabel}>THIS WEEK · TRAINING LOAD</Text>
              <View style={styles.weekBars}>
                {weekStrip.map((day, i) => (
                  <PressableScale key={day.key} onPress={() => setSelectedDay(day.key)} style={styles.weekDay}>
                    <View style={styles.weekBarArea}>
                      <AnimatedBar
                        ratio={day.trainings > 0 ? day.ratio : 0.06}
                        color={
                          day.isToday ? C.accent :
                          day.isSelected ? C.purple :
                          day.trainings > 0 ? `${C.accent}70` : C.elevated
                        }
                        maxHeight={44}
                        width={26}
                        radius={8}
                        delay={i * 55 + 300}
                        duration={700}
                      />
                    </View>
                    <Text style={[
                      styles.weekDayLabel,
                      day.isToday && { color: C.accent, fontWeight: "700" },
                      day.isSelected && !day.isToday && { color: C.purple, fontWeight: "700" },
                    ]}>
                      {day.label}
                    </Text>
                    {day.trainings > 0 && (
                      <Text style={[styles.weekDayCount, { color: day.isToday ? C.accent : C.t3 }]}>
                        {day.trainings}
                      </Text>
                    )}
                  </PressableScale>
                ))}
              </View>
            </View>
          </Animated.View>

        </View>

        <Calendar
          key={`${viewMonth}-${zoom}`}
          current={`${viewMonth}-01`}
          firstDay={1}
          enableSwipeMonths
          theme={calendarTheme}
          style={{ backgroundColor: C.bg }}
          onMonthChange={m => fetchMonth(monthKeyOf(new Date(m.year, m.month - 1, 1)))}
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

        {/* ── Day Agenda ───────────────────────────────────────────────────── */}
        <View style={styles.agenda}>
          <View style={styles.agendaHeader}>
            <Text style={styles.agendaTitle} numberOfLines={1}>{dayHeading(selectedDay, locale)}</Text>
            <View style={styles.agendaActions}>
              {myDayEntries.length > 0 && (
                <PressableScale style={styles.clearBtn} onPress={clearDay}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </PressableScale>
              )}
              <PressableScale style={styles.addBtn} onPress={openNew}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </PressableScale>
            </View>
          </View>

          {dayEntries.length === 0 && standaloneExpenses.length === 0 && dayProjects.length === 0 && (
            <Text style={styles.emptyDay}>Nothing planned. Tap "+ Add" to schedule a session.</Text>
          )}

          {dayProjects.map((p, i) => {
            const meta = EVENT_TYPE_META[p.type] ?? EVENT_TYPE_META.TOURNAMENT;
            return (
              <Animated.View key={p.id} entering={i < 4 ? FadeInDown.delay(stagger(i, 90)).springify().damping(16).stiffness(140) : undefined}>
                <PressableScale onPress={() => router.push(`/project/${p.id}`)} style={styles.projectRow}>
                  <Text style={styles.projectRowIcon}>{meta.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectRowTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.projectRowMeta}>{meta.label}{p.location ? ` · ${p.location}` : ""}</Text>
                  </View>
                  <Text style={{ color: C.purple, fontSize: 16 }}>›</Text>
                </PressableScale>
              </Animated.View>
            );
          })}

          {dayEntries.map((e, i) => (
            <Animated.View key={e.id} entering={i < 6 ? FadeInDown.delay(stagger(i, 90)).springify().damping(16).stiffness(140) : undefined}>
              <SessionRow entry={e} onPress={() => openEdit(e)} myId={myId} partnerName={couple?.partner.firstName} />
            </Animated.View>
          ))}

          {standaloneExpenses.map(x => {
            const meta = CATEGORY_META[x.category] ?? CATEGORY_META.OTHER;
            return (
              <View key={x.id} style={styles.expenseRow}>
                <Text style={styles.expenseIcon}>{meta.icon}</Text>
                <Text style={styles.expenseLabel} numberOfLines={1}>{x.title || meta.label}</Text>
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
        projects={projects.map(p => ({ id: p.id, title: p.title }))}
        hasPartner={!!couple}
        partnerName={couple ? couple.partner.firstName : undefined}
      />
    </View>
  );
}

function ZoomBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={[styles.zoomBtn, disabled && styles.zoomBtnDisabled]}>
      <Text style={[styles.zoomBtnText, disabled && { color: C.t3 }]}>{label}</Text>
    </PressableScale>
  );
}

function StatChip({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const disabled = state === "disabled";
  const isToday = state === "today";
  const labels = [
    ...projects.map(p => ({ id: `p-${p.id}`, color: PROJECT_COLOR, text: p.title })),
    ...entries.map(e => {
      const isPartner = myId && e.userId !== myId;
      const baseColor = SESSION_META[e.type]?.dot ?? "#9ca3af";
      return { id: e.id, color: isPartner ? C.accent : baseColor, text: `${e.startTime ? `${e.startTime} ` : ""}${e.title}` };
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
      <Text style={[styles.dayNum, disabled && { color: C.t3 }, isToday && { color: C.accent, fontWeight: "700" }]}>
        {dayNum}
      </Text>
      {labelCount > 0 ? (
        <View style={{ marginTop: 2 }}>
          {labels.slice(0, labelCount).map(l => (
            <View key={l.id} style={{ backgroundColor: `${l.color}33`, borderRadius: 3, paddingHorizontal: 2, marginBottom: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 8, color: l.color }}>{l.text}</Text>
            </View>
          ))}
          {labels.length > labelCount && <Text style={{ fontSize: 8, color: C.t3 }}>+{labels.length - labelCount}</Text>}
        </View>
      ) : (
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 3, flexWrap: "wrap" }}>
          {labels.slice(0, 4).map(l => (
            <View key={l.id} style={{ width: 5, height: 5, borderRadius: 3, marginHorizontal: 1, backgroundColor: l.color }} />
          ))}
        </View>
      )}
    </PressableScale>
  );
}

function SessionRow({ entry, onPress, myId, partnerName }: { entry: ScheduleEntry; onPress: () => void; myId?: string; partnerName?: string }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const meta = SESSION_META[entry.type] ?? SESSION_META.OTHER;
  const isPartner = Boolean(myId && entry.userId !== myId);
  const time = entry.endDate
    ? `${entry.date.slice(0, 10)} – ${entry.endDate.slice(0, 10)}`
    : entry.allDay ? "All day"
    : [entry.startTime, entry.endTime].filter(Boolean).join(" – ") || "Anytime";
  const paidByLabel = entry.expense && myId && partnerName
    ? entry.expense.userId === myId ? "you paid" : `${partnerName} paid` : null;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={isPartner ? 1 : 0.97}
      style={[styles.sessionRow, isPartner && styles.sessionRowPartner]}
    >
      <View style={[styles.sessionIcon, { backgroundColor: meta.dot ? `${meta.dot}22` : C.elevated }]}>
        <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: isPartner ? 2 : 0 }}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{entry.title}</Text>
          {isPartner && partnerName && (
            <View style={styles.partnerChip}>
              <Text style={styles.partnerChipText}>{partnerName}</Text>
            </View>
          )}
        </View>
        <Text style={styles.sessionMeta}>{time}{entry.location ? ` · ${entry.location}` : ""}</Text>
      </View>
      {entry.expense && (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={entry.expense.status === "PLANNED" ? { color: C.gold, fontWeight: "600" } : { color: C.t1, fontWeight: "600" }}>
            {formatMoney(entry.expense.amount)}
          </Text>
          {paidByLabel && <Text style={styles.paidByLabel}>{paidByLabel}</Text>}
        </View>
      )}
    </PressableScale>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  topPad: { paddingHorizontal: 20, paddingTop: 16 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  monthTitle: { color: C.t1, fontSize: 24, fontWeight: "900", letterSpacing: -0.6, flex: 1 },
  zoomRow: { flexDirection: "row", gap: 8 },
  zoomBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  zoomBtnDisabled: { opacity: 0.4 },
  zoomBtnText: { color: C.t1, fontSize: 18, fontWeight: "500" },
  // Stat chips card
  statsCard: {
    flexDirection: "row", backgroundColor: C.card, borderRadius: 22,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center",
    ...SHADOWS.sm,
  },
  statChip: { flex: 1, alignItems: "center", gap: 2 },
  statChipIcon: { fontSize: 18, marginBottom: 2 },
  statLabel: { color: C.t3, fontSize: 11, fontWeight: "500", letterSpacing: 0.3 },
  statValue: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  statDivider: { width: 1, backgroundColor: C.border, height: 36, marginHorizontal: 4 },
  // Week strip
  weekCard: {
    backgroundColor: C.card, borderRadius: 22, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: C.borderStrong,
    ...SHADOWS.sm,
  },
  weekLabel: { color: C.t3, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 12 },
  weekBars: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
  weekDay: { alignItems: "center", gap: 4, flex: 1 },
  weekBarArea: { height: 52, justifyContent: "flex-end", alignItems: "center" },
  weekDayLabel: { color: C.t3, fontSize: 11, fontWeight: "500" },
  weekDayCount: { fontSize: 10, fontWeight: "700" },
  // Agenda
  agenda: { paddingHorizontal: 20, paddingTop: 16 },
  agendaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  agendaTitle: { color: C.t1, fontSize: 17, fontWeight: "700", flex: 1 },
  agendaActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  addBtn: { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  clearBtn: { backgroundColor: `${C.red}18`, borderWidth: 1, borderColor: `${C.red}40`, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  clearBtnText: { color: C.red, fontWeight: "600", fontSize: 13 },
  emptyDay: { color: C.t3, fontSize: 14, marginBottom: 16, lineHeight: 20 },
  projectRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.purpleFade,
    borderWidth: 1, borderColor: C.purpleBorder, borderRadius: 20, padding: 14, marginBottom: 10, gap: 10,
  },
  projectRowIcon: { fontSize: 20 },
  projectRowTitle: { color: C.t1, fontWeight: "600", fontSize: 15 },
  projectRowMeta: { color: C.purple, fontSize: 13, opacity: 0.8 },
  sessionRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.card,
    borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.borderStrong,
  },
  sessionRowPartner: { borderColor: C.accentBorder, backgroundColor: C.accentFade },
  partnerChip: { backgroundColor: C.accentBorder, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  partnerChipText: { color: C.accent, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  sessionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sessionTitle: { color: C.t1, fontWeight: "600", fontSize: 15 },
  sessionMeta: { color: C.t2, fontSize: 13, marginTop: 2 },
  paidByLabel: { color: C.t3, fontSize: 11, marginTop: 2 },
  expenseRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.card,
    borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 10,
  },
  expenseIcon: { fontSize: 18 },
  expenseLabel: { flex: 1, color: C.t2, fontSize: 14 },
  expenseAmount: { color: C.t1, fontWeight: "600", fontSize: 14 },
  dayNum: { textAlign: "center", fontSize: 12, color: C.t1 },
  });
}
