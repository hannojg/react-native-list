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

final class CollectionViewDelegateProxy: NSObject, UICollectionViewDelegateFlowLayout {
    weak var owner: HybridUiListView?

    init(owner: HybridUiListView) {
        self.owner = owner
        super.init()
    }

    func collectionView(
        _ collectionView: UICollectionView,
        layout collectionViewLayout: UICollectionViewLayout,
        sizeForItemAt indexPath: IndexPath
    ) -> CGSize {
        guard let owner else {
            return .zero
        }
        return owner.collectionView(
            collectionView,
            layout: collectionViewLayout,
            sizeForItemAt: indexPath
        )
    }
}

private struct HostedFabricViewRestorePoint {
    let view: UIView
    let originalSuperview: UIView
    let originalIndex: Int
}

class HybridUiListView : HybridUiListViewSpec {
    let view: UIView

    private var collectionView: UICollectionView?
    private var collectionDataSourceProxy: CollectionViewDataSourceProxy?
    private var collectionDelegateProxy: CollectionViewDelegateProxy?
    private var dataSource: HybridNativeListDataSource?
    private var layoutProvider: NativeListLayoutProviding = HybridNativeLinearListLayout()
    private var registeredReuseIdentifiers = Set<String>()
    private var measuredContentSizeByItemKey: [String: CGSize] = [:]
    private var hasScheduledLayoutInvalidation = false
    private let measuredSizeTolerance: CGFloat = 0.5
    private var rendererSurfaceId: ReactTag?
    // Fabric unmount asserts that a child is still mounted under its original parent.
    // Cells temporarily host those views, so teardown must restore the parent first.
    private var fabricRestorePointsByReactTag: [ReactTag: HostedFabricViewRestorePoint] = [:]
    private let hostedCells = NSHashTable<HostCell>.weakObjects()

    private var createViewCallback: ((_ type: String) -> Double)?
    private var updateViewCallback: ((_ reactTag: Double, _ item: NativeListItem, _ index: Double) -> Bool)?

    override init() {
        view = UIView(frame: .zero)
        super.init()
    }

    func getSurfaceId() throws -> Double {
        if let rendererSurfaceId {
            return Double(rendererSurfaceId)
        }

        var createdSurfaceId: ReactTag?
        var capturedError: Error?

        let createSurface = {
            do {
                let surfaceId = try SurfaceHelper.createExternalSurface()
                createdSurfaceId = ReactTag(truncating: surfaceId)
            } catch {
                capturedError = error
            }
        }

        if Thread.isMainThread {
            createSurface()
        } else {
            DispatchQueue.main.sync(execute: createSurface)
        }

        if let capturedError {
            let message = String(describing: capturedError)
            throw RuntimeError.error(withMessage: message)
        }

        guard let createdSurfaceId else {
            throw RuntimeError.error(withMessage: "Could not create renderer surface.")
        }

        rendererSurfaceId = createdSurfaceId
        return Double(createdSurfaceId)
    }

    func disposeRendererSurface() throws {
        let surfaceId = rendererSurfaceId
        rendererSurfaceId = nil
        createViewCallback = nil
        updateViewCallback = nil

        var capturedError: Error?

        let disposeSurface = {
            self.dataSource?.observer = nil
            self.dataSource = nil
            self.collectionView?.dataSource = nil
            self.collectionView?.delegate = nil
            // RCTFabricSurface.stop() commits an empty tree. Let Fabric perform that cleanup
            // after the UIKit hierarchy matches Fabric's expected parent-child structure again (otherwise we crash).
            self.restoreFabricViewHierarchy()
            self.collectionView?.removeFromSuperview()
            self.collectionView = nil
            self.collectionDataSourceProxy = nil
            self.collectionDelegateProxy = nil
            self.registeredReuseIdentifiers.removeAll()
            self.measuredContentSizeByItemKey.removeAll()
            self.hasScheduledLayoutInvalidation = false

            guard let surfaceId else {
                return
            }

            do {
                _ = try SurfaceHelper.releaseExternalSurface(surfaceId)
            } catch {
                capturedError = error
            }
        }

        if Thread.isMainThread {
            disposeSurface()
        } else {
            DispatchQueue.main.sync(execute: disposeSurface)
        }

        if let capturedError {
            let message = String(describing: capturedError)
            throw RuntimeError.error(withMessage: message)
        }
    }

