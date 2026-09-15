# SAA mobile

Offline-first iOS/Android app for the AWS SAA study workspace: lectures, drills, cards, mock
exams. The curriculum, both question banks and all 21 lectures are compiled into the JS bundle,
so content is never fetched. Progress is local, and optionally mirrored to the web app — see
Sync below.

Content is generated, not fetched. After editing anything in `content/` or `lectures/_src/` at
the repo root, regenerate:

```bash
npm run lectures      # from the repo root: web lectures + mobile content + src/generated/lectures.ts
```

`npm run lectures` inside `mobile/` does the mobile half only. Both `src/content/` and
`src/generated/` are committed, because they are inputs to the bundle.

## 1. Run on the simulator

```bash
cd mobile
npm install
npm run ios           # expo run:ios — compiles native code the first time (several minutes)
```

After the first native build, `npm start` is enough; press `i` to open the simulator.

If CocoaPods fails to install on this machine, it is the Command Line Tools SDK: point the
pods at the full Xcode SDK first. React Native also has to be built from source: the
prebuilt `React.xcframework` ships no `react/renderer/core` symbols, so linking fails with
`Undefined symbol: facebook::react::Sealable::Sealable()` from `libRNGestureHandler.a`.

```bash
cd mobile/ios
RCT_USE_PREBUILT_RNCORE=0 SDKROOT=$(xcrun --sdk macosx --show-sdk-path) pod install
```

Both flags are needed on **every** `pod install`, and the first build after one takes about
ten minutes. If a build ever fails on that symbol, this is why.

