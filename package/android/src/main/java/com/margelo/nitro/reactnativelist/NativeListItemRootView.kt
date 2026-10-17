package com.margelo.nitro.reactnativelist

import android.annotation.SuppressLint
import android.content.MutableContextWrapper
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.uimanager.JSTouchDispatcher
import com.facebook.react.uimanager.RootView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper

internal class NativeListItemRootView(reactContext: ThemedReactContext) :
    FrameLayout(MutableContextWrapper(reactContext)), RootView {
    private val touchDispatcher = JSTouchDispatcher(this)
    private lateinit var eventContext: ThemedReactContext
    private val eventDispatcher = UIManagerHelper.getEventDispatcher(reactContext)
        ?: throw IllegalStateException("Fabric event dispatcher is unavailable.")

    fun attachSurface(reactContext: ThemedReactContext, surfaceId: Int) {
        eventContext = ThemedReactContext(
            reactContext.reactApplicationContext,
            reactContext,
            "",
            surfaceId
        )
        // JSTouchDispatcher derives the surface from the root's Context, not its id.
        val wrapper = context as MutableContextWrapper
        wrapper.baseContext = eventContext
    }

    // Fabric positions the children; FrameLayout must not lay them out a second time.
    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
        touchDispatcher.handleTouchEvent(event, eventDispatcher, eventContext)
        return super.onInterceptTouchEvent(event)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        touchDispatcher.handleTouchEvent(event, eventDispatcher, eventContext)
        super.onTouchEvent(event)
        return true
    }

    @OptIn(UnstableReactNativeAPI::class)
    override fun onChildStartedNativeGesture(childView: View?, event: MotionEvent) {
        touchDispatcher.onChildStartedNativeGesture(event, eventDispatcher, eventContext)
    }

    override fun onChildEndedNativeGesture(childView: View, event: MotionEvent) {
        touchDispatcher.onChildEndedNativeGesture(event, eventDispatcher)
    }

    override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
        parent?.requestDisallowInterceptTouchEvent(disallowIntercept)
    }

    override fun handleException(throwable: Throwable) {
        val error = RuntimeException(throwable)
        eventContext.reactApplicationContext.handleException(error)
    }
}
