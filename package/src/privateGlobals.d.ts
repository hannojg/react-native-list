'use strict'

import type * as ReactModule from 'react'
import type { UiManagerBinding } from './specs/UIManagerHelper.nitro'

declare global {
  var log: (...args: unknown[]) => void
  var React: typeof ReactModule
  var Render: (element: ReactModule.ReactElement, callback?: () => void) => void
  var nativeFabricUIManager: UiManagerBinding
}

export {}
