package com.margelo.nitro.reactnativelist;

import android.view.View;
import android.os.Handler;
import android.os.Looper;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.fabric.SurfaceHandlerBinding;
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags;
import com.facebook.react.modules.i18nmanager.I18nUtil;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.common.UIManagerType;

/**
 * A holder owns an empty Fabric surface, not an AppRegistry application. Starting through
 * Fabric directly makes the root and shadow tree available before the synchronous row render.
 * Keep RN's version-sensitive SurfaceHandlerBinding interop here (it is Kotlin-internal).
 */
final class RendererSurface {
  private static final Handler mainHandler = new Handler(Looper.getMainLooper());
  private final FabricUIManager manager;
  private final SurfaceMounting mounting;
  private final SurfaceHandlerBinding handler = new SurfaceHandlerBinding("");
  final NativeListItemRootView view;
  final int surfaceId;
  private boolean stopRequested;

  RendererSurface(ThemedReactContext context) {
    manager = (FabricUIManager) UIManagerHelper.getUIManager(context, UIManagerType.FABRIC);
    if (manager == null) throw new IllegalStateException("Fabric UIManager is unavailable.");
    mounting = SurfaceMounting.install(manager);
    view = new NativeListItemRootView(context);
    final android.content.res.Resources resources = context.getResources();
    final android.util.DisplayMetrics metrics = resources.getDisplayMetrics();
    final int width = View.MeasureSpec.makeMeasureSpec(metrics.widthPixels, View.MeasureSpec.AT_MOST);
    final int height = View.MeasureSpec.makeMeasureSpec(metrics.heightPixels, View.MeasureSpec.AT_MOST);
    final android.content.res.Configuration configuration = resources.getConfiguration();
    final I18nUtil i18n = I18nUtil.getInstance();
    final boolean rtl = i18n.isRTL(context);
    final boolean swap = i18n.doLeftAndRightSwapInRTL(context);
    final boolean scaleChanges = ReactNativeFeatureFlags.enableFontScaleChangesUpdatingLayout();
    final float fontScale = scaleChanges ? configuration.fontScale : 1f;
    handler.setLayoutConstraints(width, height, 0, 0, swap, rtl, metrics.density, fontScale);
    manager.startSurface(handler, context, view);
    surfaceId = handler.getSurfaceId();
    mounting.registerSurface(surfaceId);
    view.attachSurface(context, surfaceId);
    if (!handler.isRunning() || view.getId() != surfaceId) {
      if (handler.isRunning()) stop();
      throw new IllegalStateException("Fabric did not synchronously start the holder surface.");
    }
  }

  void stop() {
    if (stopRequested) return;
    stopRequested = true;
    // completeSurface holds the registry's read lock while mounting. Surface removal
    // needs its write lock, so stopping inside onDropView would deadlock that thread.
    mainHandler.post(() -> {
      try {
        manager.stopSurface(handler);
        view.removeAllViews();
      } finally {
        mounting.unregisterSurface(surfaceId);
      }
    });
  }
}
