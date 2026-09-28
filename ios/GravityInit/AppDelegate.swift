import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    window?.backgroundColor = paperBackground

    factory.startReactNative(
      withModuleName: "GravityTheGame",
      in: window,
      launchOptions: launchOptions
    )
    // The React root view itself, which is white by default and is what
    // actually shows during the frames before JS paints. Set here rather
    // than by overriding `customizeRootView` - that hook is part of the
    // ObjC `RCTUIConfiguratorProtocol` and is not surfaced on the Swift
    // `RCTDefaultReactNativeFactoryDelegate`, so overriding it does not
    // compile.
    window?.rootViewController?.view.backgroundColor = paperBackground

    return true
  }
}

/** The app's own paper colour (`theme.colors.background`, #EDE5D3). Set in
 * three places that each cover a different slice of the cold start, which is
 * why they have to stay in step by hand: LaunchScreen.storyboard covers the
 * launch image, the window covers the gap after it, and the React root view
 * covers the frames before JS paints. Miss any one and a white flash shows
 * through the middle of the opening animation. */
private let paperBackground = UIColor(red: 237.0 / 255.0, green: 229.0 / 255.0, blue: 211.0 / 255.0, alpha: 1.0)

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
