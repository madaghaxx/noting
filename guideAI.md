# Noting Project Continuation Prompt

You are continuing a React Native / Expo learning + project-building session with the developer **madagha**.

## 1. Goal

We are building **Noting**, a serious offline-first secure notes application in React Native.

The goal is not to make a basic tutorial app. It should eventually be **significantly more advanced than the user's previous Flutter Secure Notes project**, while also being a vehicle for learning React Native and interview-level concepts.

The user has an interview in about **15 days**, and it is **not entry-level**, so explanations should prioritize practical and interview-relevant knowledge rather than beginner-level hand-holding.

The user prefers **short, focused answers and one step at a time**. Do not dump a huge tutorial unless explicitly requested.

---

# 2. Previous Flutter project

The user already successfully built and validated a Flutter project called **Secure Notes**.

It used:

- Flutter
- SQLite via `sqflite`
- biometric authentication via `local_auth`
- CRUD notes
- drag-and-drop reordering
- swipe-to-delete
- form validation
- localization
- persistent local storage
- Android/iOS-oriented mobile concepts

The project was successfully audited and received **100%**.

However, the user considers that implementation relatively simple.

We initially discussed using it as the baseline for Noting, but the user decided:

> Ignore the old Flutter implementation and continue learning React Native, then use its ideas as inspiration.

So **do not get stuck reproducing the Flutter project**.

---

# 3. Noting requirements decided so far

### Platform

- Android only for now.
- No planned public release yet.

### Framework

- **Expo / React Native**
- Expo for Noting.
- The user expects a future Chess project may use a more native/development-build approach.

### Language

**TypeScript**, not JavaScript.

Reason:

- better interview value
- static typing
- catches mistakes
- appropriate for production React Native projects

### Database

**SQLite**.

The user already knows SQLite.

We agreed SQLite is appropriate, but it should be hidden behind a repository/service layer so the database implementation can theoretically be replaced later.

### Security

Notes should be **actually encrypted at rest**.

Important clarification already made:

> Android Keystore does not directly encrypt the SQLite database for us.

The intended architecture is roughly:

```text
SQLite encrypted data
        ↑
encryption/decryption layer
        ↑
data encryption key
        ↑
Android secure key storage / Keystore
        ↑
biometric authentication / PIN fallback
```

Do not treat the biometric itself as the encryption key.

### Authentication

- biometric authentication
- PIN/password fallback

### Connectivity

Offline-only initially.

No cloud sync for the first version.

### Features

Currently planned:

- notes
- create/edit/delete
- favorites
- drag-and-drop reordering
- timestamps
- secure storage
- biometric unlock
- fallback authentication
- English initially
- architecture that can support additional languages later

Potential future additions can be considered, but **do not expand scope unnecessarily**.

### State management

We discussed Context vs Zustand.

Decision:

**Use Zustand.**

Even though the project could technically use Context, the user wants experience with Zustand and it will keep application state cleaner as the project grows.

### Testing

Decision:

- unit tests
- integration tests
- likely Jest + React Native Testing Library

Reason:

A secure application should test important behavior such as:

- database CRUD
- encryption/decryption
- authentication state
- note operations

Testing is also valuable for the user's upcoming interview.

### Architecture

We rejected an overly complicated Clean Architecture.

Decision:

**Feature-first architecture**, with a lightweight structure.

---

# 4. Architecture chosen

Current intended architecture:

```text
Noting/
├── app/                         # Expo Router only
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   │   └── unlock.tsx
│   ├── (app)/
│   │   ├── _layout.tsx
│   │   ├── notes/
│   │   │   ├── index.tsx
│   │   │   ├── new.tsx
│   │   │   └── [id].tsx
│   │   └── settings.tsx
│   └── +not-found.tsx
│
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── store/
│   │   │   └── services/
│   │   │
│   │   ├── notes/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── store/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   │
│   │   └── settings/
│   │       ├── components/
│   │       └── store/
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── encryption/
│   │   ├── biometrics/
│   │   └── storage/
│   │
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── constants/
│   └── types/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── assets/
└── ...
```

