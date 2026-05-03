import { NativeListLayout } from './NativeListLayout.nitro'

export interface NativeLinearListLayoutConfig {
  topInset: number
  bottomInset: number
  itemSpacing: number
}

export interface NativeLinearListLayout extends NativeListLayout {
  setConfig(config: NativeLinearListLayoutConfig): void
}
