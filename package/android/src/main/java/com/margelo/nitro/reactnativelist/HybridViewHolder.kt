package com.margelo.nitro.reactnativelist

import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

@DoNotStrip
@Keep
class HybridViewHolder(context: ThemedReactContext) : HybridViewHolderSpec() {
    override val view: View
        get() = TODO("Hm, would this here be the user's view?")
}
