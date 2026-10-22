/**
 * Gravity
 * Root application shell.
 *
 * @format
 */

import { GlassScreen } from './src/screens/GlassScreen';
import { LilyPadsScreen } from './src/screens/LilyPadsScreen';
import { VanesScreen } from './src/screens/VanesScreen';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AchievementsScreen,
  JourneyScreen,
  LedgerScreen,
  LeaderboardScreen,
  AccountScreen,
  ShopScreen,
  AdjacentScreen,
  BloomScreen,
  MosaicScreen,
  BridgesScreen,
  ArukoneScreen,
  LightsOutScreen,
  BinairoScreen,
  GameScreen,
  HomeScreen,
  holdHomeEntrance,
  releaseHomeEntrance,
  MirrorMazeScreen,
  SettingsScreen,
} from './src/screens';
import { useReminderSync } from './src/notifications';
import { useCloudSync } from './src/backend';
import { EmblemHandoff } from './src/components/EmblemHandoff';
import { ErrorBoundary, IntroWalkthrough, LaunchSequence, ScreenTransition } from './src/components';
import { PlayingPuzzle } from './src/components/DifficultyChip';
import { GameLesson } from './src/components/lessons';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { FirstPuzzleContext } from './src/components/HelpHalo';
import { tutorialIdForGame } from './src/game/tutorials';
import { getLevelById } from './src/game/levels';
import { getMirrorMazeById } from './src/game/mirror';
import { getLilyById } from './src/game/lilypads';
import { getVanesById } from './src/game/vanes';
import { getBinairoById } from './src/game/binairo';
import { getArukoneById } from './src/game/arukone';
import { getGlassWindow } from './src/game/glass';
import { endlessName, parseEndlessId } from './src/game/endlessId';
import { getLightsOutById } from './src/game/lightsout';
import { getAdjacentById } from './src/game/adjacent';
import { getBloomById } from './src/game/bloom';
import { getMosaicById } from './src/game/mosaic';
import { getBridgesById } from './src/game/bridges';
import { GameKind, NextPuzzleOptions, getDailyEntry, usePrepareUpcoming } from './src/game/journey';
import { CalmingInterstitialScreen } from './src/interstitial';
import { PlayerProgressProvider, PracticeProvider, gamesPlayed, isAdFree, notePuzzleOpened, practiceBoards, usePlayerProgress } from './src/progression';
import { learnedTutorials } from './src/progression/learnedTutorials';
import { AD_RULES, betweenSets, startAds } from './src/ads';
import { AppearanceProvider, SettingsProvider, useAppearance, useHoldAppearance, useSettings } from './src/settings';
import { motion, theme, themedStyles } from './src/theme';

/** How long after a set rolls over, mid-game, before its first board is
 * built: past the solve card's arrival and the level card's tally. */
const IN_GAME_PREPARE_MS = motion.beat.prepareInGame;

interface Selected {
  kind: GameKind;
  puzzleId: string;
  /** Opened from Settings to try the game: nothing is saved, Next deals
   * the game's next practice board, and Home returns to Settings. */
  practice?: boolean;
}

/** Settings and Achievements are reachable only from Home, and opening a
 * puzzle from either closes it - so one flag alongside `selected` is
 * enough; they can never be meaningfully "open" at the same time as a
 * puzzle. No `'browse'` route - the randomized level-batch system (see
 * `src/progression/batches.ts`) replaces the need for a manual
 * level-select/browse screen entirely; there is deliberately no way to
 * pick a specific puzzle by hand. */
type OverlayRoute = 'settings' | 'achievements' | 'journey' | 'shop' | 'ledger' | 'leaderboard' | 'account' | 'collection' | null;

/**
 * App wires up the global providers and renders `AppRoutes` inside them -
 * the actual screen-switching logic needs `useSettings()` (to decide
 * whether the calming interstitial is even on), which only works for a
 * component rendered *inside* `SettingsProvider`, not for `App` itself,
 * since `App` is what instantiates the provider.
 */
