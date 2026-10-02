import Foundation
import WidgetKit

/// Asks the home-screen widget to redraw - WidgetKit is Swift-only, so the
/// Objective-C bridge (TesseraWidgetBridge.m) calls through this.
@objc public class TesseraWidgetReloader: NSObject {
  @objc public static func reload() {
    WidgetCenter.shared.reloadAllTimelines()
  }
}
