import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator, Modal, ScrollView, Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useChatStore } from "../../store/useChatStore";
import { usePartnerStore } from "../../store/usePartnerStore";
import { useAuthStore } from "../../store/useAuthStore";
import PressableScale from "../../components/ui/PressableScale";
import { formatMoney } from "../../lib/display";
import { ApiError } from "../../lib/api";
import type { Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import type { ChatMessage, Proposal, ProposalType } from "../../lib/types";

const PROPOSAL_TYPES: { type: ProposalType; icon: string; label: string }[] = [
  { type: "TRAINING", icon: "💃", label: "Training" },
  { type: "HOTEL", icon: "🏨", label: "Hotel" },
  { type: "TOURNAMENT", icon: "🏆", label: "Tournament" },
  { type: "TRANSPORT", icon: "✈️", label: "Transport" },
  { type: "OTHER", icon: "📌", label: "Other" },
];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const myId = useAuthStore((st) => st.user?.id);

  const { messages, loading, fetch, send, markRead } = useChatStore();
  const { couple, proposals, fetchProposals, respondProposal } = usePartnerStore();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useFocusEffect(useCallback(() => {
    fetch();
    fetchProposals();
    markRead();
  }, []));

  useEffect(() => {
    // Re-mark read whenever new messages arrive while we're on screen.
    if (messages.length) markRead();
  }, [messages.length]);

  const proposalById = useMemo(() => {
    const m = new Map<string, Proposal>();
    for (const p of proposals) m.set(p.id, p);
    return m;
  }, [proposals]);

  const data = useMemo(() => [...messages].reverse(), [messages]); // inverted list

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setSending(true);
    try {
      await send(text);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const onRespond = async (id: string, action: "APPROVE" | "DECLINE") => {
    try {
      await respondProposal(id, action);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not respond");
    }
  };

  if (!couple) {
    return (
      <View style={[s.screen, s.center]}>
        <Text style={{ fontSize: 36 }}>💬</Text>
        <Text style={s.emptyText}>Connect with a partner to start chatting.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.kind === "SYSTEM") {
      return (
        <View style={s.systemRow}>
          <Text style={s.systemText}>{item.body}</Text>
          <Text style={s.systemTime}>{timeLabel(item.createdAt)}</Text>
        </View>
      );
    }

    const mine = item.authorId === myId;
    const authorName = item.author ? item.author.firstName : "";

    if (item.kind === "PROPOSAL") {
      const p = item.proposalId ? proposalById.get(item.proposalId) : undefined;
      const status = p?.status ?? "PENDING";
      const canRespond = p && status === "PENDING" && p.senderId !== myId;
      const statusColor = status === "APPROVED" ? C.accent : status === "DECLINED" ? C.red : C.gold;
      return (
        <View style={[s.bubbleRow, mine ? s.rowRight : s.rowLeft]}>
          <View style={[s.proposalCard, mine && { borderColor: C.accentBorder }]}>
            <View style={s.proposalHead}>
              <Text style={s.proposalIcon}>📌</Text>
              <Text style={s.proposalTitle} numberOfLines={2}>{p?.title ?? item.body.replace(/^Proposal:\s*/, "")}</Text>
            </View>
            <View style={s.proposalMetaRow}>
              {p?.cost ? <Text style={s.proposalCost}>{formatMoney(p.cost)}</Text> : null}
              <Text style={[s.proposalStatus, { color: statusColor }]}>{status}</Text>
            </View>
            {canRespond ? (
              <View style={s.proposalActions}>
                <PressableScale onPress={() => onRespond(p!.id, "APPROVE")} style={[s.pBtn, { backgroundColor: C.accent }]}>
                  <Text style={s.pBtnText}>✓ Accept</Text>
                </PressableScale>
                <PressableScale onPress={() => onRespond(p!.id, "DECLINE")} style={[s.pBtn, s.pBtnGhost]}>
                  <Text style={[s.pBtnText, { color: C.t2 }]}>✕ Decline</Text>
                </PressableScale>
              </View>
            ) : null}
            <Text style={s.bubbleTime}>{authorName ? `${authorName} · ` : ""}{timeLabel(item.createdAt)}</Text>
          </View>
        </View>
      );
    }

    // TEXT
    return (
      <View style={[s.bubbleRow, mine ? s.rowRight : s.rowLeft]}>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
          {!mine && authorName ? <Text style={s.bubbleAuthor}>{authorName}</Text> : null}
          <Text style={[s.bubbleText, mine && { color: "#fff" }]}>{item.body}</Text>
          <Text style={[s.bubbleTime, mine && { color: "rgba(255,255,255,0.7)" }]}>{timeLabel(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {loading && messages.length === 0 ? (
        <View style={[s.center, { flex: 1 }]}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, gap: 8 }}
          ListEmptyComponent={
            <View style={[s.center, { paddingTop: 80, transform: [{ scaleY: -1 }] }]}>
              <Text style={{ fontSize: 30 }}>👋</Text>
              <Text style={s.emptyText}>No messages yet. Say hi, or share a proposal.</Text>
            </View>
          }
        />
      )}

      <View style={s.composer}>
        <PressableScale onPress={() => setProposalOpen(true)} style={s.plusBtn}>
          <Text style={s.plusText}>＋</Text>
        </PressableScale>
        <TextInput
          style={s.input}
          placeholder="Message…"
          placeholderTextColor={C.t3}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <PressableScale onPress={onSend} disabled={sending || !draft.trim()} style={[s.sendBtn, !draft.trim() && { opacity: 0.5 }]}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendText}>➤</Text>}
        </PressableScale>
      </View>

      <NewProposalModal visible={proposalOpen} onClose={() => setProposalOpen(false)} />
    </KeyboardAvoidingView>
  );
}