function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <AppearanceProvider>
            <PlayerProgressProvider>
              <Boot />
            </PlayerProgressProvider>
          </AppearanceProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/**
 * The cold start: the launch sequence over the app until it has both
 * played its beat and got a loaded app to hand off to.
 *
 * It lives *inside* both providers because it needs their `ready` flags,
 * and it renders over `AppRoutes` rather than instead of it, so the real
 * screen is already mounted and laid out by the time the cover lifts -
 * handing off to a blank frame would undo the whole point.
 *
 * This also covers a rough edge that was always there: both providers hand
 * out defaults until their async storage read resolves, so Home's first
 * frames show level 1's placeholder batch before snapping to the real save
 * (see `withBatch` in `PlayerProgressProvider`). The sequence is over that
 * window, so nobody sees it any more.
 */
function Boot(): React.JSX.Element {
  const { ready: settingsReady, settings, markTutorialSeen } = useSettings();
  const { ready: progressReady, progress } = usePlayerProgress();
  // A game the player has already played needs no "how to play" - also
  // after signing back in, on a new phone, or after a reinstall, when this
  // phone's own memory of the guides is empty but the account is not.
  useEffect(() => {
    if (!settingsReady || !progressReady) return;
    for (const id of learnedTutorials(progress)) if (!settings.seenTutorials.includes(id)) markTutorialSeen(id);
  }, [settingsReady, progressReady, progress, settings.seenTutorials, markTutorialSeen]);
  // The daily reminder's schedule follows the save and the setting.
  useReminderSync();
  const scheme = useAppearance();
  const [launched, setLaunched] = useState(false);
  const finishLaunch = useCallback(() => setLaunched(true), []);
  // Home's first arrival waits for the launch tile to start lifting away,
  // then places itself under it.
  const heldHome = useRef(false);
  if (!launched && !heldHome.current) {
    heldHome.current = true;
    holdHomeEntrance();
  }
  // Home is built only once the launch's name has landed, in the still
  // moment before the hand-off: built at once, its first commit froze the
  // pieces mid-flight. The hand-off then waits for Home's first frame.
  const [launchSettled, setLaunchSettled] = useState(false);
  const settleLaunch = useCallback(() => setLaunchSettled(true), []);
  const [homeDrawn, setHomeDrawn] = useState(false);
  const markHomeDrawn = useCallback(() => setHomeDrawn(true), []);
  useEffect(() => {
    // Never hold the launch on Home: if it is not the first screen, or is
    // slow to draw, go anyway.
    if (!launchSettled) return;
    const timer = setTimeout(markHomeDrawn, 1500);
    return () => clearTimeout(timer);
  }, [launchSettled, markHomeDrawn]);

  return (
    <>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <AppRoutes launched={launched} mountHome={launched || launchSettled} onHomeDrawn={markHomeDrawn} />
      {!launched && <LaunchSequence appReady={settingsReady && progressReady && homeDrawn} onSettled={settleLaunch} onHandoff={releaseHomeEntrance} onDone={finishLaunch} />}
    </>
  );
}

/**
 * Switches between the hub (`Home`) and whichever game the current level
 * batch's puzzle belongs to, and - between levels - the calming
 * interstitial (see `src/interstitial/`). There is no level select. A real
 * navigator can replace this state switch later.
 */
