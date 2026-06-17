import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useFinanceStore, type CreateExpenseInput } from "../../../store/useFinanceStore";
import { useProjectStore } from "../../../store/useProjectStore";
import TransactionCard from "../../../components/TransactionCard";
import { CATEGORY_META, CATEGORY_ORDER } from "../../../lib/display";
import type { Category, ExpenseStatus } from "../../../lib/types";
import { ApiError } from "../../../lib/api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesScreen() {
  const { expenses, refresh, addExpense, deleteExpense } = useFinanceStore();
  const { projects, refreshProjects } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProjects();
    }, [refresh, refreshProjects])
  );

  const confirmDelete = (id: string) => {
    if (Platform.OS === "web") {
      deleteExpense(id);
      return;
    }
    Alert.alert("Delete expense", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense(id) },
    ]);
  };

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl text-white font-bold">All expenses</Text>
          <TouchableOpacity
            className="bg-emerald-500 px-4 py-2 rounded-xl"
            onPress={() => setModalOpen(true)}
          >
            <Text className="text-white font-bold">+ Add</Text>
          </TouchableOpacity>
        </View>

        {expenses.length === 0 ? (
          <Text className="text-zinc-500 text-center mt-10">
            No expenses yet. Tap “+ Add” to record one.
          </Text>
        ) : (
          expenses.map((tx) => (
            <TransactionCard key={tx.id} expense={tx} onDelete={confirmDelete} />
          ))
        )}
        <View className="h-10" />
      </ScrollView>

      <AddExpenseModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={addExpense}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      />
    </View>
  );
}

function AddExpenseModal({
  visible,
  onClose,
  onSubmit,
  projects,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateExpenseInput) => Promise<void>;
  projects: { id: string; title: string }[];
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("INDIVIDUAL");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<ExpenseStatus>("PAID");
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setAmount("");
    setCategory("INDIVIDUAL");
    setDate(todayISO());
    setStatus("PAID");
    setEventId(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError(null);
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be YYYY-MM-DD");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim() || undefined,
        amount: value,
        category,
        date: new Date(date).toISOString(),
        status,
        eventId,
      });
      close();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-zinc-900 rounded-t-3xl p-5 max-h-[90%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl text-white font-bold">New expense</Text>
              <TouchableOpacity onPress={close}>
                <Text className="text-zinc-400 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
                <Text className="text-red-300">{error}</Text>
              </View>
            ) : null}

            <Text className="text-zinc-400 mb-1">Amount (€)</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4 text-lg"
              placeholder="0"
              placeholderTextColor="#71717a"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text className="text-zinc-400 mb-2">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {CATEGORY_ORDER.map((c) => {
                const meta = CATEGORY_META[c];
                const active = c === category;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`px-3 py-2 rounded-xl mr-2 ${active ? "bg-emerald-500" : "bg-zinc-800"}`}
                  >
                    <Text className={active ? "text-white font-semibold" : "text-zinc-300"}>
                      {meta.icon} {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text className="text-zinc-400 mb-1">Title (optional)</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="e.g. Coach lesson"
              placeholderTextColor="#71717a"
              value={title}
              onChangeText={setTitle}
            />

            <Text className="text-zinc-400 mb-1">Date</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#71717a"
              value={date}
              onChangeText={setDate}
            />

            <Text className="text-zinc-400 mb-2">Status</Text>
            <View className="flex-row mb-4">
              {(["PAID", "PLANNED"] as ExpenseStatus[]).map((s) => {
                const active = s === status;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s)}
                    className={`flex-1 py-3 rounded-xl mr-2 items-center ${active ? "bg-emerald-500" : "bg-zinc-800"}`}
                  >
                    <Text className={active ? "text-white font-semibold" : "text-zinc-300"}>
                      {s === "PAID" ? "Paid" : "Planned"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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
              className="bg-emerald-500 rounded-xl py-4 items-center mt-2 mb-6"
              onPress={submit}
              disabled={submitting}
            >
              <Text className="text-white font-bold text-base">
                {submitting ? "Saving…" : "Save expense"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