Important architectural rule:

```text
app/             = navigation / routes
features/        = business/application logic
infrastructure/  = database/security/device implementations
components/      = shared UI
```

Do not create every directory immediately. Introduce directories as features are implemented.

---

# 5. React concepts already covered

The user already has significant frontend knowledge.

They have previously built a framework from scratch involving:

- data binding
- virtual DOM
- framework internals

They have also used Flutter's `emit`.

Therefore, explanations should **not assume the user is a beginner**.

We covered:

### `useState`

Reactive state.

```tsx
const [count, setCount] = useState(0);
```

Mental model:

```text
useState = reactive component state
```

### `useEffect`

Side effects / synchronization with external systems.

```text
useEffect = interact with things outside normal rendering
```

Examples:

- subscriptions
- database operations
- listeners
- external APIs
- timers

We discussed how React's effect lifecycle differs conceptually from Flutter's lifecycle/dispose model.

### `useRef`

Persistent mutable container that survives renders without causing a render when `.current` changes.

```tsx
const ref = useRef(value);

ref.current = newValue;
```

Mental model:

```text
useRef = persistent mutable value, not reactive UI state
```

Useful for:

- TextInput refs
- timers
- WebSockets
- previous values
- imperative APIs

### `useContext`

Shared data through a component subtree without prop drilling.

Mental model:

```text
Provider supplies
       ↓
useContext consumes
```

Example:

```tsx
const AuthContext = createContext(null);

<AuthContext.Provider value={...}>
    <NotesScreen />
</AuthContext.Provider>
```

### `useMemo`

Caches a computed value.

```text
useMemo = cache expensive calculation
```

### `useCallback`

Caches a function reference.

```text
useCallback = preserve function identity
```

We summarized the important hooks:

| Hook          | Purpose                      |                        Re-render? |
| ------------- | ---------------------------- | --------------------------------: |
| `useState`    | Reactive state               |                               Yes |
| `useEffect`   | Side effects/synchronization |                        Indirectly |
| `useRef`      | Persistent mutable value     |                                No |
| `useContext`  | Shared state/dependencies    | Yes when consumed context changes |
| `useMemo`     | Memoized computation         |                      No by itself |
| `useCallback` | Memoized function reference  |                      No by itself |

We decided we had covered the important hooks for now and should **stop doing hook theory and build the project**.

---

# 6. React Native concepts already covered

The user already knows React Native core components such as:

- `View`
- `Text`
- `Image`
- `TextInput`
- `Pressable`
- `ScrollView`
- `FlatList`

We therefore decided not to spend excessive time on basic component theory.

We also discussed:

### Hermes

The user asked about Hermes, JIT and V8.

Important context:

- Hermes is the JavaScript engine commonly used by React Native.
- It is optimized specifically for React Native/mobile workloads.
- We discussed it as part of understanding React Native runtime architecture.
- Deeper JS ↔ native architecture should be learned naturally while building the project.

The user specifically said:

> "we will get that by starting the project"

So don't force a long architecture lecture before coding.

---

# 7. Initial Expo project

The user originally created an Expo starter and inspected its structure.

The original starter had:

```text
app/
├── (tabs)/
│   ├── _layout.tsx
│   ├── explore.tsx
│   └── index.tsx
├── _layout.tsx
└── modal.tsx
```

We discussed Expo Router concepts such as:

- `(tabs)` being a route group
- parentheses meaning the directory groups routes without becoming part of the URL/path
- `_layout.tsx`
- `Stack`
- `Tabs`
- `unstable_settings`
- route configuration
- navigation

The user changed a tab title from `"Home"` to `"test"` and initially thought it crashed, but it subsequently worked correctly.

They also understood that `Tabs.Screen` options are mostly declarative attributes/configuration.

---

# 8. Decision to restart from zero

The user explicitly decided:

> "forget the starter we starting from 0 now"

Therefore, the old starter structure should NOT be treated as part of the final project.

We created a new minimal project:

```bash
npx create-expo-app@latest Noting --template blank-typescript
```

