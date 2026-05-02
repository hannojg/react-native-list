import type * as React from 'react'

export let reactRender: (
  element: React.ReactElement,
  callback?: () => void
) => void

export let nativeLog: (...args: unknown[]) => void
