import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { CATEGORY_META, CATEGORY_ORDER } from "../lib/display";
import type { Category, Expense, ExpenseStatus } from "../lib/types";
import type { CreateExpenseInput } from "../store/useFinanceStore";
import type { CreateProposalInput } from "../store/usePartnerStore";
import { useTemplateStore } from "../store/useTemplateStore";
import { ApiError } from "../lib/api";
import { DateField } from "./DateTimeField";
import PressableScale from "./ui/PressableScale";
import { C } from "../lib/theme";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function categoryToProposalType(category: Category): string {
  switch (category) {
    case "INDIVIDUAL": case "GROUP": case "PRACTICE": case "HALL_RENT": return "TRAINING";
    case "HOTEL": return "HOTEL";
    case "FLIGHT": case "TRANSPORT": return "TRANSPORT";
    case "START_FEE": case "ENTRY_TICKET": case "VISA": return "TOURNAMENT";
    default: return "OTHER";
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (input: CreateExpenseInput) => Promise<void>;
  onUpdate?: (id: string, data: Partial<CreateExpenseInput>) => Promise<void>;
  initialExpense?: Expense | null;
  onProposal?: (input: CreateProposalInput) => Promise<void>;
  projects: { id: string; title: string }[];
  lockedProject?: { id: string; title: string } | null;
  defaultCategory?: Category;
  hasPartner?: boolean;
  partnerName?: string;
  hideDate?: boolean;
}

export default function ExpenseFormModal({
  visible,
  onClose,
  onSubmit,
  onUpdate,
  initialExpense,
  onProposal,
  projects,
  lockedProject,
  defaultCategory = "INDIVIDUAL",
  hasPartner = false,
  partnerName = "Partner",
  hideDate = false,
}: Props) {
  const isEditing = !!initialExpense;
  const { templates, addTemplate, deleteTemplate } = useTemplateStore();
  const [mode, setMode] = useState<"add" | "proposal">("add");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<ExpenseStatus>("PAID");
  const [paidBy, setPaidBy] = useState<"ME" | "PARTNER">("ME");
  const [syncCalendar, setSyncCalendar] = useState(true);
  const [eventId, setEventId] = useState<string | null>(lockedProject?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Template creation inline form state
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [tmplTitle, setTmplTitle] = useState("");
  const [tmplAmount, setTmplAmount] = useState("");
  const [tmplCategory, setTmplCategory] = useState<Category>(defaultCategory);
  const [tmplSaved, setTmplSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode("add");
    setTitle(initialExpense?.title ?? "");
    setAmount(initialExpense ? String(initialExpense.amount) : "");
    setCategory(initialExpense?.category ?? defaultCategory);
    setDate(initialExpense?.date.slice(0, 10) ?? todayISO());
    setStatus(initialExpense?.status ?? "PAID");
    setPaidBy("ME");
    setSyncCalendar(true);
    setEventId(lockedProject?.id ?? null);
    setError(null);
    setCreatingTemplate(false);
    setTmplTitle("");
    setTmplAmount("");
    setTmplCategory(defaultCategory);
    setTmplSaved(false);
  }, [visible, defaultCategory, lockedProject, initialExpense]);

  const applyTemplate = (t: { title: string; amount: number; category: Category }) => {
    setTitle(t.title);
    setAmount(String(t.amount));
    setCategory(t.category);
  };

  const saveNewTemplate = () => {
    const value = Number(tmplAmount.replace(",", "."));
    if (!tmplTitle.trim() || !value || value <= 0) return;
    addTemplate({ title: tmplTitle.trim(), amount: value, category: tmplCategory });
    setTmplTitle("");
    setTmplAmount("");
    setTmplCategory(defaultCategory);
    setCreatingTemplate(false);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setTmplSaved(true);
    savedTimerRef.current = setTimeout(() => setTmplSaved(false), 2000);
  };

  const showPartnerOptions = hasPartner && !!onProposal;

  const submit = async () => {
    setError(null);
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) { setError("Enter a valid amount"); return; }
    if (!hideDate && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Date must be YYYY-MM-DD"); return; }

    setSubmitting(true);
    try {
      if (isEditing && onUpdate) {
        await onUpdate(initialExpense!.id, {
          title: title.trim() || undefined,
          amount: value,
          category,
          status,
        });
      } else if (mode === "proposal" && onProposal) {
        await onProposal({
          title: title.trim() || CATEGORY_META[category].label,
          type: categoryToProposalType(category),
          cost: value,
          details: { date },
        });
      } else if (onSubmit) {
        await onSubmit({
          title: title.trim() || undefined,
          amount: value,
          category,
          date: new Date(`${date}T00:00:00.000Z`).toISOString(),
          status,
          eventId: lockedProject?.id ?? eventId,
          paidBy: hasPartner ? paidBy : undefined,
          syncCalendar,
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
                {isEditing ? "Edit expense" : mode === "proposal" ? "Propose expense" : "New expense"}
              </Text>
              <PressableScale onPress={onClose} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </PressableScale>
            </View>

            {lockedProject ? (
              <Text style={s.lockedHint}>Adding to: {lockedProject.title}</Text>
            ) : null}

            {/* Mode toggle — only when partner is connected and not editing */}
            {showPartnerOptions && !isEditing ? (
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
                  {partnerName} will receive this as a proposal. It's added to both calendars and finance only after they approve.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Templates — only in add mode */}
            {mode === "add" ? (
              <View style={s.templatesSection}>
                <View style={s.templatesSectionHeader}>
                  <Text style={s.templatesSectionTitle}>
                    {tmplSaved ? "✓ Template saved!" : "Templates"}
                  </Text>
                  <PressableScale
                    onPress={() => setCreatingTemplate((v) => !v)}
                    style={s.templateNewBtn}
                  >
                    <Text style={s.templateNewBtnText}>
                      {creatingTemplate ? "Cancel" : "+ New"}
                    </Text>
                  </PressableScale>
                </View>

                {/* Template chips */}
                {templates.length > 0 && !creatingTemplate ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 10 }}
                  >
                    <View style={s.templateChipRow}>
                      {templates.map((t) => (
                        <View key={t.id} style={s.templateChipWrapper}>
                          <PressableScale
                            onPress={() => applyTemplate(t)}
                            style={s.templateChip}
                          >
                            <Text style={s.templateChipIcon}>
                              {CATEGORY_META[t.category].icon}
                            </Text>
                            <View>
                              <Text style={s.templateChipTitle} numberOfLines={1}>
                                {t.title}
                              </Text>
                              <Text style={s.templateChipAmount}>€{t.amount}</Text>
                            </View>
                          </PressableScale>
                          <PressableScale
                            onPress={() => deleteTemplate(t.id)}
                            hitSlop={8}
                            style={s.templateChipX}
                          >
                            <Text style={s.templateChipXText}>✕</Text>
                          </PressableScale>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}

                {templates.length === 0 && !creatingTemplate ? (
                  <Text style={s.templatesEmpty}>
                    No templates yet. Tap "+ New" to create one.
                  </Text>
                ) : null}

                {/* Inline template creation form */}
                {creatingTemplate ? (
                  <View style={s.tmplForm}>
                    <TextInput
                      style={s.tmplInput}
                      placeholder="Template name (e.g. Individual lesson)"
                      placeholderTextColor={C.t3}
                      value={tmplTitle}
                      onChangeText={setTmplTitle}
                    />
                    <TextInput
                      style={s.tmplInput}
                      placeholder="Amount (€)"
                      placeholderTextColor={C.t3}
                      keyboardType="decimal-pad"
                      value={tmplAmount}
                      onChangeText={setTmplAmount}
                    />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 10 }}
                    >
                      <View style={s.chipRow}>
                        {CATEGORY_ORDER.map((c) => {
                          const meta = CATEGORY_META[c];
                          const active = c === tmplCategory;
                          return (
                            <PressableScale
                              key={c}
                              onPress={() => setTmplCategory(c)}
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
                    <PressableScale onPress={saveNewTemplate} style={s.tmplSaveBtn}>
                      <Text style={s.tmplSaveBtnText}>Save template</Text>
                    </PressableScale>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Amount */}
            <Text style={s.label}>Amount (€)</Text>
            <TextInput
              style={s.input}
              placeholder="0"
              placeholderTextColor={C.t3}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            {/* Category */}
            <Text style={s.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              <View style={s.chipRow}>
                {CATEGORY_ORDER.map((c) => {
                  const meta = CATEGORY_META[c];
                  const active = c === category;
                  return (
                    <PressableScale
                      key={c}
                      onPress={() => setCategory(c)}
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
            <Text style={s.label}>Title (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Hotel booking"
              placeholderTextColor={C.t3}
              value={title}
              onChangeText={setTitle}
            />

            {/* Date — hidden when adding to an event or editing */}
            {!hideDate ? (
              <>
                <Text style={s.label}>Date</Text>
                <View style={s.datePicker}>
                  <DateField value={date} onChange={setDate} />
                </View>
              </>
            ) : null}

            {/* Status — only in Add mode */}
            {mode === "add" ? (
              <>
                <Text style={s.label}>Status</Text>
                <View style={s.toggleRow}>
                  {(["PAID", "PLANNED"] as ExpenseStatus[]).map((st) => {
                    const active = st === status;
                    return (
                      <PressableScale
                        key={st}
                        onPress={() => setStatus(st)}
                        style={[s.toggleBtn, active && s.toggleBtnActive]}
                      >
                        <Text style={[s.toggleBtnText, active && s.toggleBtnTextActive]}>
                          {st === "PAID" ? "Paid" : "Planned"}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Paid by — only in Add mode when partner is connected */}
            {mode === "add" && hasPartner ? (
              <>
                <Text style={s.label}>Paid by</Text>
                <View style={s.toggleRow}>
                  <PressableScale
                    onPress={() => setPaidBy("ME")}
                    style={[s.toggleBtn, paidBy === "ME" && s.toggleBtnActive]}
                  >
                    <Text style={[s.toggleBtnText, paidBy === "ME" && s.toggleBtnTextActive]}>
                      Me
                    </Text>
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

            {/* Add to calendar toggle — only in Add mode */}
            {mode === "add" ? (
              <View style={s.switchRow}>
                <Text style={s.label}>Add to calendar</Text>
                <Switch
                  value={syncCalendar}
                  onValueChange={setSyncCalendar}
                  trackColor={{ true: C.accent, false: C.elevated }}
                  thumbColor="#fff"
                />
              </View>
            ) : null}

            {/* Link to project — only in Add mode */}
            {mode === "add" && !lockedProject && projects.length > 0 ? (
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
                    {isEditing ? "Save changes" : mode === "proposal" ? "Send Proposal ↗" : "Save expense"}
                  </Text>
              }
            </PressableScale>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
  lockedHint: { color: C.t3, fontSize: 13, marginBottom: 12 },
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
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: C.card },
  modeBtnText: { color: C.t3, fontWeight: "600", fontSize: 13 },
  modeBtnTextActive: { color: C.t1 },
  // Proposal hint
  proposalHint: {
    backgroundColor: C.accentFade,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  proposalHintText: { color: C.accent, fontSize: 13, lineHeight: 18 },
  // Error
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: "#fca5a5", fontSize: 13 },
  // Form
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
  // Toggle (Status / PaidBy)
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
  // Templates section
  templatesSection: {
    backgroundColor: C.elevated,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  templatesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  templatesSectionTitle: { color: C.t1, fontWeight: "700", fontSize: 13 },
  templateNewBtn: {
    backgroundColor: C.accentFade,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  templateNewBtnText: { color: C.accent, fontWeight: "700", fontSize: 12 },
  templatesEmpty: { color: C.t3, fontSize: 13 },
  templateChipRow: { flexDirection: "row", gap: 8 },
  templateChipWrapper: { position: "relative" },
  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: 160,
  },
  templateChipIcon: { fontSize: 20 },
  templateChipTitle: { color: C.t1, fontSize: 13, fontWeight: "600", maxWidth: 90 },
  templateChipAmount: { color: C.accent, fontSize: 12, fontWeight: "500" },
  templateChipX: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  templateChipXText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  // Inline template creation
  tmplForm: { gap: 8 },
  tmplInput: {
    backgroundColor: C.card,
    color: C.t1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  tmplSaveBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 2,
  },
  tmplSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // Submit
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
});
