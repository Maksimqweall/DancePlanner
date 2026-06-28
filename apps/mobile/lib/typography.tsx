// Global typography — maps every <Text>/<TextInput> to Plus Jakarta Sans, picking
// the right weighted font face from the element's `fontWeight`. This lets all the
// existing screens keep using `fontWeight: '800'` etc. and automatically get the
// premium typeface with correct weights (RN can't synthesise weights from a single
// static family, so we resolve a concrete face per weight).
import React from "react";
import { Text, TextInput, StyleSheet, Platform, type TextStyle, type StyleProp } from "react-native";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

// Font assets to hand to `useFonts` in the root layout.
export const FONT_ASSETS = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

// fontWeight → concrete font face. PJS tops out at 800, so 900 maps there too.
const FAMILY_BY_WEIGHT: Record<string, string> = {
  "100": "PlusJakartaSans_400Regular",
  "200": "PlusJakartaSans_400Regular",
  "300": "PlusJakartaSans_400Regular",
  "400": "PlusJakartaSans_400Regular",
  normal: "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  bold: "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
  "900": "PlusJakartaSans_800ExtraBold",
};

function familyFor(weight: TextStyle["fontWeight"]): string {
  return FAMILY_BY_WEIGHT[String(weight ?? "400")] ?? FAMILY_BY_WEIGHT["400"];
}

let installed = false;

/**
 * Patch RN's Text & TextInput so every instance renders in Plus Jakarta Sans with a
 * weight-correct face, unless a `fontFamily` is already set explicitly. Idempotent.
 */
export function installTypography(): void {
  if (installed) return;
  installed = true;

  type StyledElement = React.ReactElement<{ style?: StyleProp<TextStyle> }>;
  for (const Comp of [Text, TextInput] as const) {
    const Any = Comp as unknown as {
      render?: (...args: unknown[]) => StyledElement;
    };
    const orig = Any.render;
    if (typeof orig !== "function") continue;

    Any.render = function patched(...args: unknown[]): StyledElement {
      const el = orig.apply(this, args);
      if (!el || !el.props) return el;
      const flat = (StyleSheet.flatten(el.props.style) || {}) as TextStyle;
      if (flat.fontFamily) return el; // explicit family wins
      const fontFamily = familyFor(flat.fontWeight);
      // On web, RN-web has already produced a DOM element whose `style` must be a
      // plain object — passing an array makes React DOM try to set indexed props on
      // CSSStyleDeclaration and throw. So merge into one object there; arrays are
      // fine (and cheaper) on native.
      const style = Platform.OS === "web"
        ? { ...flat, fontFamily }
        : [{ fontFamily }, el.props.style];
      return React.cloneElement(el, { style });
    };
  }
}
