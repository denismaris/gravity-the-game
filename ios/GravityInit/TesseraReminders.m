// The daily reminder's native half: schedules and clears local
// notifications planned in JavaScript (src/notifications/reminders.ts).
// A plain bridge module - it runs under the New Architecture through the
// legacy-module interop, like react-native-sound.

#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>

static NSString *const kReminderPrefix = @"tessera-";

@interface TesseraReminders : NSObject <RCTBridgeModule>
@end

@implementation TesseraReminders

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionSound;
  [[UNUserNotificationCenter currentNotificationCenter] requestAuthorizationWithOptions:options
                                                                      completionHandler:^(BOOL granted, NSError *_Nullable error) {
    resolve(@(granted));
  }];
}

RCT_EXPORT_METHOD(permissionStatus:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [[UNUserNotificationCenter currentNotificationCenter] getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    switch (settings.authorizationStatus) {
      case UNAuthorizationStatusNotDetermined:
        resolve(@"undetermined");
        break;
      case UNAuthorizationStatusDenied:
        resolve(@"denied");
        break;
      default:
        resolve(@"granted");
        break;
    }
  }];
}

// Clears this app's reminders, then calls `done`.
- (void)clearWithCompletion:(void (^)(void))done
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray<NSString *> *ids = [NSMutableArray array];
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:kReminderPrefix]) {
        [ids addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:ids];
    done();
  }];
}

RCT_EXPORT_METHOD(schedule:(NSArray *)items resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [self clearWithCompletion:^{
    UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
    NSCalendar *calendar = [NSCalendar currentCalendar];
    NSCalendarUnit units = NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute;
    for (NSDictionary *item in items) {
      NSString *identifier = item[@"id"];
      NSNumber *at = item[@"at"];
      if (![identifier isKindOfClass:[NSString class]] || ![at isKindOfClass:[NSNumber class]]) {
        continue;
      }
      NSDate *date = [NSDate dateWithTimeIntervalSince1970:at.doubleValue / 1000.0];
      if ([date timeIntervalSinceNow] <= 0) {
        continue;
      }
      UNMutableNotificationContent *content = [UNMutableNotificationContent new];
      content.title = [item[@"title"] isKindOfClass:[NSString class]] ? item[@"title"] : @"Tessera";
      content.body = [item[@"body"] isKindOfClass:[NSString class]] ? item[@"body"] : @"";
      content.sound = [UNNotificationSound defaultSound];
      UNCalendarNotificationTrigger *trigger =
          [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:[calendar components:units fromDate:date] repeats:NO];
      [center addNotificationRequest:[UNNotificationRequest requestWithIdentifier:identifier content:content trigger:trigger]
               withCompletionHandler:nil];
    }
    resolve(nil);
  }];
}

RCT_EXPORT_METHOD(cancelAll:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  [self clearWithCompletion:^{
    resolve(nil);
  }];
}

@end
