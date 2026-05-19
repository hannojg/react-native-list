//
//  HybridUiListView.swift
//  ReactNativeList
//
//  Created by Hanno Gödecke on 14.02.26.
//

import DifferenceKit
import Foundation
import NitroModules
import UIKit

final class HostCell: UICollectionViewCell {

    static let verticalInset: CGFloat = 8
    static let horizontalInset: CGFloat = 16

    private var hostedView: UIView?
    private var widthConstraint: NSLayoutConstraint?
    private var heightConstraint: NSLayoutConstraint?

    var reactTag: Int?
    var itemKey: String?
    var hasHostedView: Bool {
        return hostedView != nil
    }

    func install(view: UIView, contentSize: CGSize, itemKey: String) {
        if let currentHostedView = hostedView {
            let isCurrentViewOwnedByCell = currentHostedView.superview === contentView
            if isCurrentViewOwnedByCell {
                deactivateInstalledConstraints(for: currentHostedView)
                currentHostedView.removeFromSuperview()
            }
        }

        deactivateInstalledConstraints(for: view)
        view.removeFromSuperview()

        hostedView = view
        self.itemKey = itemKey

        view.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(view)

        let widthConstraint = view.widthAnchor.constraint(equalToConstant: contentSize.width)
        let heightConstraint = view.heightAnchor.constraint(equalToConstant: contentSize.height)
        self.widthConstraint = widthConstraint
        self.heightConstraint = heightConstraint

        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: contentView.topAnchor, constant: Self.verticalInset),
            view.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Self.horizontalInset),
            widthConstraint,
            heightConstraint,
        ])
    }

    func updateContentSize(_ contentSize: CGSize) {
        widthConstraint?.constant = contentSize.width
        heightConstraint?.constant = contentSize.height
    }

    func detachHostedView() {
        if let hostedView {
            let isHostedViewOwnedByCell = hostedView.superview === contentView
            if isHostedViewOwnedByCell {
                deactivateInstalledConstraints(for: hostedView)
                hostedView.removeFromSuperview()
            }
        }

        hostedView = nil
        reactTag = nil
        itemKey = nil
        widthConstraint = nil
        heightConstraint = nil
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        if let hostedView {
            contentView.bringSubviewToFront(hostedView)
        }
    }

    func isHosting(_ view: UIView) -> Bool {
        return hostedView === view
    }

    func releaseHostedViewReferenceIfNeeded(for view: UIView) {
        guard hostedView === view else { return }

        hostedView = nil
        reactTag = nil
        itemKey = nil
        widthConstraint = nil
        heightConstraint = nil
    }

    private func deactivateInstalledConstraints(for view: UIView) {
        let localConstraints = view.constraints.filter { constraint in
            let isWidthConstraint = constraint.firstAttribute == .width
            let isHeightConstraint = constraint.firstAttribute == .height
            let isSizeConstraint = isWidthConstraint || isHeightConstraint
            let firstView = constraint.firstItem as? UIView
            let isOwnedByView = firstView === view
            let isLocalConstraint = constraint.secondItem == nil
            return isSizeConstraint && isOwnedByView && isLocalConstraint
        }
        NSLayoutConstraint.deactivate(localConstraints)

        guard let superview = view.superview else { return }

        let parentConstraints = superview.constraints.filter { constraint in
            let firstView = constraint.firstItem as? UIView
            let secondView = constraint.secondItem as? UIView
            let usesFirstView = firstView === view
            let usesSecondView = secondView === view
            return usesFirstView || usesSecondView
        }
        NSLayoutConstraint.deactivate(parentConstraints)
    }
}

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
    private var contentEqual: (NativeListItem, NativeListItem) -> Bool = { _, _ in false }

    func setContentEqualCallback(
        isContentEqual: @escaping (NativeListItem, NativeListItem) -> Bool
    ) throws {
        contentEqual = isContentEqual
    }

    func replaceData(items newItems: [NativeListItem], animated: Bool) throws {
        let targetItems = wrap(newItems)
        guard animated, observer != nil else {
            pendingTargetItems = nil
            items = targetItems
            observer?.dataSourceDidReload(self, animated: false, changeset: nil)
            return
        }

        let changeset = StagedChangeset(source: items, target: targetItems)
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

    func replaceWrappedItemsFromCollectionView(_ nextItems: [DiffableListItem]) {
        items = nextItems
        pendingTargetItems = nil
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

final class CollectionViewDataSourceProxy: NSObject, UICollectionViewDataSource {
    weak var owner: HybridUiListView?

    init(owner: HybridUiListView) {
        self.owner = owner
        super.init()
    }

    func numberOfSections(in collectionView: UICollectionView) -> Int {
        return owner?.numberOfSections(in: collectionView) ?? 0
    }

    func collectionView(
        _ collectionView: UICollectionView,
        numberOfItemsInSection section: Int
    ) -> Int {
        return owner?.collectionView(collectionView, numberOfItemsInSection: section) ?? 0
    }

    func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        guard let owner else {
            return UICollectionViewCell()
        }
        return owner.collectionView(collectionView, cellForItemAt: indexPath)
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

class HybridUiListView : HybridUiListViewSpec {
    let view: UIView

    private var collectionView: UICollectionView?
    private var collectionDataSourceProxy: CollectionViewDataSourceProxy?
    private var dataSource: HybridNativeListDataSource?
    private var layoutProvider: NativeListLayoutProviding = HybridNativeLinearListLayout()
    private var registeredReuseIdentifiers = Set<String>()
    private var measuredContentSizeByType: [String: CGSize] = [:]
    private var premeasuredViewByType: [String: (view: UIView, tag: ReactTag)] = [:]
    private var hostedContentByItemKey: [String: (view: UIView, tag: ReactTag)] = [:]

    private var createViewCallback: ((_ type: String) -> Double)?
    private var updateViewCallback: ((_ reactTag: Double, _ item: NativeListItem, _ index: Double) -> Bool)?

    override init() {
        view = UIView(frame: .zero)
        super.init()
    }

    func setListCallbacks(
        uiListModule: any HybridUiListModuleSpec,
        createView: @escaping (String) -> Double,
        updateView: @escaping (Double, NativeListItem, Double) -> Bool
    ) throws {
        createViewCallback = createView
        updateViewCallback = updateView
        runOnMain { [weak self] in
            self?.configureCollectionViewIfNeeded()
        }
    }

    func setDataSource(dataSource nextDataSource: any HybridNativeListDataSourceSpec) throws {
        guard let concreteDataSource = nextDataSource as? HybridNativeListDataSource else {
            throw RuntimeError.error(withMessage: "NativeListDataSource must be created by react-native-list.")
        }

        runOnMain { [weak self] in
            guard let self else { return }
            self.dataSource?.observer = nil
            self.dataSource = concreteDataSource
            concreteDataSource.observer = self
            self.configureCollectionViewIfNeeded()
            self.premeasureAllVisibleTypes()
            self.retainHostedContent(in: concreteDataSource)
            self.collectionView?.collectionViewLayout.invalidateLayout()
            self.collectionView?.reloadData()
        }
    }

    func setLayout(layout: any HybridNativeListLayoutSpec) throws {
        guard let nextLayout = layout as? NativeListLayoutProviding else {
            throw RuntimeError.error(withMessage: "NativeListLayout must provide a platform layout.")
        }

        runOnMain { [weak self] in
            guard let self else { return }
            layoutProvider = nextLayout
            configureCollectionViewIfNeeded()
            let collectionViewLayout = nextLayout.makeCollectionViewLayout(owner: self)
            collectionView?.setCollectionViewLayout(collectionViewLayout, animated: false)
        }
    }

    private func configureCollectionViewIfNeeded() {
        guard collectionView == nil else { return }

        let layout = layoutProvider.makeCollectionViewLayout(owner: self)
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .systemBackground
        collectionView.translatesAutoresizingMaskIntoConstraints = false

        view.backgroundColor = .clear
        view.addSubview(collectionView)
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let dataSourceProxy = CollectionViewDataSourceProxy(owner: self)
        collectionDataSourceProxy = dataSourceProxy
        collectionView.dataSource = dataSourceProxy
        self.collectionView = collectionView
    }

    private func makeView(type: String) throws -> (UIView, ReactTag, CGSize?) {
        guard let createViewCallback else {
            throw RuntimeError.error(withMessage: "Can only call makeView after setListCallbacks.")
        }

        let viewTag = ReactTag(createViewCallback(type))
        let resolvedView = try SurfaceHelper.getViewByTag(viewTag)
        let measuredSize = measure(view: resolvedView)
        resolvedView.removeFromSuperview()
        return (resolvedView, viewTag, measuredSize)
    }

    private func measure(view: UIView) -> CGSize? {
        let measuredWidth = [view.bounds.width, view.frame.width]
            .filter { $0.isFinite && $0 > 0 }
            .max()
        let measuredHeight = [view.bounds.height, view.frame.height]
            .filter { $0.isFinite && $0 > 0 }
            .max()

        guard let measuredWidth, let measuredHeight else {
            return nil
        }
        return CGSize(width: measuredWidth, height: measuredHeight)
    }

    private func premeasureAllVisibleTypes() {
        guard let dataSource else { return }

        let items = dataSource.itemsForPremeasurement()
        for item in items {
            let reuseIdentifier = reuseIdentifier(for: item)
            ensureReuseRegistered(for: reuseIdentifier)
            premeasureItemTypeIfNeeded(for: item)
        }
    }

    private func premeasureItemTypeIfNeeded(for item: NativeListItem) {
        let needsMeasuredWidth = item.width == nil
        let needsMeasuredHeight = item.height == nil
        guard needsMeasuredWidth || needsMeasuredHeight else { return }
        guard measuredContentSizeByType[item.type] == nil else { return }

        do {
            let result = try makeView(type: item.type)
            guard let measuredSize = result.2 else {
                fatalError(
                    "Developer error: Failed to measure item type '\(item.type)'. " +
                    "The shell view must render finite non-zero bounds when width or height is omitted."
                )
            }
            measuredContentSizeByType[item.type] = measuredSize
            premeasuredViewByType[item.type] = (view: result.0, tag: result.1)
        } catch {
            fatalError("Developer error: Failed to pre-measure item type '\(item.type)': \(error)")
        }
    }

    private func takePremeasuredView(for type: String) -> (UIView, ReactTag)? {
        guard let result = premeasuredViewByType[type] else {
            return nil
        }
        premeasuredViewByType[type] = nil
        return result
    }

    private func resolvedContentSize(for item: NativeListItem) -> CGSize {
        let measuredSize = measuredContentSizeByType[item.type]
        let width = item.width.map { CGFloat($0) } ?? measuredSize?.width
        let height = item.height.map { CGFloat($0) } ?? measuredSize?.height

        guard let width, width.isFinite, width > 0 else {
            fatalError(
                "Developer error: Missing width for item type '\(item.type)'. " +
                "Provide width from getItemSize or render a measurable shell."
            )
        }
        guard let height, height.isFinite, height > 0 else {
            fatalError(
                "Developer error: Missing height for item type '\(item.type)'. " +
                "Provide height from getItemSize or render a measurable shell."
            )
        }

        return CGSize(width: width, height: height)
    }

    private func ensureReuseRegistered(for type: String) {
        guard !registeredReuseIdentifiers.contains(type) else { return }

        collectionView?.register(HostCell.self, forCellWithReuseIdentifier: type)
        registeredReuseIdentifiers.insert(type)
    }

    private func reuseIdentifier(for item: NativeListItem) -> String {
        return item.type
    }

    private func installHostedContent(
        in cell: HostCell,
        item: NativeListItem,
        contentSize: CGSize
    ) throws {
        if let currentItemKey = cell.itemKey, currentItemKey != item.key {
            hostedContentByItemKey[currentItemKey] = nil
            cell.detachHostedView()
        }

        if let hostedContent = hostedContentByItemKey[item.key] {
            releaseExistingHostedViewOwner(
                view: hostedContent.view,
                targetCell: cell
            )
            cell.install(view: hostedContent.view, contentSize: contentSize, itemKey: item.key)
            cell.reactTag = hostedContent.tag
            return
        }

        if let result = takePremeasuredView(for: item.type) {
            cell.install(view: result.0, contentSize: contentSize, itemKey: item.key)
            cell.reactTag = result.1
            hostedContentByItemKey[item.key] = (view: result.0, tag: result.1)
            return
        }

        let result = try makeView(type: item.type)
        cell.install(view: result.0, contentSize: contentSize, itemKey: item.key)
        cell.reactTag = result.1
        hostedContentByItemKey[item.key] = (view: result.0, tag: result.1)
    }

    private func releaseExistingHostedViewOwner(
        view: UIView,
        targetCell: HostCell
    ) {
        guard let collectionView else { return }

        for visibleCell in collectionView.visibleCells {
            guard let hostCell = visibleCell as? HostCell else {
                continue
            }
            guard hostCell !== targetCell else {
                continue
            }
            guard hostCell.isHosting(view) else {
                continue
            }

            hostCell.releaseHostedViewReferenceIfNeeded(for: view)
        }
    }

    private func retainHostedContent(in dataSource: HybridNativeListDataSource) {
        let activeKeys = dataSource.itemsForPremeasurement().map { item in
            item.key
        }
        let activeKeySet = Set(activeKeys)
        hostedContentByItemKey = hostedContentByItemKey.filter { entry in
            return activeKeySet.contains(entry.key)
        }
    }

    private func runOnMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }

    func numberOfSections(in collectionView: UICollectionView) -> Int {
        return 1
    }

    func collectionView(
        _ collectionView: UICollectionView,
        numberOfItemsInSection section: Int
    ) -> Int {
        guard let dataSource else { return 0 }
        return Int((try? dataSource.getCount()) ?? 0)
    }

    func layoutSizeForItem(at index: Int) -> CGSize {
        guard let dataSource else { return .zero }
        let item = dataSource.item(at: index)
        let contentSize = resolvedContentSize(for: item)
        return layoutProvider.layoutSize(contentSize: contentSize)
    }

    func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        guard let dataSource else {
            return UICollectionViewCell()
        }

        let item = dataSource.item(at: indexPath.item)
        let reuseIdentifier = reuseIdentifier(for: item)
        ensureReuseRegistered(for: reuseIdentifier)

        let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: reuseIdentifier,
            for: indexPath
        ) as! HostCell

        let contentSize = resolvedContentSize(for: item)

        do {
            try installHostedContent(in: cell, item: item, contentSize: contentSize)
            cell.updateContentSize(contentSize)
        } catch {
            print("Failed to create list item view: \(error)")
        }

        if let reactTag = cell.reactTag {
            _ = updateViewCallback?(Double(reactTag), item, Double(indexPath.item))
        }

        return cell
    }
}

