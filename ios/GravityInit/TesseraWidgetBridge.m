// The home-screen widget's bridge: the app writes the player's Daily state
// (src/widget/index.ts) where the widget extension can read it, then asks
// the widget to redraw. Reading needs the App Group capability on both
// targets; without it the widget still shows the day's Daily.

#import <React/RCTBridgeModule.h>
#import "GravityInit-Swift.h"

static NSString *const kAppGroup = @"group.com.marisdenis.tessera";
static NSString *const kStateKey = @"tessera.widget";

@interface TesseraWidget : NSObject <RCTBridgeModule>
@end

@implementation TesseraWidget

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(update:(NSString *)json)
{
  NSUserDefaults *shared = [[NSUserDefaults alloc] initWithSuiteName:kAppGroup];
  [shared setObject:json forKey:kStateKey];
  [TesseraWidgetReloader reload];
}

@end
