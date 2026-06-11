# Changelog

All notable changes to this project are documented here. Versioning is tag-driven
(`vX.Y.Z` → published to GitHub Packages).

## 0.2.0

### React Native
- **Performance:** waves are now lightweight stroked lines (not per-frame filled polygons);
  the rainbow frame uses a static gradient (only the glow reacts per frame).
- **`lite` mode** for weak phones: fewer wave lines/points, no color cross-fade, no glow.
- **Mode color transitions:** wave colors cross-fade on mode change; frame palette cross-fades.
- **`draggable`** `AuraOrb` (built-in PanResponder).
- **`AuraFrame`** edge aura; `borderRadius` defaults to `useScreenCornerRadius()`.
- **`useScreenCornerRadius(override?)`** reads a real device radius when an `AuraCorner`
  native module is linked (example ships an Expo local module), else a fallback.
- Fixed an RN-SVG crash (`gradientTransform` string → ReadableArray); rotation now uses
  numeric gradient coordinates.
- Removed all audio / speech-to-text from the native build.

### Tooling
- Removed the experimental Android-APK CI job. CI is lint/smoke + npm Release on tags.
- Public-ready: README (badges, RN docs), `CONTRIBUTING.md`, this changelog.

## 0.1.0
- Initial release: web voice-reactive orb, animated rainbow frame, modes, subtitles,
  highlight-and-avoid, drag; generative-AI loading animations (image/song/video/text) with
  fail states; React bindings; React Native port.
