import NitroModules
import UIKit

class HybridNativeListLayout: HybridNativeListLayoutSpec {}

protocol NativeListLayoutProviding: AnyObject {
    func makeCollectionViewLayout(owner: HybridUiListView) -> UICollectionViewLayout
    func layoutSize(contentSize: CGSize) -> CGSize
    func estimatedContentWidth(collectionViewWidth: CGFloat, viewWidth: CGFloat) -> CGFloat
    func estimatedContentHeight(collectionViewHeight: CGFloat, viewHeight: CGFloat) -> CGFloat
}

class HybridNativeLinearListLayout: HybridNativeLinearListLayoutSpec, NativeListLayoutProviding {
    private var topInset: CGFloat = 16
    private var bottomInset: CGFloat = 16
    private var itemSpacing: CGFloat = 12
    private var estimatedItemWidth: CGFloat?
    private var estimatedItemHeight: CGFloat?

    func dispose() {
        topInset = 16
        bottomInset = 16
        itemSpacing = 12
        estimatedItemWidth = nil
        estimatedItemHeight = nil
    }

    func setConfig(config: NativeLinearListLayoutConfig) throws {
        topInset = CGFloat(config.topInset)
        bottomInset = CGFloat(config.bottomInset)
        itemSpacing = CGFloat(config.itemSpacing)

        let estimatedItemSize = config.iosConfig?.estimatedItemSize
        if let width = estimatedItemSize?.width {
            estimatedItemWidth = CGFloat(width)
        } else {
            estimatedItemWidth = nil
        }

        if let height = estimatedItemSize?.height {
            estimatedItemHeight = CGFloat(height)
        } else {
            estimatedItemHeight = nil
        }
    }

    func makeCollectionViewLayout(owner: HybridUiListView) -> UICollectionViewLayout {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumLineSpacing = itemSpacing
        layout.minimumInteritemSpacing = 0
        layout.sectionInset = UIEdgeInsets(
            top: topInset,
            left: 0,
            bottom: bottomInset,
            right: 0
        )
        // FlowLayout owns the vertical offset bookkeeping; we only provide measured sizes.
        layout.estimatedItemSize = .zero
        return layout
    }

    func layoutSize(contentSize: CGSize) -> CGSize {
        let width = ceil(contentSize.width + HostCell.horizontalInset * 2)
        let height = ceil(contentSize.height + HostCell.verticalInset * 2)
        return CGSize(width: width, height: height)
    }

    func estimatedContentWidth(collectionViewWidth: CGFloat, viewWidth: CGFloat) -> CGFloat {
        // FlowLayout may ask for sizes before a cell has rendered. A user-provided
        // estimate is only used for that first pass; measured and explicit item sizes
        // are resolved by HybridUiListView before this fallback is reached.
        if let estimatedItemWidth, estimatedItemWidth.isFinite, estimatedItemWidth > 0 {
            return estimatedItemWidth
        }

        let availableWidth = collectionViewWidth - HostCell.horizontalInset * 2
        if availableWidth.isFinite && availableWidth > 0 {
            return availableWidth
        }

        let fallbackWidth = viewWidth - HostCell.horizontalInset * 2
        if fallbackWidth.isFinite && fallbackWidth > 0 {
            return fallbackWidth
        }

        return 1
    }

    func estimatedContentHeight(collectionViewHeight: CGFloat, viewHeight: CGFloat) -> CGFloat {
        // Keep the built-in fallback finite so FlowLayout can place initial cells,
        // then let real measurements replace it after cells bind their content.
        if let estimatedItemHeight, estimatedItemHeight.isFinite, estimatedItemHeight > 0 {
            return estimatedItemHeight
        }

        if collectionViewHeight.isFinite && collectionViewHeight > 0 {
            return collectionViewHeight / 2
        }

        if viewHeight.isFinite && viewHeight > 0 {
            return viewHeight / 2
        }

        let screenHeight = UIScreen.main.bounds.height
        if screenHeight.isFinite && screenHeight > 0 {
            return screenHeight / 2
        }

        return 120
    }
}
