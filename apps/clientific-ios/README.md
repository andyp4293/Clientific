# Clientific iOS

This folder contains the native iPhone shell for an App Store version of Clientific.

## What it does

- wraps the live Clientific app inside a branded mobile shell
- preserves the current responsive web functionality immediately
- handles loading, retry, and external link handoff on iPhone
- includes Expo + EAS config so you can turn this into an App Store build

## Local development

```bash
cd apps/clientific-ios
npm install
npm run ios
```

You can point the shell at any environment by setting:

```bash
EXPO_PUBLIC_CLIENTIFIC_WEB_URL=https://www.clientific.app
```

## Validation

```bash
cd apps/clientific-ios
npm run check
```

## App Store build

```bash
cd apps/clientific-ios
npx eas build --platform ios --profile production
```

## Notes

- This is the fastest path to feature parity because it reuses the existing Clientific web app.
- A later phase can replace specific flows with fully native screens while keeping the same backend and auth model.
