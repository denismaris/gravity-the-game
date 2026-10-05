/**
 * Gravity
 * Root application shell.
 *
 * @format
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  FillaPixScreen,
  LightsOutScreen,
  BinairoScreen,
  GameScreen,
  HomeScreen,
  MirrorMazeScreen,
  SettingsScreen,
  TentsScreen,
  TowersScreen,
} from './src/screens';
import { useReminderSync } from './src/notifications';
import { useCloudSync } from './src/backend';
import { EmblemHandoff } from './src/components/EmblemHandoff';
import { ErrorBoundary, IntroWalkthrough, LaunchSequence, ScreenTransition } from './src/components';
import { GameLesson } from './src/components/lessons';
import { tutorialIdForGame } from './src/game/tutorials';
import { getLevelById } from './src/game/levels';
import { getMirrorMazeById } from './src/game/mirror';
import { getTentsTreesById } from './src/game/tents';
import { getTowersById } from './src/game/towers';
import { getBinairoById } from './src/game/binairo';
import { getArukoneById } from './src/game/arukone';
import { getFillaPixById } from './src/game/fillapix';
import { getLightsOutById } from './src/game/lightsout';
import { getAdjacentById } from './src/game/adjacent';
import { getBloomById } from './src/game/bloom';
import { getMosaicById } from './src/game/mosaic';
import { getBridgesById } from './src/game/bridges';
import { GameKind, NextPuzzleOptions, getDailyEntry } from './src/game/journey';
import { CalmingInterstitialScreen } from './src/interstitial';
import { PlayerProgressProvider, getLevelPoint, isAdFree, notePuzzleOpened, usePlayerProgress } from './src/progression';
import { learnedTutorials } from './src/progression/learnedTutorials';
import { AD_RULES, betweenSets, startAds } from './src/ads';
import { AppearanceProvider, SettingsProvider, useAppearance, useHoldAppearance, useSettings } from './src/settings';
import { theme, themedStyles } from './src/theme';

interface Selected {
  kind: GameKind;
  puzzleId: string;
}

/** Settings and Achievements are reachable only from Home, and opening a
 * puzzle from either closes it - so one flag alongside `selected` is
 * enough; they can never be meaningfully "open" at the same time as a
 * puzzle. No `'browse'` route - the randomized level-batch system (see
 * `src/progression/batches.ts`) replaces the need for a manual
 * level-select/browse screen entirely; there is deliberately no way to
 * pick a specific puzzle by hand. */
type OverlayRoute = 'settings' | 'achievements' | 'journey' | 'shop' | 'ledger' | 'leaderboard' | 'account' | null;

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

  return (
    <>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <AppRoutes launched={launched} />
      {!launched && <LaunchSequence appReady={settingsReady && progressReady} onDone={finishLaunch} />}
    </>
  );
}

/**
 * Switches between the hub (`Home`) and whichever game the current level
 * batch's puzzle belongs to, and - between levels - the calming
 * interstitial (see `src/interstitial/`). There is no level select. A real
 * navigator can replace this state switch later.
 */
