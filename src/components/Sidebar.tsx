import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LogoMark from "@/src/components/LogoMark";
import AppText from "@/src/components/ui/AppText";
import Icon from "@/src/components/ui/Icon";
import {
  activeDestination,
  DESTINATIONS,
  type BadgeSource,
  type Destination,
} from "@/src/navigation/destinations";
import { useAuthStore } from "@/src/store/auth-store";
import { lockEverything } from "@/src/store/lock";
import { useNotesStore } from "@/src/store/notes-store";
import { useSidebarStore } from "@/src/store/sidebar-store";
import { useTheme, type Theme } from "@/src/theme";
import { motion, TOUCH_TARGET } from "@/src/theme/tokens";

/** Widest the panel is allowed to get, however large the screen. */
const MAX_WIDTH = 320;

/** How far the panel has to be dragged left before releasing closes it. */
const CLOSE_DISTANCE = 56;

/** A flick closes it regardless of distance. */
const CLOSE_VELOCITY = 0.35;

function Row({
  destination,
  count,
  isActive,
  theme,
  onPress,
}: {
  destination: Destination;
  count: number | null;
  isActive: boolean;
  theme: Theme;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={
        count === null
          ? destination.label
          : `${destination.label}, ${count} ${count === 1 ? "item" : "items"}`
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.lg,
        minHeight: TOUCH_TARGET,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: isActive
          ? theme.colors.accentSubtle
          : pressed
            ? theme.colors.surfacePressed
            : "transparent",
      })}
    >
      <Icon
        name={destination.icon}
        size={21}
        filled={destination.icon === "pin"}
        color={isActive ? theme.colors.accent : theme.colors.textSecondary}
      />

      <AppText
        variant="label"
        tone={isActive ? "primary" : "secondary"}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {destination.label}
      </AppText>

      {/* Zero is left off rather than shown: an empty destination should look
          quiet, not like a counter stuck at nothing. */}
      {count !== null && count > 0 && (
        <AppText variant="caption" tone={isActive ? "accent" : "tertiary"}>
          {count}
        </AppText>
      )}
    </Pressable>
  );
}

/**
 * Noting's navigation panel.
 *
 * Built here rather than with a drawer navigator: the app has one accent, hairline
 * borders and its own motion, and a stock drawer brings its own. It also keeps the
 * dependency list as it is — the panel is an absolutely positioned overlay over
 * the group's stack, so no gesture or reanimated layer is needed.
 */
export default function Sidebar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pathname = usePathname();

  const isOpen = useSidebarStore((state) => state.isOpen);
  const close = useSidebarStore((state) => state.close);

  const notes = useNotesStore((state) => state.notes);
  const deleted = useNotesStore((state) => state.deleted);
  const loadDeleted = useNotesStore((state) => state.loadDeleted);

  const width = Math.min(MAX_WIDTH, screenWidth * 0.84);

  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  // Kept mounted only while it can be seen. An always-mounted overlay would sit
  // on top of the notes list swallowing touches even at zero opacity.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  useEffect(() => {
    drag.setValue(0);

    const animation = isOpen
      ? Animated.spring(progress, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 260,
          damping: 26,
          mass: 0.9,
        })
      : Animated.timing(progress, {
          toValue: 0,
          duration: motion.fast,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        });

    animation.start(({ finished }) => {
      if (finished && !isOpen) setMounted(false);
    });

    return () => animation.stop();
  }, [isOpen, progress, drag]);

  // The badge is the one number the sidebar cannot get from the notes list, so
  // it is read when the panel opens rather than kept in memory all the time.
  useEffect(() => {
    if (isOpen) loadDeleted();
  }, [isOpen, loadDeleted]);

  // Android's back gesture should close the panel, not leave the screen behind it.
  useEffect(() => {
    if (!isOpen) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        close();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isOpen, close]);

  const responder = useRef(
    PanResponder.create({
      // Only a horizontal drag, and only leftwards: the panel's own content may
      // scroll, and a vertical gesture belongs to it.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dx < -6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),

      onPanResponderMove: (_event, gesture) => {
        drag.setValue(Math.min(0, gesture.dx));
      },

      onPanResponderRelease: (_event, gesture) => {
        const shouldClose =
          gesture.dx < -CLOSE_DISTANCE || gesture.vx < -CLOSE_VELOCITY;

        if (shouldClose) {
          useSidebarStore.getState().close();
          return;
        }

        Animated.spring(drag, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 260,
          damping: 22,
          mass: 0.9,
        }).start();
      },

      onPanResponderTerminate: () => {
        Animated.spring(drag, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 260,
          damping: 22,
          mass: 0.9,
        }).start();
      },
    }),
  ).current;

  const go = useCallback(
    (destination: Destination) => {
      close();

      // `navigate` rather than `push`: it pops back to a destination already in
      // the stack instead of stacking a second copy, so the sidebar can never
      // build up a history of the same screen — and Back still walks out through
      // the notebook rather than straight out of the app.
      router.navigate(destination.pathname);
    },
    [close],
  );

  const handleLock = useCallback(() => lockEverything(), []);

  if (!mounted) return null;

  const counts: Record<BadgeSource, number> = {
    notes: notes.length,
    pinned: notes.filter((note) => note.isPinned).length,
    deleted: deleted.length,
  };

  const active = activeDestination(pathname);

  const translateX = Animated.add(
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, 0],
    }),
    drag,
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim. Dismisses on tap, and dims rather than hides so the screen behind
          still reads as the place you are coming back to. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#000",
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, theme.mode === "dark" ? 0.6 : 0.35],
            }),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
        />
      </Animated.View>

      <Animated.View
        {...responder.panHandlers}
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width,
            backgroundColor: theme.colors.surface,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: theme.colors.border,
            paddingTop: insets.top + theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.lg,
            transform: [{ translateX }],
          },
          theme.elevation(3),
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <LogoMark size={38} raised />

          <View style={{ flex: 1 }}>
            <AppText variant="heading">Noting</AppText>

            <AppText variant="caption" tone="tertiary">
              {notes.length === 0
                ? "Nothing written yet"
                : `${notes.length} ${notes.length === 1 ? "note" : "notes"} on this device`}
            </AppText>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.xxs,
          }}
        >
          {DESTINATIONS.map((destination) => (
            <Row
              key={destination.key}
              destination={destination}
              count={destination.badge ? counts[destination.badge] : null}
              isActive={destination.key === active}
              theme={theme}
              onPress={() => go(destination)}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.border,
            marginHorizontal: theme.spacing.md,
          }}
        >
          <Pressable
            onPress={handleLock}
            accessibilityRole="button"
            accessibilityLabel="Lock Noting now"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.lg,
              minHeight: TOUCH_TARGET,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: pressed
                ? theme.colors.surfacePressed
                : "transparent",
            })}
          >
            <Icon name="lock" size={19} color={theme.colors.textSecondary} />

            <AppText variant="label" tone="secondary">
              Lock now
            </AppText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
