package expo.modules.auracorner

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AuraCornerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AuraCorner")

    // System rounded-corner radius in dp (0 if the device/OS doesn't expose it).
    Function("getCornerRadius") {
      val ctx = appContext.reactContext ?: return@Function 0.0
      val res = ctx.resources
      return@Function try {
        val id = res.getIdentifier("rounded_corner_radius", "dimen", "android")
        if (id > 0) res.getDimensionPixelSize(id) / res.displayMetrics.density.toDouble() else 0.0
      } catch (e: Exception) {
        0.0
      }
    }
  }
}