function AppRoutes({ launched }: { launched: boolean }): React.JSX.Element {
  const { settings, ready: settingsReady, markTutorialSeen } = useSettings();
  const { progress, ready: progressReady, markIntroSeen } = usePlayerProgress();
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
  // The clock for the Daily Duel starts the moment a puzzle opens.
  useEffect(() => {
    if (selected) notePuzzleOpened(selected.puzzleId);
  }, [selected]);
  const openFromHome = useCallback((target: Selected) => {
    setHandoff(target.kind);
    setSelected(target);
  }, []);
  const endHandoff = useCallback(() => setHandoff(null), []);

  // A brand-new player's first minute: the moment the welcome walkthrough
  // ends, their first puzzle (always an easy one) opens - straight into
  // play, a first win and a first reward, rather than a Home screen to
  // work out. Only on the transition, so a returning player is never
  // pulled into a puzzle on launch.
  const introSeenBefore = useRef<boolean | null>(null);
  useEffect(() => {
    if (!progressReady) return;
    const wasSeen = introSeenBefore.current;
    introSeenBefore.current = progress.introSeen;
    if (wasSeen === false && progress.introSeen && Object.keys(progress.levels).length === 0) {
      const { entry } = getLevelPoint(progress);
      openFromHome({ kind: entry.kind, puzzleId: entry.puzzleId });
    }
  }, [progressReady, progress, openFromHome]);

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

  const homeScreen = (
    <HomeScreen
      onOpen={openFromHome}
      onOpenSettings={() => setOverlayRoute('settings')}
      onOpenAchievements={() => setOverlayRoute('achievements')}
      onOpenJourney={() => setOverlayRoute('journey')}
      onOpenShop={() => openShop(null)}
      onOpenLedger={() => setOverlayRoute('ledger')}
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
    screen = <SettingsScreen onExit={() => setOverlayRoute(null)} onOpenAccount={() => setOverlayRoute('account')} />;
    routeKey = 'settings';
  } else if (!selected && overlayRoute === 'journey') {
    screen = <JourneyScreen onExit={() => setOverlayRoute(null)} onOpenShop={() => openShop('journey')} />;
    routeKey = 'journey';
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
    switch (selected.kind) {
      case 'mirror': {
        const puzzle = getMirrorMazeById(selected.puzzleId);
        screen = puzzle ? (
          <MirrorMazeScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `mirror:${puzzle.id}` : 'home';
        break;
      }
      case 'tents': {
        const puzzle = getTentsTreesById(selected.puzzleId);
        screen = puzzle ? (
          <TentsScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `tents:${puzzle.id}` : 'home';
        break;
      }
      case 'towers': {
        const puzzle = getTowersById(selected.puzzleId);
        screen = puzzle ? (
          <TowersScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `towers:${puzzle.id}` : 'home';
        break;
      }
      case 'binairo': {
        const puzzle = getBinairoById(selected.puzzleId);
        screen = puzzle ? (
          <BinairoScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `binairo:${puzzle.id}` : 'home';
        break;
      }
      case 'arukone': {
        const puzzle = getArukoneById(selected.puzzleId);
        screen = puzzle ? (
          <ArukoneScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `arukone:${puzzle.id}` : 'home';
        break;
      }
      case 'fillapix': {
        const puzzle = getFillaPixById(selected.puzzleId);
        screen = puzzle ? (
          <FillaPixScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `fillapix:${puzzle.id}` : 'home';
        break;
      }
      case 'lightsout': {
        const puzzle = getLightsOutById(selected.puzzleId);
        screen = puzzle ? (
          <LightsOutScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `lightsout:${puzzle.id}` : 'home';
        break;
      }
      case 'adjacent': {
        const puzzle = getAdjacentById(selected.puzzleId);
        screen = puzzle ? (
          <AdjacentScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `adjacent:${puzzle.id}` : 'home';
        break;
      }
      case 'bloom': {
        const puzzle = getBloomById(selected.puzzleId);
        screen = puzzle ? (
          <BloomScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `bloom:${puzzle.id}` : 'home';
        break;
      }
      case 'mosaic': {
        const puzzle = getMosaicById(selected.puzzleId);
        screen = puzzle ? (
          <MosaicScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `mosaic:${puzzle.id}` : 'home';
        break;
      }
      case 'bridges': {
        const puzzle = getBridgesById(selected.puzzleId);
        screen = puzzle ? (
          <BridgesScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `bridges:${puzzle.id}` : 'home';
        break;
      }
      case 'gravity': {
        const level = getLevelById(selected.puzzleId);
        screen = level ? (
          <GameScreen key={level.id} level={level} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = level ? `gravity:${level.id}` : 'home';
        break;
      }
    }
  }

  // A game the player has never learned opens on its lesson: a route of
  // its own, so once it is done the puzzle mounts fresh, entrance and all.
  // (Shown inside the puzzle's screen instead, the screen's entrance ran
  // while hidden and the puzzle came up blank.)
  const lessonKind = selected && settingsReady && routeKey !== 'home' && !settings.seenTutorials.includes(tutorialIdForGame(selected.kind)) ? selected.kind : null;
  if (lessonKind) {
    screen = <GameLesson kind={lessonKind} onDone={() => markTutorialSeen(tutorialIdForGame(lessonKind))} />;
    routeKey = `lesson:${lessonKind}`;
  }

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
        <React.Fragment key={scheme}>{screen}</React.Fragment>
      </ScreenTransition>
      {handoff && selected && <EmblemHandoff kind={handoff} onDone={endHandoff} />}
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
}));

export default App;
