import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SESSION_META, SESSION_ORDER, currencySymbol } from "../lib/display";
import type { ScheduleEntry, SessionType } from "../lib/types";
import type { CreateScheduleInput } from "../store/useScheduleStore";
import type { CreateProposalInput } from "../store/usePartnerStore";
import { ApiError } from "../lib/api";
import { DateField, TimeField } from "./DateTimeField";
import PressableScale from "./ui/PressableScale";
import type { Palette } from "../lib/theme";
import { useC } from "../lib/useTheme";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function sessionTypeToProposalType(type: SessionType): string {
  switch (type) {
    case "INDIVIDUAL": case "GROUP_LESSON": case "PRACTICE": case "CAMP": return "TRAINING";
    case "COMPETITION": return "TOURNAMENT";
    default: return "OTHER";
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateScheduleInput) => Promise<void>;
  onProposal?: (input: CreateProposalInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  defaultDate: string;
  initial?: ScheduleEntry | null;
  projects: { id: string; title: string }[];
  hasPartner?: boolean;
  partnerName?: string;
}

export default function SessionFormModal({
  visible,
  onClose,
  onSubmit,
  onProposal,
  onDelete,
  defaultDate,
  initial,
  projects,
  hasPartner = false,
  partnerName = "Partner",
}: Props) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [mode, setMode] = useState<"add" | "proposal">("add");
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
  const [coupleEntry, setCoupleEntry] = useState(false);
  const [paidBy, setPaidBy] = useState<"ME" | "PARTNER">("ME");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode("add");
    setError(null);
    setCoupleEntry(false);
    setPaidBy("ME");
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
  const showPartnerOptions = hasPartner && !!onProposal && !initial;

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Enter a title"); return; }
    if (!DATE_RE.test(date)) { setError("Date must be YYYY-MM-DD"); return; }
    if (multiDay && !DATE_RE.test(endDate)) { setError("End date must be YYYY-MM-DD"); return; }
    if (multiDay && endDate < date) { setError("End date must be on or after the start date"); return; }
    if (!allDay && startTime && !TIME_RE.test(startTime)) { setError("Start time must be HH:MM"); return; }
    if (!allDay && endTime && !TIME_RE.test(endTime)) { setError("End time must be HH:MM"); return; }
    const costValue = showCost && cost ? Number(cost.replace(",", ".")) : null;

    setSubmitting(true);
    try {
      if (mode === "proposal" && onProposal) {
        await onProposal({
          title: title.trim(),
          type: sessionTypeToProposalType(type),
          cost: costValue && costValue > 0 ? costValue : null,
          details: {
            date,
            startTime: startTime || undefined,
            location: location.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        });
      } else {
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
          coupleEntry: hasPartner ? coupleEntry : false,
          paidBy: hasPartner && costValue && costValue > 0 ? paidBy : undefined,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <Text style={s.headerTitle}>
                {initial ? "Edit session" : mode === "proposal" ? "Propose session" : "New session"}
              </Text>
              <PressableScale onPress={onClose} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </PressableScale>
            </View>

            {/* Mode toggle */}
            {showPartnerOptions ? (
              <View style={s.modeRow}>
                <PressableScale
                  onPress={() => setMode("add")}
                  style={[s.modeBtn, mode === "add" && s.modeBtnActive]}
                >
                  <Text style={[s.modeBtnText, mode === "add" && s.modeBtnTextActive]}>
                    + Add
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={() => setMode("proposal")}
                  style={[s.modeBtn, mode === "proposal" && s.modeBtnActive]}
                >
                  <Text style={[s.modeBtnText, mode === "proposal" && s.modeBtnTextActive]}>
                    ↗ Propose to {partnerName}
                  </Text>
                </PressableScale>
              </View>
            ) : null}

            {mode === "proposal" ? (
              <View style={s.proposalHint}>
                <Text style={s.proposalHintText}>
                  {partnerName} will receive this as a proposal. If approved, it appears in both calendars automatically.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Type */}
            <Text style={s.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              <View style={s.chipRow}>
                {SESSION_ORDER.map((t) => {
                  const meta = SESSION_META[t];
                  const active = t === type;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => setType(t)}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>
                        {meta.icon} {meta.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>

            {/* Title */}
            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Individual with Coach"
              placeholderTextColor={C.t3}
              value={title}
              onChangeText={setTitle}
            />

            {/* Date */}
            <Text style={s.label}>{multiDay ? "Start date" : "Date"}</Text>
            <View style={s.datePicker}>
              <DateField value={date} onChange={setDate} />
            </View>

            {/* Multi-day */}
            <View style={s.switchRow}>
              <Text style={s.label}>Multi-day event</Text>
              <Switch
                value={multiDay}
                onValueChange={(v) => { setMultiDay(v); if (v && endDate < date) setEndDate(date); }}
                trackColor={{ true: C.accent, false: C.elevated }}
                thumbColor="#fff"
              />
            </View>
            {multiDay ? (
              <>
                <Text style={s.label}>End date</Text>
                <View style={s.datePicker}>
                  <DateField value={endDate} onChange={setEndDate} />
                </View>
              </>
            ) : null}

            {/* All day */}
            <View style={s.switchRow}>
              <Text style={s.label}>All day</Text>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ true: C.accent, false: C.elevated }}
                thumbColor="#fff"
              />
            </View>

            {!allDay ? (
              <View style={s.timeRow}>
                <View style={s.timeCol}>
                  <Text style={s.label}>Start</Text>
                  <TimeField value={startTime || null} onChange={(v) => setStartTime(v ?? "")} placeholder="Start" />
                </View>
                <View style={s.timeCol}>
                  <Text style={s.label}>End</Text>
                  <TimeField value={endTime || null} onChange={(v) => setEndTime(v ?? "")} placeholder="End" />
                </View>
              </View>
            ) : null}

            {/* Location */}
            <Text style={s.label}>Location (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="Studio / venue"
              placeholderTextColor={C.t3}
              value={location}
              onChangeText={setLocation}
            />

            {/* Cost */}
            {showCost ? (
              <>
                <Text style={s.label}>Cost {currencySymbol()} (optional)</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 70"
                  placeholderTextColor={C.t3}
                  keyboardType="decimal-pad"
                  value={cost}
                  onChangeText={setCost}
                />
              </>
            ) : null}

            {/* Paid by — Add mode + hasPartner + cost */}
            {mode === "add" && hasPartner && showCost && cost ? (
              <>
                <Text style={s.label}>Paid by</Text>
                <View style={s.toggleRow}>
                  <PressableScale
                    onPress={() => setPaidBy("ME")}
                    style={[s.toggleBtn, paidBy === "ME" && s.toggleBtnActive]}
                  >
                    <Text style={[s.toggleBtnText, paidBy === "ME" && s.toggleBtnTextActive]}>Me</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={() => setPaidBy("PARTNER")}
                    style={[s.toggleBtn, paidBy === "PARTNER" && s.toggleBtnActive]}
                  >
                    <Text style={[s.toggleBtnText, paidBy === "PARTNER" && s.toggleBtnTextActive]}>
                      {partnerName}
                    </Text>
                  </PressableScale>
                </View>
              </>
            ) : null}

            {/* Sync to partner calendar — Add mode + hasPartner */}
            {mode === "add" && hasPartner ? (
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Add to {partnerName}'s calendar</Text>
                </View>
                <Switch
                  value={coupleEntry}
                  onValueChange={setCoupleEntry}
                  trackColor={{ true: C.accent, false: C.elevated }}
                  thumbColor="#fff"
                />
              </View>
            ) : null}

            {/* Notes */}
            <Text style={s.label}>Notes (optional)</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              placeholder="Anything to remember"
              placeholderTextColor={C.t3}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Link to project — Add mode only */}
            {mode === "add" && projects.length > 0 ? (
              <>
                <Text style={s.label}>Link to project (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                  <View style={s.chipRow}>
                    <PressableScale
                      onPress={() => setEventId(null)}
                      style={[s.chip, eventId === null && s.chipActive]}
                    >
                      <Text style={[s.chipText, eventId === null && s.chipTextActive]}>None</Text>
                    </PressableScale>
                    {projects.map((p) => {
                      const active = p.id === eventId;
                      return (
                        <PressableScale
                          key={p.id}
                          onPress={() => setEventId(p.id)}
                          style={[s.chip, active && s.chipActive]}
                        >
                          <Text style={[s.chipText, active && s.chipTextActive]}>{p.title}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : null}

            {/* Submit */}
            <PressableScale style={s.submitBtn} onPress={submit} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>
                    {mode === "proposal"
                      ? "Send Proposal ↗"
                      : initial ? "Save changes" : "Add session"}
                  </Text>
              }
            </PressableScale>

            {initial && onDelete ? (
              <PressableScale
                style={s.deleteBtn}
                onPress={async () => {
                  setSubmitting(true);
                  try { await onDelete(); onClose(); }
                  finally { setSubmitting(false); }
                }}
              >
                <Text style={s.deleteBtnText}>Delete session</Text>
              </PressableScale>
            ) : (
              <View style={{ height: 32 }} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: C.border,
    borderBottomWidth: 0,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: C.elevated,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { color: C.t1, fontSize: 20, fontWeight: "700" },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: 10,
    backgroundColor: C.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: C.t2, fontSize: 16 },
  // Mode toggle
  modeRow: {
    flexDirection: "row",
    backgroundColor: C.elevated,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  modeBtnActive: { backgroundColor: C.card },
  modeBtnText: { color: C.t3, fontWeight: "600", fontSize: 13 },
  modeBtnTextActive: { color: C.t1 },
  proposalHint: {
    backgroundColor: C.accentFade,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  proposalHintText: { color: C.accent, fontSize: 13, lineHeight: 18 },
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: "#fca5a5", fontSize: 13 },
  label: { color: C.t2, fontSize: 13, fontWeight: "500", marginBottom: 8 },
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
  notesInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  datePicker: { marginBottom: 16 },
  chipScroll: { marginBottom: 16 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  chipText: { color: C.t2, fontSize: 13 },
  chipTextActive: { color: C.accent, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  timeRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  timeCol: { flex: 1 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  toggleBtnText: { color: C.t2, fontWeight: "600", fontSize: 14 },
  toggleBtnTextActive: { color: C.accent },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  deleteBtn: { paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  deleteBtnText: { color: C.red, fontWeight: "600", fontSize: 15 },
  });
}
