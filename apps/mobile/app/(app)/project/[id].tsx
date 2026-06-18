import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useProjectStore } from "../../../store/useProjectStore";
import {
  EVENT_TYPE_META,
  CATEGORY_META,
  CATEGORY_ORDER,
  formatDate,
  formatMoney,
} from "../../../lib/display";
import type { Attachment, Category, ChecklistItem } from "../../../lib/types";
import { ApiError } from "../../../lib/api";
import ExpenseFormModal from "../../../components/ExpenseFormModal";
import CategoryDonut, { type DonutSlice } from "../../../components/CategoryDonut";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    current,
    loading,
    fetchProject,
    deleteProject,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    uploadAttachment,
    deleteAttachment,
    createProjectExpense,
  } = useProjectStore();

  const [newItem, setNewItem] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<Category | null>(null);
  const [expenseModal, setExpenseModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) fetchProject(id);
    }, [id, fetchProject])
  );

  const project = current && current.id === id ? current : null;

  if (loading && !project) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!project) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900">
        <Text className="text-zinc-400">Project not found.</Text>
      </View>
    );
  }

  const meta = EVENT_TYPE_META[project.type] ?? EVENT_TYPE_META.TOURNAMENT;
  const expenses = project.expenses ?? [];
  const spent = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0);
  const planned = expenses.filter((e) => e.status === "PLANNED").reduce((s, e) => s + e.amount, 0);

  // Spend per part (category) for this project.
  const byCategory: Partial<Record<Category, number>> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }
  const presentCategories = CATEGORY_ORDER.filter((c) => byCategory[c] != null);
  const visibleExpenses = filterCat
    ? expenses.filter((e) => e.category === filterCat)
    : expenses;
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
      await uploadAttachment(
        project.id,
        {
          uri: asset.uri,
          name: asset.name ?? "upload",
          mimeType: asset.mimeType ?? "application/octet-stream",
        },
        asset.name ?? "Attachment"
      );
    } catch (e) {
      Alert.alert("Upload failed", e instanceof ApiError ? e.message : "Try again");
    } finally {
      setUploading(false);
    }
  };

  const onDeleteProject = () => {
    const doDelete = async () => {
      await deleteProject(project.id);
      router.back();
    };
    if (Platform.OS === "web") {
      doDelete();
      return;
    }
    Alert.alert("Delete project", "This removes the project and its attachments.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-zinc-900 px-4 pt-4">
      <Stack.Screen options={{ title: project.title }} />

      {/* Header */}
      <Text className="text-2xl text-white font-bold">
        {meta.icon} {project.title}
      </Text>
      <Text className="text-zinc-400 mt-1">
        {meta.label} · {formatDate(project.date)}
        {project.endDate ? ` – ${formatDate(project.endDate)}` : ""}
      </Text>
      {project.location ? (
        <Text className="text-zinc-500 mt-0.5">📍 {project.location}</Text>
      ) : null}

      {/* Budget summary */}
      <View className="bg-zinc-800 rounded-2xl p-4 mt-4 flex-row justify-between">
        <Stat label="Budget" value={project.budget != null ? formatMoney(project.budget) : "—"} />
        <Stat label="Planned" value={formatMoney(planned)} tone="amber" />
        <Stat label="Paid" value={formatMoney(spent)} />
      </View>

      {/* Hotel booking */}
      {project.hotelName || project.hotelAddress || project.checkIn ? (
        <Section title="🏨 Hotel booking">
          {project.hotelName ? (
            <Text className="text-white font-semibold">{project.hotelName}</Text>
          ) : null}
          {project.hotelAddress ? (
            <Text className="text-zinc-400 mt-0.5">{project.hotelAddress}</Text>
          ) : null}
          {project.checkIn ? (
            <Text className="text-zinc-400 mt-1">
              Check-in {formatDate(project.checkIn)}
              {project.checkOut ? ` · Check-out ${formatDate(project.checkOut)}` : ""}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {/* Checklist */}
      <Section title="✅ Prep checklist">
        <View className="flex-row mb-3">
          <TextInput
            className="flex-1 bg-zinc-700 text-white rounded-xl px-4 py-2 mr-2"
            placeholder="Add a task…"
            placeholderTextColor="#a1a1aa"
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={onAddItem}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={onAddItem} className="bg-emerald-500 rounded-xl px-4 justify-center">
            <Text className="text-white font-bold">Add</Text>
          </TouchableOpacity>
        </View>
        {(project.checklist ?? []).length === 0 ? (
          <Text className="text-zinc-500">No tasks yet.</Text>
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
      <Section title="📎 Attachments (tickets, bookings)">
        <TouchableOpacity
          onPress={onPickFile}
          disabled={uploading}
          className="bg-zinc-700 rounded-xl py-3 items-center mb-3"
        >
          <Text className="text-white font-semibold">
            {uploading ? "Uploading…" : "+ Upload PDF / image"}
          </Text>
        </TouchableOpacity>
        {(project.attachments ?? []).length === 0 ? (
          <Text className="text-zinc-500">No files attached yet.</Text>
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

      {/* Add expense directly to this project */}
      <TouchableOpacity
        onPress={() => setExpenseModal(true)}
        className="bg-emerald-500 rounded-2xl py-3 items-center mt-4"
      >
        <Text className="text-white font-bold">+ Add expense to this project</Text>
      </TouchableOpacity>

      {/* Analytics: spend by part */}
      <Section title="📊 Analytics — where the money goes">
        {presentCategories.length === 0 ? (
          <Text className="text-zinc-500">
            No costs yet. Tap “+ Add expense” above (hotel, tickets, registration, food…) or add a
            session with a cost.
          </Text>
        ) : (
          <>
            <View className="items-center mb-4">
              <CategoryDonut data={donutData} centerLabel="Total" />
            </View>
            <View className="flex-row flex-wrap -mx-1">
            {presentCategories.map((c) => {
              const m = CATEGORY_META[c];
              const active = filterCat === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setFilterCat(active ? null : c)}
                  className={`w-1/2 px-1 mb-2`}
                >
                  <View
                    className={`rounded-2xl p-3 ${active ? "bg-emerald-500/20 border border-emerald-500" : "bg-zinc-700/50"}`}
                  >
                    <Text className="text-zinc-300 text-sm" numberOfLines={1}>
                      {m.icon} {m.label}
                    </Text>
                    <Text className="text-white font-bold text-lg mt-1">
                      {formatMoney(byCategory[c] ?? 0)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            </View>
          </>
        )}
      </Section>

      {/* Linked expenses (filtered by selected part) */}
      <Section
        title={
          filterCat
            ? `💶 ${CATEGORY_META[filterCat].label} expenses`
            : "💶 Linked expenses"
        }
      >
        {filterCat ? (
          <TouchableOpacity onPress={() => setFilterCat(null)} className="mb-2">
            <Text className="text-emerald-400">← Show all parts</Text>
          </TouchableOpacity>
        ) : null}
        {visibleExpenses.length === 0 ? (
          <Text className="text-zinc-500">No expenses linked to this project.</Text>
        ) : (
          visibleExpenses.map((e) => (
            <View key={e.id} className="flex-row justify-between py-2 border-b border-zinc-700">
              <View className="flex-row items-center flex-1 pr-2">
                <Text className="mr-2">{CATEGORY_META[e.category]?.icon ?? "📦"}</Text>
                <Text className="text-zinc-200 flex-1" numberOfLines={1}>
                  {e.title || CATEGORY_META[e.category]?.label || e.category}
                </Text>
              </View>
              <Text className={e.status === "PLANNED" ? "text-amber-400" : "text-white"}>
                {formatMoney(e.amount)}
              </Text>
            </View>
          ))
        )}
      </Section>

      <TouchableOpacity onPress={onDeleteProject} className="py-4 items-center mt-2 mb-10">
        <Text className="text-red-400 font-semibold">Delete project</Text>
      </TouchableOpacity>

      <ExpenseFormModal
        visible={expenseModal}
        onClose={() => setExpenseModal(false)}
        onSubmit={(input) => createProjectExpense(project.id, input)}
        projects={[]}
        lockedProject={{ id: project.id, title: project.title }}
        defaultCategory="HOTEL"
      />
    </ScrollView>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-zinc-400 text-xs mb-1">{label}</Text>
      <Text className={`font-bold ${tone === "amber" ? "text-amber-400" : "text-white"}`}>
        {value}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-zinc-800 rounded-2xl p-4 mt-4">
      <Text className="text-white font-semibold text-base mb-3">{title}</Text>
      {children}
    </View>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="flex-row items-center py-2">
      <TouchableOpacity onPress={onToggle} className="flex-row items-center flex-1">
        <View
          className={`w-6 h-6 rounded-md mr-3 items-center justify-center ${item.isDone ? "bg-emerald-500" : "border border-zinc-500"}`}
        >
          {item.isDone ? <Text className="text-white text-xs">✓</Text> : null}
        </View>
        <Text className={item.isDone ? "text-zinc-500 line-through flex-1" : "text-zinc-200 flex-1"}>
          {item.text}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text className="text-zinc-600 ml-2">✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function AttachmentRow({
  attachment,
  onOpen,
  onDelete,
}: {
  attachment: Attachment;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isPdf = attachment.mimeType === "application/pdf";
  return (
    <View className="flex-row items-center py-2 border-b border-zinc-700">
      <TouchableOpacity onPress={onOpen} className="flex-row items-center flex-1">
        <Text className="text-xl mr-3">{isPdf ? "📄" : "🖼️"}</Text>
        <View className="flex-1">
          <Text className="text-zinc-200" numberOfLines={1}>
            {attachment.label}
          </Text>
          <Text className="text-zinc-500 text-xs" numberOfLines={1}>
            {attachment.fileName}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Text className="text-zinc-600 ml-2">✕</Text>
      </TouchableOpacity>
    </View>
  );
}
