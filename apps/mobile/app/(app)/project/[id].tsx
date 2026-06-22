import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { Stack, useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useProjectStore, type CreateProjectInput } from "../../../store/useProjectStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import {
  EVENT_TYPE_META,
  EVENT_TYPE_ORDER,
  CATEGORY_META,
  CATEGORY_ORDER,
  formatDate,
  formatMoney,
} from "../../../lib/display";
import type { Attachment, Category, ChecklistItem, Expense, EventType, Project } from "../../../lib/types";
import { ApiError } from "../../../lib/api";
import { DateField } from "../../../components/DateTimeField";
import ExpenseFormModal from "../../../components/ExpenseFormModal";
import CategoryDonut, { type DonutSlice } from "../../../components/CategoryDonut";
import PressableScale from "../../../components/ui/PressableScale";
import { C } from "../../../lib/theme";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    current, loading, fetchProject, deleteProject, updateProject,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    uploadAttachment, deleteAttachment, createProjectExpense, updateProjectExpense,
  } = useProjectStore();

  const { couple, createProposal } = usePartnerStore();
  const [newItem, setNewItem] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<Category | null>(null);
  const [expenseModal, setExpenseModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editModal, setEditModal] = useState(false);

  useFocusEffect(useCallback(() => { if (id) fetchProject(id); }, [id, fetchProject]));

  const project = current && current.id === id ? current : null;

  if (loading && !project) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }
  if (!project) {
    return (
      <View style={styles.center}>
        <Text style={{ color: C.t2 }}>Project not found.</Text>
      </View>
    );
  }

  const meta = EVENT_TYPE_META[project.type] ?? EVENT_TYPE_META.TOURNAMENT;
  const expenses = project.expenses ?? [];
  const spent = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const planned = expenses.filter((e) => e.status === "PLANNED").reduce((s, e) => s + e.amount, 0);

  const byCategory: Partial<Record<Category, number>> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  const presentCategories = CATEGORY_ORDER.filter((c) => byCategory[c] != null);
  const visibleExpenses = filterCat ? expenses.filter((e) => e.category === filterCat) : expenses;
  const donutData: DonutSlice[] = presentCategories.map((c) => ({
    key: c,
    value: byCategory[c] ?? 0,
    color: CATEGORY_META[c].hex,
  }));

  const onAddItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    await addChecklistItem(project.id, text);
  };

  const onPickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      await uploadAttachment(project.id,
        { uri: asset.uri, name: asset.name ?? "upload", mimeType: asset.mimeType ?? "application/octet-stream" },
        asset.name ?? "Attachment"
      );
    } catch (e) {
      Alert.alert("Upload failed", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setUploading(false);
    }
  };

  const onDeleteProject = () => {
    const doDelete = async () => { await deleteProject(project.id); router.back(); };
    if (Platform.OS === "web") { doDelete(); return; }
    Alert.alert("Delete event", "This removes the event and its attachments.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: project.title,
          headerRight: () => (
            <PressableScale onPress={() => setEditModal(true)} hitSlop={10} style={{ marginRight: 14 }}>
              <Text style={{ color: C.accent, fontSize: 15, fontWeight: "600" }}>Edit</Text>
            </PressableScale>
          ),
        }}
      />

      {/* Hero header */}
      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.hero}>
        <View style={styles.heroIconWrapper}>
          <Text style={styles.heroIcon}>{meta.icon}</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroTitle}>{project.title}</Text>
          <Text style={styles.heroMeta}>
            {meta.label} · {formatDate(project.date)}
            {project.endDate ? ` – ${formatDate(project.endDate)}` : ""}
          </Text>
          {project.location ? (
            <Text style={styles.heroLocation}>📍 {project.location}</Text>
          ) : null}
        </View>
      </Animated.View>

      {/* Budget summary */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.budgetRow}>
        <BudgetStat label="Budget" value={project.budget != null ? formatMoney(project.budget) : "—"} />
        <View style={styles.budgetDivider} />
        <BudgetStat label="Planned" value={formatMoney(planned)} gold />
        <View style={styles.budgetDivider} />
        <BudgetStat label="Paid" value={formatMoney(spent)} />
      </Animated.View>

      {/* Hotel */}
      {project.hotelName || project.hotelAddress || project.checkIn ? (
        <Section title="🏨  Hotel booking" delay={100}>
          {project.hotelName ? <Text style={styles.hotelName}>{project.hotelName}</Text> : null}
          {project.hotelAddress ? <Text style={styles.hotelAddr}>{project.hotelAddress}</Text> : null}
          {project.checkIn ? (
            <Text style={styles.hotelDates}>
              Check-in {formatDate(project.checkIn)}
              {project.checkOut ? ` · Check-out ${formatDate(project.checkOut)}` : ""}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {/* Checklist */}
      <Section title="✅  Prep checklist" delay={130}>
        <View style={styles.addItemRow}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Add a task…"
            placeholderTextColor={C.t3}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={onAddItem}
            returnKeyType="done"
          />
          <PressableScale onPress={onAddItem} style={styles.addItemBtn}>
            <Text style={styles.addItemBtnText}>Add</Text>
          </PressableScale>
        </View>
        {(project.checklist ?? []).length === 0 ? (
          <Text style={styles.emptyHint}>No tasks yet.</Text>
        ) : (
          (project.checklist ?? []).map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={() => toggleChecklistItem(project.id, item.id, !item.isDone)}
              onDelete={() => deleteChecklistItem(project.id, item.id)}
            />
          ))
        )}
      </Section>

      {/* Attachments */}
      <Section title="📎  Attachments" delay={160}>
        <PressableScale
          onPress={onPickFile}
          disabled={uploading}
          style={styles.uploadBtn}
        >
          <Text style={styles.uploadBtnText}>
            {uploading ? "Uploading…" : "+ Upload PDF / image"}
          </Text>
        </PressableScale>
        {(project.attachments ?? []).length === 0 ? (
          <Text style={styles.emptyHint}>No files attached yet.</Text>
        ) : (
          (project.attachments ?? []).map((att) => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              onOpen={() => Linking.openURL(att.fileUrl)}
              onDelete={() => deleteAttachment(project.id, att.id)}
            />
          ))
        )}
      </Section>

      {/* Add expense */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <PressableScale onPress={() => setExpenseModal(true)} style={styles.addExpenseBtn}>
          <Text style={styles.addExpenseBtnText}>+ Add expense to this event</Text>
        </PressableScale>
      </Animated.View>

      {/* Analytics */}
      <Section title="📊  Analytics" delay={220}>
        {presentCategories.length === 0 ? (
          <Text style={styles.emptyHint}>
            No costs yet. Add hotel, tickets, registration, food expenses to see analytics.
          </Text>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <CategoryDonut data={donutData} centerLabel="Total" />
            </View>
            <View style={styles.catGrid}>
              {presentCategories.map((c) => {
                const m = CATEGORY_META[c];
                const active = filterCat === c;
                return (
                  <PressableScale
                    key={c}
                    onPress={() => setFilterCat(active ? null : c)}
                    style={[styles.catChip, active && styles.catChipActive]}
                  >
                    <Text style={styles.catChipLabel} numberOfLines={1}>{m.icon} {m.label}</Text>
                    <Text style={styles.catChipAmount}>{formatMoney(byCategory[c] ?? 0)}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}
      </Section>

      {/* Linked expenses */}
      <Section
        title={filterCat ? `💶  ${CATEGORY_META[filterCat].label} expenses` : "💶  Linked expenses"}
        delay={250}
      >
        {filterCat ? (
          <PressableScale onPress={() => setFilterCat(null)} style={{ marginBottom: 10 }}>
            <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>← Show all</Text>
          </PressableScale>
        ) : null}
        {visibleExpenses.length === 0 ? (
          <Text style={styles.emptyHint}>No expenses linked to this event.</Text>
        ) : (
          visibleExpenses.map((e) => (
            <PressableScale key={e.id} onPress={() => setEditExpense(e)} style={styles.expenseLine}>
              <Text style={styles.expenseLineIcon}>{CATEGORY_META[e.category]?.icon ?? "📦"}</Text>
              <Text style={styles.expenseLineName} numberOfLines={1}>
                {e.title || CATEGORY_META[e.category]?.label || e.category}
              </Text>
              <View style={[styles.statusBadge, e.status === "PLANNED" && styles.statusBadgePlanned]}>
                <Text style={[styles.statusBadgeText, e.status === "PLANNED" && styles.statusBadgeTextPlanned]}>
                  {e.status === "PLANNED" ? "Planned" : "Paid"}
                </Text>
              </View>
              <Text style={[styles.expenseLineAmount, e.status === "PLANNED" && { color: C.gold }]}>
                {formatMoney(e.amount)}
              </Text>
            </PressableScale>
          ))
        )}
      </Section>

      <Animated.View entering={FadeInDown.delay(280).duration(400)}>
        <PressableScale onPress={onDeleteProject} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete event</Text>
        </PressableScale>
      </Animated.View>

      <View style={{ height: 32 }} />

      <ExpenseFormModal
        visible={expenseModal}
        onClose={() => setExpenseModal(false)}
        onSubmit={(input) => createProjectExpense(project.id, input)}
        onProposal={couple ? createProposal : undefined}
        hasPartner={!!couple}
        partnerName={couple ? couple.partner.firstName : undefined}
        projects={[]}
        lockedProject={{ id: project.id, title: project.title }}
        defaultCategory="HOTEL"
        hideDate
      />

      <ExpenseFormModal
        visible={!!editExpense}
        onClose={() => setEditExpense(null)}
        initialExpense={editExpense}
        onUpdate={(expenseId, data) => updateProjectExpense(project.id, expenseId, data)}
        projects={[]}
        lockedProject={{ id: project.id, title: project.title }}
        hideDate
      />

      <EditProjectModal
        visible={editModal}
        project={project}
        onClose={() => setEditModal(false)}
        onSave={async (input) => { await updateProject(project.id, input); setEditModal(false); }}
      />
    </ScrollView>
  );
}

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Animated.View>
  );
}

function BudgetStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.budgetStat}>
      <Text style={styles.budgetStatLabel}>{label}</Text>
      <Text style={[styles.budgetStatValue, gold && { color: C.gold }]}>{value}</Text>
    </View>
  );
}