    func onDropView() {
        do {
            try disposeRendererSurface()
        } catch {
            print("Failed to dispose list renderer surface: \(error)")
        }
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
            self.retainMeasuredContent(in: concreteDataSource)
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
        let delegateProxy = CollectionViewDelegateProxy(owner: self)
        collectionDataSourceProxy = dataSourceProxy
        collectionDelegateProxy = delegateProxy
        collectionView.dataSource = dataSourceProxy
        collectionView.delegate = delegateProxy
        self.collectionView = collectionView
    }

    private func makeView(type: String) throws -> (UIView, ReactTag) {
        guard let createViewCallback else {
            throw RuntimeError.error(withMessage: "Can only call makeView after setListCallbacks.")
        }

        let rawViewTag = createViewCallback(type)
        let viewTag = ReactTag(rawViewTag)
        let resolvedView = try SurfaceHelper.getViewByTag(viewTag)
        try recordFabricRestorePoint(for: resolvedView, viewTag: viewTag)
        resolvedView.removeFromSuperview()
        return (resolvedView, viewTag)
    }

    private func recordFabricRestorePoint(for resolvedView: UIView, viewTag: ReactTag) throws {
        guard let originalSuperview = resolvedView.superview else {
            throw RuntimeError.error(
                withMessage: "Fabric view \(viewTag) must have a superview before being hosted by the list."
            )
        }

        guard let originalIndex = originalSuperview.subviews.firstIndex(of: resolvedView) else {
            throw RuntimeError.error(
                withMessage: "Fabric view \(viewTag) must be present in its Fabric parent before being hosted by the list."
            )
        }

        let restorePoint = HostedFabricViewRestorePoint(
            view: resolvedView,
            originalSuperview: originalSuperview,
            originalIndex: originalIndex
        )
        fabricRestorePointsByReactTag[viewTag] = restorePoint
    }

    private func restoreFabricViewHierarchy() {
        detachHostedCells()

        let restorePoints = fabricRestorePointsByReactTag.values.sorted { firstPoint, secondPoint in
            return firstPoint.originalIndex < secondPoint.originalIndex
        }

        for restorePoint in restorePoints {
            restoreFabricView(restorePoint)
        }

        fabricRestorePointsByReactTag.removeAll()
    }

    private func detachHostedCells() {
        let cells = hostedCells.allObjects
        for cell in cells {
            cell.detachHostedView()
        }
        hostedCells.removeAllObjects()
    }

    private func restoreFabricView(_ restorePoint: HostedFabricViewRestorePoint) {
        let hostedView = restorePoint.view
        let originalSuperview = restorePoint.originalSuperview

        if hostedView.superview === originalSuperview {
            let currentIndex = originalSuperview.subviews.firstIndex(of: hostedView)
            if currentIndex == restorePoint.originalIndex {
                return
            }
            hostedView.removeFromSuperview()
        }

        precondition(hostedView.superview == nil, "Fabric view must be detached before restoring it.")

        let subviewCount = originalSuperview.subviews.count
        let insertionIndex: Int
        if restorePoint.originalIndex <= subviewCount {
            insertionIndex = restorePoint.originalIndex
        } else {
            insertionIndex = subviewCount
        }

        originalSuperview.insertSubview(hostedView, at: insertionIndex)
    }

