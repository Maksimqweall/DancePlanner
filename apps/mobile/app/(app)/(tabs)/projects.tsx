import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useProjectStore, type CreateProjectInput } from "../../../store/useProjectStore";
import {
  EVENT_TYPE_META,
  EVENT_TYPE_ORDER,
  formatDate,
  formatMoney,
} from "../../../lib/display";
import type { EventType, Project } from "../../../lib/types";
import { ApiError } from "../../../lib/api";

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
    <View className="flex-1 bg-zinc-900">
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl text-white font-bold">Projects</Text>
          <TouchableOpacity
            className="bg-emerald-500 px-4 py-2 rounded-xl"
            onPress={() => setModalOpen(true)}
          >
            <Text className="text-white font-bold">+ New</Text>
          </TouchableOpacity>
        </View>

        {projects.length === 0 ? (
          <Text className="text-zinc-500 text-center mt-10">
            No projects yet. Create a tournament or training camp to organize tickets,
            bookings and a prep checklist.
          </Text>
        ) : (
          projects.map((p) => (
            <ProjectRow key={p.id} project={p} onPress={() => router.push(`/project/${p.id}`)} />
          ))
        )}
        <View className="h-10" />
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

function ProjectRow({ project, onPress }: { project: Project; onPress: () => void }) {
  const meta = EVENT_TYPE_META[project.type] ?? EVENT_TYPE_META.TOURNAMENT;
  const counts = project._count;
  return (
    <TouchableOpacity onPress={onPress} className="bg-zinc-800 rounded-2xl p-4 mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-2">
          <Text className="text-white font-semibold text-lg">
            {meta.icon} {project.title}
          </Text>
          <Text className="text-zinc-400 mt-1">
            {meta.label} · {formatDate(project.date)}
          </Text>
          {project.location ? (
            <Text className="text-zinc-500 mt-0.5">📍 {project.location}</Text>
          ) : null}
        </View>
        {project.budget != null ? (
          <Text className="text-amber-400 font-bold">{formatMoney(project.budget)}</Text>
        ) : null}
      </View>
      {counts ? (
        <View className="flex-row mt-3">
          <Text className="text-zinc-500 text-sm mr-4">📎 {counts.attachments}</Text>
          <Text className="text-zinc-500 text-sm mr-4">✅ {counts.checklist}</Text>
          <Text className="text-zinc-500 text-sm">💶 {counts.expenses}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
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
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setType("TOURNAMENT");
    setDate(todayISO());
    setLocation("");
    setBudget("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Date must be YYYY-MM-DD");
      return;
    }
    const budgetValue = budget ? Number(budget.replace(",", ".")) : null;
    setSubmitting(true);
    try {
      const project = await onCreate({
        title: title.trim(),
        type,
        date: new Date(date).toISOString(),
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
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-zinc-900 rounded-t-3xl p-5 max-h-[90%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl text-white font-bold">New project</Text>
              <TouchableOpacity onPress={close}>
                <Text className="text-zinc-400 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
                <Text className="text-red-300">{error}</Text>
              </View>
            ) : null}

            <Text className="text-zinc-400 mb-1">Title</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="e.g. Vienna Open Championship"
              placeholderTextColor="#71717a"
              value={title}
              onChangeText={setTitle}
            />

            <Text className="text-zinc-400 mb-2">Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {EVENT_TYPE_ORDER.map((t) => {
                const meta = EVENT_TYPE_META[t];
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

            <Text className="text-zinc-400 mb-1">Date</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#71717a"
              value={date}
              onChangeText={setDate}
            />

            <Text className="text-zinc-400 mb-1">Location (optional)</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="City, country"
              placeholderTextColor="#71717a"
              value={location}
              onChangeText={setLocation}
            />

            <Text className="text-zinc-400 mb-1">Budget € (optional)</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="e.g. 1200"
              placeholderTextColor="#71717a"
              keyboardType="decimal-pad"
              value={budget}
              onChangeText={setBudget}
            />

            <TouchableOpacity
              className="bg-emerald-500 rounded-xl py-4 items-center mt-2 mb-6"
              onPress={submit}
              disabled={submitting}
            >
              <Text className="text-white font-bold text-base">
                {submitting ? "Creating…" : "Create project"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
