import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Modal, Switch, Alert, Platform,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, withTiming, withDelay, useAnimatedStyle, Easing,
} from "react-native-reanimated";
import { usePartnerStore, type CreateProposalInput } from "../../../store/usePartnerStore";
import { useChatStore } from "../../../store/useChatStore";
import { useAuthStore } from "../../../store/useAuthStore";
import ProposalCard from "../../../components/ProposalCard";
import PressableScale from "../../../components/ui/PressableScale";
import { AnimatedBar } from "../../../components/ui/AnimatedProgress";
import { formatMoney, monthLong } from "../../../lib/display";
import { ApiError } from "../../../lib/api";
import { SHADOWS, type Palette } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useT } from "../../../lib/i18n";
import Hint from "../../../components/ui/Hint";
import { DateField } from "../../../components/DateTimeField";
import type { ProposalType } from "../../../lib/types";

const PROPOSAL_TYPES: { type: ProposalType; icon: string; label: string }[] = [
  { type: "TRAINING", icon: "💃", label: "Training" },
  { type: "HOTEL", icon: "🏨", label: "Hotel" },
  { type: "TOURNAMENT", icon: "🏆", label: "Tournament" },
  { type: "TRANSPORT", icon: "✈️", label: "Transport" },
  { type: "OTHER", icon: "📌", label: "Other" },
];

