# Noting — handoff for the next agent

You are continuing work on **Noting**, a private, offline-first notes app (Expo SDK 54 / React Native 0.81 / expo-router 6 / TypeScript / zustand / expo-sqlite). Everything lives on the device; there is no account and no network.

Read this whole file before touching code. Then read `AGENTS.md` (it requires consulting the versioned Expo docs at <https://docs.expo.dev/versions/v54.0.0/> before writing code that touches an Expo API).

---

## 1. Hard constraints (non-negotiable)

These come from the user and applied to the previous session too:

- **Never run `adb`.** Never ask the user to connect a phone, launch an emulator, run `sudo`, or do any device-based verification.
- **Do not stop work because the app cannot be launched on a device.** Verification happens entirely in user space.
- **Do not add dependencies** unless there is no reasonable alternative. The project deliberately has *zero* new runtime dependencies beyond what `package.json` shipped with. Icons, the Markdown parser/renderer, the swipe gesture, the sidebar, and SHA-256/HMAC/PBKDF2 are all hand-written for this reason. If you think a dependency is genuinely required, say so and explain the trade-off rather than adding it silently.
- **Preserve existing architecture and working features.** Do not rewrite unrelated code.

### How verification works here

| What | Command | Current state |
| --- | --- | --- |
| Types | `npx tsc --noEmit` (or `npm run typecheck`) | clean |
| Tests | `npm test` | **160 passing, 0 failing** |
| Real bundle | `npx expo export -p android --output-dir /tmp/x` | bundles, 1040 modules |
| Visual (icons/geometry only) | headless Chrome on a hand-written HTML mock — see §6 | used for the icon set |

Run all three after any change. `expo export` catches unresolved imports and syntax errors that `tsc` misses.

---

## 2. Current state of the ten requested features

The original brief had ten numbered features. Status:

| # | Feature | State |
| --- | --- | --- |
| 1 | Replace Favorite with Pin | **Done, tested** (12 tests) |
| 2 | Markdown note editing | **Done, tested** (58 tests across parser + editor transforms) |
| 3 | Biometric unlock (fingerprint / Face ID detection) | **Done, tested** (18 tests) |
| 4 | App relocking on background | **Done, tested** (8 tests) |
| 5 | Swipe to delete | **Done**, logic tested via the store; the gesture itself is untested (no renderer) |
| 6 | Sidebar / navigation | **Done**, model tested (7 tests); panel component untested |
| 7 | Recently Deleted | **Done, tested** (21 tests + 6 migration tests) |
| 8 | Passcode authentication | **Done, tested** (30 tests: crypto vs `node:crypto`, service, guard) |
| 9 | Security | **Mostly done** — see the FLAG_SECURE gap in §5 |
| 10 | UX quality | **Mostly done** — see §5 for what is left |

### What was actually built (by feature)

**1 — Pin.** The DB/repo/store layer had already been migrated from `is_favorite` to `is_pinned` by a previous session, but the **UI still called a `toggleFavorite` action that did not exist** — the app was broken mid-migration. That is now finished: `NoteCard`/notes screen use `togglePin`, the palette's `favorite` colour became `pin`, and the star glyph in `Icon.tsx` was replaced by a hand-drawn thumbtack. Pinned notes sort above unpinned (`ORDER BY is_pinned DESC, position ASC`) and pinning never rewrites `position`, which is what preserves manual order within each section.

**A real bug was found and fixed here:** `notes-store.reorder` wrote the new `position` to SQLite but left the in-memory note carrying its old one, so the next local re-sort (i.e. any pin toggle) silently undid the drag while the database disagreed. `moveNote` now returns `{ position, exhausted }` and the store mirrors it. Regression test: *"a drag survives a later pin"* in `tests/pin.test.mjs` (it fails if you revert the fix — verified).

**2 — Markdown.** Hand-written parser (`src/markdown/parse.ts`) → blocks/inlines as plain data; renderer (`src/markdown/Markdown.tsx`) maps them onto the existing type scale; `src/markdown/edit.ts` holds the formatting-bar text transformations as pure functions; `src/markdown/plain.ts` flattens markdown to words for card previews (replaced `toPreview`, now deleted from `format.ts`). Supports headings, bold/italic/both, inline code, fenced code (``` and ~~~, with language), links, autolinked bare URLs, bullet/ordered lists with nesting depth, blockquotes with lazy continuation, rules, and backslash escapes. Unrecognised or half-typed syntax stays literal — there are explicit tests for the states a document passes through *while being typed*. The editor (`app/(app)/note/[id].tsx`) opens saved notes in **Reading** mode and new notes in **Writing** mode; tapping the rendered note switches to Writing; a `FormatBar` appears only while the body has focus.

**3 — Biometrics.** `probeCapability()` reports hardware/enrolment/kinds/device-credential. `pickPrimary()` prefers **face → fingerprint → iris** (the brief's ordering). `describeMethod(kind, os)` returns platform-correct proper nouns ("Face ID"/"Touch ID" on iOS, "face unlock"/"fingerprint" on Android). `methodIcon(kind)` picks the badge glyph. The unlock screen only ever offers methods the device actually has, and auto-attempts biometrics once when the screen settles. Note the honest limitation encoded in the comments: **on Android the platform chooses the sensor**, so the app names the one the device leads with rather than promising a choice it cannot make.

**4 — Relocking.** `src/services/lifecycle.ts` `decideForAppState()` is a pure function returning `lock | shield | reveal | ignore`; `src/hooks/use-app-lock.ts` subscribes to `AppState` in the root layout and applies it; `PrivacyShield` covers the screen. **The critical rule is that nothing happens while `status === "authenticating"`** — the platform's own PIN screen is a separate activity that backgrounds the app, and reacting to it would cancel the unlock in progress every time (this is a trap; there are tests for it). `background` → lock, `inactive` → shield only, unknown → shield.

**5 — Swipe to delete.** `src/components/SwipeableRow.tsx`, built on `PanResponder` + `Animated` (no gesture-handler). Two stages: a short swipe parks the row open, a long swipe past `COMMIT` deepens the panel, fires a haptic detent, and commits on release. Two modes: `commit` (reversible actions — the notes list) and `reveal` (permanent actions — the trash, where a gesture must never be the last word). Only one row stays open at a time.

**6 — Sidebar.** `src/components/Sidebar.tsx` — a custom animated overlay rendered by `app/(app)/_layout.tsx` outside the `Stack`, with scrim, swipe-to-close, Android back handling, and live counts. Destinations live as data in `src/navigation/destinations.ts` (All Notes, Pinned, Recently Deleted, Favorite Images, Settings) so they are testable. Navigation uses `router.navigate()` — verified against the installed source that it dispatches react-navigation's `NAVIGATE`, which pops to an existing screen instead of stacking duplicates, and keeps Back walking out through the notebook. There is also a narrow left-edge open gesture on the wrapper around the navigator.

**7 — Recently Deleted.** Migration **v3** adds a nullable `deleted_at` plus two *partial* indexes (live / trashed). Deleting is a soft delete: the row never moves, so restore returns the note with its id, position, pin state and timestamps intact. `purgeNote`/`purgeAllDeleted` are guarded on `deleted_at IS NOT NULL` in SQL, so **no code path can destroy a live note in one step**. `updateNote`/`setPinned` are guarded on the live half. Nothing is ever auto-purged (deliberate — see §4). The trash screen shows "Deleted 2 hr ago", a Restore pill per row, reveal-only swipe to delete forever, and an Empty action; both permanent paths confirm.

**8 — Passcode.** `src/services/crypto.ts` implements SHA-256, HMAC-SHA-256 and PBKDF2 in plain TS (Hermes has no WebCrypto, and no crypto dependency was allowed). **`tests/crypto.test.mjs` compares all of it against Node's own `node:crypto`** over generated inputs and the padding-boundary lengths — this is the highest-value suite in the repo, because a mistake there would look like a working app with a weak verifier. `src/services/passcode-service.ts` stores `{v, salt, iterations, hash}` in SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, verified to exist in the installed module) at 25 000 PBKDF2 iterations — chosen against a measurement (≈150 ms in V8, so under a second on Hermes). There is a **persisted** attempt guard with escalating cooldowns (30 s → 60 s → 5 min → 15 min). A numeric `Keypad` component serves both the unlock screen and `app/(app)/passcode.tsx` (set / change / remove, with removal only offered *after* the current code is proved). Biometrics are never removed when a passcode exists.

**9 — Security.** Secure storage kept; passcode never stored or logged in plaintext (a test asserts the stored blob contains neither the code nor its base64/hex); error messages never quote the code; `equalBytes` compares in constant time; `lockEverything()` in `src/store/lock.ts` is the single lock path so note contents always leave the JS heap (including the trash list) whenever the app locks; no `console.*` calls anywhere in `src/` or `app/`.

**10 — UX.** Pin pop animation, swipe haptics (`src/utils/haptics.ts`, RN `Vibration`-based — `android.permission.VIBRATE` is now declared in `app.json`), undo snackbar, empty states for every list, confirmations on destructive actions, `useWindowDimensions`-based sidebar width and safe-area handling for different screen sizes.

---

## 3. Architecture map

```
app/                          expo-router routes (thin; screens live in src/ when shared)
  _layout.tsx                 theme + auth route guard + useAppLock + PrivacyShield
  (auth)/unlock.tsx           biometric + passcode unlock
  (app)/_layout.tsx           Stack + <Sidebar/> overlay + left-edge open gesture
  (app)/index.tsx             → src/screens/notes-screen (All Notes)
  (app)/pinned.tsx            → src/screens/notes-screen onlyPinned
  (app)/trash.tsx             Recently Deleted
  (app)/images.tsx            Favorite Images (placeholder — see §5)
  (app)/settings.tsx          Unlocking / Notebook / Storage sections
  (app)/passcode.tsx          set / change / remove passcode
  (app)/note/[id].tsx         editor with Writing/Reading modes

src/
  db/            database.ts, migrations.ts (forward-only), repositories/notes-repository.ts
  store/         notes-store, auth-store, sidebar-store, lock.ts (lockEverything)
  services/      auth-service, passcode-service, crypto.ts, lifecycle.ts
  markdown/      parse.ts, plain.ts, edit.ts, Markdown.tsx
  navigation/    destinations.ts
  screens/       notes-screen.tsx (shared by two routes)
  components/    Sidebar, SwipeableRow, UndoToast, ScreenHeader, Keypad,
                 PrivacyShield, NoteCard, BiometricBadge, LogoMark, ui/*
  theme/         palette.ts, tokens.ts, index.tsx (useTheme, elevation)
  utils/         format.ts, haptics.ts, id.ts, search.ts (unused — see §5)
```

**Layering rules to respect**

- SQL lives only in `src/db/repositories/*`. Stores never write SQL.
- Stores mutate optimistically, then reconcile with what the write returned, and roll back on failure. **If a write returns a value the UI holds a copy of, mirror it** — that was the source of the reorder bug.
- `NoteRow` (snake_case, integer booleans) stops at the repository boundary; `Note` (camelCase, real booleans) is what the rest of the app sees.
- All colour/spacing/type/motion comes from `useTheme()` / `tokens.ts`. There is no ad-hoc `fontSize:` anywhere; keep it that way.
- Text goes through `AppText`; icons through `Icon` (hand-drawn from Views).
- Anything worth testing should be a pure function outside a component. That is why `destinations.ts`, `lifecycle.ts`, `markdown/edit.ts` and `crypto.ts` exist as separate modules.

---

## 4. Decisions already made — do not silently reverse these

Each of these was deliberate; the reasoning is also in code comments.

1. **Positions are assigned from the global minimum** (`SELECT MIN(position) FROM notes`, unscoped). Scoping to unpinned would hand new notes positions that pinned notes already hold, and the moment such a note is pinned two notes share a position — where SQLite's order and the in-memory sort are free to disagree. `rebalanceSection` intentionally renumbers deleted rows too.
2. **Shipped migrations are immutable.** `MIGRATIONS[0]` still creates `is_favorite` because v1 devices have that column and migration 2 renames it. Append a new migration; never edit an existing one.
3. **Nothing is auto-purged from the trash.** The brief said "do not permanently delete anything accidentally", so retention is explicit-only and the trash screen says so. If you add a 30-day sweep, make it opt-in and announce it in the UI.
4. **Swipe commits without a dialog on the notes list** (the action is reversible and the gesture is armed + haptic), while **long-press asks first** (it is ambiguous, and it is the only path a screen reader has). Permanent deletion always confirms.
5. **Pinned is a real route**, not a filter flag, so every sidebar row maps to exactly one pathname and `navigate`'s semantics stay unambiguous.
6. **`describeMethod` takes the OS as an argument** instead of importing `Platform`, which is what keeps `auth-service` testable in Node. Don't "simplify" it by importing `Platform`.
7. **The salt fallback is documented, not accidental.** Hermes has no `getRandomValues`; the fallback mixes clock + counter + `Math.random` and the comment explains that a salt needs *uniqueness*, not unpredictability. If you add `expo-crypto`, delete the fallback rather than leaving both.
8. **The privacy shield is a JS-level mitigation** for the app-switcher thumbnail and says so in its own doc comment. It does not stop deliberate screenshots — see §5.

---

## 5. Outstanding work, in priority order

Nothing here is blocking; the app builds, typechecks and passes 160 tests. These are the honest gaps.

### High value

1. **`FLAG_SECURE` / screenshot blocking (feature 9's last mile).** The real fix is `expo-screen-capture`'s `preventScreenCaptureAsync()` while unlocked, which sets `FLAG_SECURE` on Android. That is a new native dependency and a rebuild, so it was left out and documented in `src/components/PrivacyShield.tsx`. Decide with the user whether to add it. Acceptance: content excluded from screenshots/recordings while unlocked, shield still covering during transitions.
2. **Drag-to-reorder UI.** `notes-store.reorder` and the whole float-position scheme are implemented and tested, but **nothing in the UI calls them** — manual order is currently insertion order. Doing this without `react-native-reanimated`/`gesture-handler` means a `PanResponder` long-press-drag inside the `FlatList`; it is the largest remaining piece of UI work. Acceptance: dragging within a section persists and survives a reload; cross-section drags stay refused (the store already refuses them).
3. **Search.** `src/utils/search.ts` (`matchesQuery`, `filterNotes`, `highlight`) and the store's `query`/`setQuery` are fully written and **entirely unused** — there is no search field. This is the cheapest large win in the app: add a field to the notes-screen header, filter with `filterNotes`, and render matches with `highlight`. Acceptance: filtering is instant, empty-result state handled, pinned grouping preserved.

### Medium

4. **Favorite Images is an honest placeholder.** Notes are text-only; there is no attachment feature, so the screen is a well-designed empty state that says what will appear there. It was left that way deliberately rather than faking a grid. If the user wants it real, that is a new feature: image picking (`expo-image-picker`), storage, a `note_images` table or a favourites table, and a grid screen.
5. **Component-level tests.** `Sidebar`, `SwipeableRow`, `Keypad`, `UndoToast` and the Markdown *renderer* have no tests because there is no renderer in the harness. Options: add `react-test-renderer` + a `react-native` preset (a devDependency — ask first), or extract more decision logic into pure modules (e.g. the swipe's release rule: distance/velocity → `commit | open | close`, which is currently inline in `SwipeableRow`). The second option fits this project's grain better.
6. **Store-level auth tests.** `auth-store.submitPasscode` (lockout branch, unlock beat, guard reset) is untested because the store is only reachable through zustand; the *service* beneath it is well covered. Testing it needs no renderer — it would just need the store imported in Node, which works today (`notes-store` already is). Worth doing.
7. **`greeting()` in the header** is only used on All Notes; check it still reads well beside the new subtitle line on small screens.

### Low

8. **Iris copy.** `describeMethod` returns the bare word "iris"; if any target device reports iris-only, the sentence "Unlock with iris" is awkward.
9. **`formatRelativeTime` falls back to `toLocaleDateString()`** for anything older than a week — fine, but the trash's "Deleted …" line will read as a bare date for old items.
10. **Editor `pendingSelection` pattern.** The formatting bar controls the `TextInput` selection for exactly one render and then releases it (a permanently controlled selection fights the Android keyboard). This is the one piece of the editor that most wants real-device confirmation; if the user ever provides device output, check cursor placement after each toolbar button first.

---

## 6. The test harness (read before adding tests)

Zero dependencies. `npm test` runs `node --test tests/*.test.mjs` with `--import ./tests/support/register.mjs`, which registers module hooks that:

- resolve the `@/*` tsconfig alias,
- fill in the extensions TS-style imports omit,
- swap native modules for stand-ins in `tests/support/`.

Node 24 strips TypeScript types itself, so tests import the app's **real** modules — real store, real repository, real migrations. `--import` propagates to `node --test` child processes, so **each test file gets its own process**, hence a fresh in-memory DB and fresh module singletons. Tests within a file share state and run in order on purpose (ordering bugs only appear in sequences).

Stand-ins:

| Module | Stand-in | Notes |
| --- | --- | --- |
| `expo-sqlite` | `tests/support/expo-sqlite.mjs` | **Real SQLite** via `node:sqlite`, in-memory. Migrations and queries genuinely execute. |
| `expo-local-authentication` | `…/expo-local-authentication.mjs` | `setDevice({...})` describes a phone; `deviceCalls()` asserts what was asked of it. |
| `expo-secure-store` | `…/expo-secure-store.mjs` | Plain `Map`; `__dump()` makes "never stored in plaintext" checkable. |

To shim another native module, add a file there and one entry to `STANDINS` in `register.mjs`. **Keep `react-native` out of anything you want to test** — import types from it (type imports are stripped) but not values.

Visual checks: RN Views and CSS boxes share a box model, so the icon geometry was verified by hand-translating `Icon.tsx`'s numbers into an HTML mock and screenshotting it with `google-chrome --headless --screenshot`. That is how the pin was caught reading as a mushroom on the first attempt, and how the outlined cap was found collapsing to solid at 20 px. Reuse the technique for new hand-drawn icons; it does not extend to whole screens.

---

## 7. Writing style expected in this codebase

Match it — the existing code is consistent and the user's brief valued polish.

- Comments explain **why**, and specifically why the non-obvious choice was made ("`is_pinned DESC` puts 1 before 0. Because the flag dominates the sort, pinning a note moves it to the top section without rewriting its position"). Avoid comments that restate the code.
- Doc comments on every exported function/component; note the trap where there is one.
- Prose is plain and unhyped. UI copy is short, specific, sentence case, and never scolds ("Nothing here is deleted automatically. Notes stay until you empty this list.").
- Prefer a pure function in a module over logic inside a component.
- British-ish spelling appears in prose ("favourites", "colour") while identifiers and user-facing labels required by the brief stay as specified (`Favorite Images`).

---

## 8. Suggested first moves

1. `npm install` (fresh machine), then `npx tsc --noEmit && npm test && npx expo export -p android --output-dir /tmp/x` to confirm you start from green: **160 passing, tsc clean, 1040 modules**.
2. Skim `src/store/notes-store.ts`, `src/db/repositories/notes-repository.ts` and `tests/pin.test.mjs` — they encode the ordering invariants everything else depends on.
3. Pick from §5. If the user gives no direction, **search (item 3)** is the highest value per line of code, and **drag-to-reorder (item 2)** is the biggest genuinely-missing capability.
4. Ask the user before adding any dependency, including `expo-screen-capture`, `expo-crypto`, `expo-haptics`, `react-native-reanimated`, `react-native-gesture-handler`, or a test renderer.

Nothing in this project has been run on a physical device or emulator. Every claim above is backed by `tsc`, the 160 tests, a successful Metro bundle, or source inspection — and where something could not be verified that way, it is called out rather than assumed.
