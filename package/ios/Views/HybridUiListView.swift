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
    var hasHostedView: Bool {
        return hostedView != nil
    }

    func install(view: UIView, contentSize: CGSize) {
        hostedView?.removeFromSuperview()
        hostedView = view

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

    override func prepareForReuse() {
        super.prepareForReuse()
        if let hostedView {
            contentView.bringSubviewToFront(hostedView)
        }
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

final class ListCollectionViewLayout: UICollectionViewLayout {
    weak var owner: HybridUiListView?
    private var itemAttributes: [UICollectionViewLayoutAttributes] = []
    private var contentSize = CGSize.zero

    init(owner: HybridUiListView) {
        self.owner = owner
        super.init()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func prepare() {
        guard let collectionView, let owner else {
            itemAttributes = []
            contentSize = .zero
            return
        }

        var attributes: [UICollectionViewLayoutAttributes] = []
        var yOffset = owner.listTopInset
        let itemCount = owner.collectionView(collectionView, numberOfItemsInSection: 0)

        for itemIndex in 0..<itemCount {
            let indexPath = IndexPath(item: itemIndex, section: 0)
            let itemSize = owner.layoutSizeForItem(at: itemIndex, in: collectionView)
            let frame = CGRect(
                x: 0,
                y: yOffset,
                width: itemSize.width,
                height: itemSize.height
            )
            let itemAttributes = UICollectionViewLayoutAttributes(forCellWith: indexPath)
            itemAttributes.frame = frame
            attributes.append(itemAttributes)
            yOffset += itemSize.height + owner.listInterItemSpacing
        }

        if itemCount > 0 {
            yOffset -= owner.listInterItemSpacing
        }
        yOffset += owner.listBottomInset

        itemAttributes = attributes
        contentSize = CGSize(width: collectionView.bounds.width, height: max(yOffset, 0))
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
    private var registeredReuseIdentifiers = Set<String>()
    private var items: [DiffableListItem] = []

    let listTopInset: CGFloat = 16
    let listBottomInset: CGFloat = 16
    let listInterItemSpacing: CGFloat = 12

    private var createViewCallback: ((_ type: String) -> Double)?
    private var updateViewCallback: ((_ reactTag: Double, _ item: NativeListItem, _ index: Double) -> Bool)?
    private var isContentEqualCallback: ((_ oldItem: NativeListItem, _ newItem: NativeListItem) -> Bool)?

    override init() {
        view = UIView(frame: .zero)
        super.init()
    }

    func setListCallbacks(
        uiListModule: any HybridUiListModuleSpec,
        createView: @escaping (String) -> Double,
        updateView: @escaping (Double, NativeListItem, Double) -> Bool,
        isContentEqual: @escaping (NativeListItem, NativeListItem) -> Bool
    ) throws {
        createViewCallback = createView
        updateViewCallback = updateView
        isContentEqualCallback = isContentEqual
        runOnMain { [weak self] in
            self?.configureCollectionViewIfNeeded()
        }
    }

    func setData(items newItems: [NativeListItem], animated: Bool) throws {
        runOnMain { [weak self] in
            self?.setDataOnMain(items: newItems, animated: animated)
        }
    }

    func insertItem(index: Double, item: NativeListItem) throws {
        runOnMain { [weak self] in
            guard let self else { return }
            let itemIndex = self.validInsertionIndex(index)
            let wrappedItem = self.wrap(item)
            self.items.insert(wrappedItem, at: itemIndex)
            self.ensureReuseRegistered(for: item.type)
            self.collectionView?.collectionViewLayout.invalidateLayout()
            self.collectionView?.insertItems(at: [IndexPath(item: itemIndex, section: 0)])
        }
    }

    func updateItem(index: Double, item: NativeListItem) throws {
        runOnMain { [weak self] in
            guard let self else { return }
            let itemIndex = self.validExistingIndex(index)
            self.items[itemIndex] = self.wrap(item)
            self.ensureReuseRegistered(for: item.type)
            self.collectionView?.collectionViewLayout.invalidateLayout()
            self.collectionView?.reloadItems(at: [IndexPath(item: itemIndex, section: 0)])
        }
    }

    func removeItem(index: Double) throws {
        runOnMain { [weak self] in
            guard let self else { return }
            let itemIndex = self.validExistingIndex(index)
            self.items.remove(at: itemIndex)
            self.collectionView?.collectionViewLayout.invalidateLayout()
            self.collectionView?.deleteItems(at: [IndexPath(item: itemIndex, section: 0)])
        }
    }

    func moveItem(fromIndex: Double, toIndex: Double) throws {
        runOnMain { [weak self] in
            guard let self else { return }
            let sourceIndex = self.validExistingIndex(fromIndex)
            let targetIndex = self.validExistingIndex(toIndex)
            let item = self.items.remove(at: sourceIndex)
            self.items.insert(item, at: targetIndex)
            self.collectionView?.collectionViewLayout.invalidateLayout()
            let sourceIndexPath = IndexPath(item: sourceIndex, section: 0)
            let targetIndexPath = IndexPath(item: targetIndex, section: 0)
            self.collectionView?.moveItem(at: sourceIndexPath, to: targetIndexPath)
        }
    }

    private func setDataOnMain(items newItems: [NativeListItem], animated: Bool) {
        configureCollectionViewIfNeeded()

        let targetItems = newItems.map { item in
            wrap(item)
        }
        for item in newItems {
            ensureReuseRegistered(for: item.type)
        }

        guard animated, let collectionView else {
            items = targetItems
            collectionView?.collectionViewLayout.invalidateLayout()
            collectionView?.reloadData()
            return
        }

        let changeset = StagedChangeset(source: items, target: targetItems)
        collectionView.reload(using: changeset) { nextItems in
            self.items = nextItems
            collectionView.collectionViewLayout.invalidateLayout()
        }
    }

    private func configureCollectionViewIfNeeded() {
        guard collectionView == nil else { return }

        let layout = ListCollectionViewLayout(owner: self)

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

    private func makeView(type: String) throws -> (UIView, ReactTag) {
        guard let createViewCallback else {
            throw RuntimeError.error(withMessage: "Can only call makeView after setListCallbacks.")
        }

        let viewTag = ReactTag(createViewCallback(type))
        let resolvedView = try SurfaceHelper.getViewByTag(viewTag)
        resolvedView.removeFromSuperview()
        return (resolvedView, viewTag)
    }

    private func wrap(_ item: NativeListItem) -> DiffableListItem {
        let contentEqual = isContentEqualCallback ?? { _, _ in false }
        return DiffableListItem(nativeItem: item, contentEqual: contentEqual)
    }

    private func ensureReuseRegistered(for type: String) {
        guard !registeredReuseIdentifiers.contains(type) else { return }

        collectionView?.register(HostCell.self, forCellWithReuseIdentifier: type)
        registeredReuseIdentifiers.insert(type)
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
        return items.count
    }

    func layoutSizeForItem(at index: Int, in collectionView: UICollectionView) -> CGSize {
        let item = items[index].nativeItem
        let width = collectionView.bounds.width
        let height = CGFloat(item.height) + HostCell.verticalInset * 2
        return CGSize(width: width, height: height)
    }

    func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        let item = items[indexPath.item].nativeItem
        ensureReuseRegistered(for: item.type)

        let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: item.type,
            for: indexPath
        ) as! HostCell

        let contentSize = CGSize(width: item.width, height: item.height)

        if !cell.hasHostedView {
            do {
                let result = try makeView(type: item.type)
                cell.install(view: result.0, contentSize: contentSize)
                cell.reactTag = result.1
            } catch {
                print("Failed to create list item view: \(error)")
            }
        } else {
            cell.updateContentSize(contentSize)
        }

        if let reactTag = cell.reactTag {
            _ = updateViewCallback?(Double(reactTag), item, Double(indexPath.item))
        }

        return cell
    }
}