Checks:

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest: progress, store, sync, game, drill, cards, exam
```

Icons and the splash mark are generated: `node scripts/make-icons.mjs` rewrites
`assets/*.png` (dark square, "SAA" in white).

## 2. Install on an iPhone with a free Apple ID

1. Xcode → Settings → Accounts → sign in with the Apple ID. Xcode creates a free personal
   team and a development certificate.
2. Plug the iPhone in, unlock it, trust the Mac.
3. From `mobile/`:

   ```bash
   npx expo run:ios --device --configuration Release
   ```

   Pick the phone from the device list. Release bundles the JS into the app, so it runs with
   the laptop nowhere near it.
4. First launch only: on the phone, Settings → General → VPN & Device Management → the
   developer certificate → Trust.

**The build expires after 7 days.** A free Apple ID signs for one week; after that the app
refuses to launch and has to be reinstalled by re-plugging the phone and running the same
command. Free accounts are also capped at 3 apps and 10 app ids per week.

If signing fails, open `ios/SAA.xcworkspace`, select the target, Signing & Capabilities, and
pick the personal team once. `ios/` is generated and git-ignored, so that choice is lost on
the next prebuild — which is the argument for the paid path.

## 3. Keep it alive without a laptop

### iOS, paid Developer Program ($99/yr)

`eas.json` is already configured with three profiles: `development` (dev client, internal),
`preview` (internal distribution, Release) and `production` (store).

```bash
npm i -g eas-cli
eas login                                  # Expo account
eas build --profile preview --platform ios # asks for the Apple account on the first run
```

EAS registers the device, signs with the paid team and returns an install link. The
provisioning profile lasts **a year**, and rebuilds run from a browser with no laptop
involved. `eas submit --profile production --platform ios` puts a build on TestFlight
(90 days per build) instead.

None of this has been run here: it needs an Expo login and a paid Apple account.

### Android, any account — the APK never expires

```bash
cd mobile
npx expo prebuild --platform android
cd android
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties
env -u CPATH -u LIBRARY_PATH \
  JAVA_HOME="$HOME/.gradle/jdks/eclipse_adoptium-17-aarch64-os_x.2/jdk-17.0.20.1+1/Contents/Home" \
  ANDROID_HOME="$HOME/Library/Android/sdk" \
  ./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`. Copy it to the
phone and open it (Files → install unknown apps). It is signed with the debug keystore, which
is fine for sideloading and not for the Play Store — `eas build --profile production
--platform android` produces a properly signed app bundle.

Two machine-specific traps, both handled by the command above:

- **JDK.** Android Studio's bundled JDK is 25, and the Android Gradle Plugin fails the CMake
  step on the native-access warning JDK 24+ prints. Gradle has already downloaded a JDK 17
  into `~/.gradle/jdks/`; point `JAVA_HOME` at it (or `brew install --cask temurin@17`).
- **Homebrew headers.** The shell exports `CPATH=/opt/homebrew/include` and
  `LIBRARY_PATH=/opt/homebrew/lib`, which the NDK's clang honours, so the Android build
  picks up macOS folly/glog headers and fails. Unset both for the build.

## 4. Sync

The app works signed out exactly as it always has: everything local, nothing leaves the phone.
Signing in adds a second copy on the server and keeps the two in step.

**Login.** Settings (the gear on Home) → Account → email and password, the same account as
https://saa.mihais-vps.xyz. Auth is better-auth with a cookie session: the app reads the
session cookie off the sign-in response, keeps it in the iOS keychain (`expo-secure-store`)
and sends it as an explicit `Cookie` header with `credentials: 'omit'`, so the native cookie
jar never sends a second copy. Every request also carries `Origin: https://saa.mihais-vps.xyz`,
because better-auth refuses writes from an origin it does not trust.

**First sign-in on a phone that already has progress** merges rather than replaces: the server
copy and the local copy go through the same `mergeImport` the file import uses, so attempts and
mocks are unioned by identity, nothing counts twice, and nothing is lost.

**Offline.** Every edit is written to the local store first and queued as one operation. Nothing
blocks on the network. The status line says `Offline, N pending` and the queue survives a
restart. Sync runs on launch, on returning to the app, when connectivity comes back, about a
second after each edit, and every five minutes while the app is open.

**Latest wins.** When the same key changed on both sides, the more recent edit takes it — no
dialog, ever. History is never the loser: attempts and mocks are unioned regardless, and the
daily activity count takes the higher of the two. The reconciliation is one pure function,
`resolveConflict` in `src/lib/sync/resolve.ts`, with its own tests.

Recency needs a server timestamp. The `updatedAt` field is in the web code but **not deployed
yet**; until it ships, the engine falls back to the newest stamp it can see in the server data
(the latest attempt, mock or lecture-read time), which is close but not exact.

**Signing out** flushes first. If the queue cannot be emptied it says how many changes are
unsaved and lets you cancel. Signing out never wipes the phone — the progress stays and the
next sign-in merges it back.

### Running against a fake server

`scripts/fake-server.mjs` implements the same contract in memory, so the whole flow can be
driven without touching the real one.

```bash
npx tsx scripts/fake-server.mjs                     # http://localhost:8787
EXPO_PUBLIC_SAA_SERVER=http://localhost:8787 npx expo run:ios
curl -s localhost:8787/__debug                      # revision and counts
```

The account is `mihai@example.com` / `correct-horse`. `EXPO_PUBLIC_*` is inlined at bundle
time, so the variable has to be set on the command that starts Metro.

## 5. Bring your web progress over

The app at https://saa.mihais-vps.xyz and this one share the `Progress` shape, so the export
imports unchanged.

1. On the web app: Progress → Export, which downloads `saa-progress-*.json`. Put it somewhere
   the phone can reach (AirDrop, iCloud Drive, Files).
2. In the app: Home → the gear → **Import progress** → pick the file.

Import **merges**: attempts and mocks are keyed by identity so the same answer never counts
twice, cards and notes take the incoming version, and activity takes the higher count per day.
Unknown fields in the file are dropped rather than rejected. **Export progress** does the
reverse through the share sheet, writing `saa-progress-YYYY-MM-DD.json`.

## 6. Layout

| Path | What it holds |
| --- | --- |
| `app/` | expo-router routes. `(tabs)/` is the five-tab shell, `learn/[id]` the reader, `exam/[id]` the results |
| `src/components/ui/` | the vocabulary: Frame, Header, Button, Field, Choice, Sheet, Row/Rows/Panel/Stat/StatRow, Meter, Toast |
| `src/components/` | one folder per surface: `home`, `learn`, `drill`, `cards`, `exam`, `question`, `sync` |
| `src/lib/` | `progress.ts`, `srs.ts`, `game.ts`, `content.ts` ported from `app/src/lib`, plus the store |
| `src/lib/sync/` | `api.ts` (fetch + keychain session), `engine.ts` (queue, flush, pull), `resolve.ts` (latest wins), `triggers.ts` |
| `src/theme/` | `tokens.ts` (the web tokens converted to sRGB) and `type.ts` |
| `src/content/`, `src/generated/` | generated by `npm run lectures` |
| `assets/fonts/` | Inter and Geist Mono, bundled, never fetched |