function AppRoutes({
  launched,
  mountHome,
  onHomeDrawn,
}: {
  launched: boolean;
  mountHome: boolean;
  onHomeDrawn: () => void;
}): React.JSX.Element {
  const { settings, ready: settingsReady, markTutorialSeen } = useSettings();
  const { progress, ready: progressReady, markIntroSeen, addInsights } = usePlayerProgress();
  // A lesson replayed from Your games.
  const [replaying, setReplaying] = useState<GameKind | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  // Ads start at launch only for a player who already sees them (see
  // src/ads/policy.ts) - a new player meets no consent form and no ad.
  useEffect(() => {
    if (progressReady && Object.keys(progressRef.current.levels).length >= AD_RULES.minSolvedBeforeAds) startAds();
  }, [progressReady]);
  // A between-sets ad in progress: a second tap on Next waits for it.
  const advancing = useRef(false);
  // The cloud save (does nothing until the backend is configured).
  useCloudSync();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [overlayRoute, setOverlayRoute] = useState<OverlayRoute>(null);
  // Where the shop returns to: Home, or the Almanac it was opened from.
  const [shopReturn, setShopReturn] = useState<OverlayRoute>(null);
  const openShop = useCallback((from: OverlayRoute) => {
    setShopReturn(from);
    setOverlayRoute('shop');
  }, []);
  // The puzzle to open once the calming interstitial finishes - non-null
  // is exactly "the interstitial is showing right now" (see `screen`/
  // `routeKey` below, and `finishInterstitial`).
  const [pendingNext, setPendingNext] = useState<Selected | null>(null);
  // A switch of light/dark remounts the screen (below), which would throw
  // away a puzzle in progress - so while one is open, it waits.
  const scheme = useAppearance();
  useHoldAppearance(selected !== null || pendingNext !== null);

  // The emblem hand-off, shown over a puzzle just opened from Home.
  const [handoff, setHandoff] = useState<GameKind | null>(null);
  // Whether the puzzle under the hand-off has drawn its first frame: the
  // hand-off's bar finishes, and its veil lifts, only then.
  const [boardDrawn, setBoardDrawn] = useState(false);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => setBoardDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  // The clock for the Daily Duel starts the moment a puzzle opens.
  useEffect(() => {
    if (selected) notePuzzleOpened(selected.puzzleId);
  }, [selected]);

  // The puzzles coming up, built ahead while nothing is moving (see
  // `usePrepareUpcoming`): on Home, or once a new set has been dealt -
  // which happens as a set's last puzzle is solved, with its card up.
  // Never during a puzzle.
  const batch = progress.currentBatch;
  const upcoming = useMemo(() => {
    const list = (batch?.puzzles ?? []).filter(p => !batch?.completedPuzzleIds.includes(p.puzzleId)).map(p => ({ kind: p.kind, puzzleId: p.puzzleId }));
    const daily = getDailyEntry();
    return [...list, { kind: daily.kind, puzzleId: daily.puzzleId }];
  }, [batch]);
  const setKey = (batch?.puzzles ?? []).map(p => p.puzzleId).join(',');
  const doneKey = (batch?.completedPuzzleIds ?? []).join(',');
  const setAtOpen = useRef(setKey);
  const doneAtOpen = useRef(doneKey);
  useEffect(() => {
    setAtOpen.current = setKey;
    doneAtOpen.current = doneKey;
    // Only when a puzzle opens or closes: the set it was opened under.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // Not until the opening animation is over: building a hard board under
  // it held the JavaScript thread and made the opening stutter. And in a
  // game whose solve just dealt a new set, only the one board Next opens,
  // once the finish cards have long arrived: building the whole set there
  // stalled the cards (half a second a board, on a phone) just as they
  // came in and as the player reached for Next.
  // After any solve (not only a set's last), the board Next opens, built
  // once the solve card has settled: an endless board can take half a
  // second to build on a phone, and built on the tap it made the next
  // puzzle open heavily.
  const inGameSolved = !!selected && (setKey !== setAtOpen.current || doneKey !== doneAtOpen.current);
  // Not during the launch: the launch draws on the UI thread, but its
  // hand-off and Home's first build need the JavaScript thread, and boards
  // built behind it held the finished tile on screen most of a second too
  // long. Home's own wait (`prepareOnHome`) starts once it is up.
  usePrepareUpcoming(
    inGameSolved ? upcoming.slice(0, 1) : upcoming,
    progressReady && launched && (!selected || inGameSolved),
    inGameSolved ? IN_GAME_PREPARE_MS : undefined,
  );
  const openFromHome = useCallback((target: Selected) => {
    // The veil first, the puzzle a couple of frames later, under it. Both
    // at once, the hand-off could not start until the whole game screen
    // had mounted - the tap seemed to freeze, then jump.
    setHandoff(target.kind);
    setBoardDrawn(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setSelected(target)));
  }, []);
  const endHandoff = useCallback(() => setHandoff(null), []);

  // tessera://daily - the home-screen widget's tap - opens today's Daily,
  // whether it launched the app or found it already running.
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (!url || !url.startsWith('tessera://daily')) return;
      const daily = getDailyEntry();
      setOverlayRoute(null);
      setPendingNext(null);
      openFromHome({ kind: daily.kind, puzzleId: daily.puzzleId });
    };
    Linking.getInitialURL().then(open).catch(() => {});
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => subscription.remove();
  }, [openFromHome]);

  const exit = useCallback(() => setSelected(null), []);
  // A practice run: one game's starter boards in turn, from Settings.
  const tryGame = useCallback((kind: GameKind) => {
    setOverlayRoute(null);
    setSelected({ kind, puzzleId: practiceBoards(kind)[0], practice: true });
  }, []);
  const nextPractice = useCallback(() => {
    setSelected(current => {
      if (!current) return current;
      const boards = practiceBoards(current.kind);
      const at = boards.indexOf(current.puzzleId);
      return { kind: current.kind, puzzleId: boards[(at + 1) % boards.length], practice: true };
    });
  }, []);
  const exitPractice = useCallback(() => {
    setSelected(null);
    setOverlayRoute('settings');
  }, []);
  // Shared by every game's completion screen as "next puzzle": advancing
  // always means going straight to the current level batch's next puzzle,
  // whatever game it belongs to, *unless* this solve just completed the
  // batch and the calming interstitial is enabled - then it opens the
  // interstitial first, stashing the real target in `pendingNext` for
  // `finishInterstitial` to open once the player skips or it finishes.
  // Also closes Settings, in case this came from there.
  const openPuzzle = useCallback(
    (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => {
      const go = () => {
        setOverlayRoute(null);
        if (options?.showInterstitial && settings.calmingInterstitialEnabled) {
          setPendingNext({ kind, puzzleId });
        } else {
          setSelected({ kind, puzzleId });
        }
      };
      // A set just finished: the one place an ad may play, if the rules
      // allow (src/ads/policy.ts) - then on to the next set as usual.
      if (!options?.showInterstitial) {
        go();
        return;
      }
      if (advancing.current) return;
      advancing.current = true;
      const now = progressRef.current;
      betweenSets({ solved: Object.keys(now.levels).length, adFree: isAdFree(now) })
        .catch(() => {})
        .finally(() => {
          advancing.current = false;
          go();
        });
    },
    [settings.calmingInterstitialEnabled],
  );

  const finishInterstitial = useCallback(() => {
    setSelected(pendingNext);
    setPendingNext(null);
  }, [pendingNext]);

  const homeScreen = !mountHome ? (
    <View style={styles.unbuilt} />
  ) : (
    <HomeScreen
      onDrawn={onHomeDrawn}
      onOpen={openFromHome}
      onOpenSettings={() => setOverlayRoute('settings')}
      onOpenAchievements={() => setOverlayRoute('achievements')}
      onOpenJourney={() => setOverlayRoute('journey')}
      onOpenShop={() => openShop(null)}
      onOpenLedger={() => setOverlayRoute('ledger')}
      onOpenCollection={() => setOverlayRoute('collection')}
      onOpenLeaderboard={() => setOverlayRoute('leaderboard')}
    />
  );
  const playDaily = () => {
    const daily = getDailyEntry();
    setOverlayRoute(null);
    openFromHome({ kind: daily.kind, puzzleId: daily.puzzleId });
  };

  let screen: React.JSX.Element;
  let routeKey: string;
  if (pendingNext) {
    screen = <CalmingInterstitialScreen onDone={finishInterstitial} />;
    routeKey = 'interstitial';
  } else if (!selected && overlayRoute === 'settings') {
    screen = <SettingsScreen onExit={() => setOverlayRoute(null)} onOpenAccount={() => setOverlayRoute('account')} onTryGame={tryGame} />;
    routeKey = 'settings';
  } else if (!selected && overlayRoute === 'journey') {
    screen = <JourneyScreen onExit={() => setOverlayRoute(null)} onOpenShop={() => openShop('journey')} />;
    routeKey = 'journey';
  } else if (!selected && overlayRoute === 'collection' && replaying) {
    // A lesson played again from Your games, back there when it is done.
    screen = <GameLesson kind={replaying} onDone={() => setReplaying(null)} />;
    routeKey = `replay:${replaying}`;
  } else if (!selected && overlayRoute === 'collection') {
    screen = <CollectionScreen onExit={() => setOverlayRoute(null)} onReplayLesson={setReplaying} />;
    routeKey = 'collection';
  } else if (!selected && overlayRoute === 'ledger') {
    screen = <LedgerScreen onExit={() => setOverlayRoute(null)} onOpenShop={() => openShop('ledger')} />;
    routeKey = 'ledger';
  } else if (!selected && overlayRoute === 'shop') {
    screen = <ShopScreen onExit={() => setOverlayRoute(shopReturn)} />;
    routeKey = 'shop';
  } else if (!selected && overlayRoute === 'account') {
    screen = <AccountScreen onExit={() => setOverlayRoute('settings')} />;
    routeKey = 'account';
  } else if (!selected && overlayRoute === 'leaderboard') {
    screen = <LeaderboardScreen onExit={() => setOverlayRoute(null)} onPlayDaily={playDaily} />;
    routeKey = 'leaderboard';
  } else if (!selected && overlayRoute === 'achievements') {
    screen = <AchievementsScreen onExit={() => setOverlayRoute(null)} />;
    routeKey = 'achievements';
  } else if (!selected) {
    screen = homeScreen;
    routeKey = 'home';
  } else {
    // Exhaustive over `GameKind` and deliberately has no `default`: forgetting
    // a case here is a compile error, not a silent bounce to Home the way an
    // unmatched if/else-if chain would be.
    const playExit = selected.practice ? exitPractice : exit;
    const playNext = selected.practice ? nextPractice : openPuzzle;
    switch (selected.kind) {
      case 'mirror': {
        const puzzle = getMirrorMazeById(selected.puzzleId);
        screen = puzzle ? (
          <MirrorMazeScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `mirror:${puzzle.id}` : 'home';
        break;
      }
      case 'lilypads': {
        const endless = parseEndlessId(selected.puzzleId);
        const puzzle = getLilyById(selected.puzzleId, endless?.kind === 'lilypads' ? { name: endlessName(endless.index, 'lilypads'), tier: endless.tier } : undefined);
        screen = puzzle ? <LilyPadsScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} /> : homeScreen;
        routeKey = puzzle ? `lilypads:${puzzle.id}` : 'home';
        break;
      }
      case 'vanes': {
        const endless = parseEndlessId(selected.puzzleId);
        const puzzle = getVanesById(selected.puzzleId, endless?.kind === 'vanes' ? { name: endlessName(endless.index, 'vanes'), tier: endless.tier } : undefined);
        screen = puzzle ? <VanesScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} /> : homeScreen;
        routeKey = puzzle ? `vanes:${puzzle.id}` : 'home';
        break;
      }
      case 'binairo': {
        const puzzle = getBinairoById(selected.puzzleId);
        screen = puzzle ? (
          <BinairoScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `binairo:${puzzle.id}` : 'home';
        break;
      }
      case 'arukone': {
        const puzzle = getArukoneById(selected.puzzleId);
        screen = puzzle ? (
          <ArukoneScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `arukone:${puzzle.id}` : 'home';
        break;
      }
      case 'glass': {
        const endless = parseEndlessId(selected.puzzleId);
        const puzzle = getGlassWindow(selected.puzzleId, endless?.kind === 'glass' ? { name: endlessName(endless.index, 'glass'), tier: endless.tier } : undefined);
        screen = puzzle ? (
          <GlassScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `glass:${puzzle.id}` : 'home';
        break;
      }
      case 'lightsout': {
        const puzzle = getLightsOutById(selected.puzzleId);
        screen = puzzle ? (
          <LightsOutScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `lightsout:${puzzle.id}` : 'home';
        break;
      }
      case 'adjacent': {
        const puzzle = getAdjacentById(selected.puzzleId);
        screen = puzzle ? (
          <AdjacentScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `adjacent:${puzzle.id}` : 'home';
        break;
      }
      case 'bloom': {
        const puzzle = getBloomById(selected.puzzleId);
        screen = puzzle ? (
          <BloomScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `bloom:${puzzle.id}` : 'home';
        break;
      }
      case 'mosaic': {
        const puzzle = getMosaicById(selected.puzzleId);
        screen = puzzle ? (
          <MosaicScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `mosaic:${puzzle.id}` : 'home';
        break;
      }
      case 'bridges': {
        const puzzle = getBridgesById(selected.puzzleId);
        screen = puzzle ? (
          <BridgesScreen key={puzzle.id} puzzle={puzzle} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `bridges:${puzzle.id}` : 'home';
        break;
      }
      case 'gravity': {
        const level = getLevelById(selected.puzzleId);
        screen = level ? (
          <GameScreen key={level.id} level={level} onExit={playExit} onNextPuzzle={playNext} />
        ) : (
          homeScreen
        );
        routeKey = level ? `gravity:${level.id}` : 'home';
        break;
      }
    }
    if (selected.practice && screen !== homeScreen) screen = <PracticeProvider>{screen}</PracticeProvider>;
    if (screen !== homeScreen) screen = <PlayingPuzzle.Provider value={selected.puzzleId}>{screen}</PlayingPuzzle.Provider>;
  }

  // A game the player has never learned opens on its lesson: a route of
  // its own, so once it is done the puzzle mounts fresh, entrance and all.
  // (Shown inside the puzzle's screen instead, the screen's entrance ran
  // while hidden and the puzzle came up blank.)
  const playedKinds = useMemo(() => gamesPlayed(progress), [progress]);
  const lessonKind = selected && settingsReady && routeKey !== 'home' && !settings.seenTutorials.includes(tutorialIdForGame(selected.kind)) ? selected.kind : null;
  if (lessonKind) {
    screen = (
      <GameLesson
        kind={lessonKind}
        onDone={() => {
          markTutorialSeen(tutorialIdForGame(lessonKind));
          // A finished lesson leaves a free Insight for the first board.
          addInsights(1);
        }}
      />
    );
    routeKey = `lesson:${lessonKind}`;
  }

  const firstPuzzle = selected !== null && !lessonKind && routeKey !== 'home' && !playedKinds.has(selected.kind);

  // Home is the root of this app, so "deeper" simply means "not Home".
  // Arriving at Home is therefore always a step back, and everything else
  // a step forward - which is exactly how the two read to a player, and
  // needs no navigation stack to work out.
  const direction = routeKey === 'home' ? 'back' : 'forward';

  // Keyed on the palette as well as the route: switching light/dark
  // remounts the screen (so nothing keeps a colour it read before) and
  // replays its entrance, which reads as a deliberate fade, not a snap.
  return (
    <View style={styles.root}>
      <ScreenTransition routeKey={`${routeKey}@${scheme}`} direction={direction}>
        {/* A game's first real puzzle: its "?" breathes (see \`HelpHalo\`). */}
        <FirstPuzzleContext.Provider value={firstPuzzle}>
          <React.Fragment key={scheme}>{screen}</React.Fragment>
        </FirstPuzzleContext.Provider>
      </ScreenTransition>
      {handoff && <EmblemHandoff kind={handoff} ready={boardDrawn && selected !== null} onDone={endHandoff} />}
      {/* The walkthrough, once, for a new player - after the launch mark,
          and only over Home: never over a game, the shop, or the sign-in
          screen (a sign-out or a reset makes the player new again while
          they are still on the account screen). */}
      {launched && progressReady && !progress.introSeen && routeKey === 'home' && <IntroWalkthrough key={scheme} onDone={markIntroSeen} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  /** Where Home will be, until the launch has set its name. */
  unbuilt: { flex: 1 },
}));

export default App;
