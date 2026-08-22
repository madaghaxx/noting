import type { IconName } from "@/src/components/ui/Icon";

/**
 * The sidebar's contents, as data.
 *
 * Kept out of the component so the set of destinations, their order, and which
 * one counts as active are plain values that can be reasoned about — and tested —
 * without rendering anything.
 */
export type DestinationKey =
  | "all"
  | "pinned"
  | "trash"
  | "images"
  | "settings";

/** Which running total to show alongside a label. */
export type BadgeSource = "notes" | "pinned" | "deleted";

export type Destination = {
  key: DestinationKey;
  label: string;
  icon: IconName;
  pathname: "/" | "/pinned" | "/trash" | "/images" | "/settings";
  badge?: BadgeSource;
};

/**
 * Every destination is its own route, including Pinned.
 *
 * Pinned could have been a filter on the notes list, but then one sidebar row
 * would change state while the others navigate — and `dismissTo`, which is what
 * keeps tapping around the sidebar from stacking screens, needs a path to aim at.
 */
export const DESTINATIONS: readonly Destination[] = [
  {
    key: "all",
    label: "All Notes",
    icon: "notes",
    pathname: "/",
    badge: "notes",
  },
  {
    key: "pinned",
    label: "Pinned",
    icon: "pin",
    pathname: "/pinned",
    badge: "pinned",
  },
  {
    key: "trash",
    label: "Recently Deleted",
    icon: "trash",
    pathname: "/trash",
    badge: "deleted",
  },
  {
    key: "images",
    label: "Favorite Images",
    icon: "image",
    pathname: "/images",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "sliders",
    pathname: "/settings",
  },
];

/**
 * Which row to light up for the route currently on screen.
 *
 * The editor is reached from the notes list and keeps that row highlighted rather
 * than clearing the selection — a sidebar with nothing selected reads as though
 * the app has lost its place.
 */
export function activeDestination(pathname: string): DestinationKey {
  if (pathname.startsWith("/pinned")) return "pinned";
  if (pathname.startsWith("/trash")) return "trash";
  if (pathname.startsWith("/images")) return "images";
  if (pathname.startsWith("/settings")) return "settings";

  return "all";
}
