s# RetailOps Mobile (Android)

React Native (Expo) client for the RetailOps platform. Shares the same backend,
brand tokens, and auth contract as the web dashboard.

## Stack

| Concern            | Choice                                        |
| ------------------ | --------------------------------------------- |
| Runtime            | Expo SDK 57 (managed) + React Native 0.86     |
| Language           | TypeScript (strict)                           |
| UI kit             | React Native Paper (Material Design 3)        |
| Navigation         | React Navigation 7 (native-stack + tabs)      |
| State              | Zustand                                       |
| HTTP               | Axios (token injection + single-flight refresh)|
| Storage            | AsyncStorage                                  |
| Realtime           | Socket.IO client                              |

## Project structure

```
src/
  config/env.ts            # EXPO_PUBLIC_* runtime config (URLs, timeouts, keys)
  theme/theme.ts           # MD3 light/dark themes mirroring web design tokens
  types/index.ts           # Domain + navigation types
  services/
    storage.ts             # AsyncStorage helpers
    apiClient.ts           # Axios instance + interceptors + error helper
    authService.ts         # /auth/* endpoints
    dashboardService.ts    # /dashboard
    socketService.ts       # Socket.IO connect/disconnect
  store/authStore.ts       # Session state + permission helpers
  components/              # ScreenContainer, KpiCard, PlaceholderScreen
  navigation/              # Root → Auth / Main (tabs)
  screens/
    auth/                  # LoginScreen, OtpScreen
    main/                  # Dashboard, Asins, Ads, Tasks, Profile
App.tsx                    # Providers + RootNavigator
```

## Configuration

Copy the values in `.env` (or set them in an EAS build profile). Only
`EXPO_PUBLIC_*` variables are embedded in the client bundle — never put secrets
here.

| Variable                   | Default                              |
| -------------------------- | ------------------------------------ |
| `EXPO_PUBLIC_API_URL`      | `https://data.brandcentral.in/api`   |
| `EXPO_PUBLIC_SOCKET_URL`   | `https://data.brandcentral.in`       |
| `EXPO_PUBLIC_API_TIMEOUT`  | `30000`                              |

For local development point the URLs at your machine. The Android emulator
reaches the host via `10.0.2.2`:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

## Authentication flow

1. `POST /auth/login` with `{ email, password }`.
   - Trusted device → returns `data.{user,accessToken,refreshToken}` directly.
   - Otherwise → returns `{ requiresOtp: true, tempToken, destination }`.
2. `POST /auth/verify-otp` with `{ tempToken, otp, trustDevice }` → tokens.
3. Session is persisted in AsyncStorage; `GET /auth/me` re-validates on launch
   (`bootstrap`).
4. A 401 on any non-auth request triggers a single refresh via
   `POST /auth/refresh-token`; repeated failure clears the session.

## Scripts

```bash
npm install
npm start          # Expo dev server
npm run android    # Launch on a connected device/emulator
npm run ios        # iOS (macOS only)
npx tsc --noEmit   # Type check
```

## Status

Implemented: authentication (password + OTP), dashboard KPIs, profile/logout,
real-time socket wiring.

Placeholders (next): ASIN Manager, Ads Intelligence, Tasks (PEMS) — these reuse
the existing backend endpoints and will follow the same service/store pattern.

## Design

The UI/UX design schema for this app — audiences, role-based navigation, tokens,
screen inventory, component library, and the API mapping — lives in
[`docs/design/mobile/`](../docs/design/mobile/README.md).

Start with [`01-design-schema.md`](../docs/design/mobile/01-design-schema.md).
It defines a **single app with two surfaces** (internal staff + seller clients),
so new screens must resolve visibility from `surface × permission × scope` rather
than from role names, and must consume tokens from
[`02-design-tokens.json`](../docs/design/mobile/02-design-tokens.json).

Note: that schema proposes moving the brand seed from `#2563EB` to the RetailOps
brand blue `#1976D2` (`--bc-ro-500` in `src/styles/tokens.css`), which the seller
surface and the app icon already imply. Do not mix the two blues in a screen.