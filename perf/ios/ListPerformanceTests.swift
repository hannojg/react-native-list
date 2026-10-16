import XCTest

@MainActor
final class ListPerformanceTests: XCTestCase {
  private let app = XCUIApplication()

  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  private func launch() {
    app.terminate()
    app.launch()
    let ready = app.staticTexts["perf-ready"].waitForExistence(timeout: 30)
    XCTAssertTrue(ready)
  }

  private func options() -> XCTMeasureOptions {
    let options = XCTMeasureOptions()
    options.iterationCount = 5
    options.invocationOptions = [.manuallyStart, .manuallyStop]
    return options
  }

  private func reset() {
    app.buttons["perf-reset"].tap()
    let ready = app.staticTexts["perf-ready"].waitForExistence(timeout: 25)
    XCTAssertTrue(ready)
    XCTAssertFalse(app.collectionViews["perf-list"].exists)
  }

  private func snapshot(_ identifier: String) throws -> [String: Double] {
    let element = app.staticTexts[identifier]
    let exists = element.waitForExistence(timeout: 25)
    XCTAssertTrue(exists)
    let encoded = element.label.data(using: .utf8)
    let data = try XCTUnwrap(encoded)
    let decoder = JSONDecoder()
    let snapshot = try decoder.decode([String: Double].self, from: data)
    let thermal = try XCTUnwrap(snapshot["thermal"])
    XCTAssertLessThan(thermal, 2, "Device is thermally constrained")
    return snapshot
  }

  private func validateMount() throws {
    let state = try snapshot("perf-mounted")
    XCTAssertEqual(state["first"], 0)
    let last = try XCTUnwrap(state["last"])
    XCTAssertGreaterThan(last, 0)
    XCTAssertTrue(app.collectionViews["perf-list"].exists)
  }

  func testMount() {
    launch()
    let signpost = XCTOSSignpostMetric(subsystem: "com.hannojg.list.perf", category: "benchmark", name: "ListMount")
    let cpu = XCTCPUMetric(application: app)
    let memory = XCTMemoryMetric(application: app)
    let metrics: [XCTMetric] = [signpost, cpu, memory]
    let measureOptions = options()
    measure(metrics: metrics, options: measureOptions) {
      reset()
      startMeasuring()
      app.buttons["perf-mount"].tap()
      let mounted = app.staticTexts["perf-mounted"].waitForExistence(timeout: 25)
      XCTAssertTrue(mounted)
      stopMeasuring()
      do { try validateMount() } catch { XCTFail("Invalid mount: \(error)") }
    }
  }

  func testScroll() {
    launch()
    let hitch = XCTHitchMetric(application: app)
    let scrolling = XCTOSSignpostMetric.scrollingAndDecelerationMetric
    let cpu = XCTCPUMetric(application: app)
    let memory = XCTMemoryMetric(application: app)
    let metrics: [XCTMetric] = [hitch, scrolling, cpu, memory]
    let measureOptions = options()
    measure(metrics: metrics, options: measureOptions) {
      reset()
      app.buttons["perf-mount"].tap()
      do { try validateMount() } catch { XCTFail("Invalid mount: \(error)") }
      let list = app.collectionViews["perf-list"]
      startMeasuring()
      for _ in 0..<6 { list.swipeUp(velocity: .fast) }
      stopMeasuring()
      app.buttons["perf-inspect"].tap()
      do {
        let state = try snapshot("perf-inspected")
        let first = try XCTUnwrap(state["first"])
        let offset = try XCTUnwrap(state["offset"])
        let viewport = try XCTUnwrap(state["viewport"])
        XCTAssertGreaterThan(first, 0, "Scroll did not advance through the dataset")
        XCTAssertGreaterThan(offset, viewport)
        let json = app.staticTexts["perf-inspected"].label
        let attachment = XCTAttachment(string: json)
        attachment.name = "scroll-workload"
        attachment.lifetime = .keepAlways
        add(attachment)
      } catch { XCTFail("Invalid scroll: \(error)") }
    }
  }
}
