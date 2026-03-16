# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start Metro bundler
yarn start

# Run on Android / iOS
yarn android
yarn ios

# Lint / auto-fix / format
yarn lint
yarn lint:fix
yarn format

# Type check (no emit)
yarn type-check

# Test (all)
yarn test

# Run a single test file
yarn jest __tests__/App.test.tsx

# iOS dependencies (macOS only, after native module changes)
bundle install && cd ios && bundle exec pod install
```

**Node version requirement**: >= 22.11.0

## Architecture

React Native 0.84 + TypeScript app targeting Android and iOS.

### Entry points
- `index.js` → registers `App`
- `App.tsx` → wraps `<SafeAreaProvider>` + `<RootNavigator>`

### `src/` layout
| Path | Purpose |
|------|---------|
| `api/client.ts` | Axios factory (`createApiClient`) + pre-built `notionClient` (Notion API v1) |
| `navigation/RootNavigator.tsx` | `RootStackParamList` type + `NavigationContainer` + Stack screens |
| `screens/` | One file per screen; typed via `NativeStackScreenProps<RootStackParamList, 'ScreenName'>` |
| `store/useAuthStore.ts` | Zustand auth store — `token`, `isAuthenticated`, `setToken`, `clearToken` |
| `types/index.ts` | Shared types: `ApiResponse<T>`, Notion page/database shapes |
| `components/`, `hooks/`, `utils/` | Empty, ready to populate |

### Path alias
`@/*` resolves to `src/*` — configured in both `tsconfig.json` (`paths`) and `babel.config.js` (`module-resolver`).

### API clients (`src/api/client.ts`)
- `createApiClient(baseURL, headers?)` — factory for any external API
- `notionClient` — pre-configured for `https://api.notion.com/v1` with `Notion-Version: 2022-06-28`
- Default `apiClient` — for a custom backend (`process.env.API_BASE_URL`)
- Both include request (token injection) and response (401 handling) interceptors

### Animation libraries installed
| Library | Use |
|---------|-----|
| `react-native-reanimated` v4 | Complex/gesture-driven animations (worklet-based) |
| `react-native-gesture-handler` | Touch & gesture primitives (required by navigation too) |
| `react-native-animatable` | Declarative, simple entrance/exit animations |
| `lottie-react-native` | Lottie JSON animations |

> **Note**: `react-native-reanimated` v4 has a peer dep on `react-native-worklets`. Install it if worklet errors appear: `yarn add react-native-worklets`

### Key dependency versions
- React Navigation v7 (`@react-navigation/native`, `@react-navigation/native-stack`)
- Zustand v5
- Axios v1
