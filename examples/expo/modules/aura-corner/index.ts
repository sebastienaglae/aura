import { requireOptionalNativeModule } from 'expo-modules-core';

// null in Expo Go / iOS / before a native build; present in a dev-client / standalone build.
const AuraCorner = requireOptionalNativeModule('AuraCorner');

/** System rounded-corner radius in dp, or undefined if the native module isn't available. */
export function getSystemCornerRadius(): number | undefined {
  try {
    const r = AuraCorner?.getCornerRadius?.();
    return typeof r === 'number' && r > 0 ? Math.round(r) : undefined;
  } catch {
    return undefined;
  }
}

export default AuraCorner;
