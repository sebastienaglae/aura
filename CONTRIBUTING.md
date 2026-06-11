# Contributing to Aura

Thanks for your interest! Aura is a small, dependency-free UI library (web + React Native).

## Project layout

```
src/          published package (web orb/gen, React bindings, RN orb/gen)
demo/         web demos (not published)
examples/expo Expo app exercising the RN build (not published)
.github/      CI (lint/smoke) + Release (npm → GitHub Packages on tags)
```

Only `src/`, `README.md`, and `LICENSE` ship to the registry (see `files` in `package.json`).

## Dev

- **Web:** `npx serve` then open `demo/index.html`.
- **React Native:** `cd examples/expo && npm i && npx expo start` (Expo Go, SDK 54).
- **Checks:** `npm run check` (syntax) and `npm run smoke` (ESM import) — these run in CI.

## Guidelines

- Keep the core **dependency-free**; React and RN libs are **optional peer deps**.
- Web code is plain ESM (`.js` / `.jsx`); RN code targets `react-native-svg` +
  `react-native-reanimated` (no audio/native deps shipped).
- Match the existing style; keep per-frame work cheap (it runs at 60fps).
- Run `npm run check && npm run smoke` before opening a PR.

## Releasing (maintainers)

Versioning is tag-driven:

```bash
git tag v1.2.3 && git push origin v1.2.3   # → publishes to GitHub Packages + Release
```

## License

By contributing you agree your contributions are licensed under the MIT License.
