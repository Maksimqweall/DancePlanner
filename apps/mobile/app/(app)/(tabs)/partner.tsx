import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { usePartnerStore, type CreateProposalInput } from "../../../store/usePartnerStore";
import { useAuthStore } from "../../../store/useAuthStore";
import ProposalCard from "../../../components/ProposalCard";
import PressableScale from "../../../components/ui/PressableScale";
import { formatMoney, monthLong } from "../../../lib/display";
import { ApiError } from "../../../lib/api";
import { C } from "../../../lib/theme";
import { DateField } from "../../../components/DateTimeField";
import type { ProposalType } from "../../../lib/types";

// ─── Proposal type metadata ────────────────────────────────────────────────
const PROPOSAL_TYPES: { type: ProposalType; icon: string; label: string }[] = [
  { type: "TRAINING",   icon: "💃", label: "Training" },
  { type: "HOTEL",      icon: "🏨", label: "Hotel" },
  { type: "TOURNAMENT", icon: "🏆", label: "Tournament" },
  { type: "TRANSPORT",  icon: "✈️", label: "Transport" },
  { type: "OTHER",      icon: "📌", label: "Other" },
];

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function PartnerScreen() {
  const myId = useAuthStore((s) => s.user?.id);
  const {
    couple, pendingCount, proposals, split,
    loading, fetchPartner, linkPartner, unlinkPartner,
    fetchProposals, fetchSplit, respondProposal, cancelProposal,
  } = usePartnerStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [connectEmail, setConnectEmail] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [splitPeriod, setSplitPeriod] = useState<"3M" | "6M" | "1Y">("3M");

  const filteredSplit = useMemo(() => {
    if (!split) return null;
    const months = splitPeriod === "3M" ? 3 : splitPeriod === "6M" ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months + 1);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);
    const myExp = split.myExpenses.filter((e) => new Date(e.date) >= cutoff);
    const partnerExp = split.partnerExpenses.filter((e) => new Date(e.date) >= cutoff);
    const myTotal = Math.round(myExp.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const partnerTotal = Math.round(partnerExp.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    return { myTotal, partnerTotal, balance: myTotal - partnerTotal, myExpenses: myExp, partnerExpenses: partnerExp };
  }, [split, splitPeriod]);

  useFocusEffect(
    useCallback(() => {
      fetchPartner();
      fetchProposals();
      if (couple) fetchSplit();
    }, [couple?.id])
  );

  const inbox = proposals.filter((p) => p.senderId !== myId);
  const sent = proposals.filter((p) => p.senderId === myId);
  const displayed = tab === "inbox" ? inbox : sent;

  const onConnect = async () => {
    if (!connectEmail.trim()) return;
    setConnectError(null);
    setConnecting(true);
    try {
      await linkPartner(connectEmail.trim());
      setConnectEmail("");
      await fetchProposals();
    } catch (e) {
      setConnectError(e instanceof ApiError ? e.message : "Could not connect");
    } finally {
      setConnecting(false);
    }
  };

  const onDisconnect = () => {
    if (Platform.OS === "web") { unlinkPartner(); return; }
    Alert.alert("Disconnect partner", "You will no longer share proposals.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => unlinkPartner() },
    ]);
  };

  const onApprove = async (id: string) => {
    try {
      await respondProposal(id, "APPROVE");
      await fetchSplit();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not approve");
    }
  };

  const onDecline = async (id: string) => {
    try {
      await respondProposal(id, "DECLINE");
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Could not decline");
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── No partner ─────────────────────────────────────────────── */}
        {!couple ? (
          <Animated.View entering={FadeInDown.delay(0).duration(450)}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEmoji}>👥</Text>
              <Text style={styles.heroTitle}>Connect your dance partner</Text>
              <Text style={styles.heroSubtitle}>
                Share proposals, sync your calendar, and track expenses together — just like Splitwise for dancers.
              </Text>

              {connectError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{connectError}</Text>
                </View>
              ) : null}

              <TextInput
                style={styles.emailInput}
                placeholder="Partner's email address"
                placeholderTextColor={C.t3}
                autoCapitalize="none"
                keyboardType="email-address"
                value={connectEmail}
                onChangeText={setConnectEmail}
              />
              <PressableScale
                onPress={onConnect}
                disabled={connecting || !connectEmail.trim()}
                style={[styles.connectBtn, (!connectEmail.trim()) && styles.connectBtnDisabled]}
              >
                {connecting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.connectBtnText}>Connect Partner</Text>
                }
              </PressableScale>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* ── Partner connected ────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(0).duration(400)}>
              <View style={styles.partnerCard}>
                <View style={styles.partnerAvatar}>
                  <Text style={styles.partnerAvatarText}>
                    {couple.partner.firstName[0]}{couple.partner.lastName[0]}
                  </Text>
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>
                    {couple.partner.firstName} {couple.partner.lastName}
                  </Text>
                  <Text style={styles.partnerEmail}>{couple.partner.email}</Text>
                  <View style={styles.connectedBadge}>
                    <View style={styles.connectedDot} />
                    <Text style={styles.connectedText}>Connected</Text>
                  </View>
                </View>
                <PressableScale onPress={onDisconnect} style={styles.disconnectBtn}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </PressableScale>
              </View>
            </Animated.View>

            {/* ── Split view ───────────────────────────────────────────── */}
            {split && filteredSplit ? (
              <Animated.View entering={FadeInDown.delay(60).duration(400)}>
                {/* Header + period selector */}
                <View style={styles.splitHeader}>
                  <Text style={styles.sectionLabel}>EXPENSE SPLIT</Text>
                  <View style={styles.splitPeriodRow}>
                    {(["3M", "6M", "1Y"] as const).map((p) => (
                      <PressableScale
                        key={p}
                        onPress={() => setSplitPeriod(p)}
                        style={[styles.splitPeriodBtn, splitPeriod === p && styles.splitPeriodBtnActive]}
                      >
                        <Text style={[styles.splitPeriodText, splitPeriod === p && styles.splitPeriodTextActive]}>
                          {p}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>

                {/* Period totals */}
                <View style={styles.splitCard}>
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>You</Text>
                    <Text style={styles.splitAmount}>{formatMoney(filteredSplit.myTotal)}</Text>
                  </View>
                  <View style={styles.splitDivider} />
                  <View style={styles.splitCol}>
                    <Text style={styles.splitLabel}>{couple.partner.firstName}</Text>
                    <Text style={styles.splitAmount}>{formatMoney(filteredSplit.partnerTotal)}</Text>
                  </View>
                </View>

                <BalanceBanner balance={filteredSplit.balance} partnerName={couple.partner.firstName} />

                {/* Monthly breakdown */}
                <MonthlySplit
                  myExpenses={filteredSplit.myExpenses}
                  partnerExpenses={filteredSplit.partnerExpenses}
                  partnerName={couple.partner.firstName}
                />
              </Animated.View>
            ) : null}

            {/* ── Proposals tab bar ────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(110).duration(400)}>
              <View style={styles.tabRow}>
                <PressableScale
                  onPress={() => setTab("inbox")}
                  style={[styles.tabBtn, tab === "inbox" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, tab === "inbox" && styles.tabBtnTextActive]}>
                    Inbox {pendingCount > 0 ? `(${pendingCount})` : ""}
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={() => setTab("sent")}
                  style={[styles.tabBtn, tab === "sent" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, tab === "sent" && styles.tabBtnTextActive]}>
                    Sent
                  </Text>
                </PressableScale>
              </View>
            </Animated.View>

            {displayed.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(150).duration(400)}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {tab === "inbox"
                      ? "No proposals received yet. Ask your partner to send one!"
                      : "You haven't sent any proposals yet. Use the + button below."}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              displayed.map((p, i) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  isMine={p.senderId === myId}
                  index={i}
                  onApprove={p.senderId !== myId ? () => onApprove(p.id) : undefined}
                  onDecline={p.senderId !== myId ? () => onDecline(p.id) : undefined}
                  onCancel={p.senderId === myId && p.status === "PENDING" ? () => cancelProposal(p.id) : undefined}
                />
              ))
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      {couple ? (
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.fab}>
          <PressableScale onPress={() => setModalOpen(true)} style={styles.fabBtn} scaleTo={0.94}>
            <Text style={styles.fabText}>+ New Proposal</Text>
          </PressableScale>
        </Animated.View>
      ) : null}

      <NewProposalModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={async (input) => {
          await usePartnerStore.getState().createProposal(input);
          setModalOpen(false);
          setTab("sent");
        }}
      />
    </View>
  );
}

// ─── Monthly Split ───────────────────────────────────────────────────────────
interface MonthRow { month: string; myTotal: number; partnerTotal: number }

function groupByMonth(
  myExpenses: { date: string; amount: number }[],
  partnerExpenses: { date: string; amount: number }[],
): MonthRow[] {
  const map = new Map<string, MonthRow>();
  const add = (expenses: { date: string; amount: number }[], key: "myTotal" | "partnerTotal") => {
    for (const e of expenses) {
      const m = e.date.slice(0, 7);
      const row = map.get(m) ?? { month: m, myTotal: 0, partnerTotal: 0 };
      row[key] = Math.round((row[key] + e.amount) * 100) / 100;
      map.set(m, row);
    }
  };
  add(myExpenses, "myTotal");
  add(partnerExpenses, "partnerTotal");
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function MonthlySplit({
  myExpenses,
  partnerExpenses,
  partnerName,
}: {
  myExpenses: { date: string; amount: number }[];
  partnerExpenses: { date: string; amount: number }[];
  partnerName: string;
}) {
  const rows = groupByMonth(myExpenses, partnerExpenses);
  if (rows.length === 0) return null;

  return (
    <View style={styles.monthlyBlock}>
      <Text style={styles.sectionLabel}>BY MONTH</Text>
      {rows.map((row) => {
        const myMore = row.myTotal >= row.partnerTotal;
        return (
          <View key={row.month} style={styles.monthRow}>
            <Text style={styles.monthRowLabel}>{monthLong(row.month)}</Text>
            <View style={styles.monthRowAmounts}>
              <View style={styles.monthRowCol}>
                <Text style={styles.monthRowWho}>You</Text>
                <Text style={[styles.monthRowAmt, myMore && styles.monthRowAmtBold]}>
                  {formatMoney(row.myTotal)}
                </Text>
              </View>
              <View style={styles.monthRowDivider} />
              <View style={styles.monthRowCol}>
                <Text style={styles.monthRowWho}>{partnerName}</Text>
                <Text style={[styles.monthRowAmt, !myMore && styles.monthRowAmtBold]}>
                  {formatMoney(row.partnerTotal)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Balance Banner ─────────────────────────────────────────────────────────
function BalanceBanner({ balance, partnerName }: { balance: number; partnerName: string }) {
  if (balance === 0) return null;
  const owes = balance > 0
    ? `${partnerName} owes you ${formatMoney(Math.abs(balance))}`
    : `You owe ${partnerName} ${formatMoney(Math.abs(balance))}`;
  const positive = balance > 0;

  return (
    <View style={[styles.balanceBanner, positive ? styles.balanceBannerPositive : styles.balanceBannerNegative]}>
      <Text style={[styles.balanceText, { color: positive ? C.accent : C.gold }]}>{owes}</Text>
    </View>
  );
}

// ─── New Proposal Modal ──────────────────────────────────────────────────────
function NewProposalModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: CreateProposalInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProposalType>("TRAINING");
  const [cost, setCost] = useState("");
  const [hasDate, setHasDate] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle(""); setType("TRAINING"); setCost(""); setHasDate(false);
    setDate(new Date().toISOString().slice(0, 10));
    setLocation(""); setNotes(""); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Enter a title"); return; }
    const costNum = cost ? Number(cost.replace(",", ".")) : null;
    if (cost && (!costNum || costNum <= 0)) { setError("Enter a valid cost"); return; }

    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        type,
        cost: costNum,
        details: {
          date: hasDate ? date : undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Proposal</Text>
              <PressableScale onPress={close} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </PressableScale>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>What are you proposing?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Book a lesson with Coach Anna"
              placeholderTextColor={C.t3}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PROPOSAL_TYPES.map(({ type: t, icon, label }) => {
                  const active = t === type;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => setType(t)}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {icon} {label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Cost (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 150"
              placeholderTextColor={C.t3}
              keyboardType="decimal-pad"
              value={cost}
              onChangeText={setCost}
            />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Has a date</Text>
              <Switch
                value={hasDate}
                onValueChange={setHasDate}
                trackColor={{ true: C.accent, false: C.elevated }}
                thumbColor="#fff"
              />
            </View>

            {hasDate ? (
              <>
                <Text style={styles.fieldLabel}>Date</Text>
                <View style={{ marginBottom: 16 }}>
                  <DateField value={date} onChange={setDate} />
                </View>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>Location (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Vienna Sports Center"
              placeholderTextColor={C.t3}
              value={location}
              onChangeText={setLocation}
            />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Any extra details…"
              placeholderTextColor={C.t3}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            <PressableScale onPress={submit} disabled={submitting} style={styles.submitBtn}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Send Proposal ↗</Text>
              }
            </PressableScale>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  // Hero (no partner)
  heroCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  heroEmoji: { fontSize: 48, marginBottom: 16 },
  heroTitle: { color: C.t1, fontSize: 22, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  heroSubtitle: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emailInput: {
    width: "100%",
    backgroundColor: C.elevated,
    color: C.t1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  connectBtn: {
    width: "100%",
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Partner card
  partnerCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  partnerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: C.accentFade,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  partnerAvatarText: { color: C.accent, fontWeight: "800", fontSize: 18 },
  partnerInfo: { flex: 1 },
  partnerName: { color: C.t1, fontWeight: "700", fontSize: 16, marginBottom: 2 },
  partnerEmail: { color: C.t2, fontSize: 13 },
  connectedBadge: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: 5 },
  connectedText: { color: C.accent, fontSize: 12, fontWeight: "600" },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  disconnectText: { color: C.t3, fontSize: 12 },
  // Split
  sectionLabel: {
    color: C.t3,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 0,
    marginTop: 4,
  },
  // Split header with period picker
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  splitPeriodRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  splitPeriodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  splitPeriodBtnActive: { backgroundColor: C.elevated },
  splitPeriodText: { color: C.t3, fontWeight: "600", fontSize: 12 },
  splitPeriodTextActive: { color: C.t1 },
  splitCard: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  splitCol: { flex: 1, alignItems: "center" },
  splitDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  splitLabel: { color: C.t2, fontSize: 12, fontWeight: "500", marginBottom: 6 },
  splitAmount: { color: C.t1, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  balanceBanner: {
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  balanceBannerPositive: { backgroundColor: C.accentFade },
  balanceBannerNegative: { backgroundColor: C.goldFade },
  balanceText: { fontWeight: "700", fontSize: 14 },
  // Monthly split
  monthlyBlock: { marginBottom: 16 },
  monthRow: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  monthRowLabel: {
    color: C.t2,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  monthRowAmounts: { flexDirection: "row", alignItems: "center" },
  monthRowCol: { flex: 1, alignItems: "center" },
  monthRowDivider: { width: 1, backgroundColor: C.border, height: 32, marginHorizontal: 8 },
  monthRowWho: { color: C.t3, fontSize: 11, fontWeight: "500", marginBottom: 4 },
  monthRowAmt: { color: C.t2, fontSize: 17, fontWeight: "600", letterSpacing: -0.3 },
  monthRowAmtBold: { color: C.t1, fontWeight: "800" },
  // Tab bar
  tabRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.elevated },
  tabBtnText: { color: C.t3, fontWeight: "600", fontSize: 14 },
  tabBtnTextActive: { color: C.t1 },
  // Empty
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  emptyText: { color: C.t3, fontSize: 14, textAlign: "center", lineHeight: 20 },
  // Error
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    width: "100%",
  },
  errorText: { color: "#fca5a5", fontSize: 13 },
  // FAB
  fab: {
    position: "absolute",
    bottom: 16,
    left: 20,
    right: 20,
  },
  fabBtn: {
    backgroundColor: C.accent,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: C.border,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: C.elevated,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { color: C.t1, fontSize: 20, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: C.t2, fontSize: 16 },
  fieldLabel: { color: C.t2, fontSize: 13, fontWeight: "500", marginBottom: 8 },
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  typeChipText: { color: C.t2, fontSize: 14 },
  typeChipTextActive: { color: C.accent, fontWeight: "600" },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
