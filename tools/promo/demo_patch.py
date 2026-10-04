"""Temporary demo-mode patches for recording the promo. Applied to a copy
of the working tree's files and always restored by record.sh."""
import re, sys
root = '/Users/marisdenis/DEV/gravity-the-game/'
mode = sys.argv[1]        # 'auto' for game autoplay, 'home' for carousel, 'none'
interval = int(sys.argv[2]) if len(sys.argv) > 2 else 700

def patch(path, fn):
    p = root + path
    s = open(p).read()
    open(p, 'w').write(fn(s))

# Hints are free on camera: autoplay must not spend the simulator save's
# coins, and the Hint pill hides its price tag at 0.
patch('src/progression/coins.ts', lambda s: s.replace('export const HINT_COST = 15;', 'export const HINT_COST = 0;', 1))

# Autoplay reveals moves through Insight: on camera it never runs out.
patch('src/components/InsightPower.tsx', lambda s: s.replace('    (apply: () => void) => {\n      if (spendInsightCharge()) {', '    (apply: () => void) => {\n      if (Date.now() > 0) {\n        apply();\n        return;\n      }\n      if (spendInsightCharge()) {', 1))

# No ads and no consent form on camera.
patch('src/ads/index.ts', lambda s: s.replace('export function startAds(): Promise<boolean> {', 'export function startAds(): Promise<boolean> {\n  if (Date.now() > 0) return Promise.resolve(false);', 1))

# No hint captions on camera.
patch('src/components/HintNote.tsx', lambda s: s.replace(
    "export function HintNote({ reason, kind, accent, onGone }: { reason: string; kind: HintKind; accent: string; onGone: () => void }): React.JSX.Element {",
    "export function HintNote({ reason, kind, accent, onGone }: { reason: string; kind: HintKind; accent: string; onGone: () => void }): React.JSX.Element {\n  if (Date.now() > 0) return null as unknown as React.JSX.Element;", 1))

def autoplay(s):
    m = re.search(r"\n  const useHint = useCallback\(\(\) => \{", s)
    if not m: return s
    end = s.index("\n  }, [", m.end())
    end = s.index(";\n", end) + 2
    inject = f"  useEffect(() => {{ let t: ReturnType<typeof setInterval> | null = null; const s0 = setTimeout(() => {{ t = setInterval(() => useHint(), {interval}); }}, 1100); return () => {{ clearTimeout(s0); if (t) clearInterval(t); }}; }}, [useHint]);\n"
    return s[:end] + inject + s[end:]

def gravity(s):
    m = re.search(r"\n  const handleDirection = useCallback\(", s)
    end = s.index("\n  }, [", m.end())
    end = s.index(";\n", end) + 2
    inject = f"  useEffect(() => {{ let t: ReturnType<typeof setInterval> | null = null; const s0 = setTimeout(() => {{ t = setInterval(() => {{ if (isAnimatingRef.current || solvedRef.current) return; const p = findShortestSolution(gameStateRef.current, 16); if (p && p.length) handleDirection(p[0]); }}, {interval}); }}, 1100); return () => {{ clearTimeout(s0); if (t) clearInterval(t); }}; }}, [handleDirection]);\n"
    return s[:end] + inject + s[end:]

if mode == 'auto':
    for f in ['MirrorMazeScreen','MosaicScreen','BloomScreen','LightsOutScreen','TentsScreen','BinairoScreen','TowersScreen','ArukoneScreen','FillaPixScreen','AdjacentScreen','BridgesScreen']:
        patch(f'src/screens/{f}.tsx', autoplay)
    patch('src/screens/GameScreen.tsx', gravity)

if mode == 'home':
    # The Home carousel turns its own pages.
    def home(s):
        s = s.replace("          <ScrollView\n            style={{ height: cardHeight }}\n            horizontal", "          <ScrollView\n            ref={demoScroll}\n            style={{ height: cardHeight }}\n            horizontal", 1)
        anchor = "  const [page, setPage] = useState(0);"
        s = s.replace(anchor, anchor + f"\n  const demoScroll = useRef<ScrollView>(null);\n  useEffect(() => {{ let i = 0; const t = setInterval(() => {{ i = (i + 1) % PAGES.length; demoScroll.current?.scrollTo({{ x: i * width, animated: true }}); }}, {interval}); return () => clearInterval(t); }}, [width]);", 1)
        return s
    patch('src/screens/HomeScreen.tsx', home)
    patch('src/screens/HomeScreen.tsx', lambda s: s.replace("const gift = ready && progress.introSeen ? giftFor", "const gift = false && ready && progress.introSeen ? giftFor", 1))

# The solved card, as a first-time player would earn it.
patch('src/components/PuzzleSolved.tsx', lambda s: s.replace("(hintsUsed === 0 ? 'No hints used'", "(true ? 'No hints used'", 1))
patch('src/components/PuzzleSolved.tsx', lambda s: s.replace("<StarRow earned={stars}", "<StarRow earned={3}", 1).replace("const heading = title ?? (stars === 3 ? 'PERFECT' : 'SOLVED');", "const heading = 'PERFECT';", 1))