function ChecklistRow({
  item, onToggle, onDelete,
}: { item: ChecklistItem; onToggle: () => void; onDelete: () => void }) {
  return (
    <View style={styles.checkRow}>
      <PressableScale onPress={onToggle} style={styles.checkLeft}>
        <View style={[styles.checkbox, item.isDone && styles.checkboxDone]}>
          {item.isDone ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text> : null}
        </View>
        <Text style={[styles.checkText, item.isDone && styles.checkTextDone]}>{item.text}</Text>
      </PressableScale>
      <PressableScale onPress={onDelete} hitSlop={10}>
        <Text style={styles.checkDelete}>✕</Text>
      </PressableScale>
    </View>
  );
}

function AttachmentRow({
  attachment, onOpen, onDelete,
}: { attachment: Attachment; onOpen: () => void; onDelete: () => void }) {
  const isPdf = attachment.mimeType === "application/pdf";
  return (
    <View style={styles.attachRow}>
      <PressableScale onPress={onOpen} style={styles.attachLeft}>
        <Text style={styles.attachIcon}>{isPdf ? "📄" : "🖼️"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.attachLabel} numberOfLines={1}>{attachment.label}</Text>
          <Text style={styles.attachFile} numberOfLines={1}>{attachment.fileName}</Text>
        </View>
      </PressableScale>
      <PressableScale onPress={onDelete} hitSlop={10}>
        <Text style={styles.checkDelete}>✕</Text>
      </PressableScale>
    </View>
  );
}

