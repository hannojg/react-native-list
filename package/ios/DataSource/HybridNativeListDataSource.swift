import DifferenceKit
import Foundation
import NitroModules

final class DiffableListItem: Differentiable {
    typealias DifferenceIdentifier = String

    let nativeItem: NativeListItem
    private let contentEqual: (NativeListItem, NativeListItem) -> Bool

    init(
        nativeItem: NativeListItem,
        contentEqual: @escaping (NativeListItem, NativeListItem) -> Bool
    ) {
        self.nativeItem = nativeItem
        self.contentEqual = contentEqual
    }

    var differenceIdentifier: String {
        return nativeItem.type + ":" + nativeItem.key
    }

    func isContentEqual(to source: DiffableListItem) -> Bool {
        if nativeItem.type != source.nativeItem.type {
            return false
        }
        if nativeItem.width != source.nativeItem.width {
            return false
        }
        if nativeItem.height != source.nativeItem.height {
            return false
        }
        return contentEqual(source.nativeItem, nativeItem)
    }
}

protocol NativeListDataSourceObserver: AnyObject {
    func dataSourceDidReload(
        _ dataSource: HybridNativeListDataSource,
        animated: Bool,
        changeset: StagedChangeset<[DiffableListItem]>?
    )
    func dataSourceDidInsert(_ dataSource: HybridNativeListDataSource, index: Int)
    func dataSourceDidUpdate(
        _ dataSource: HybridNativeListDataSource,
        index: Int,
        previousItem: NativeListItem
    )
    func dataSourceDidRemove(
        _ dataSource: HybridNativeListDataSource,
        index: Int,
        removedItem: NativeListItem
    )
    func dataSourceDidMove(_ dataSource: HybridNativeListDataSource, fromIndex: Int, toIndex: Int)
}

class HybridNativeListDataSource: HybridNativeListDataSourceSpec {
    weak var observer: NativeListDataSourceObserver?
    private var items: [DiffableListItem] = []
    private var pendingTargetItems: [DiffableListItem]?
    private var animatedReloadSourceItems: [DiffableListItem]?
    private var contentEqual: (NativeListItem, NativeListItem) -> Bool = { _, _ in false }

    func dispose() {
        observer = nil
        items.removeAll()
        pendingTargetItems = nil
        animatedReloadSourceItems = nil
        contentEqual = { _, _ in false }
    }

    func setContentEqualCallback(
        isContentEqual: @escaping (NativeListItem, NativeListItem) -> Bool
    ) throws {
        contentEqual = isContentEqual
    }

    func replaceData(items newItems: [NativeListItem], animated: Bool) throws {
        let targetItems = wrap(newItems)
        guard animated, observer != nil else {
            pendingTargetItems = nil
            animatedReloadSourceItems = nil
            items = targetItems
            observer?.dataSourceDidReload(self, animated: false, changeset: nil)
            return
        }

        animatedReloadSourceItems = items
        let changeset = StagedChangeset(source: items, target: targetItems)
        guard !changeset.isEmpty else {
            pendingTargetItems = nil
            animatedReloadSourceItems = nil
            items = targetItems
            observer?.dataSourceDidReload(self, animated: false, changeset: nil)
            return
        }

        pendingTargetItems = targetItems
        observer?.dataSourceDidReload(self, animated: true, changeset: changeset)
    }

    func insertItem(index: Double, item: NativeListItem) throws {
        let itemIndex = validInsertionIndex(index)
        let wrappedItem = wrap(item)
        items.insert(wrappedItem, at: itemIndex)
        observer?.dataSourceDidInsert(self, index: itemIndex)
    }

    func updateItem(index: Double, item: NativeListItem) throws {
        let itemIndex = validExistingIndex(index)
        let previousItem = items[itemIndex].nativeItem
        let wrappedItem = wrap(item)
        items[itemIndex] = wrappedItem
        observer?.dataSourceDidUpdate(self, index: itemIndex, previousItem: previousItem)
    }

    func removeItem(index: Double) throws {
        let itemIndex = validExistingIndex(index)
        let removedItem = items.remove(at: itemIndex).nativeItem
        observer?.dataSourceDidRemove(self, index: itemIndex, removedItem: removedItem)
    }

    func moveItem(fromIndex: Double, toIndex: Double) throws {
        let sourceIndex = validExistingIndex(fromIndex)
        let targetIndex = validExistingIndex(toIndex)
        let item = items.remove(at: sourceIndex)
        items.insert(item, at: targetIndex)
        observer?.dataSourceDidMove(self, fromIndex: sourceIndex, toIndex: targetIndex)
    }

    func getCount() throws -> Double {
        return Double(items.count)
    }

    func getItem(index: Double) throws -> NativeListItem {
        let itemIndex = validExistingIndex(index)
        return item(at: itemIndex)
    }

    func item(at index: Int) -> NativeListItem {
        return items[index].nativeItem
    }

    func itemForCollectionViewQuery(at index: Int) -> NativeListItem {
        if items.indices.contains(index) {
            return items[index].nativeItem
        }

        // During DifferenceKit staged reloads, UICollectionViewFlowLayout can still ask for
        // sizing information from the pre-animation snapshot after the stage data was applied.
        if let animatedReloadSourceItems, animatedReloadSourceItems.indices.contains(index) {
            return animatedReloadSourceItems[index].nativeItem
        }

        preconditionFailure("List item index \(index) is out of bounds for collection view query.")
    }

    func replaceWrappedItemsFromCollectionView(_ nextItems: [DiffableListItem]) {
        items = nextItems

        guard let pendingTargetItems else {
            animatedReloadSourceItems = nil
            return
        }

        if hasSameIdentity(nextItems, pendingTargetItems) {
            self.pendingTargetItems = nil
            animatedReloadSourceItems = nil
        }
    }

    func itemsForPremeasurement() -> [NativeListItem] {
        let sourceItems = pendingTargetItems ?? items
        return sourceItems.map { item in
            item.nativeItem
        }
    }

    private func wrap(_ item: NativeListItem) -> DiffableListItem {
        return DiffableListItem(nativeItem: item, contentEqual: contentEqual)
    }

    private func wrap(_ nativeItems: [NativeListItem]) -> [DiffableListItem] {
        return nativeItems.map { item in
            wrap(item)
        }
    }

    private func hasSameIdentity(
        _ firstItems: [DiffableListItem],
        _ secondItems: [DiffableListItem]
    ) -> Bool {
        if firstItems.count != secondItems.count {
            return false
        }

        return zip(firstItems, secondItems).allSatisfy { firstItem, secondItem in
            return firstItem.differenceIdentifier == secondItem.differenceIdentifier
        }
    }

    private func validExistingIndex(_ value: Double) -> Int {
        let index = Int(value)
        precondition(index >= 0 && index < items.count, "List index \(index) is out of bounds.")
        return index
    }

    private func validInsertionIndex(_ value: Double) -> Int {
        let index = Int(value)
        precondition(index >= 0 && index <= items.count, "List index \(index) is out of bounds.")
        return index
    }
}
