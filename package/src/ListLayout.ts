import { NitroModules } from 'react-native-nitro-modules'
import { useMemo } from 'react'
import type { NativeListLayout } from './specs/NativeListLayout.nitro'
import type {
  NativeLinearListLayout,
  NativeLinearListLayoutConfig,
} from './specs/NativeLinearListLayout.nitro'

export type LinearListLayoutConfig = Partial<NativeLinearListLayoutConfig>

export type ListLayout = {
  __nativeLayout: NativeListLayout
}

const defaultLinearListLayoutConfig: NativeLinearListLayoutConfig = {
  topInset: 16,
  bottomInset: 16,
  itemSpacing: 12,
}

function normalizeLinearConfig(
  config: LinearListLayoutConfig = {}
): NativeLinearListLayoutConfig {
  return {
    topInset: config.topInset ?? defaultLinearListLayoutConfig.topInset,
    bottomInset:
      config.bottomInset ?? defaultLinearListLayoutConfig.bottomInset,
    itemSpacing:
      config.itemSpacing ?? defaultLinearListLayoutConfig.itemSpacing,
  }
}

export function createLinearListLayout(
  config?: LinearListLayoutConfig
): ListLayout {
  const nativeLayout = NitroModules.createHybridObject<NativeLinearListLayout>(
    'NativeLinearListLayout'
  )
  const normalizedConfig = normalizeLinearConfig(config)
  nativeLayout.setConfig(normalizedConfig)

  return {
    __nativeLayout: nativeLayout,
  }
}

export function useLinearListLayout(
  config?: LinearListLayoutConfig
): ListLayout {
  return useMemo(() => {
    return createLinearListLayout(config)
  }, [config])
}