// ─── Compact proposal composer (posts into the chat feed) ─────────────────────
function NewProposalModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProposalType>("TRAINING");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => { setTitle(""); setType("TRAINING"); setCost(""); setError(null); onClose(); };

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Add a title"); return; }
    const costNum = cost ? Number(cost.replace(",", ".")) : null;
    if (cost && (!costNum || costNum <= 0)) { setError("Invalid cost"); return; }
    setSubmitting(true);
    try {
      await usePartnerStore.getState().createProposal({ title: title.trim(), type, cost: costNum });
      await useChatStore.getState().fetch();
      close();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New proposal</Text>
              <PressableScale onPress={close} style={s.closeBtn}><Text style={s.closeBtnText}>✕</Text></PressableScale>
            </View>
            {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput style={s.mInput} placeholder="e.g. Individual lesson" placeholderTextColor={C.t3} value={title} onChangeText={setTitle} />
            <Text style={s.fieldLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PROPOSAL_TYPES.map(({ type: t, icon, label }) => {
                  const active = t === type;
                  return (
                    <PressableScale key={t} onPress={() => setType(t)} style={[s.typeChip, active && s.typeChipActive]}>
                      <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{icon} {label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={s.fieldLabel}>Cost (optional)</Text>
            <TextInput style={s.mInput} placeholder="0" placeholderTextColor={C.t3} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
            <PressableScale onPress={submit} disabled={submitting} style={s.submitBtn}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Send to chat</Text>}
            </PressableScale>
            <View style={{ height: 28 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: "center", justifyContent: "center", gap: 10 },
    emptyText: { color: C.t3, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },

    systemRow: { alignSelf: "center", alignItems: "center", maxWidth: "90%", backgroundColor: C.elevated, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
    systemText: { color: C.t2, fontSize: 12, textAlign: "center" },
    systemTime: { color: C.t3, fontSize: 10, marginTop: 2 },

    bubbleRow: { flexDirection: "row" },
    rowLeft: { justifyContent: "flex-start" },
    rowRight: { justifyContent: "flex-end" },
    bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
    bubbleMine: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
    bubbleAuthor: { color: C.accent, fontSize: 11, fontWeight: "700", marginBottom: 2 },
    bubbleText: { color: C.t1, fontSize: 15, lineHeight: 20 },
    bubbleTime: { color: C.t3, fontSize: 10, marginTop: 4, alignSelf: "flex-end" },

    proposalCard: { maxWidth: "82%", backgroundColor: C.card, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: C.gold + "55" },
    proposalHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    proposalIcon: { fontSize: 16 },
    proposalTitle: { flex: 1, color: C.t1, fontSize: 15, fontWeight: "700" },
    proposalMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    proposalCost: { color: C.accent, fontSize: 15, fontWeight: "800" },
    proposalStatus: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
    proposalActions: { flexDirection: "row", gap: 8, marginTop: 12 },
    pBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
    pBtnGhost: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border },
    pBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

    composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },
    plusBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
    plusText: { color: C.accent, fontSize: 22, fontWeight: "700", marginTop: -2 },
    input: { flex: 1, maxHeight: 120, minHeight: 40, backgroundColor: C.elevated, color: C.t1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15, borderWidth: 1, borderColor: C.border },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
    sendText: { color: "#fff", fontSize: 18, fontWeight: "700" },

    modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
    modalSheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "88%", borderWidth: 1, borderColor: C.border, borderBottomWidth: 0 },
    modalHandle: { width: 36, height: 4, backgroundColor: C.elevated, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
    modalTitle: { color: C.t1, fontSize: 20, fontWeight: "700" },
    closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
    closeBtnText: { color: C.t2, fontSize: 16 },
    fieldLabel: { color: C.t2, fontSize: 13, fontWeight: "500", marginBottom: 8 },
    mInput: { backgroundColor: C.elevated, color: C.t1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
    typeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border },
    typeChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
    typeChipText: { color: C.t2, fontSize: 14 },
    typeChipTextActive: { color: C.accent, fontWeight: "600" },
    submitBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
    submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    errorBox: { backgroundColor: C.redFade, borderWidth: 1, borderColor: C.red, borderRadius: 12, padding: 12, marginBottom: 14 },
    errorText: { color: "#fca5a5", fontSize: 13 },
  });
}