    private func measure(view: UIView) -> CGSize? {
        // Fabric has already applied layout metrics after updateView returns.
        // Asking UIKit Auto Layout to resolve this root can collapse it back to zero.
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

    private func resolvedContentSize(for item: NativeListItem) -> CGSize {
        let measuredSize = measuredContentSizeByItemKey[item.key]

        // UICollectionViewFlowLayout asks for item sizes before cells are created.
        // If JS did not provide a dimension and this item has not been measured yet,
        // use a viewport-based estimate for the first pass. Once cellForItemAt binds
        // real content, we measure the Fabric-applied frame and future queries use it.
        let width: CGFloat
        if let itemWidth = item.width {
            width = CGFloat(itemWidth)
        } else if let measuredWidth = measuredSize?.width {
            width = measuredWidth
        } else {
            let collectionViewWidth = collectionView?.bounds.width ?? 0
            width = layoutProvider.estimatedContentWidth(
                collectionViewWidth: collectionViewWidth,
                viewWidth: view.bounds.width
            )
        }

        let height: CGFloat
        if let itemHeight = item.height {
            height = CGFloat(itemHeight)
        } else if let measuredHeight = measuredSize?.height {
            height = measuredHeight
        } else {
            let collectionViewHeight = collectionView?.bounds.height ?? 0
            height = layoutProvider.estimatedContentHeight(
                collectionViewHeight: collectionViewHeight,
                viewHeight: view.bounds.height
            )
        }

        return CGSize(width: width, height: height)
    }

    private func captureMeasuredContentSize(for item: NativeListItem, view: UIView) -> Bool {
        guard let measuredSize = measure(view: view) else {
            return false
        }

        let width = item.width.map { CGFloat($0) } ?? measuredSize.width
        let height = item.height.map { CGFloat($0) } ?? measuredSize.height
        let nextSize = CGSize(width: width, height: height)
        let previousSize = measuredContentSizeByItemKey[item.key]

        if let previousSize {
            let widthDelta = abs(previousSize.width - nextSize.width)
            let heightDelta = abs(previousSize.height - nextSize.height)
            // Fabric can report tiny fractional differences for the same rendered row.
            // Ignoring sub-point churn avoids full layout invalidations for visual no-ops.
            if widthDelta < measuredSizeTolerance && heightDelta < measuredSizeTolerance {
                return false
            }
        }

        measuredContentSizeByItemKey[item.key] = nextSize
        return true
    }

    private func needsMeasuredContentSize(for item: NativeListItem) -> Bool {
        return item.width == nil || item.height == nil
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
        if cell.hostedContentView != nil {
            guard cell.itemType == item.type else {
                throw RuntimeError.error(
                    withMessage:
                        "CollectionView supplied cell for type '\(cell.itemType ?? "<nil>")' " +
                        "to item type '\(item.type)'."
                )
            }
            cell.bind(itemKey: item.key)
            cell.updateContentSize(contentSize)
            return
        }

        let result = try makeView(type: item.type)
        cell.install(
            view: result.0,
            contentSize: contentSize,
            itemKey: item.key,
            itemType: item.type
        )
        cell.reactTag = result.1
        hostedCells.add(cell)
    }

    private func retainMeasuredContent(in dataSource: HybridNativeListDataSource) {
        let activeKeys = dataSource.itemsForPremeasurement().map { item in
            item.key
        }
        let activeKeySet = Set(activeKeys)
        measuredContentSizeByItemKey = measuredContentSizeByItemKey.filter { entry in
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

    private func scheduleLayoutInvalidation() {
        if hasScheduledLayoutInvalidation {
            return
        }

        hasScheduledLayoutInvalidation = true

        // Perf optimization: Several visible cells can discover their real size in the same UI tick.
        // Coalesce those updates so FlowLayout only recalculates once.
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.hasScheduledLayoutInvalidation = false
            self.collectionView?.collectionViewLayout.invalidateLayout()
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
        layout collectionViewLayout: UICollectionViewLayout,
        sizeForItemAt indexPath: IndexPath
    ) -> CGSize {
        guard let dataSource else {
            return .zero
        }

        let item = dataSource.item(at: indexPath.item)
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
        } catch {
            print("Failed to create list item view: \(error)")
        }

        if let reactTag = cell.reactTag {
            let width = resolvedContentSize(for: item).width
            let height = item.height.map { CGFloat($0) }

            cell.prepareForMeasurement(width: width, height: height)

            _ = updateViewCallback?(Double(reactTag), item, Double(indexPath.item))
        }

        if let hostedView = cell.hostedContentView, needsMeasuredContentSize(for: item) {
            let didMeasureNewSize = captureMeasuredContentSize(for: item, view: hostedView)
            let measuredContentSize = resolvedContentSize(for: item)
            cell.updateContentSize(measuredContentSize)

            if didMeasureNewSize {
                scheduleLayoutInvalidation()
            }
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
            retainMeasuredContent(in: dataSource)

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
                measuredContentSizeByItemKey[previousItem.key] = nil
            }

            let reuseIdentifier = reuseIdentifier(for: item)
            ensureReuseRegistered(for: reuseIdentifier)
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
            measuredContentSizeByItemKey[removedItem.key] = nil
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