extension HybridUiListView: NativeListDataSourceObserver {
    func dataSourceDidReload(
        _ dataSource: HybridNativeListDataSource,
        animated: Bool,
        changeset: StagedChangeset<[DiffableListItem]>?
    ) {
        runOnMain { [weak self] in
            guard let self else { return }
            configureCollectionViewIfNeeded()
            premeasureAllVisibleTypes()
            retainHostedContent(in: dataSource)

            guard animated, let collectionView, let changeset else {
                collectionView?.reloadData()
                return
            }

            collectionView.reload(using: changeset) { nextItems in
                dataSource.replaceWrappedItemsFromCollectionView(nextItems)
                collectionView.collectionViewLayout.invalidateLayout()
            }
        }
    }

    func dataSourceDidInsert(_ dataSource: HybridNativeListDataSource, index: Int) {
        runOnMain { [weak self] in
            guard let self else { return }
            let item = dataSource.item(at: index)
            let reuseIdentifier = reuseIdentifier(for: item)
            ensureReuseRegistered(for: reuseIdentifier)
            premeasureItemTypeIfNeeded(for: item)
            let indexPath = IndexPath(item: index, section: 0)
            let indexPaths = [indexPath]
            collectionView?.insertItems(at: indexPaths)
        }
    }

    func dataSourceDidUpdate(
        _ dataSource: HybridNativeListDataSource,
        index: Int,
        previousItem: NativeListItem
    ) {
        runOnMain { [weak self] in
            guard let self else { return }
            let item = dataSource.item(at: index)
            if previousItem.key != item.key {
                hostedContentByItemKey[previousItem.key] = nil
            }

            let reuseIdentifier = reuseIdentifier(for: item)
            ensureReuseRegistered(for: reuseIdentifier)
            premeasureItemTypeIfNeeded(for: item)
            let indexPath = IndexPath(item: index, section: 0)
            let indexPaths = [indexPath]
            collectionView?.reloadItems(at: indexPaths)
        }
    }

    func dataSourceDidRemove(
        _ dataSource: HybridNativeListDataSource,
        index: Int,
        removedItem: NativeListItem
    ) {
        runOnMain { [weak self] in
            guard let self else { return }
            hostedContentByItemKey[removedItem.key] = nil
            let indexPath = IndexPath(item: index, section: 0)
            let indexPaths = [indexPath]
            collectionView?.deleteItems(at: indexPaths)
        }
    }

    func dataSourceDidMove(_ dataSource: HybridNativeListDataSource, fromIndex: Int, toIndex: Int) {
        runOnMain { [weak self] in
            guard let self else { return }
            let sourceIndexPath = IndexPath(item: fromIndex, section: 0)
            let targetIndexPath = IndexPath(item: toIndex, section: 0)
            collectionView?.moveItem(at: sourceIndexPath, to: targetIndexPath)
        }
    }
}
