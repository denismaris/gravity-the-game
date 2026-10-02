import SwiftUI
import WidgetKit

// Today's Daily on the home screen.
//
// The puzzle comes from `daily-schedule.json`, bundled with the widget and
// generated from the app's own Daily rule (tools/makeWidgetSchedule.ts), so
// the widget is right even on a day the app has not been opened. The
// player's own state - today's done, the streak - is read from the app
// group the app writes to (src/widget/index.ts); without it, the widget
// still shows the Daily, just without the streak.

private let appGroup = "group.com.marisdenis.tessera"
private let stateKey = "tessera.widget"

// MARK: - Data

struct DailyDay: Decodable {
  let n: String
  let g: String
  let c: String
}

struct Schedule: Decodable {
  let start: String
  let days: [DailyDay]
}

struct PlayerState: Decodable {
  let streak: Int
  let solvedKey: String?
}

private var utc: Calendar = {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(identifier: "UTC")!
  return calendar
}()

private func dayKey(_ date: Date) -> String {
  let parts = utc.dateComponents([.year, .month, .day], from: date)
  return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
}

private func date(of key: String) -> Date? {
  let parts = key.split(separator: "-").compactMap { Int($0) }
  guard parts.count == 3 else { return nil }
  return utc.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
}

private let schedule: Schedule? = {
  guard let url = Bundle.main.url(forResource: "daily-schedule", withExtension: "json"),
        let data = try? Data(contentsOf: url) else { return nil }
  return try? JSONDecoder().decode(Schedule.self, from: data)
}()

/// Daily #1 was the first day of 2026 (as `dailyNumber` in the app).
private func dailyNumber(_ date: Date) -> Int {
  let epoch = utc.date(from: DateComponents(year: 2026, month: 1, day: 1))!
  return (utc.dateComponents([.day], from: epoch, to: utc.startOfDay(for: date)).day ?? 0) + 1
}

struct DailyEntry: TimelineEntry {
  let date: Date
  let number: Int
  let day: DailyDay?
  /// Today's done.
  let solved: Bool
  /// The streak as it stands - zero once a day has been missed.
  let streak: Int
  /// Whether the app's state could be read at all.
  let knowsPlayer: Bool
}

private func entry(at when: Date) -> DailyEntry {
  let key = dayKey(when)
  var day: DailyDay?
  if let schedule, let start = date(of: schedule.start) {
    let index = utc.dateComponents([.day], from: start, to: utc.startOfDay(for: when)).day ?? -1
    if index >= 0 && index < schedule.days.count { day = schedule.days[index] }
  }
  var solved = false
  var streak = 0
  var knows = false
  if let raw = UserDefaults(suiteName: appGroup)?.string(forKey: stateKey),
     let state = try? JSONDecoder().decode(PlayerState.self, from: Data(raw.utf8)) {
    knows = true
    let yesterday = dayKey(utc.date(byAdding: .day, value: -1, to: when)!)
    solved = state.solvedKey == key
    streak = (state.solvedKey == key || state.solvedKey == yesterday) ? state.streak : 0
  }
  return DailyEntry(date: when, number: dailyNumber(when), day: day, solved: solved, streak: streak, knowsPlayer: knows)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> DailyEntry {
    DailyEntry(date: Date(), number: 275, day: DailyDay(n: "Escort II", g: "Gravity", c: "#C46C33"), solved: false, streak: 4, knowsPlayer: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (DailyEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: Date()))
  }

  /// Now, then each of the next few UTC midnights - when the Daily turns over.
  func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEntry>) -> Void) {
    let now = Date()
    var entries = [entry(at: now)]
    var midnight = utc.startOfDay(for: now)
    for _ in 0..<3 {
      midnight = utc.date(byAdding: .day, value: 1, to: midnight)!
      entries.append(entry(at: midnight))
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - Look

private extension Color {
  init(hex: String) {
    let value = UInt64(hex.dropFirst(), radix: 16) ?? 0
    self.init(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
  }

  /// The app's own paper, ink and accents, by day and by night.
  static func dynamic(_ light: String, _ dark: String) -> Color {
    Color(UIColor { traits in
      let hex = traits.userInterfaceStyle == .dark ? dark : light
      let value = UInt64(hex.dropFirst(), radix: 16) ?? 0
      return UIColor(red: CGFloat((value >> 16) & 0xFF) / 255, green: CGFloat((value >> 8) & 0xFF) / 255, blue: CGFloat(value & 0xFF) / 255, alpha: 1)
    })
  }

  static let paper = dynamic("#EDE5D3", "#15101B")
  static let ink = dynamic("#3B1F52", "#EFE3CC")
  static let quiet = dynamic("#7D6E86", "#9A8DA6")
  static let terracotta = dynamic("#C46C33", "#E08452")
  static let mark = dynamic("#D9CDB6", "#2E2637")
  static let solved = dynamic("#5C7C4A", "#8DB87A")
}

private struct Kicker: View {
  let number: Int
  var body: some View {
    HStack {
      Text("TODAY'S DAILY")
        .font(.system(size: 9, weight: .bold, design: .monospaced))
        .tracking(1.2)
        .foregroundColor(.terracotta)
      Spacer(minLength: 4)
      Text("No. \(number)")
        .font(.system(size: 9, weight: .medium, design: .monospaced))
        .foregroundColor(.quiet)
    }
  }
}

private struct Title: View {
  let entry: DailyEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 5) {
        Circle().fill(Color(hex: entry.day?.c ?? "#C46C33")).frame(width: 7, height: 7)
        Text(entry.day?.g ?? "A new puzzle")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(.quiet)
          .lineLimit(1)
      }
      Text(entry.day?.n ?? "Open Tessera")
        .font(.system(size: 19, weight: .bold, design: .serif))
        .foregroundColor(.ink)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
    }
  }
}

