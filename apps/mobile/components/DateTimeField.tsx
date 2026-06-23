import { useState } from "react";
import { View, Text, TouchableOpacity, Platform, Modal, TextInput } from "react-native";
import { useC, useScheme } from "../lib/useTheme";

// Native picker is required lazily so the web bundle never executes it.
let RNDateTimePicker: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNDateTimePicker = require("@react-native-community/datetimepicker").default;
}

const pad = (n: number) => String(n).padStart(2, "0");

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function hm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseYmd(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function parseHm(s: string | null): Date {
  const base = new Date();
  const m = s ? /^(\d{2}):(\d{2})$/.exec(s) : null;
  base.setHours(m ? Number(m[1]) : 12, m ? Number(m[2]) : 0, 0, 0);
  return base;
}
function prettyDate(s: string): string {
  return parseYmd(s).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Date selector. Value & onChange use "YYYY-MM-DD". */
export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const C = useC();
  const scheme = useScheme();
  const [open, setOpen] = useState(false);

  const fieldStyle = {
    backgroundColor: C.input,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.border,
  } as const;

  if (Platform.OS === "web") {
    return (
      <TextInput
        style={[fieldStyle, { color: C.t1, fontSize: 15 }]}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.t3}
        value={value}
        onChangeText={onChange}
      />
    );
  }

  const picker = RNDateTimePicker ? (
    <RNDateTimePicker
      value={parseYmd(value)}
      mode="date"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      themeVariant={scheme}
      textColor={C.t1}
      onChange={(event: any, d?: Date) => {
        if (Platform.OS !== "ios") setOpen(false);
        if (d && (Platform.OS === "ios" || event.type === "set")) onChange(ymd(d));
      }}
    />
  ) : null;

  return (
    <>
      <TouchableOpacity style={fieldStyle} onPress={() => setOpen(true)}>
        <Text style={{ color: C.t1, fontSize: 15 }}>{prettyDate(value)}</Text>
      </TouchableOpacity>
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
            <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 }}>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={{ color: C.accent, fontWeight: "700", fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              {picker}
            </View>
          </View>
        </Modal>
      ) : (
        open && picker
      )}
    </>
  );
}

/** Time selector. Value & onChange use "HH:MM" (nullable). */
export function TimeField({
  value,
  onChange,
  placeholder = "Set time",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const C = useC();
  const scheme = useScheme();
  const [open, setOpen] = useState(false);

  const fieldStyle = {
    backgroundColor: C.input,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.border,
    flex: 1,
  } as const;

  if (Platform.OS === "web") {
    return (
      <TextInput
        style={[fieldStyle, { color: C.t1, fontSize: 15 }]}
        placeholder="HH:MM"
        placeholderTextColor={C.t3}
        value={value ?? ""}
        onChangeText={(t) => onChange(t || null)}
      />
    );
  }

  const picker = RNDateTimePicker ? (
    <RNDateTimePicker
      value={parseHm(value)}
      mode="time"
      is24Hour
      display={Platform.OS === "ios" ? "spinner" : "default"}
      themeVariant={scheme}
      textColor={C.t1}
      onChange={(event: any, d?: Date) => {
        if (Platform.OS !== "ios") setOpen(false);
        if (d && (Platform.OS === "ios" || event.type === "set")) onChange(hm(d));
      }}
    />
  ) : null;

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity style={fieldStyle} onPress={() => setOpen(true)}>
          <Text style={{ color: value ? C.t1 : C.t3, fontSize: 15 }}>{value ?? placeholder}</Text>
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity onPress={() => onChange(null)} style={{ marginLeft: 8, paddingHorizontal: 8 }} hitSlop={8}>
            <Text style={{ color: C.t3 }}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
            <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 }}>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={{ color: C.accent, fontWeight: "700", fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
              {picker}
            </View>
          </View>
        </Modal>
      ) : (
        open && picker
      )}
    </>
  );
}
