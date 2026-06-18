import { useState } from "react";
import { View, Text, TouchableOpacity, Platform, Modal, TextInput } from "react-native";

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
  const [open, setOpen] = useState(false);

  if (Platform.OS === "web") {
    return (
      <TextInput
        className="bg-zinc-800 text-white rounded-xl px-4 py-3"
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#71717a"
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
      themeVariant="dark"
      textColor="#ffffff"
      onChange={(event: any, d?: Date) => {
        if (Platform.OS !== "ios") setOpen(false);
        if (d && (Platform.OS === "ios" || event.type === "set")) onChange(ymd(d));
      }}
    />
  ) : null;

  return (
    <>
      <TouchableOpacity
        className="bg-zinc-800 rounded-xl px-4 py-3"
        onPress={() => setOpen(true)}
      >
        <Text className="text-white">{prettyDate(value)}</Text>
      </TouchableOpacity>
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/60">
            <View className="bg-zinc-900 rounded-t-3xl p-4">
              <View className="flex-row justify-end mb-1">
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text className="text-emerald-400 font-bold text-base">Done</Text>
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
  const [open, setOpen] = useState(false);

  if (Platform.OS === "web") {
    return (
      <TextInput
        className="bg-zinc-800 text-white rounded-xl px-4 py-3"
        placeholder="HH:MM"
        placeholderTextColor="#71717a"
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
      themeVariant="dark"
      textColor="#ffffff"
      onChange={(event: any, d?: Date) => {
        if (Platform.OS !== "ios") setOpen(false);
        if (d && (Platform.OS === "ios" || event.type === "set")) onChange(hm(d));
      }}
    />
  ) : null;

  return (
    <>
      <View className="flex-row items-center">
        <TouchableOpacity
          className="bg-zinc-800 rounded-xl px-4 py-3 flex-1"
          onPress={() => setOpen(true)}
        >
          <Text className={value ? "text-white" : "text-zinc-500"}>
            {value ?? placeholder}
          </Text>
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity onPress={() => onChange(null)} className="ml-2 px-2" hitSlop={8}>
            <Text className="text-zinc-500">Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/60">
            <View className="bg-zinc-900 rounded-t-3xl p-4">
              <View className="flex-row justify-end mb-1">
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text className="text-emerald-400 font-bold text-base">Done</Text>
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
