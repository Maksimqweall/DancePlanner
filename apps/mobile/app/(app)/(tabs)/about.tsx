import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "../../../store/useAuthStore";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import { formatMoney, CURRENCIES, CURRENCY_ORDER } from "../../../lib/display";
import PressableScale from "../../../components/ui/PressableScale";
import type { Palette } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useThemeStore, type ThemeMode } from "../../../store/useThemeStore";
import { api } from "../../../lib/api";
import { useWdsfStore } from "../../../store/useWdsfStore";

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: "light",  label: "Light",  icon: "☀" },
  { key: "dark",   label: "Dark",   icon: "☾" },
  { key: "system", label: "System", icon: "⚙" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const user   = useAuthStore((st) => st.user);
  const logout = useAuthStore((st) => st.logout);
  const setCurrency = useAuthStore((st) => st.setCurrency);
  const mode = useThemeStore((st) => st.mode);
  const setMode = useThemeStore((st) => st.setMode);
  const { budgets, refresh, setBudget } = useFinanceStore();
  const { couple } = usePartnerStore();
  const wdsfProfile = useWdsfStore((st) => st.profile);

  const [budgetModal,   setBudgetModal]   = useState(false);
  const [contactModal,  setContactModal]  = useState(false);
  const [currencyModal, setCurrencyModal] = useState(false);

  const currencyCode = user?.currency ?? "EUR";
  const currencyMeta = CURRENCIES[currencyCode] ?? CURRENCIES.EUR;

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const currentMonth  = new Date().toISOString().slice(0, 7);
  const defaultBudget = user?.monthlyBudget ?? 1000;
  const monthBudget   = budgets[currentMonth] ?? defaultBudget;
  const initials      = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  const handleLogout = () => {
    if (Platform.OS === "web") { logout(); return; }
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Profile card */}
      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={s.profileCard}>
        <View style={s.profileCardTopBand} />
        <View style={s.avatarWrap}>
          <View style={s.avatarGlow} />
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials || "?"}</Text>
          </View>
        </View>
        <Text style={s.userName}>{user?.firstName} {user?.lastName}</Text>
        <Text style={s.userEmail}>{user?.email}</Text>
        <View style={s.premiumBadge}>
          <Text style={s.premiumBadgeText}>✦ Premium</Text>
        </View>
      </Animated.View>

      {/* WDSF Profile */}
      <Animated.View entering={FadeInDown.delay(40).duration(400)}>
        <Text style={s.sectionLabel}>WDSF PROFILE</Text>
        <View style={s.settingsCard}>
          <PressableScale onPress={() => router.push("/wdsf-profile")} style={s.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingsRowTitle}>
                {wdsfProfile ? wdsfProfile.name : "Connect WDSF Profile"}
              </Text>
              <Text style={s.settingsRowSub}>
                {wdsfProfile
                  ? `MIN: ${wdsfProfile.min} · ${wdsfProfile.represents || wdsfProfile.nationality}`
                  : "Link your WorldDanceSport profile"}
              </Text>
            </View>
            {wdsfProfile ? (
              <View style={[
                s.wdsfStatusDot,
                { backgroundColor: wdsfProfile.licenseStatus?.toLowerCase().includes("active")
                  ? C.accent : C.red }
              ]} />
            ) : null}
            <Text style={s.settingsRowChevron}>›</Text>
          </PressableScale>
        </View>
      </Animated.View>

      {/* Finance */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <Text style={s.sectionLabel}>FINANCE</Text>
        <View style={s.settingsCard}>
          <PressableScale onPress={() => setBudgetModal(true)} style={s.settingsRow}>
            <View>
              <Text style={s.settingsRowTitle}>Monthly Budget</Text>
              <Text style={s.settingsRowSub}>Default spending limit per month</Text>
            </View>
            <View style={s.settingsRowRight}>
              <Text style={s.settingsRowValue}>{formatMoney(monthBudget)}</Text>
              <Text style={s.settingsRowChevron}>›</Text>
            </View>
          </PressableScale>

          <View style={s.rowDivider} />

          <PressableScale onPress={() => setCurrencyModal(true)} style={s.settingsRow}>
            <View>
              <Text style={s.settingsRowTitle}>Currency</Text>
              <Text style={s.settingsRowSub}>All amounts displayed in</Text>
            </View>
            <View style={s.settingsRowRight}>
              <Text style={s.settingsRowValue}>{currencyMeta.code} {currencyMeta.symbol}</Text>
              <Text style={s.settingsRowChevron}>›</Text>
            </View>
          </PressableScale>
        </View>
      </Animated.View>

      {/* Appearance */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.settingsCard}>
          <View style={s.appearanceRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = mode === opt.key;
              return (
                <PressableScale
                  key={opt.key}
                  onPress={() => setMode(opt.key)}
                  style={[s.themeBtn, active && s.themeBtnActive]}
                >
                  <Text style={[s.themeIcon, active && s.themeIconActive]}>{opt.icon}</Text>
                  <Text style={[s.themeLabel, active && s.themeLabelActive]}>{opt.label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* Partner */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Text style={s.sectionLabel}>PARTNER</Text>
        <View style={s.settingsCard}>
          <View style={s.settingsRow}>
            <View>
              <Text style={s.settingsRowTitle}>Partner sync</Text>
              <Text style={s.settingsRowSub}>
                {couple
                  ? `Synced with ${couple.partner.firstName} ${couple.partner.lastName}`
                  : "No partner connected"}
              </Text>
            </View>
            <View style={[s.syncDot, { backgroundColor: couple ? C.accent : C.t3 }]} />
          </View>
        </View>
      </Animated.View>

      {/* Support */}
      <Animated.View entering={FadeInDown.delay(140).duration(400)}>
        <Text style={s.sectionLabel}>SUPPORT</Text>
        <View style={s.settingsCard}>
          <PressableScale onPress={() => setContactModal(true)} style={s.settingsRow}>
            <View>
              <Text style={s.settingsRowTitle}>Contact us</Text>
              <Text style={s.settingsRowSub}>Send us a message via Telegram</Text>
            </View>
            <Text style={s.settingsRowChevron}>›</Text>
          </PressableScale>

          <View style={s.rowDivider} />

          <PressableScale onPress={() => router.push("/about-app")} style={s.settingsRow}>
            <View>
              <Text style={s.settingsRowTitle}>About Dance Planner</Text>
              <Text style={s.settingsRowSub}>Version, info & more</Text>
            </View>
            <Text style={s.settingsRowChevron}>›</Text>
          </PressableScale>
        </View>
      </Animated.View>

      {/* Account */}
      <Animated.View entering={FadeInDown.delay(180).duration(400)}>
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.settingsCard}>
          <PressableScale onPress={handleLogout} style={s.settingsRow}>
            <Text style={[s.settingsRowTitle, { color: C.red }]}>Sign out</Text>
            <Text style={s.settingsRowChevron}>›</Text>
          </PressableScale>
        </View>
      </Animated.View>

      <View style={{ height: 32 }} />

      <BudgetModal
        visible={budgetModal}
        current={monthBudget}
        onClose={() => setBudgetModal(false)}
        onSave={async (val) => { await setBudget(currentMonth, val); setBudgetModal(false); }}
      />

      <CurrencyModal
        visible={currencyModal}
        current={currencyCode}
        onClose={() => setCurrencyModal(false)}
        onSelect={async (code) => { await setCurrency(code); setCurrencyModal(false); }}
      />

      <ContactModal visible={contactModal} onClose={() => setContactModal(false)} />
    </ScrollView>
  );
}

// ─── Budget Modal ────────────────────────────────────────────────────────────

function BudgetModal({
  visible, current, onClose, onSave,
}: {
  visible: boolean;
  current: number;
  onClose: () => void;
  onSave: (v: number) => Promise<void>;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [value, setValue]   = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setValue(String(current)); setError(null); }
  }, [visible, current]);

  const save = async () => {
    const n = Number(value.replace(",", "."));
    if (!n || n <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    try { await onSave(n); }
    catch { setError("Could not save"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Monthly Budget</Text>
          <Text style={s.modalSub}>Default spending limit for each month.</Text>
          {error ? <Text style={s.modalError}>{error}</Text> : null}
          <TextInput
            style={s.modalInput}
            keyboardType="decimal-pad"
            placeholder="1000"
            placeholderTextColor={C.t3}
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <View style={s.modalBtns}>
            <PressableScale style={s.modalCancel} onPress={onClose}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </PressableScale>
            <PressableScale style={s.modalSave} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.modalSaveText}>Save</Text>}
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Currency Modal ──────────────────────────────────────────────────────────

function CurrencyModal({
  visible, current, onClose, onSelect,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onSelect: (code: string) => Promise<void>;
}) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => { if (visible) { setSavingCode(null); setError(null); } }, [visible]);

  const choose = async (code: string) => {
    if (code === current) { onClose(); return; }
    setSavingCode(code);
    setError(null);
    try {
      await onSelect(code);
    } catch {
      setError("Could not change currency. Please try again.");
      setSavingCode(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Display currency</Text>
          <Text style={s.modalSub}>All amounts across the app are shown in this currency.</Text>
          {error ? <Text style={s.modalError}>{error}</Text> : null}
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {CURRENCY_ORDER.map((code) => {
              const c = CURRENCIES[code];
              const active = code === current;
              return (
                <PressableScale
                  key={code}
                  onPress={() => choose(code)}
                  style={[s.currencyRow, active && s.currencyRowActive]}
                >
                  <View style={s.currencySymbolBox}>
                    <Text style={s.currencySymbolText}>{c.symbol}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.currencyLabel}>{c.label}</Text>
                    <Text style={s.currencyCode}>{c.code}</Text>
                  </View>
                  {savingCode === code
                    ? <ActivityIndicator color={C.accent} size="small" />
                    : active ? <Text style={s.currencyCheck}>✓</Text> : null}
                </PressableScale>
              );
            })}
          </ScrollView>
          <PressableScale style={[s.aboutCloseBtn, { marginTop: 16 }]} onPress={onClose}>
            <Text style={s.aboutCloseBtnText}>Close</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setMessage(""); setSent(false); setError(null); }
  }, [visible]);

  const send = async () => {
    if (!message.trim()) { setError("Please write a message first"); return; }
    setSending(true);
    setError(null);
    try {
      await api.post("/contact", { message: message.trim() });
      setSent(true);
    } catch {
      setError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          {sent ? (
            <>
              <Text style={s.sentIcon}>✓</Text>
              <Text style={s.modalTitle}>Message sent!</Text>
              <Text style={s.modalSub}>
                We received your message and will get back to you via Telegram soon.
              </Text>
              <PressableScale style={[s.modalSave, { marginTop: 16 }]} onPress={onClose}>
                <Text style={s.modalSaveText}>Done</Text>
              </PressableScale>
            </>
          ) : (
            <>
              <Text style={s.modalTitle}>Contact us</Text>
              <Text style={s.modalSub}>
                Tell us anything — feedback, bugs, feature requests. We'll reply on Telegram.
              </Text>
              {error ? <Text style={s.modalError}>{error}</Text> : null}
              <TextInput
                style={[s.modalInput, s.contactTextArea]}
                placeholder="Your message..."
                placeholderTextColor={C.t3}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                autoFocus
              />
              <View style={s.modalBtns}>
                <PressableScale style={s.modalCancel} onPress={onClose}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </PressableScale>
                <PressableScale style={s.modalSave} onPress={send} disabled={sending}>
                  {sending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.modalSaveText}>Send</Text>}
                </PressableScale>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 24 },

  // Appearance theme picker
  appearanceRow: { flexDirection: "row", gap: 8, padding: 12 },
  themeBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border, gap: 4 },
  themeBtnActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  themeIcon: { fontSize: 18, color: C.t2 },
  themeIconActive: { color: C.accent },
  themeLabel: { fontSize: 12, fontWeight: "600", color: C.t2 },
  themeLabelActive: { color: C.accent },

  profileCard: {
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 28,
    backgroundColor: C.card,
    borderRadius: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.borderStrong,
    overflow: "hidden",
  },
  profileCardTopBand: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 72,
    backgroundColor: C.accentFade,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  avatarWrap: { position: "relative", width: 80, height: 80, marginBottom: 16 },
  avatarGlow: {
    position: "absolute",
    top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 50,
    backgroundColor: C.accentGlow,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.elevated,
    borderWidth: 2.5, borderColor: C.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  avatarText:  { color: C.accent, fontSize: 28, fontWeight: "800" },
  userName:    { color: C.t1, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  userEmail:   { color: C.t3, fontSize: 13, marginBottom: 14 },
  premiumBadge: {
    backgroundColor: C.goldFade,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  premiumBadgeText: { color: C.gold, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },

  sectionLabel: {
    color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    marginBottom: 8, marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: C.card, borderRadius: 22,
    borderWidth: 1, borderColor: C.borderStrong,
    marginBottom: 22, overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 18,
  },
  settingsRowTitle:   { color: C.t1, fontSize: 15, fontWeight: "600", marginBottom: 2 },
  settingsRowSub:     { color: C.t3, fontSize: 12 },
  settingsRowRight:   { flexDirection: "row", alignItems: "center", gap: 6 },
  settingsRowValue:   { color: C.t2, fontSize: 14, fontWeight: "600" },
  settingsRowChevron: { color: C.t3, fontSize: 18, fontWeight: "300" },
  rowDivider:         { height: 1, backgroundColor: C.border, marginHorizontal: 18 },
  syncDot:            { width: 10, height: 10, borderRadius: 5 },
  wdsfStatusDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 4 },

  modalOverlay: {
    flex: 1, justifyContent: "center",
    backgroundColor: "rgba(5,5,10,0.82)", paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: C.card, borderRadius: 28,
    padding: 26, borderWidth: 1, borderColor: C.borderStrong,
  },
  modalTitle:     { color: C.t1, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalSub:       { color: C.t2, fontSize: 14, marginBottom: 16 },
  modalError:     { color: C.red, fontSize: 13, marginBottom: 10 },
  modalInput: {
    backgroundColor: C.elevated, color: C.t1,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontWeight: "500", marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  contactTextArea: { height: 130, fontSize: 15 },
  modalBtns:      { flexDirection: "row", gap: 10 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: "center", backgroundColor: C.elevated,
  },
  modalCancelText: { color: C.t2, fontWeight: "600" },
  modalSave: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: "center", backgroundColor: C.accent,
  },
  modalSaveText: { color: "#fff", fontWeight: "700" },
  sentIcon: { color: C.accent, fontSize: 40, textAlign: "center", marginBottom: 8 },

  // Currency picker
  currencyRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 6,
    backgroundColor: C.elevated,
    borderWidth: 1, borderColor: C.border,
  },
  currencyRowActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  currencySymbolBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  currencySymbolText: { color: C.t1, fontSize: 16, fontWeight: "800" },
  currencyLabel: { color: C.t1, fontSize: 15, fontWeight: "600" },
  currencyCode:  { color: C.t3, fontSize: 12, marginTop: 1 },
  currencyCheck: { color: C.accent, fontSize: 18, fontWeight: "800" },

  aboutCloseBtn: {
    marginTop: 22, paddingVertical: 14, borderRadius: 14,
    alignItems: "center", backgroundColor: C.elevated,
    width: "100%",
  },
  aboutCloseBtnText: { color: C.t2, fontWeight: "600", fontSize: 15 },
  });
}