Then:

```bash
cd ~/Desktop
cd Noting
```

The initial blank project contained:

```text
Noting/
├── App.tsx
├── index.ts
├── assets/
├── app.json
├── package.json
├── package-lock.json
└── tsconfig.json
```

We later removed the blank-template entry files:

```bash
rm App.tsx index.ts
```

because Expo Router would become the entry point.

---

# 9. Dependency installation struggle

We attempted:

```bash
npx expo install expo-router expo-secure-store expo-local-authentication expo-sqlite
npm install zustand
```

This initially failed with npm `ERESOLVE`.

The important conflict was:

```text
react@19.1.0
```

versus:

```text
react-dom@19.2.8
```

pulled by:

```text
expo-router@6.0.24
```

This caused the dependency tree to be inconsistent.

We explicitly decided:

**Do not use `--force` or `--legacy-peer-deps`.**

Instead we installed an Expo SDK 54 compatible Expo Router version:

```bash
npx expo install expo-router@~5.1.4 expo-secure-store expo-local-authentication expo-sqlite
```

This succeeded:

```text
added 2 packages
removed 40 packages
changed 1 package
```

Then:

```bash
npm install zustand
```

also succeeded.

npm reported:

```text
19 vulnerabilities
8 moderate
11 high
```

We discussed this.

Important rule:

- funding warnings are harmless
- audit vulnerabilities should eventually be investigated
- peer dependency conflicts are important
- don't blindly run `npm audit fix --force`
- first establish a correct Expo-supported dependency tree

---

# 10. Expo Router configuration

We configured `package.json` so the entry point is:

```json
"main": "expo-router/entry"
```

instead of:

```json
"main": "index.ts"
```

because `index.ts` was deleted.

We also added the Expo Router plugin to `app.json`:

```json
{
  "expo": {
    "plugins": ["expo-router"]
  }
}
```

---

# 11. Current route structure

We created:

```text
app/
├── _layout.tsx
├── (auth)/
│   └── unlock.tsx
└── (app)/
    ├── _layout.tsx
    └── index.tsx
```

This is the current routing skeleton.

The intended concept is:

```text
(auth)
   ↓
unlock
   ↓
(app)
   ↓
notes
```

Eventually authentication state will control access to the app flow.

---

# 12. Root layout currently

We put this into `app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

---

# 13. Route warnings encountered

After starting Expo Router, Metro successfully bundled the application, but warned:

```text
Route "./(app)/index.tsx" is missing the required default export.
Route "./(auth)/unlock.tsx" is missing the required default export.
Route "./_layout.tsx" is missing the required default export.
```

These happened because the route files were empty.

We fixed them with minimal default components.

`app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

`app/(auth)/unlock.tsx`:

```tsx
import { Text } from "react-native";

export default function UnlockScreen() {
  return <Text>Unlock</Text>;
}
```

`app/(app)/index.tsx`:

```tsx
import { Text } from "react-native";

export default function HomeScreen() {
  return <Text>Noting</Text>;
}
```

At this point Metro successfully bundles.

---

# 14. Expo tunnel/ngrok problem

The user uses:

```bash
npx expo start --tunnel
```

because they want to test on their physical Android phone.

Expo attempted to install:

```text
@expo/ngrok@^4.1.0
```

globally, but failed with npm error 243 because global npm was configured to:

```text
/usr/lib/node_modules
```

and the user does not have sudo.

The user previously uses a user-local npm prefix, so we fixed the global npm setup with:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Then:

```bash
npm install -g @expo/ngrok@^4.1.0
```

After that, Expo tunnel worked.

Important:
**Never suggest sudo for npm global installs for this user.**

---

# 15. Metro cache

The user asked what:

```bash
npx expo start -c
```

means.

Explanation already given:

`-c` clears the Metro bundler cache.

Useful after:

- dependency changes
- Metro transformation problems
- stale module resolution

It does **not** fix genuine dependency incompatibilities.

---

# 16. react-native-screens/codegen error

After the dependency setup, the project hit:

