import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from "react-native";
import { Calendar } from "react-native-calendars";
import { useFocusEffect, useRouter } from "expo-router";
import { useScheduleStore, monthKeyOf } from "../../../store/useScheduleStore";
import { useProjectStore } from "../../../store/useProjectStore";
import SessionFormModal from "../../../components/SessionFormModal";
import {
  SESSION_META,
  EVENT_TYPE_META,
  CATEGORY_META,
  dayKey,
  formatMoney,
} from "../../../lib/display";
import type { Project, ScheduleEntry } from "../../../lib/types";

const PROJECT_COLOR = "#a855f7";

// Inclusive list of "YYYY-MM-DD" keys between two ISO dates (UTC).
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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
  calendarBackground: "#18181b",
  monthTextColor: "#ffffff",
  textMonthFontWeight: "bold" as const,
  dayTextColor: "#e4e4e7",
  textDisabledColor: "#3f3f46",
  todayTextColor: "#10b981",
  arrowColor: "#10b981",
  textSectionTitleColor: "#71717a",
};

// Cell height per zoom level, and how many session labels to show inline.
const ZOOM_HEIGHT = [42, 66, 96, 128];
const ZOOM_LABELS = [0, 0, 2, 4];
const MAX_ZOOM = ZOOM_HEIGHT.length - 1;

export default function CalendarScreen() {
  const router = useRouter();
  const { viewMonth, entries, monthExpenses, fetchMonth, createEntry, updateEntry, deleteEntry } =
    useScheduleStore();
  const { projects, refreshProjects } = useProjectStore();
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
    let paid = 0;
    let planned = 0;
    for (const e of monthExpenses) {
      if (e.status === "PAID") paid += e.amount;
      else planned += e.amount;
    }
    return { trainings, paid, planned };
  }, [entries, monthExpenses]);

  // Sessions grouped per day, expanding multi-day events across their span.
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

  // Projects (tournaments/camps) spanning each day.
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

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (entry: ScheduleEntry) => {
    setEditing(entry);
    setModalOpen(true);
  };
  const onSubmit = async (input: Parameters<typeof createEntry>[0]) => {
    if (editing) await updateEntry(editing.id, input);
    else await createEntry(input);
  };

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView className="flex-1">
        <View className="px-4 pt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-2xl text-white font-bold flex-1" numberOfLines={1}>
              {monthLabel(viewMonth)}
            </Text>
            {/* Zoom controls */}
            <View className="flex-row items-center">
              <ZoomBtn label="−" disabled={zoom === 0} onPress={() => setZoom((z) => Math.max(0, z - 1))} />
              <ZoomBtn label="+" disabled={zoom === MAX_ZOOM} onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} />
            </View>
          </View>

          <View className="bg-zinc-800 rounded-2xl p-4 flex-row justify-between mb-3">
            <Totals label="Trainings" value={String(totals.trainings)} />
            <Totals label="Spent" value={formatMoney(totals.paid)} />
            <Totals label="Planned" value={formatMoney(totals.planned)} tone="amber" />
          </View>
        </View>

        <Calendar
          key={`${viewMonth}-${zoom}`}
          current={`${viewMonth}-01`}
          firstDay={1}
          enableSwipeMonths
          theme={calendarTheme}
          style={{ backgroundColor: "#18181b" }}
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
              />
            );
          }}
        />

        {/* Selected day agenda */}
        <View className="px-4 pt-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg text-white font-semibold flex-1" numberOfLines={1}>
              {dayHeading(selectedDay)}
            </Text>
            <TouchableOpacity className="bg-emerald-500 px-4 py-2 rounded-xl ml-2" onPress={openNew}>
              <Text className="text-white font-bold">+ Add</Text>
            </TouchableOpacity>
          </View>

          {dayEntries.length === 0 &&
          standaloneExpenses.length === 0 &&
          dayProjects.length === 0 ? (
            <Text className="text-zinc-500 mb-6">
              Nothing planned. Tap “+ Add” to schedule a session.
            </Text>
          ) : null}

          {/* Active projects on this day */}
          {dayProjects.map((p) => {
            const meta = EVENT_TYPE_META[p.type] ?? EVENT_TYPE_META.TOURNAMENT;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => router.push(`/project/${p.id}`)}
                className="flex-row items-center bg-purple-500/20 border border-purple-500/40 rounded-2xl p-4 mb-2"
              >
                <Text className="text-lg mr-3">{meta.icon}</Text>
                <View className="flex-1">
                  <Text className="text-white font-semibold" numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text className="text-purple-300 text-sm">
                    {meta.label} · project{p.location ? ` · ${p.location}` : ""}
                  </Text>
                </View>
                <Text className="text-purple-300">›</Text>
              </TouchableOpacity>
            );
          })}

          {dayEntries.map((e) => (
            <SessionRow key={e.id} entry={e} onPress={() => openEdit(e)} />
          ))}

          {standaloneExpenses.map((x) => {
            const meta = CATEGORY_META[x.category] ?? CATEGORY_META.OTHER;
            return (
              <View
                key={x.id}
                className="flex-row items-center justify-between bg-zinc-800/60 rounded-2xl p-3 mb-2"
              >
                <View className="flex-row items-center flex-1">
                  <Text className="text-lg mr-3">{meta.icon}</Text>
                  <Text className="text-zinc-300 flex-1" numberOfLines={1}>
                    {x.title || meta.label}
                  </Text>
                </View>
                <Text className={x.status === "PLANNED" ? "text-amber-400" : "text-white"}>
                  {formatMoney(x.amount)}
                </Text>
              </View>
            );
          })}

          <View className="h-10" />
        </View>
      </ScrollView>

      <SessionFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
        onDelete={editing ? () => deleteEntry(editing.id) : undefined}
        defaultDate={selectedDay}
        initial={editing}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      />
    </View>
  );
}

function ZoomBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`w-9 h-9 rounded-full items-center justify-center ml-2 ${disabled ? "bg-zinc-800/50" : "bg-zinc-800"}`}
    >
      <Text className={`text-xl ${disabled ? "text-zinc-600" : "text-white"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function DayCell({
  dayNum,
  state,
  entries,
  projects,
  selected,
  onPress,
  width,
  height,
  labelCount,
}: {
  dayNum: number;
  dateString: string;
  state: string;
  entries: ScheduleEntry[];
  projects: Project[];
  selected: boolean;
  onPress: () => void;
  width: number;
  height: number;
  labelCount: number;
}) {
  const disabled = state === "disabled";
  const isToday = state === "today";

  // Combined items: projects first, then sessions.
  const labels = [
    ...projects.map((p) => ({ id: `p-${p.id}`, color: PROJECT_COLOR, text: p.title })),
    ...entries.map((e) => ({
      id: e.id,
      color: SESSION_META[e.type]?.dot ?? "#9ca3af",
      text: `${e.startTime ? `${e.startTime} ` : ""}${e.title}`,
    })),
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ width, height }}
      className={`px-0.5 pt-1 ${selected ? "bg-emerald-500/20 rounded-xl" : ""}`}
    >
      <Text
        className={`text-center text-xs ${
          disabled ? "text-zinc-700" : isToday ? "text-emerald-400 font-bold" : "text-zinc-200"
        }`}
      >
        {dayNum}
      </Text>

      {labelCount > 0 ? (
        <View className="mt-0.5">
          {labels.slice(0, labelCount).map((l) => (
            <View
              key={l.id}
              style={{ backgroundColor: `${l.color}33` }}
              className="rounded px-1 mb-0.5"
            >
              <Text numberOfLines={1} style={{ fontSize: 9, color: l.color }}>
                {l.text}
              </Text>
            </View>
          ))}
          {labels.length > labelCount ? (
            <Text style={{ fontSize: 9 }} className="text-zinc-500 px-1">
              +{labels.length - labelCount} more
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-row justify-center mt-1" style={{ flexWrap: "wrap" }}>
          {labels.slice(0, 4).map((l) => (
            <View
              key={l.id}
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                marginHorizontal: 1,
                backgroundColor: l.color,
              }}
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function Totals({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-zinc-400 text-xs mb-1">{label}</Text>
      <Text className={`font-bold text-base ${tone === "amber" ? "text-amber-400" : "text-white"}`}>
        {value}
      </Text>
    </View>
  );
}

function SessionRow({ entry, onPress }: { entry: ScheduleEntry; onPress: () => void }) {
  const meta = SESSION_META[entry.type] ?? SESSION_META.OTHER;
  const range = (a: string, b: string) => {
    const fmt = (iso: string) =>
      new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
    return `${fmt(a)} – ${fmt(b)}`;
  };
  const time = entry.endDate
    ? range(entry.date, entry.endDate)
    : entry.allDay
      ? "All day"
      : [entry.startTime, entry.endTime].filter(Boolean).join(" – ") || "Anytime";
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center bg-zinc-800 rounded-2xl p-4 mb-2">
      <View className={`w-11 h-11 rounded-full items-center justify-center ${meta.color}`}>
        <Text className="text-lg">{meta.icon}</Text>
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-white font-semibold" numberOfLines={1}>
          {entry.title}
        </Text>
        <Text className="text-zinc-400 text-sm">
          {time}
          {entry.location ? ` · ${entry.location}` : ""}
        </Text>
      </View>
      {entry.expense ? (
        <Text className={entry.expense.status === "PLANNED" ? "text-amber-400" : "text-white"}>
          {formatMoney(entry.expense.amount)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
