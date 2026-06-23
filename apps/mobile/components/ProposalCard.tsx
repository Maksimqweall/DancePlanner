import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { Proposal } from "../lib/types";
import { formatMoney, formatShortDate } from "../lib/display";
import PressableScale from "./ui/PressableScale";
import type { Palette } from "../lib/theme";
import { useC } from "../lib/useTheme";

const PROPOSAL_META: Record<string, { icon: string; label: string }> = {
  TRAINING:   { icon: "💃", label: "Training" },
  TOURNAMENT: { icon: "🏆", label: "Tournament" },
  HOTEL:      { icon: "🏨", label: "Hotel" },
  TRANSPORT:  { icon: "✈️", label: "Transport" },
  OTHER:      { icon: "📌", label: "Other" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:  { bg: "rgba(245,158,11,0.14)",  text: "#f59e0b", label: "Pending" },
  APPROVED: { bg: "rgba(16,185,129,0.14)",  text: "#10b981", label: "Approved ✓" },
  DECLINED: { bg: "rgba(239,68,68,0.14)",   text: "#ef4444", label: "Declined" },
};

interface Props {
  proposal: Proposal;
  isMine: boolean; // true = I sent this
  index?: number;
  onApprove?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

export default function ProposalCard({
  proposal,
  isMine,
  index = 0,
  onApprove,
  onDecline,
  onCancel,
}: Props) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const meta = PROPOSAL_META[proposal.type] ?? PROPOSAL_META.OTHER;
  const status = STATUS_STYLE[proposal.status];
  const isPending = proposal.status === "PENDING";
  const dateStr = proposal.details?.date
    ? formatShortDate(proposal.details.date)
    : null;

  return (
    <Animated.View entering={index < 8 ? FadeInDown.delay(index * 55).duration(350) : undefined}>
      <View style={styles.card}>
        {/* Icon + title row */}
        <View style={styles.topRow}>
          <View style={styles.iconWrapper}>
            <Text style={styles.icon}>{meta.icon}</Text>
          </View>
          <View style={styles.titleArea}>
            <Text style={styles.title} numberOfLines={2}>{proposal.title}</Text>
            <Text style={styles.subtitle}>
              {meta.label}
              {dateStr ? ` · ${dateStr}` : ""}
              {proposal.details?.location ? ` · ${proposal.details.location}` : ""}
            </Text>
            {!isMine && proposal.sender ? (
              <Text style={styles.from}>
                from {proposal.sender.firstName} {proposal.sender.lastName}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        {/* Cost row */}
        {proposal.cost ? (
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Cost</Text>
            <Text style={styles.costValue}>{formatMoney(proposal.cost)}</Text>
          </View>
        ) : null}

        {/* Notes */}
        {proposal.details?.notes ? (
          <Text style={styles.notes}>{proposal.details.notes}</Text>
        ) : null}

        {/* Actions */}
        {isPending && !isMine && onApprove && onDecline ? (
          <View style={styles.actions}>
            <PressableScale onPress={onDecline} style={styles.declineBtn} scaleTo={0.96}>
              <Text style={styles.declineBtnText}>✗ Decline</Text>
            </PressableScale>
            <PressableScale onPress={onApprove} style={styles.approveBtn} scaleTo={0.96}>
              <Text style={styles.approveBtnText}>✓ Approve</Text>
            </PressableScale>
          </View>
        ) : null}

        {isPending && isMine && onCancel ? (
          <PressableScale onPress={onCancel} style={styles.cancelBtn} scaleTo={0.97}>
            <Text style={styles.cancelBtnText}>Cancel proposal</Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.elevated,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon: { fontSize: 22 },
  titleArea: { flex: 1, marginRight: 8 },
  title: { color: C.t1, fontWeight: "700", fontSize: 15, marginBottom: 3 },
  subtitle: { color: C.t2, fontSize: 13 },
  from: { color: C.t3, fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.elevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  costLabel: { color: C.t2, fontSize: 13 },
  costValue: { color: C.gold, fontWeight: "700", fontSize: 15 },
  notes: {
    color: C.t3,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    fontStyle: "italic",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  declineBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: `${C.red}44`,
  },
  declineBtnText: { color: C.red, fontWeight: "700", fontSize: 14 },
  approveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: C.accent,
  },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelBtnText: { color: C.t3, fontSize: 13 },
  });
}
