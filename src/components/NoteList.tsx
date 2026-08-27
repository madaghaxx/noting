import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, FlatList, PanResponder, View } from "react-native";

import NoteCard from "@/src/components/NoteCard";
import SwipeableRow from "@/src/components/SwipeableRow";
import { useTheme } from "@/src/theme";
import type { Note } from "@/src/types/note";
import { haptics } from "@/src/utils/haptics";
import {
  displacement,
  dropIndex,
  sectionBounds,
  stack,
  type Slot,
} from "@/src/utils/reorder";

/**
 * A note with its body already stripped of Markdown.
 *
 * `title` is duplicated out of the note so a row is directly searchable — see
 * `utils/search`, which wants a plain `{ title, content }` to match against.
 */
export type NoteRow = {
  note: Note;
  title: string;
  content: string;
};

type Props = {
  rows: NoteRow[];
  query: string;
  /**
   * Whether a note can be picked up and moved.
   *
   * False while searching: the rows on screen are then a subset, so their indices
   * are not the notebook's indices and dropping one "between" two visible notes
   * would mean nothing.
   */
  reorderable: boolean;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
  /** Both indices are into `rows`, which for a reorderable list is the notebook. */
  onReorder: (from: number, to: number) => void;
  paddingBottom: number;
};

/** Used for a row that has not reported its height yet. */
const ASSUMED_ROW_HEIGHT = 108;

type Drag = {
  id: string;
  from: number;
  /** Where it would land if released now. */
  to: number;
};

/**
 * One row of the notes list: swipeable, and able to be picked up.
 *
 * Split out so each row owns the spring that moves it aside. The alternative —
 * one animation driver in the list — would mean the list re-running every row's
 * animation whenever the drop target changed.
 */
function Row({
  row,
  query,
  shift,
  lifted,
  liftY,
  reorderable,
  onOpen,
  onTogglePin,
  onDelete,
  onLift,
  onMove,
  onRelease,
  onMeasure,
}: {
  row: NoteRow;
  query: string;
  /** How far aside this row should sit while something is dragged over it. */
  shift: number;
  lifted: boolean;
  liftY: Animated.Value;
  reorderable: boolean;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
  onLift: (note: Note) => void;
  onMove: (note: Note, direction: -1 | 1) => void;
  onRelease: () => void;
  onMeasure: (id: string, height: number) => void;
}) {
  const theme = useTheme();
  const aside = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(aside, {
      toValue: shift,
      useNativeDriver: true,
      stiffness: 320,
      damping: 30,
      mass: 0.9,
    }).start();
  }, [shift, aside]);

  return (
    <Animated.View
      onLayout={(event) =>
        onMeasure(row.note.id, event.nativeEvent.layout.height)
      }
      style={[
        { transform: [{ translateY: lifted ? liftY : aside }] },
        // Above the rows it is passing over, and lifted off the page. `zIndex`
        // alone does nothing on Android — elevation is what orders siblings there.
        lifted && { zIndex: 2, ...theme.elevation(3) },
      ]}
    >
      <SwipeableRow
        label="Delete"
        // A row cannot be swiped away while it is being carried.
        enabled={!lifted}
        onAction={() => onDelete(row.note)}
      >
        <NoteCard
          note={row.note}
          preview={row.content}
          query={query}
          lifted={lifted}
          onPress={onOpen}
          onTogglePin={onTogglePin}
          onLift={reorderable ? onLift : undefined}
          onMove={reorderable ? onMove : undefined}
          onRelease={onRelease}
        />
      </SwipeableRow>
    </Animated.View>
  );
}

/**
 * The notes list.
 *
 * Reordering is a long press followed by a drag, which is the gesture both
 * platforms already use for "pick this up and put it somewhere else". It is built
 * from `PanResponder` and `Animated`, like every other gesture in the app, rather
 * than from a draggable-list dependency: the list is flat, single-column and
 * short, which is the case those libraries' generality is for.
 *
 * The responder lives on the container and only claims a touch once a card has
 * actually been picked up. Because it claims it in the capture phase, it takes
 * over from the card's own press handling mid-gesture — the finger never has to
 * be lifted between the long press and the drag.
 *
 * The arithmetic is in `utils/reorder`, where it can be tested.
 */
