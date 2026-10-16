import ExpoModulesCore
import QuartzCore
import UIKit
import os.signpost

public final class ListBenchmarkModule: Module {
  private let log = OSLog(subsystem: "com.hannojg.list.perf", category: "benchmark")
  private var signpost: OSSignpostID?
  private var displayLink: CADisplayLink?
  private var startedAt: CFTimeInterval = 0
  private var result: [String: Any]?
  private var completion: Promise?
  private var failure: String?
  private var observer: MountObserver?
  private var waitingForUnmount = false

  public func definition() -> ModuleDefinition {
    Name("ListBenchmark")

    AsyncFunction("beginMount") { () in
      self.waitingForUnmount = false
      self.startedAt = CACurrentMediaTime()
      self.result = nil
      self.failure = nil
      let identifier = OSSignpostID(log: self.log)
      self.signpost = identifier
      os_signpost(.begin, log: self.log, name: "ListMount", signpostID: identifier)
      let observer = MountObserver { [weak self] in self?.checkMount() }
      self.observer = observer
      let link = CADisplayLink(target: observer, selector: #selector(MountObserver.tick))
      self.displayLink = link
      link.add(to: .main, forMode: .common)
    }.runOnQueue(.main)

    AsyncFunction("waitForUnmount") { (promise: Promise) in
      self.waitingForUnmount = true
      self.startedAt = CACurrentMediaTime()
      self.completion = promise
      let observer = MountObserver { [weak self] in self?.checkMount() }
      self.observer = observer
      let link = CADisplayLink(target: observer, selector: #selector(MountObserver.tick))
      self.displayLink = link
      link.add(to: .main, forMode: .common)
    }.runOnQueue(.main)

    AsyncFunction("waitForMount") { (promise: Promise) in
      if let result = self.result {
        promise.resolve(result)
      } else if let failure = self.failure {
        promise.reject("ERR_MOUNT", failure)
      } else {
        self.completion = promise
      }
    }.runOnQueue(.main)

    AsyncFunction("snapshot") { () -> [String: Any] in
      guard let list = self.findList() else {
        throw NSError(domain: "ListBenchmark", code: 1, userInfo: [NSLocalizedDescriptionKey: "List missing"])
      }
      return self.snapshot(list)
    }.runOnQueue(.main)

    OnDestroy {
      self.displayLink?.invalidate()
    }
  }

  private func findList(in view: UIView) -> UICollectionView? {
    if let collection = view as? UICollectionView { return collection }
    for child in view.subviews {
      if let collection = findList(in: child) { return collection }
    }
    return nil
  }

  private func findList() -> UICollectionView? {
    let scenes = UIApplication.shared.connectedScenes
    for scene in scenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      for window in windowScene.windows where window.isKeyWindow {
        if let collection = findList(in: window) { return collection }
      }
    }
    return nil
  }

  private func snapshot(_ list: UICollectionView) -> [String: Any] {
    let paths = list.indexPathsForVisibleItems
    let indices = paths.map { $0.item }
    return [
      "first": indices.min() ?? -1,
      "last": indices.max() ?? -1,
      "offset": list.contentOffset.y,
      "viewport": list.bounds.height,
      "thermal": ProcessInfo.processInfo.thermalState.rawValue,
    ]
  }

  private func checkMount() {
    if CACurrentMediaTime() - startedAt > 20 {
      let message = "List readiness timed out after 20 seconds (unmount: \(waitingForUnmount))"
      failure = message
      completion?.reject("ERR_MOUNT", message)
      finish()
      return
    }
    if waitingForUnmount {
      guard findList() == nil else { return }
      completion?.resolve(nil)
      finish()
      return
    }
    guard let list = findList(), list.bounds.height > 0 else { return }
    let cells = list.visibleCells
    guard !cells.isEmpty else { return }
    let frames = cells.map { $0.frame }
    let topEdges = frames.map { $0.minY }
    let bottomEdges = frames.map { $0.maxY }
    let minimumY = topEdges.min() ?? .infinity
    let maximumY = bottomEdges.max() ?? -.infinity
    guard minimumY <= list.bounds.minY + 1, maximumY >= list.bounds.maxY - 1 else { return }
    let indices = list.indexPathsForVisibleItems
    let first = IndexPath(item: 0, section: 0)
    guard indices.contains(first) else { return }
    list.accessibilityIdentifier = "perf-list"
    result = snapshot(list)
    completion?.resolve(result)
    finish()
  }

  private func finish() {
    if let signpost {
      os_signpost(.end, log: log, name: "ListMount", signpostID: signpost)
    }
    signpost = nil
    displayLink?.invalidate()
    displayLink = nil
    observer = nil
    completion = nil
  }
}

private final class MountObserver: NSObject {
  private let callback: () -> Void
  init(callback: @escaping () -> Void) { self.callback = callback }
  @objc func tick() { callback() }
}