private struct Status: View {
  let entry: DailyEntry
  var body: some View {
    Group {
      if entry.solved {
        Text(entry.streak > 1 ? "Solved · \(entry.streak)-day streak" : "Solved today")
          .foregroundColor(.solved)
      } else if entry.streak > 0 {
        Text("Keep your \(entry.streak)-day streak")
          .foregroundColor(.terracotta)
      } else {
        Text(entry.knowsPlayer ? "Start a streak today" : "Tap to play")
          .foregroundColor(.quiet)
      }
    }
    .font(.system(size: 11, weight: .semibold))
    .lineLimit(1)
    .minimumScaleFactor(0.85)
  }
}

/// A week of marks, the same row the app's Today page shows.
private struct Marks: View {
  let streak: Int
  var body: some View {
    HStack(spacing: 4) {
      ForEach(0..<7, id: \.self) { i in
        Capsule()
          .fill(i < min(streak, 7) ? Color.terracotta : Color.mark)
          .frame(height: 5)
      }
    }
  }
}

private struct PlayButton: View {
  let solved: Bool
  var body: some View {
    ZStack {
      Circle().fill(solved ? Color.solved : Color.terracotta)
      if solved {
        Image(systemName: "checkmark").font(.system(size: 17, weight: .bold)).foregroundColor(.paper)
      } else {
        Image(systemName: "play.fill").font(.system(size: 16, weight: .bold)).foregroundColor(.paper).offset(x: 1.5)
      }
    }
    .frame(width: 46, height: 46)
  }
}

struct TesseraWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: DailyEntry

  var body: some View {
    content
      .widgetURL(URL(string: "tessera://daily"))
      .modifier(PaperBackground())
  }

  @ViewBuilder private var content: some View {
    if family == .systemMedium {
      HStack(alignment: .center, spacing: 14) {
        VStack(alignment: .leading, spacing: 8) {
          Kicker(number: entry.number)
          Title(entry: entry)
          Spacer(minLength: 0)
          Marks(streak: entry.streak)
          Status(entry: entry)
        }
        PlayButton(solved: entry.solved)
      }
      .padding(pad)
    } else {
      VStack(alignment: .leading, spacing: 6) {
        Kicker(number: entry.number)
        Title(entry: entry)
        Spacer(minLength: 0)
        Marks(streak: entry.streak)
        Status(entry: entry)
      }
      .padding(pad)
    }
  }

  /// iOS 17 gives a widget its own margins; before it, the widget sets them.
  private var pad: CGFloat {
    if #available(iOS 17.0, *) { return 0 }
    return family == .systemMedium ? 16 : 14
  }
}

/// The paper ground, through the API each iOS version expects.
private struct PaperBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(Color.paper, for: .widget)
    } else {
      content.background(Color.paper)
    }
  }
}

@main
struct TesseraWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TesseraDaily", provider: Provider()) { entry in
      TesseraWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's Daily")
    .description("The day's puzzle, and your streak.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
