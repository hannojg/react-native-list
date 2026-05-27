import { NitroModules } from 'react-native-nitro-modules'
import { useEffect, useMemo } from 'react'
import type { NativeListLayout } from './specs/NativeListLayout.nitro'
import type {
  NativeLinearListLayout,
  NativeLinearListLayoutConfig,
} from './specs/NativeLinearListLayout.nitro'

type LinearListLayoutBaseConfig = Omit<
  Partial<NativeLinearListLayoutConfig>,
  'iosConfig'
>

export type ItemSizeEstimate =
  | {
      width: number
      height?: number
    }
  | {
      width?: number
      height: number
    }

export type LinearListLayoutIOSConfig = {
  estimatedItemSize?: ItemSizeEstimate
}

export type LinearListLayoutConfig = LinearListLayoutBaseConfig & {
  iosConfig?: LinearListLayoutIOSConfig
}

export type ListLayout = {
  __nativeLayout: NativeListLayout
  release(): void
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
    iosConfig: config.iosConfig,
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
    release() {
      nativeLayout.dispose()
    },
  }
}

export function useLinearListLayout(
  config?: LinearListLayoutConfig
): ListLayout {
  const layout = useMemo(() => {
    return createLinearListLayout(config)
  }, [config])

  useEffect(() => {
    return () => {
      layout.release()
    }
  }, [layout])

  return layout
}