// ─── Animated split bar ──────────────────────────────────────────────────────
function SplitBar({ myTotal, partnerTotal, partnerName }: {
  myTotal: number; partnerTotal: number; partnerName: string;
}) {
  const C = useC();
  const T = useT();
  const total = myTotal + partnerTotal;
  const myRatio = total > 0 ? myTotal / total : 0.5;

  const progress = useSharedValue(0.5);
  useEffect(() => {
    progress.value = withDelay(350, withTiming(myRatio, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [myRatio]);

  const myStyle = useAnimatedStyle(() => ({ flex: Math.max(0.001, progress.value) }));
  const partnerStyle = useAnimatedStyle(() => ({ flex: Math.max(0.001, 1 - progress.value) }));

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
        <View>
          <Text style={{ color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 }}>{T.partner.you.toUpperCase()}</Text>
          <Text style={{ color: C.accent, fontSize: 28, fontWeight: "900", letterSpacing: -0.6 }}>
            {formatMoney(myTotal)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 }}>
            {partnerName.toUpperCase()}
          </Text>
          <Text style={{ color: C.purple, fontSize: 28, fontWeight: "900", letterSpacing: -0.6 }}>
            {formatMoney(partnerTotal)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 999, overflow: "hidden", gap: 3 }}>
        <Animated.View style={[{ backgroundColor: C.accent, borderRadius: 999 }, myStyle]} />
        <Animated.View style={[{ backgroundColor: C.purple, borderRadius: 999 }, partnerStyle]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <Text style={{ color: C.accent, fontSize: 12, fontWeight: "700" }}>
          {Math.round(myRatio * 100)}%
        </Text>
        <Text style={{ color: C.purple, fontSize: 12, fontWeight: "700" }}>
          {Math.round((1 - myRatio) * 100)}%
        </Text>
      </View>
    </View>
  );
}

// ─── Balance Banner ──────────────────────────────────────────────────────────
function BalanceBanner({ balance, partnerName }: { balance: number; partnerName: string }) {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  if (balance === 0) return null;
  const positive = balance > 0;
  const color = positive ? C.accent : C.gold;
  const bg = positive ? C.accentFade : C.goldFade;
  const border = positive ? C.accentBorder : C.goldBorder;
  const label = positive ? `${partnerName} ${T.partner.theyOwe}` : `${T.partner.youOwe} ${partnerName}`;

  return (
    <View style={[styles.balanceBanner, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.balanceWho, { color }]}>{label}</Text>
      <Text style={[styles.balanceAmount, { color }]}>{formatMoney(Math.abs(balance))}</Text>
      <Text style={styles.balanceSub}>{T.partner.splitLabel} · {positive ? T.partner.youPaidMore : T.partner.partnerPaidMore}</Text>
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
  myExpenses, partnerExpenses, partnerName,
}: {
  myExpenses: { date: string; amount: number }[];
  partnerExpenses: { date: string; amount: number }[];
  partnerName: string;
}) {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const rows = groupByMonth(myExpenses, partnerExpenses);
  if (rows.length === 0) return null;
  const maxAmt = Math.max(...rows.map(r => Math.max(r.myTotal, r.partnerTotal)), 1);

  return (
    <View style={styles.monthlyBlock}>
      <View style={styles.monthlyLegend}>
        <Text style={styles.sectionLabel}>{T.partner.byMonth}</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.accent }]} />
            <Text style={styles.legendLabel}>{T.partner.you}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.purple }]} />
            <Text style={styles.legendLabel}>{partnerName}</Text>
          </View>
        </View>
      </View>
      {rows.map((row, i) => (
        <View key={row.month} style={styles.monthRow}>
          <Text style={styles.monthRowLabel}>{monthLong(row.month)}</Text>
          <View style={styles.monthBarsRow}>
            <View style={styles.monthBarGroup}>
              <View style={{ height: 52, justifyContent: "flex-end", alignItems: "center" }}>
                <AnimatedBar ratio={row.myTotal / maxAmt} color={C.accent} maxHeight={44} width={32} radius={8} delay={i * 80} />
              </View>
              <Text style={[styles.monthAmt, { color: C.accent }]}>{formatMoney(row.myTotal)}</Text>
            </View>
            <View style={styles.monthBarGroup}>
              <View style={{ height: 52, justifyContent: "flex-end", alignItems: "center" }}>
                <AnimatedBar ratio={row.partnerTotal / maxAmt} color={C.purple} maxHeight={44} width={32} radius={8} delay={i * 80 + 90} />
              </View>
              <Text style={[styles.monthAmt, { color: C.purple }]}>{formatMoney(row.partnerTotal)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PartnerScreen() {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const myId = useAuthStore(st => st.user?.id);
  const {
    couple, pendingCount, proposals, split,
    loading, fetchPartner, linkPartner, unlinkPartner, addCoach, removeCoach,
    fetchProposals, fetchSplit, respondProposal, cancelProposal,
  } = usePartnerStore();
  const chatUnread = useChatStore(st => st.unread);

  const [modalOpen, setModalOpen] = useState(false);
  const [connectEmail, setConnectEmail] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [splitPeriod, setSplitPeriod] = useState<"3M" | "6M" | "1Y">("3M");
  const [coachEmail, setCoachEmail] = useState("");
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

  const onAddCoach = async () => {
    if (!coachEmail.trim()) return;
    setCoachError(null); setCoachBusy(true);
    try {
      await addCoach(coachEmail.trim());
      setCoachEmail("");
    } catch (e) {
      setCoachError(e instanceof ApiError ? e.message : "Could not add coach");
    } finally { setCoachBusy(false); }
  };

  const onRemoveCoach = () => {
    const doRemove = () => removeCoach().catch(() => {});
    if (Platform.OS === "web") { doRemove(); return; }
    Alert.alert("Remove coach", "Remove the coach from this couple?", [
      { text: T.common.cancel, style: "cancel" },
      { text: "Remove", style: "destructive", onPress: doRemove },
    ]);
  };

  const filteredSplit = useMemo(() => {
    if (!split) return null;
    const months = splitPeriod === "3M" ? 3 : splitPeriod === "6M" ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months + 1);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);
    const myExp = split.myExpenses.filter(e => new Date(e.date) >= cutoff);
    const partnerExp = split.partnerExpenses.filter(e => new Date(e.date) >= cutoff);
    const myTotal = Math.round(myExp.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const partnerTotal = Math.round(partnerExp.reduce((s, e) => s + e.amount, 0) * 100) / 100;
    const balance = Math.round(((myTotal - partnerTotal) / 2) * 100) / 100;
    return { myTotal, partnerTotal, balance, myExpenses: myExp, partnerExpenses: partnerExp };
  }, [split, splitPeriod]);

  useFocusEffect(useCallback(() => {
    fetchPartner(); fetchProposals();
    if (couple) fetchSplit();
  }, [couple?.id]));

  const inbox = proposals.filter(p => p.senderId !== myId);
  const sent = proposals.filter(p => p.senderId === myId);
  const displayed = tab === "inbox" ? inbox : sent;

  const onConnect = async () => {
    if (!connectEmail.trim()) return;
    setConnectError(null); setConnecting(true);
    try {
      await linkPartner(connectEmail.trim());
      setConnectEmail(""); await fetchProposals();
    } catch (e) {
      setConnectError(e instanceof ApiError ? e.message : T.partner.errorConnect);
    } finally { setConnecting(false); }
  };

  const onDisconnect = () => {
    if (Platform.OS === "web") { unlinkPartner(); return; }
    Alert.alert(T.partner.disconnectTitle, T.partner.disconnectSub, [
      { text: T.common.cancel, style: "cancel" },
      { text: T.partner.disconnect, style: "destructive", onPress: () => unlinkPartner() },
    ]);
  };

  const onApprove = async (id: string) => {
    try { await respondProposal(id, "APPROVE"); await fetchSplit(); }
    catch (e) { Alert.alert(T.common.error, e instanceof ApiError ? e.message : T.partner.errorApprove); }
  };

  const onDecline = async (id: string) => {
    try { await respondProposal(id, "DECLINE"); }
    catch (e) { Alert.alert(T.common.error, e instanceof ApiError ? e.message : T.partner.errorDecline); }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Hint
          id="partner.intro"
          title={T.hints.partnerTitle}
          text={T.hints.partnerText}
          gradient="rose"
          icon="bulb"
          style={{ marginHorizontal: 0 }}
        />

        {/* ── No partner ───────────────────────────────────────────────────── */}
        {!couple ? (
          <Animated.View entering={FadeInDown.delay(0).duration(450)}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEmoji}>👥</Text>
              <Text style={styles.heroTitle}>{T.partner.connectTitle}</Text>
              <Text style={styles.heroSubtitle}>{T.partner.connectSub}</Text>
              {connectError ? <View style={styles.errorBox}><Text style={styles.errorText}>{connectError}</Text></View> : null}
              <TextInput
                style={styles.emailInput}
                placeholder={T.partner.emailPlaceholder}
                placeholderTextColor={C.t3}
                autoCapitalize="none"
                keyboardType="email-address"
                value={connectEmail}
                onChangeText={setConnectEmail}
              />
              <PressableScale
                onPress={onConnect}
                disabled={connecting || !connectEmail.trim()}
                style={[styles.connectBtn, !connectEmail.trim() && styles.connectBtnDisabled]}
              >
                {connecting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.connectBtnText}>{T.partner.connectBtn}</Text>}
              </PressableScale>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* ── Partner card ──────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(0).duration(400)}>
              <View style={styles.partnerCard}>
                <View style={styles.partnerAvatar}>
                  <Text style={styles.partnerAvatarText}>
                    {couple.partner.firstName[0]}{couple.partner.lastName[0]}
                  </Text>
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName}>{couple.partner.firstName} {couple.partner.lastName}</Text>
                  <Text style={styles.partnerEmail}>{couple.partner.email}</Text>
                  <View style={styles.connectedBadge}>
                    <View style={styles.connectedDot} />
                    <Text style={styles.connectedText}>{T.partner.connected}</Text>
                  </View>
                </View>
                <PressableScale onPress={onDisconnect} style={styles.disconnectBtn}>
                  <Text style={styles.disconnectText}>{T.partner.disconnect}</Text>
                </PressableScale>
              </View>
            </Animated.View>

            {/* ── Team chat ─────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(40).duration(400)}>
              <PressableScale onPress={() => router.push("/chat")} style={styles.chatBtn}>
                <Text style={styles.chatBtnIcon}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatBtnTitle}>Team chat</Text>
                  <Text style={styles.chatBtnSub}>Messages, proposals &amp; every change</Text>
                </View>
                {chatUnread > 0 ? (
                  <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{chatUnread > 99 ? "99+" : chatUnread}</Text></View>
                ) : <Text style={styles.chatChevron}>›</Text>}
              </PressableScale>
            </Animated.View>

            {/* ── Coach ─────────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(70).duration(400)}>
              {couple.coach ? (
                <View style={styles.coachCard}>
                  <View style={styles.coachAvatar}>
                    <Text style={styles.coachAvatarText}>{couple.coach.firstName[0]}{couple.coach.lastName[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coachName}>{couple.coach.firstName} {couple.coach.lastName}</Text>
                    <Text style={styles.coachRole}>🎓 Coach · full access</Text>
                  </View>
                  {couple.role !== "coach" ? (
                    <PressableScale onPress={onRemoveCoach} style={styles.disconnectBtn}>
                      <Text style={styles.disconnectText}>Remove</Text>
                    </PressableScale>
                  ) : null}
                </View>
              ) : couple.role !== "coach" ? (
                <View style={styles.coachAddCard}>
                  <Text style={styles.coachAddTitle}>🎓 Add a coach</Text>
                  <Text style={styles.coachAddSub}>A coach sees and can change everything, just like a partner.</Text>
                  {coachError ? <View style={styles.errorBox}><Text style={styles.errorText}>{coachError}</Text></View> : null}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={[styles.emailInput, { flex: 1, marginBottom: 0 }]}
                      placeholder="coach@email.com"
                      placeholderTextColor={C.t3}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={coachEmail}
                      onChangeText={setCoachEmail}
                    />
                    <PressableScale onPress={onAddCoach} disabled={coachBusy || !coachEmail.trim()} style={[styles.coachAddBtn, !coachEmail.trim() && { opacity: 0.5 }]}>
                      {coachBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.coachAddBtnText}>Add</Text>}
                    </PressableScale>
                  </View>
                </View>
              ) : null}
            </Animated.View>

            {/* ── Split section ─────────────────────────────────────────── */}
            {split && filteredSplit ? (
              <Animated.View entering={FadeInDown.delay(60).duration(400)}>
                {/* Header + period */}
                <View style={styles.splitHeader}>
                  <Text style={styles.sectionLabel}>{T.partner.expenseSplit}</Text>
                  <View style={styles.splitPeriodRow}>
                    {(["3M", "6M", "1Y"] as const).map(p => (
                      <PressableScale
                        key={p}
                        onPress={() => setSplitPeriod(p)}
                        style={[styles.splitPeriodBtn, splitPeriod === p && styles.splitPeriodBtnActive]}
                      >
                        <Text style={[styles.splitPeriodText, splitPeriod === p && styles.splitPeriodTextActive]}>{p}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>

                {/* Animated split bar card */}
                <View style={styles.splitCard}>
                  <SplitBar
                    myTotal={filteredSplit.myTotal}
                    partnerTotal={filteredSplit.partnerTotal}
                    partnerName={couple.partner.firstName}
                  />
                </View>

                <BalanceBanner balance={filteredSplit.balance} partnerName={couple.partner.firstName} />

                <MonthlySplit
                  myExpenses={filteredSplit.myExpenses}
                  partnerExpenses={filteredSplit.partnerExpenses}
                  partnerName={couple.partner.firstName}
                />
              </Animated.View>
            ) : null}

            {/* ── Proposals ─────────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(110).duration(400)}>
              <View style={styles.tabRow}>
                <PressableScale
                  onPress={() => setTab("inbox")}
                  style={[styles.tabBtn, tab === "inbox" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, tab === "inbox" && styles.tabBtnTextActive]}>
                    {T.partner.inbox} {pendingCount > 0 ? `(${pendingCount})` : ""}
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={() => setTab("sent")}
                  style={[styles.tabBtn, tab === "sent" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, tab === "sent" && styles.tabBtnTextActive]}>{T.partner.sent}</Text>
                </PressableScale>
              </View>
            </Animated.View>

            {displayed.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(150).duration(400)}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {tab === "inbox" ? T.partner.noInbox : T.partner.noSent}
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

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      {couple ? (
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.fab}>
          <PressableScale onPress={() => setModalOpen(true)} style={styles.fabBtn} scaleTo={0.94}>
            <Text style={styles.fabText}>{T.partner.newProposal}</Text>
          </PressableScale>
        </Animated.View>
      ) : null}

      <NewProposalModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={async input => {
          await usePartnerStore.getState().createProposal(input);
          setModalOpen(false); setTab("sent");
        }}
      />
    </View>
  );
}

// ─── New Proposal Modal ──────────────────────────────────────────────────────
function NewProposalModal({ visible, onClose, onCreate }: {
  visible: boolean; onClose: () => void;
  onCreate: (input: CreateProposalInput) => Promise<void>;
}) {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
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
    setDate(new Date().toISOString().slice(0, 10)); setLocation(""); setNotes(""); setError(null);
  };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError(T.partner.errorTitle); return; }
    const costNum = cost ? Number(cost.replace(",", ".")) : null;
    if (cost && (!costNum || costNum <= 0)) { setError(T.partner.errorCost); return; }
    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(), type, cost: costNum,
        details: { date: hasDate ? date : undefined, location: location.trim() || undefined, notes: notes.trim() || undefined },
      });
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : T.partner.errorCreate);
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{T.partner.proposalTitle}</Text>
              <PressableScale onPress={close} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </PressableScale>
            </View>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            <Text style={styles.fieldLabel}>{T.partner.proposalField}</Text>
            <TextInput style={styles.input} placeholder={T.partner.proposalPlaceholder} placeholderTextColor={C.t3} value={title} onChangeText={setTitle} />
            <Text style={styles.fieldLabel}>{T.partner.typeField}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PROPOSAL_TYPES.map(({ type: t, icon }) => {
                  const active = t === type;
                  const typeLabel = ({
                    TRAINING: T.partner.typeTraining,
                    HOTEL: T.partner.typeHotel,
                    TOURNAMENT: T.partner.typeTournament,
                    TRANSPORT: T.partner.typeTransport,
                    OTHER: T.partner.typeOther,
                  } as Record<string, string>)[t] ?? t;
                  return (
                    <PressableScale key={t} onPress={() => setType(t)} style={[styles.typeChip, active && styles.typeChipActive]}>
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{icon} {typeLabel}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={styles.fieldLabel}>{T.partner.costField}</Text>
            <TextInput style={styles.input} placeholder={T.partner.costPlaceholder} placeholderTextColor={C.t3} keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>{T.partner.hasDate}</Text>
              <Switch value={hasDate} onValueChange={setHasDate} trackColor={{ true: C.accent, false: C.elevated }} thumbColor="#fff" />
            </View>
            {hasDate ? (
              <>
                <Text style={styles.fieldLabel}>{T.partner.dateField}</Text>
                <View style={{ marginBottom: 16 }}><DateField value={date} onChange={setDate} /></View>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>{T.partner.locationField}</Text>
            <TextInput style={styles.input} placeholder={T.partner.locationPlaceholder} placeholderTextColor={C.t3} value={location} onChangeText={setLocation} />
            <Text style={styles.fieldLabel}>{T.partner.notesField}</Text>
            <TextInput style={[styles.input, styles.notesInput]} placeholder={T.partner.notesPlaceholder} placeholderTextColor={C.t3} multiline numberOfLines={3} value={notes} onChangeText={setNotes} />
            <PressableScale onPress={submit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{T.partner.sendProposal}</Text>}
            </PressableScale>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(C: Palette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  // No-partner hero
  heroCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 24,
    alignItems: "center", borderWidth: 1, borderColor: C.border, marginBottom: 20,
    ...SHADOWS.md,
  },
  heroEmoji: { fontSize: 48, marginBottom: 16 },
  heroTitle: { color: C.t1, fontSize: 22, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  heroSubtitle: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emailInput: {
    width: "100%", backgroundColor: C.elevated, color: C.t1,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  connectBtn: { width: "100%", backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Partner card
  partnerCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: C.border,
    ...SHADOWS.sm,
  },
  partnerAvatar: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: C.accentFade,
    alignItems: "center", justifyContent: "center", marginRight: 14,
    borderWidth: 1.5, borderColor: C.accentBorder,
  },
  partnerAvatarText: { color: C.accent, fontWeight: "800", fontSize: 18 },
  partnerInfo: { flex: 1 },
  partnerName: { color: C.t1, fontWeight: "700", fontSize: 16, marginBottom: 2 },
  partnerEmail: { color: C.t2, fontSize: 13 },
  connectedBadge: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: 5 },
  connectedText: { color: C.accent, fontSize: 12, fontWeight: "600" },
  disconnectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border },
  disconnectText: { color: C.t3, fontSize: 12 },
  // Chat button
  chatBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.accentFade, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: C.accentBorder, marginBottom: 16,
  },
  chatBtnIcon: { fontSize: 22 },
  chatBtnTitle: { color: C.accent, fontWeight: "800", fontSize: 16 },
  chatBtnSub: { color: C.t2, fontSize: 12, marginTop: 2 },
  chatChevron: { color: C.accent, fontSize: 22, fontWeight: "700" },
  chatBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  chatBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  // Coach
  coachCard: {
    backgroundColor: C.card, borderRadius: 18, padding: 14,
    flexDirection: "row", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  coachAvatar: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.goldFade,
    alignItems: "center", justifyContent: "center", marginRight: 12,
    borderWidth: 1.5, borderColor: C.goldBorder,
  },
  coachAvatarText: { color: C.gold, fontWeight: "800", fontSize: 15 },
  coachName: { color: C.t1, fontWeight: "700", fontSize: 15 },
  coachRole: { color: C.gold, fontSize: 12, fontWeight: "600", marginTop: 2 },
  coachAddCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  coachAddTitle: { color: C.t1, fontWeight: "700", fontSize: 15, marginBottom: 4 },
  coachAddSub: { color: C.t3, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  coachAddBtn: { backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  coachAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Split
  sectionLabel: { color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  splitHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 },
  splitPeriodRow: { flexDirection: "row", backgroundColor: C.card, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: C.border },
  splitPeriodBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  splitPeriodBtnActive: { backgroundColor: C.elevated },
  splitPeriodText: { color: C.t3, fontWeight: "600", fontSize: 12 },
  splitPeriodTextActive: { color: C.t1 },
  splitCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: C.borderStrong, marginBottom: 12,
  },
  // Balance banner
  balanceBanner: { borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1 },
  balanceWho: { fontSize: 12, fontWeight: "600", marginBottom: 4, opacity: 0.8 },
  balanceAmount: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  balanceSub: { color: C.t3, fontSize: 12, marginTop: 6 },
  // Monthly breakdown
  monthlyBlock: { marginBottom: 16 },
  monthlyLegend: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: C.t2, fontSize: 12, fontWeight: "500" },
  monthRow: {
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  monthRowLabel: { color: C.t2, fontSize: 12, fontWeight: "600", marginBottom: 10 },
  monthBarsRow: { flexDirection: "row", gap: 12 },
  monthBarGroup: { flex: 1, alignItems: "center", gap: 6 },
  monthAmt: { fontSize: 14, fontWeight: "700", letterSpacing: -0.3 },
  // Tabs
  tabRow: {
    flexDirection: "row", backgroundColor: C.card, borderRadius: 14, padding: 4,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.elevated },
  tabBtnText: { color: C.t3, fontWeight: "600", fontSize: 14 },
  tabBtnTextActive: { color: C.t1 },
  // Empty
  emptyCard: { backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  emptyText: { color: C.t3, fontSize: 14, textAlign: "center", lineHeight: 20 },
  // Error
  errorBox: { backgroundColor: C.redFade, borderWidth: 1, borderColor: C.red, borderRadius: 12, padding: 12, marginBottom: 14, width: "100%" },
  errorText: { color: "#fca5a5", fontSize: 13 },
  // FAB
  fab: { position: "absolute", bottom: 16, left: 20, right: 20 },
  fabBtn: {
    backgroundColor: C.accent, borderRadius: 18, paddingVertical: 16, alignItems: "center",
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: "92%", borderWidth: 1, borderColor: C.border, borderBottomWidth: 0,
  },
  modalHandle: { width: 36, height: 4, backgroundColor: C.elevated, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { color: C.t1, fontSize: 20, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: C.t2, fontSize: 16 },
  fieldLabel: { color: C.t2, fontSize: 13, fontWeight: "500", marginBottom: 8 },
  input: { backgroundColor: C.elevated, color: C.t1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  notesInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 12 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border },
  typeChipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  typeChipText: { color: C.t2, fontSize: 14 },
  typeChipTextActive: { color: C.accent, fontWeight: "600" },
  submitBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
}