```text
react-native-screens/src/fabric/SearchBarNativeComponent.ts:
The first argument of method blur must be of type React.ElementRef<>
```

This was identified as a dependency mismatch involving `react-native-screens` and React Native codegen.

We fixed/re-aligned it with:

```bash
npx expo install react-native-screens
```

Then cleared Metro cache:

```bash
npx expo start --tunnel -c
```

After that, Android bundling succeeded.

---

# 17. Current state

The latest successful output is approximately:

```text
Android Bundled 13516ms node_modules/expo-router/entry.js
```

There are still warnings, but the bundler works.

Current important warning:

```text
Linking requires a build-time setting `scheme`
```

We decided this is **not important yet**.

We'll configure the scheme when we actually work with authentication/deep linking / production builds.

---

# 18. What should happen next

Do NOT jump straight into encryption implementation yet.

The immediate next phase should be:

### First

Make the routing architecture work:

```text
Root Stack
    │
    ├── (auth)
    │      └── unlock
    │
    └── (app)
           └── home/notes
```

Then introduce a small authentication state/store with Zustand.

Conceptually:

```text
auth store
    ↓
locked / unlocked
    ↓
router chooses accessible flow
```

After that:

1. build the authentication flow
2. implement biometric detection/authentication
3. design secure key management
4. implement encryption layer
5. implement SQLite repository
6. implement note model
7. build notes UI
8. add favorites/reordering
9. add timestamps
10. add testing
11. localization
12. polish/performance/interview-level improvements

---

# 19. How to teach the user

The user explicitly wants to learn, not merely copy code.

Use this style:

```text
Explain concept briefly
↓
Give ONE concrete step
↓
User implements/runs it
↓
Inspect result
↓
Next step
```

Do not dump 20 commands at once.

The user is an experienced developer and has worked with:

- Go
- JavaScript
- Rust
- Flutter/Dart
- Vue
- Angular
- Spring Boot
- Docker
- Linux
- databases
- virtual DOM/framework internals

Therefore explain React/React Native concepts using those mental models when useful.

For example:

```text
useState
≈ reactive state

useRef
≈ persistent mutable reference without triggering rendering

useEffect
≈ synchronization/side-effect lifecycle

Context
≈ dependency/state propagation through a component tree

Zustand
≈ external reactive store
```

Avoid explaining basic programming concepts.

---

# 20. Current project philosophy

The project should feel like a **real application**, not a Zone01 exercise.

Priorities:

```text
Correct architecture
        ↓
Security
        ↓
Maintainability
        ↓
Testing
        ↓
UX
        ↓
Performance
```

But avoid premature overengineering.

The user explicitly preferred the feature-first architecture over a huge Clean Architecture setup.

---

# 21. Current exact tree

At the latest point:

```text
Noting/
├── AGENTS.md
├── app/
│   ├── (app)/
│   │   ├── index.tsx
│   │   └── _layout.tsx
│   ├── (auth)/
│   │   └── unlock.tsx
│   └── _layout.tsx
├── app.json
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
├── CLAUDE.md
├── package.json
├── package-lock.json
└── tsconfig.json
```

The blank Expo `App.tsx` and `index.ts` have been removed.

The project currently has these important dependencies:

```text
expo-router
expo-secure-store
expo-local-authentication
expo-sqlite
zustand
```

and is based on **Expo SDK 54**.

---

# 22. Important constraints

- Do not downgrade/upgrade random Expo packages without checking SDK compatibility.
- Do not use `npm install --force` to hide dependency problems.
- Do not use `npm install --legacy-peer-deps` unless there is a very specific reason.
- Do not use sudo for npm global installs.
- Don't blindly run `npm audit fix --force`.
- Keep answers focused and progress one step at a time.
- The user is learning for a relatively advanced interview, so explain the **why**, but don't turn every step into a lecture.
- Build the application rather than endlessly studying theory.

## Current immediate task

**Continue from the working Expo Router skeleton and implement the `(auth)` / `(app)` navigation flow using Zustand.**

Do not recreate the Expo starter. We are building Noting from this point forward.
