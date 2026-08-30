# Noting

A private, offline-first Markdown notebook for **iOS and Android**, built with Expo and React Native.

Noting keeps everything on the device. There is no account, no cloud sync, and no network dependency — your notes live in a local SQLite database and are protected by your device's biometric lock.

> **Authentication note:** Face ID can only be verified in an iOS **development build** — it does not work through Expo Go. See [iOS notes](#ios-notes).

---

## Screenshots

_Screenshots coming soon._

---

## Features

- **Biometric-only unlock** — the app opens with the system biometric prompt. On devices that support it this means **fingerprint / Touch ID** or **Face ID / facial recognition**; the device's own enrolled biometric is used. There is no app passcode, PIN, or device-credential fallback.
- **Create, edit, search, pin, and reorder notes.**
- **Markdown writing and preview** — write in plain source or switch to a rendered preview. A formatting bar covers headings, bold, italics, inline code, lists, quotes, and links.
- **Drag-and-drop ordering** with automatic section clamping (pinned notes always stay above unpinned ones). Keyboard/screen-reader "move up / move down" actions provide the accessible equivalent.
- **Swipe-to-delete** with an undo toast.
- **Recently Deleted** — deletions are reversible. Notes stay there until you restore them or empty the list; individual and empty-all actions both confirm before anything is destroyed.
- **Sidebar navigation** between All Notes, Pinned, and Recently Deleted.
- **In-memory search** over titles and body text, with highlighted matches and a context-aware preview.
- **Automatic relock** and privacy shield when the app leaves the foreground, so notes aren't visible in the app switcher.
- **Light and dark themes**, phone and tablet layouts, accessibility labels, and platform haptics.

Noting does **not** support images or media attachments — it is a text notebook.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Expo SDK 54 / React Native 0.81 |
| Language | TypeScript (strict) |
| Routing | expo-router 6 |
| State | Zustand |
| Storage | expo-sqlite (local SQLite) |
| Biometrics | expo-local-authentication |

Icons, the Markdown parser/renderer, swipe gestures, and the sidebar are all hand-written rather than imported as libraries, keeping the dependency list small and the UI consistent.

---

## Architecture

- **`app/`** — Expo Router routes. The root layout owns the lock guard and the global confirmation dialog and privacy shield. The `(auth)` group is the biometric unlock screen; the `(app)` group holds the notebook screens.
- **`src/`** — application logic.
  - **`db/`** — the SQLite connection, forward-only migrations, and a repository that owns every query. Column names and integer booleans stop at this boundary.
  - **`store/`** — Zustand stores for notes, authentication, confirmations, and the sidebar. Mutations are optimistic: state updates first, and the previous list is restored if a write fails.
  - **`services/`** — biometric capability detection/authentication and app-lifecycle lock decisions.
  - **`markdown/`** — a hand-written Markdown parser, the text transformations behind the formatting bar, a plain-text flattener for previews, and the renderer.
  - **`components/`** + **`theme/`** — the shared UI system: a single text component, buttons, cards, inputs, icons (drawn from primitives), and a light/dark design-token system.

## Authentication and security

- The unlock screen probes the device (`hasHardwareAsync`, `isEnrolledAsync`, `supportedAuthenticationTypesAsync`) before offering anything, and never advertises a sensor that isn't there.
- Authentication goes through the **system biometric prompt** via `LocalAuthentication.authenticateAsync()`. The app never selects a specific sensor — the platform uses whichever biometric is enrolled, so fingerprint-only, Face ID-only, and multi-biometric devices all work. The modal shown in the UI copy matches the device's primary enrolled method.
- Devices with no enrolled biometric are handled gracefully with a clear message and no deep failure.
- On iOS, the `expo-local-authentication` config plugin sets `NSFaceIDUsageDescription`, which is required for Face ID in a native build.
- **Lock lifecycle:** when the app backgrounds, notes are cleared from memory and the app requires authentication again. A privacy shield covers the content immediately on the transition to keep it out of app-switcher thumbnails.

### Data storage

Notes are stored in **SQLite on the device**, unencrypted at rest and protected by the biometric gate plus the platform's per-app sandbox. The database is intentionally **not** encrypted with SQLCipher; encrypting it would require a native config-plugin flag and a development build, which is a deliberate, separate decision documented in `src/db/database.ts`.

**SecureStore is intentionally not used.** Noting stores no credentials, tokens, or small secret values (the only key held by the app is the biometric authentication result). SecureStore is also unsuitable for note bodies, which can exceed platform key-value storage limits — those live in the database instead.

---

## Project structure

```
app/                  Expo Router routes (auth guard + notebook screens)
src/
  components/         Shared UI: cards, buttons, sidebar, swipe rows, dialogs…
  db/                 SQLite connection, migrations, notes repository
  hooks/              App-lock and entrance-animation hooks
  markdown/           Parser, editor transforms, plain-text, renderer
  navigation/         Sidebar destinations and screen transitions
  screens/            Notes list screen
  services/           Biometrics and lifecycle decisions
  store/              Zustand stores
  theme/              Design tokens, palettes, ThemeProvider
  types/              Note model
  utils/              Formatting, search, reordering, ids, haptics
tests/                Node-based test suite (separate from Jest)
```

---

## Installation

```bash
npm install
```

Requires Node.js 20.19 or newer (Expo SDK 54).

## Development

```bash
npm start          # start the Expo dev server
npm run ios        # open in iOS (Expo Go or a dev build)
npm run android    # open in Android
npm run web        # open in the browser
```

> Face ID is **not** supported in Expo Go on iOS. To test Face ID you need an iOS development build (`npx expo run:ios`).

## Testing

```bash
npm test           # Node test suite (154 tests)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
```

The tests run the app's real TypeScript against an in-memory SQLite and a fake `expo-local-authentication`, covering authentication capability handling, lifecycle relocking, Markdown parsing/editing, search, pinning, ordering, Recently Deleted, restore, migrations, and permanent deletion.

## Production build

The project uses Continuous Native Generation (CNG): native projects are generated on demand, and the iOS `Info.plist` (including `NSFaceIDUsageDescription`) is produced by the config plugins in `app.json`.

```bash
# Android release APK/AAB
npx eas build --platform android --profile production

# iOS release (requires an Apple Developer account; Face ID testing requires this)
npx eas build --platform ios --profile production
```

or, building locally with the native toolchains installed:

```bash
npx expo run:android --variant release
npx expo run:ios --configuration Release
```

**Release target note:** because Noting uses native biometric functionality, Expo Go is not a valid release target. Ship a real native build.

## iOS notes

- `expo-local-authentication` does **not** support Face ID in Expo Go. Face ID must be verified in a development or standalone/release build.
- The app config includes the required `NSFaceIDUsageDescription` permission through the `expo-local-authentication` plugin.

## Android notes

- Uses the Android system biometric prompt (`BiometricsSecurityLevel: 'weak'`), so both fingerprint and camera-based face unlock work where the device supports them.
- The Android manifest permission `android.permission.VIBRATE` is declared for the haptics used on swipe/reorder.

---

## Known limitations

- **Text-only.** Image and media attachments are not implemented.
- **Unencrypted at rest.** Device biometrics protect access; the SQLite file is not encrypted (see [Data storage](#data-storage)).
- **Face ID must be tested in a native build**, not Expo Go.
- **Web is alpha.** A web deployment requires the COOP/COEP headers needed for the SQLite WebAssembly build; the included Metro config handles bundling its asset.
- The sidebar shows navigation, not user-defined categories.

## Dependency advisories

`npm audit` reports 18 transitive advisories (9 moderate, 9 high) within the Expo/Metro toolchain (`@expo/config` and dependents such as `expo-constants`, `expo-linking`, and `expo-router`). The available remediation upgrades the Expo SDK to v57, a major migration outside this project's SDK 54 scope, so it has not been applied.

---

## License

_To be added before publishing._
