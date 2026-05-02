'use strict'

import type * as ReactModule from 'react'
import type { UiManagerBinding } from './specs/UIManagerHelper.nitro'

declare global {
  var log: (...args: unknown[]) => void
  var nativeFabricUIManager: UiManagerBinding

  interface GlobalThis {
    React: typeof ReactModule
  }

  interface Performance {
    now(): number
  }
  var performance: Performance
}

export {}
