import NitroModules
import UIKit

class HybridNativeListLayout: HybridNativeListLayoutSpec {}

protocol NativeListLayoutProviding: AnyObject {
    func makeCollectionViewLayout(owner: HybridUiListView) -> UICollectionViewLayout
    func layoutSize(contentSize: CGSize) -> CGSize
}

class HybridNativeLinearListLayout: HybridNativeLinearListLayoutSpec, NativeListLayoutProviding {
    private var topInset: CGFloat = 16
    private var bottomInset: CGFloat = 16
    private var itemSpacing: CGFloat = 12

    func setConfig(config: NativeLinearListLayoutConfig) throws {
        topInset = CGFloat(config.topInset)
        bottomInset = CGFloat(config.bottomInset)
        itemSpacing = CGFloat(config.itemSpacing)
    }

    func makeCollectionViewLayout(owner: HybridUiListView) -> UICollectionViewLayout {
        return LinearCollectionViewLayout(owner: owner, layout: self)
    }

    func layoutSize(contentSize: CGSize) -> CGSize {
        let width = ceil(contentSize.width + HostCell.horizontalInset * 2)
        let height = ceil(contentSize.height + HostCell.verticalInset * 2)
        return CGSize(width: width, height: height)
    }

    func yOffsetForFirstItem() -> CGFloat {
        return topInset
    }

    func yOffsetAfterItem(currentOffset: CGFloat, itemHeight: CGFloat) -> CGFloat {
        return currentOffset + itemHeight + itemSpacing
    }

    func contentHeight(lastOffset: CGFloat, itemCount: Int) -> CGFloat {
        var height = lastOffset
        if itemCount > 0 {
            height -= itemSpacing
        }
        height += bottomInset
        return max(height, 0)
    }
}

final class LinearCollectionViewLayout: UICollectionViewLayout {
    weak var owner: HybridUiListView?
    private weak var linearLayout: HybridNativeLinearListLayout?
    private var itemAttributes: [UICollectionViewLayoutAttributes] = []
    private var contentSize = CGSize.zero

    init(owner: HybridUiListView, layout: HybridNativeLinearListLayout) {
        self.owner = owner
        linearLayout = layout
        super.init()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func prepare() {
        guard let collectionView, let owner, let linearLayout else {
            itemAttributes = []
            contentSize = .zero
            return
        }

        var attributes: [UICollectionViewLayoutAttributes] = []
        var yOffset = linearLayout.yOffsetForFirstItem()
        let itemCount = owner.collectionView(collectionView, numberOfItemsInSection: 0)

        for itemIndex in 0..<itemCount {
            let indexPath = IndexPath(item: itemIndex, section: 0)
            let itemSize = owner.layoutSizeForItem(at: itemIndex)
            let frame = CGRect(x: 0, y: yOffset, width: itemSize.width, height: itemSize.height)
            let itemAttributes = UICollectionViewLayoutAttributes(forCellWith: indexPath)
            itemAttributes.frame = frame
            attributes.append(itemAttributes)

            yOffset = linearLayout.yOffsetAfterItem(currentOffset: yOffset, itemHeight: itemSize.height)
        }

        let height = linearLayout.contentHeight(lastOffset: yOffset, itemCount: itemCount)
        itemAttributes = attributes
        contentSize = CGSize(width: collectionView.bounds.width, height: height)
    }

    override var collectionViewContentSize: CGSize {
        return contentSize
    }

    override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
        return itemAttributes.filter { attributes in
            attributes.frame.intersects(rect)
        }
    }

    override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        guard indexPath.item >= 0 && indexPath.item < itemAttributes.count else {
            return nil
        }
        return itemAttributes[indexPath.item]
    }

    override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
        guard let collectionView else {
            return false
        }
        return collectionView.bounds.width != newBounds.width
    }
}