export default function NoteList({
  rows,
  query,
  reorderable,
  onOpen,
  onTogglePin,
  onDelete,
  onReorder,
  paddingBottom,
}: Props) {
  const theme = useTheme();
  const gap = theme.spacing.md;

  const [drag, setDrag] = useState<Drag | null>(null);

  const liftY = useRef(new Animated.Value(0)).current;
  const heights = useRef(new Map<string, number>()).current;

  /**
   * Everything the gesture needs, kept out of React state.
   *
   * The responder is created once and reads through this; and the slot geometry
   * is deliberately frozen at pick-up, so the rows moving aside underneath cannot
   * feed back into the calculation of where the finger is.
   */
  const held = useRef<{
    from: number;
    to: number;
    slots: Slot[];
    bounds: [number, number];
    /**
     * Whether the container has taken the gesture over yet.
     *
     * A long press that is released without moving never produces one, so the
     * card would otherwise stay picked up with nothing left to put it down.
     */
    captured: boolean;
  } | null>(null);

  const onMeasure = useCallback(
    (id: string, height: number) => {
      heights.set(id, height);
    },
    [heights],
  );

  const finish = useCallback(
    (commit: boolean) => {
      const current = held.current;

      if (!current) return;

      const { from, to, slots } = current;

      // Settle onto the target row before the list actually reorders, so the card
      // is put down where it was dropped rather than teleporting there.
      const resting =
        commit && slots[to] && slots[from]
          ? slots[to].top - slots[from].top
          : 0;

      held.current = null;

      Animated.spring(liftY, {
        toValue: resting,
        useNativeDriver: true,
        stiffness: 300,
        damping: 30,
        mass: 0.9,
      }).start(() => {
        // One commit: the list reorders and the lift resets together, so there is
        // no frame in which the card is at its old index with no offset.
        liftY.setValue(0);
        setDrag(null);

        if (commit && from !== to) onReorder(from, to);
      });
    },
    [liftY, onReorder],
  );

  // The responder is built once, so it reads `finish` through a ref rather than
  // freezing whichever one existed on first render.
  const latestFinish = useRef(finish);

  latestFinish.current = finish;

  const responder = useRef(
    PanResponder.create({
      // Capture, so a card that has been picked up hands the gesture over without
      // the finger being lifted. Only ever true once a drag is under way.
      onMoveShouldSetPanResponderCapture: () => {
        if (!held.current) return false;

        held.current.captured = true;

        return true;
      },

      onPanResponderMove: (_event, gesture) => {
        const current = held.current;

        if (!current) return;

        liftY.setValue(gesture.dy);

        const { from, slots, bounds } = current;
        const slot = slots[from];

        if (!slot) return;

        const centre = slot.top + slot.height / 2 + gesture.dy;
        const next = dropIndex(slots, from, centre, bounds);

        if (next === current.to) return;

        current.to = next;
        setDrag((value) => (value ? { ...value, to: next } : value));

        // One tap per row crossed: the list is moving under the finger, and the
        // buzz is what confirms the move registered rather than merely looked
        // like it.
        haptics.detent();
      },

      onPanResponderRelease: () => latestFinish.current(true),
      onPanResponderTerminate: () => latestFinish.current(false),
    }),
  ).current;

  const lift = useCallback(
    (note: Note) => {
      const from = rows.findIndex((row) => row.note.id === note.id);

      if (from === -1) return;

      const slots = stack(
        rows.map((row) => heights.get(row.note.id) ?? ASSUMED_ROW_HEIGHT),
        gap,
      );

      held.current = {
        from,
        to: from,
        slots,
        // Pinned notes stay above unpinned ones, so a drag is confined to the
        // section it started in.
        bounds: sectionBounds(
          rows.map((row) => row.note.isPinned),
          from,
        ),
        captured: false,
      };

      liftY.setValue(0);
      setDrag({ id: note.id, from, to: from });
      haptics.detent();
    },
    [rows, heights, gap, liftY],
  );

  /**
   * The finger came off a card that was picked up but never dragged anywhere.
   *
   * Ignored once the container has the gesture, because then the card's own press
   * has already been terminated and the release that matters is the pan's.
   */
  const release = useCallback(() => {
    if (held.current && !held.current.captured) finish(false);
  }, [finish]);

  /** The accessible equivalent of a drag: one step, within the section. */
  const move = useCallback(
    (note: Note, direction: -1 | 1) => {
      const from = rows.findIndex((row) => row.note.id === note.id);

      if (from === -1) return;

      const [first, last] = sectionBounds(
        rows.map((row) => row.note.isPinned),
        from,
      );

      const to = from + direction;

      if (to < first || to > last) return;

      onReorder(from, to);
    },
    [rows, onReorder],
  );

  return (
    <View style={{ flex: 1 }} {...responder.panHandlers}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.note.id}
        keyboardShouldPersistTaps="handled"
        // The list must hold still while a card is being carried over it.
        scrollEnabled={drag === null}
        renderItem={({ item, index }) => (
          <Row
            row={item}
            query={query}
            lifted={drag?.id === item.note.id}
            liftY={liftY}
            shift={
              drag
                ? displacement(
                    index,
                    drag.from,
                    drag.to,
                    (heights.get(drag.id) ?? ASSUMED_ROW_HEIGHT) + gap,
                  )
                : 0
            }
            reorderable={reorderable}
            onOpen={onOpen}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            onLift={lift}
            onMove={move}
            onRelease={release}
            onMeasure={onMeasure}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.xs,
          paddingBottom,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