function EditProjectModal({
  visible, project, onClose, onSave,
}: {
  visible: boolean;
  project: Project;
  onClose: () => void;
  onSave: (input: Partial<CreateProjectInput>) => Promise<void>;
}) {
  const [title, setTitle] = useState(project.title);
  const [type, setType] = useState<EventType>(project.type);
  const [date, setDate] = useState(project.date.slice(0, 10));
  const [multiDay, setMultiDay] = useState(!!project.endDate);
  const [endDate, setEndDate] = useState(project.endDate ? project.endDate.slice(0, 10) : project.date.slice(0, 10));
  const [location, setLocation] = useState(project.location ?? "");
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Enter a title"); return; }
    const budgetValue = budget ? Number(budget.replace(",", ".")) : null;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        type,
        date: new Date(`${date}T00:00:00.000Z`).toISOString(),
        endDate: multiDay ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : null,
        location: location.trim() || null,
        budget: budgetValue && budgetValue > 0 ? budgetValue : null,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={editStyles.overlay}>
        <View style={editStyles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={editStyles.handle} />
            <View style={editStyles.header}>
              <Text style={editStyles.title}>Edit event</Text>
              <PressableScale onPress={onClose} style={editStyles.closeBtn}>
                <Text style={editStyles.closeBtnText}>✕</Text>
              </PressableScale>
            </View>

            {error ? (
              <View style={editStyles.errorBox}>
                <Text style={editStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={editStyles.label}>Title</Text>
            <TextInput
              style={editStyles.input}
              placeholder="Event title"
              placeholderTextColor={C.t3}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={editStyles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                {EVENT_TYPE_ORDER.map((t) => {
                  const m = EVENT_TYPE_META[t];
                  const active = t === type;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => setType(t)}
                      style={[editStyles.typeChip, active && editStyles.typeChipActive]}
                    >
                      <Text style={[editStyles.typeChipText, active && editStyles.typeChipTextActive]}>
                        {m.icon} {m.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={editStyles.label}>{multiDay ? "Start date" : "Date"}</Text>
            <View style={{ marginBottom: 14 }}>
              <DateField value={date} onChange={setDate} />
            </View>

            <View style={editStyles.switchRow}>
              <Text style={editStyles.label}>Multi-day event</Text>
              <Switch
                value={multiDay}
                onValueChange={(v) => { setMultiDay(v); if (v && endDate < date) setEndDate(date); }}
                trackColor={{ true: C.accent, false: C.elevated }}
                thumbColor="#fff"
              />
            </View>

            {multiDay ? (
              <>
                <Text style={editStyles.label}>End date</Text>
                <View style={{ marginBottom: 14 }}>
                  <DateField value={endDate} onChange={setEndDate} />
                </View>
              </>
            ) : null}

            <Text style={editStyles.label}>Location (optional)</Text>
            <TextInput
              style={editStyles.input}
              placeholder="City, country"
              placeholderTextColor={C.t3}
              value={location}
              onChangeText={setLocation}
            />

            <Text style={editStyles.label}>Budget € (optional)</Text>
            <TextInput
              style={editStyles.input}
              placeholder="e.g. 1200"
              placeholderTextColor={C.t3}
              keyboardType="decimal-pad"
              value={budget}
              onChangeText={setBudget}
            />

            <PressableScale style={editStyles.saveBtn} onPress={submit} disabled={saving}>
              <Text style={editStyles.saveBtnText}>{saving ? "Saving…" : "Save changes"}</Text>
            </PressableScale>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
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
    width: 36, height: 4, backgroundColor: C.elevated, borderRadius: 2,
    alignSelf: "center", marginBottom: 16,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { color: C.t1, fontSize: 20, fontWeight: "700" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.elevated, alignItems: "center", justifyContent: "center",
  },
  closeBtnText: { color: C.t2, fontSize: 16 },
  errorBox: {
    backgroundColor: C.redFade, borderWidth: 1, borderColor: C.red,
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  errorText: { color: "#fca5a5", fontSize: 13 },
  label: { color: C.t2, fontSize: 13, fontWeight: "500", marginBottom: 8 },
  input: {
    backgroundColor: C.elevated, color: C.t1,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: C.elevated,
    borderWidth: 1, borderColor: C.border,
  },
  typeChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  typeChipText: { color: C.t2, fontSize: 14 },
  typeChipTextActive: { color: C.accent, fontWeight: "600" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  heroIcon: { fontSize: 28 },
  heroInfo: { flex: 1, paddingTop: 4 },
  heroTitle: { color: C.t1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  heroMeta: { color: C.t2, fontSize: 14 },
  heroLocation: { color: C.t3, fontSize: 13, marginTop: 3 },
  // Budget row
  budgetRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  budgetStat: { flex: 1, alignItems: 'center' },
  budgetStatLabel: { color: C.t3, fontSize: 11, fontWeight: '500', marginBottom: 5, letterSpacing: 0.3 },
  budgetStatValue: { color: C.t1, fontSize: 16, fontWeight: '700' },
  budgetDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  // Hotel
  hotelName: { color: C.t1, fontWeight: '600', fontSize: 15, marginBottom: 4 },
  hotelAddr: { color: C.t2, fontSize: 14, marginBottom: 4 },
  hotelDates: { color: C.t2, fontSize: 14 },
  // Section
  section: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: { color: C.t1, fontWeight: '700', fontSize: 15, marginBottom: 14 },
  emptyHint: { color: C.t3, fontSize: 14, lineHeight: 20 },
  // Add item
  addItemRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addItemInput: {
    flex: 1,
    backgroundColor: C.elevated,
    color: C.t1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  addItemBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addItemBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Checklist
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  checkLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.t3,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: C.accent, borderColor: C.accent },
  checkText: { color: C.t1, fontSize: 14, flex: 1 },
  checkTextDone: { color: C.t3, textDecorationLine: 'line-through' },
  checkDelete: { color: C.t3, fontSize: 14, marginLeft: 8 },
  // Upload
  uploadBtn: {
    backgroundColor: C.elevated,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  uploadBtnText: { color: C.t1, fontWeight: '600', fontSize: 14 },
  // Attachments
  attachRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  attachLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  attachIcon: { fontSize: 20, marginRight: 12 },
  attachLabel: { color: C.t1, fontSize: 14, marginBottom: 2 },
  attachFile: { color: C.t3, fontSize: 12 },
  // Add expense
  addExpenseBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 14,
  },
  addExpenseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Category grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: {
    width: '47%',
    backgroundColor: C.elevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  catChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  catChipLabel: { color: C.t2, fontSize: 13, marginBottom: 6 },
  catChipAmount: { color: C.t1, fontWeight: '700', fontSize: 17 },
  // Expense line
  expenseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  expenseLineIcon: { fontSize: 16 },
  expenseLineName: { flex: 1, color: C.t2, fontSize: 14 },
  expenseLineAmount: { color: C.t1, fontWeight: '600', fontSize: 14 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.accentFade,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  statusBadgePlanned: {
    backgroundColor: C.goldFade,
    borderColor: C.goldBorder,
  },
  statusBadgeText: { color: C.accent, fontSize: 11, fontWeight: '600' },
  statusBadgeTextPlanned: { color: C.gold },
  // Delete
  deleteBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  deleteBtnText: { color: C.red, fontWeight: '600', fontSize: 15 },
});
