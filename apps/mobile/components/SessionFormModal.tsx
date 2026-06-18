import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
} from "react-native";
import { SESSION_META, SESSION_ORDER } from "../lib/display";
import type { ScheduleEntry, SessionType } from "../lib/types";
import type { CreateScheduleInput } from "../store/useScheduleStore";
import { ApiError } from "../lib/api";
import { DateField, TimeField } from "./DateTimeField";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  defaultDate: string; // YYYY-MM-DD
  initial?: ScheduleEntry | null;
  projects: { id: string; title: string }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function SessionFormModal({
  visible,
  onClose,
  onSubmit,
  onDelete,
  defaultDate,
  initial,
  projects,
}: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SessionType>("INDIVIDUAL");
  const [date, setDate] = useState(defaultDate);
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form whenever it opens (for the right entry / default date).
  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (initial) {
      setTitle(initial.title);
      setType(initial.type);
      setDate(initial.date.slice(0, 10));
      setMultiDay(!!initial.endDate);
      setEndDate((initial.endDate ?? initial.date).slice(0, 10));
      setAllDay(initial.allDay);
      setStartTime(initial.startTime ?? "");
      setEndTime(initial.endTime ?? "");
      setLocation(initial.location ?? "");
      setNotes(initial.notes ?? "");
      setEventId(initial.eventId);
      setCost(initial.expense ? String(initial.expense.amount) : "");
    } else {
      setTitle("");
      setType("INDIVIDUAL");
      setDate(defaultDate);
      setMultiDay(false);
      setEndDate(defaultDate);
      setAllDay(false);
      setStartTime("");
      setEndTime("");
      setLocation("");
      setNotes("");
      setEventId(null);
      setCost("");
    }
  }, [visible, initial, defaultDate]);

  const showCost = type !== "REST";

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }
    if (!DATE_RE.test(date)) {
      setError("Date must be YYYY-MM-DD");
      return;
    }
    if (multiDay && !DATE_RE.test(endDate)) {
      setError("End date must be YYYY-MM-DD");
      return;
    }
    if (multiDay && endDate < date) {
      setError("End date must be on or after the start date");
      return;
    }
    if (!allDay && startTime && !TIME_RE.test(startTime)) {
      setError("Start time must be HH:MM");
      return;
    }
    if (!allDay && endTime && !TIME_RE.test(endTime)) {
      setError("End time must be HH:MM");
      return;
    }
    const costValue = showCost && cost ? Number(cost.replace(",", ".")) : null;

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        type,
        date: new Date(`${date}T00:00:00.000Z`).toISOString(),
        endDate: multiDay ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
        allDay,
        startTime: allDay ? null : startTime || null,
        endTime: allDay ? null : endTime || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        eventId,
        cost: costValue && costValue > 0 ? costValue : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-zinc-900 rounded-t-3xl p-5 max-h-[92%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl text-white font-bold">
                {initial ? "Edit session" : "New session"}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-zinc-400 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
                <Text className="text-red-300">{error}</Text>
              </View>
            ) : null}

            <Text className="text-zinc-400 mb-2">Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {SESSION_ORDER.map((t) => {
                const meta = SESSION_META[t];
                const active = t === type;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    className={`px-3 py-2 rounded-xl mr-2 ${active ? "bg-emerald-500" : "bg-zinc-800"}`}
                  >
                    <Text className={active ? "text-white font-semibold" : "text-zinc-300"}>
                      {meta.icon} {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text className="text-zinc-400 mb-1">Title</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="e.g. Individual with Coach"
              placeholderTextColor="#71717a"
              value={title}
              onChangeText={setTitle}
            />

            <Text className="text-zinc-400 mb-1">{multiDay ? "Start date" : "Date"}</Text>
            <View className="mb-3">
              <DateField value={date} onChange={setDate} />
            </View>

            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-zinc-400">Multi-day event</Text>
              <Switch
                value={multiDay}
                onValueChange={(v) => {
                  setMultiDay(v);
                  if (v && endDate < date) setEndDate(date);
                }}
                trackColor={{ true: "#10b981", false: "#3f3f46" }}
                thumbColor="#fff"
              />
            </View>
            {multiDay ? (
              <>
                <Text className="text-zinc-400 mb-1">End date</Text>
                <View className="mb-4">
                  <DateField value={endDate} onChange={setEndDate} />
                </View>
              </>
            ) : null}

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-zinc-400">All day</Text>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ true: "#10b981", false: "#3f3f46" }}
                thumbColor="#fff"
              />
            </View>

            {!allDay ? (
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-zinc-400 mb-1">Start</Text>
                  <TimeField
                    value={startTime || null}
                    onChange={(v) => setStartTime(v ?? "")}
                    placeholder="Start"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-400 mb-1">End</Text>
                  <TimeField
                    value={endTime || null}
                    onChange={(v) => setEndTime(v ?? "")}
                    placeholder="End"
                  />
                </View>
              </View>
            ) : null}

            <Text className="text-zinc-400 mb-1">Location (optional)</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="Studio / venue"
              placeholderTextColor="#71717a"
              value={location}
              onChangeText={setLocation}
            />

            {showCost ? (
              <>
                <Text className="text-zinc-400 mb-1">Cost € (optional)</Text>
                <TextInput
                  className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-1"
                  placeholder="e.g. 70"
                  placeholderTextColor="#71717a"
                  keyboardType="decimal-pad"
                  value={cost}
                  onChangeText={setCost}
                />
                <Text className="text-zinc-600 text-xs mb-4">
                  Adds a linked expense so this session counts in your finances.
                </Text>
              </>
            ) : null}

            <Text className="text-zinc-400 mb-1">Notes (optional)</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="Anything to remember"
              placeholderTextColor="#71717a"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {projects.length > 0 ? (
              <>
                <Text className="text-zinc-400 mb-2">Link to project (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <TouchableOpacity
                    onPress={() => setEventId(null)}
                    className={`px-3 py-2 rounded-xl mr-2 ${eventId === null ? "bg-emerald-500" : "bg-zinc-800"}`}
                  >
                    <Text className={eventId === null ? "text-white font-semibold" : "text-zinc-300"}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {projects.map((p) => {
                    const active = p.id === eventId;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setEventId(p.id)}
                        className={`px-3 py-2 rounded-xl mr-2 ${active ? "bg-emerald-500" : "bg-zinc-800"}`}
                      >
                        <Text className={active ? "text-white font-semibold" : "text-zinc-300"}>
                          {p.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <TouchableOpacity
              className="bg-emerald-500 rounded-xl py-4 items-center mt-2"
              onPress={submit}
              disabled={submitting}
            >
              <Text className="text-white font-bold text-base">
                {submitting ? "Saving…" : initial ? "Save changes" : "Add session"}
              </Text>
            </TouchableOpacity>

            {initial && onDelete ? (
              <TouchableOpacity
                className="py-4 items-center mb-6"
                onPress={async () => {
                  setSubmitting(true);
                  try {
                    await onDelete();
                    onClose();
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <Text className="text-red-400 font-semibold">Delete session</Text>
              </TouchableOpacity>
            ) : (
              <View className="h-6" />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
