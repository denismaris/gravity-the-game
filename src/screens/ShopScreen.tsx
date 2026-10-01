import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { GameEmblem } from '../components/GameEmblem';
import { GameKind, ROTATION, accentColorForKind, gameDisplayName, gameShortName } from '../game/journey';
import { ConfettiBurst, PressableScale } from '../components';
import { CoinBalance, CoinGlyph } from '../components/Coins';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { CoinPile } from '../components/CoinPile';
import { TesseraMark } from '../components/TesseraMark';
import { PageBloom } from '../components/PageBloom';
import { previewChime, triggerFeedback, useReducedMotion } from '../game/rendering';
import {
  COSMETICS,
  Cosmetic,
  CosmeticSlot,
  RARITY_NAMES,
  FEATURED_DISCOUNT,
  featuredItem,
  priceFor,
  Rarity,
  rarityOf,
  skinSlot,
  LUCKY_CHARM_CHARGES,
  LUCKY_CHARM_PRICE,
  GRAND_REWARDS,
  MAX_LUCKY_CHARGES,
  MAX_RETIRED,
  MAX_STREAK_FREEZES,
  STREAK_FREEZE_PRICE,
  retirePrice,
  chapterRewarding,
  chaptersFinished,
  COSMETIC_SETS,
  CosmeticSet,
  SEASON_NAMES,
  cosmeticById,
  inSeason,
  seasonDaysLeft,
  seasonOf,
  seasonalItems,
  setProgress,
  setsWith,
  unclaimedSets,
  cosmeticsFor,
  equipped,
  owns,
  usePlayerProgress,
  COIN_PACKS,
  PATRON_COINS,
  PATRON_PRICE,
  ProductId,
  STORE_SIMULATED,
  purchase,
  restorePurchases,
} from '../progression';
import { motion, theme, themedStyles } from '../theme';

export interface ShopScreenProps {
  onExit: () => void;
}

const ALMANAC_SECTIONS: ReadonlyArray<{ slot: CosmeticSlot; title: string; blurb: string }> = [
  { slot: 'chime', title: 'Solve chimes', blurb: 'Plays when any puzzle is solved. Tap a picture to listen.' },
  { slot: 'confetti', title: 'Solve confetti', blurb: 'The burst behind every solved puzzle, in every game.' },
  { slot: 'garden', title: 'Page art', blurb: 'The blossom in the corner of every page.' },
  { slot: 'ball', title: 'Break marbles', blurb: 'The marble you roll through the relaxation mazes.' },
];

/** Five rooms, each named for what is in it: the day's showcase, each
 * game's own looks, the looks shared by every game, the things that help
 * a streak or a purse, and coins themselves. */
type Tab = 'featured' | 'games' | 'style' | 'boosts' | 'coins';
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'games', label: 'Games' },
  { id: 'style', label: 'Style' },
  { id: 'boosts', label: 'Boosts' },
  { id: 'coins', label: 'Coins' },
];

/** A tab's content arriving: a short fade and lift, so switching tabs
 * reads as turning to another page rather than a jump cut. */
function TabPane({ children }: { children: React.ReactNode }): React.JSX.Element {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(enter, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, reduced]);
  return <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

/** Every section opens the same way: a small kicker, a serif title, and
 * anything that belongs beside it. */
function SectionHeader({ kicker, title, aside, blurb }: { kicker?: string; title: string; aside?: React.ReactNode; blurb?: string }): React.JSX.Element {
  return (
    <View style={styles.sh}>
      <View style={styles.shRow}>
        <View style={styles.shText}>
          {kicker && <Text style={styles.shKicker}>{kicker}</Text>}
          <Text style={styles.shTitle}>{title}</Text>
        </View>
        {aside}
      </View>
      {blurb && <Text style={styles.shBlurb}>{blurb}</Text>}
    </View>
  );
}

const PATRON_PERKS: ReadonlyArray<string> = [
  `${PATRON_COINS.toLocaleString('en-US')} coins, straight away`,
  'A gold Patron mark beside your coins on Home',
  'Gilt Patron confetti and the Patron Bells chime, never sold',
  "Half price on every season's pieces",
];

/** About how much play a pack is worth, against what a day earns. */
function playDays(coins: number): string {
  const days = coins / 350;
  if (days < 1.75) return 'ABOUT 1½ DAYS OF PLAY';
  return `ABOUT ${Math.round(days)} DAYS OF PLAY`;
}

const CONFIRM_PURCHASE_MS = 3500;

/**
 * Coins for real money, and the one-time Patron pass. Each buy button
 * asks once ("Confirm $1.99"), then buys. The store behind it is
 * simulated for now (see `store.ts`): what is bought really lands in the
 * save, but no money is charged.
 */
function CoinsTab({ onNotice, onPaid }: { onNotice: (title: string, text: string) => void; onPaid: (id: ProductId) => void }): React.JSX.Element {
  const { progress, completePurchase } = usePlayerProgress();
  const [confirming, setConfirming] = useState<ProductId | null>(null);
  const [buying, setBuying] = useState<ProductId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const press = (id: ProductId) => {
    if (buying || restoring || (id === 'patron' && progress.patron)) return;
    triggerFeedback('tap');
    if (confirming !== id) {
      setConfirming(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirming(null), CONFIRM_PURCHASE_MS);
      return;
    }
    setConfirming(null);
    setBuying(id);
    purchase(id)
      .then(paid => {
        if (!mounted.current) return;
        setBuying(null);
        if (paid && completePurchase(id)) {
          triggerFeedback('coin');
          onPaid(id);
        } else onNotice('Not bought', 'The purchase did not go through. Nothing was charged.');
      })
      .catch(() => {
        if (!mounted.current) return;
        setBuying(null);
        onNotice('Not bought', 'The store could not be reached. Nothing was charged.');
      });
  };
  const restore = () => {
    if (buying || restoring) return;
    triggerFeedback('tap');
    setRestoring(true);
    restorePurchases().then(found => {
      if (!mounted.current) return;
      setRestoring(false);
      found.forEach(id => completePurchase(id));
      onNotice('Purchases restored', found.length > 0 ? 'Your Patron pass is back.' : 'Everything you bought is already in this save.');
    });
  };
  const label = (id: ProductId, price: string) => (buying === id ? 'Purchasing…' : confirming === id ? `Confirm ${price}` : price);

  return (
    <View>
      {STORE_SIMULATED && (
        <View style={styles.previewNote}>
          <Text style={styles.previewNoteText}>TEST STORE · NO REAL MONEY IS CHARGED</Text>
        </View>
      )}

      <View style={styles.patron}>
        <Shimmer seed="patron" strength={0.95} />
        <View style={styles.patronTop}>
          <View style={styles.patronCrest}>
            <TesseraMark size={50} />
          </View>
          <View style={styles.freezeBody}>
            <Text style={styles.patronKicker}>{progress.patron ? 'PATRON · THANK YOU' : 'ONE TIME · YOURS FOR GOOD'}</Text>
            <Text style={styles.patronTitle}>Tessera Patron</Text>
            <Text style={styles.passText}>{progress.patron ? 'You keep the almanac going. Everything below is yours.' : 'For players who want to keep the almanac going.'}</Text>
          </View>
        </View>
        <View style={styles.perks}>
          {PATRON_PERKS.map(perk => (
            <View key={perk} style={styles.perk}>
              {progress.patron ? <Text style={styles.perkTick}>✓︎</Text> : <View style={styles.perkMark} />}
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>
        {progress.patron ? (
          <View style={styles.patronOwned}>
            <Text style={styles.actionWornText}>{'YOU ARE A PATRON ✓︎'}</Text>
          </View>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={confirming === 'patron' ? `Confirm becoming a Patron for ${PATRON_PRICE}` : `Become a Patron for ${PATRON_PRICE}`}
            accessibilityState={{ busy: buying === 'patron' }}
            onPress={() => press('patron')}
            style={({ pressed }) => [styles.patronButton, confirming === 'patron' && styles.patronButtonConfirm, pressed && styles.pressed]}
          >
            <Text style={styles.patronButtonText}>{buying === 'patron' ? 'Purchasing…' : confirming === 'patron' ? `Confirm ${PATRON_PRICE}` : `Become a Patron · ${PATRON_PRICE}`}</Text>
          </PressableScale>
        )}
      </View>

      <SectionHeader kicker="350 COINS ≈ A DAY OF PLAY" title="Coin packs" blurb="For a piece you would rather not wait for. Everything in the shop can also be earned by playing." />
      <View style={styles.grid}>
        {COIN_PACKS.map((pack, i) => (
          <View key={pack.id} style={[styles.item, pack.tag && styles.itemFeatured]}>
            <Shimmer seed={pack.id} strength={0.4 + i * 0.15} />
            {pack.tag && (
              <View style={styles.packTag}>
                <Text style={styles.packTagText}>{pack.tag}</Text>
              </View>
            )}
            <View style={styles.preview}>
              <CoinPile tier={i} size={88} />
            </View>
            <Text style={styles.packName}>{pack.name}</Text>
            <View style={styles.priceRow}>
              <CoinGlyph size={15} />
              <Text style={styles.packCoins}>{pack.coins.toLocaleString('en-US')}</Text>
            </View>
            {pack.bonus > 0 ? <Text style={styles.packBonus}>{`+${pack.bonus}% EXTRA`}</Text> : <Text style={styles.packPlain}>{' '}</Text>}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={confirming === pack.id ? `Confirm buying ${pack.coins} coins for ${pack.price}` : `Buy ${pack.name}, ${pack.coins} coins, for ${pack.price}`}
              accessibilityState={{ busy: buying === pack.id }}
              onPress={() => press(pack.id)}
              style={({ pressed }) => [styles.action, styles.packBuy, confirming === pack.id && styles.actionConfirm, pressed && styles.pressed]}
            >
              <Text style={styles.actionConfirmText}>{label(pack.id, pack.price)}</Text>
            </PressableScale>
            <Text style={styles.packDays}>{playDays(pack.coins)}</Text>
          </View>
        ))}
      </View>

      <PressableScale accessibilityRole="button" accessibilityLabel="Restore purchases" accessibilityState={{ busy: restoring }} onPress={restore} containerStyle={styles.restoreWrap} style={({ pressed }) => [styles.restore, pressed && styles.pressed]}>
        <Text style={styles.restoreText}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
      </PressableScale>
      <Text style={styles.finePrint}>Prices are shown in your local currency at checkout. Purchases come back on any device signed in to the same store account.</Text>
    </View>
  );
}

/** Where a piece shows once worn - for the featured card and the toast. */
function whereItShows(item: Cosmetic): string {
  if (item.slot.startsWith('skin-')) return `From your next ${gameShortName(item.slot.replace('skin-', '') as GameKind)} puzzle`;
  switch (item.slot) {
    case 'chart':
      return 'From your next Bridges puzzle';
    case 'confetti':
    case 'chime':
      return 'On your next solve';
    case 'ball':
      return 'In your next break';
    default:
      return 'On every page, now';
  }
}

function kindOfItem(item: Cosmetic): string {
  if (item.slot.startsWith('skin-')) return `A ${gameShortName(item.slot.replace('skin-', '') as GameKind)} set`;
  switch (item.slot) {
    case 'chart':
      return 'A Bridges chart';
    case 'ball':
      return 'A break marble';
    case 'garden':
      return 'Page art';
    case 'chime':
      return 'A solve chime';
    default:
      return 'Solve confetti';
  }
}

/** Each rarity's mark: the ribbon on a card, and its row in the legend. */
function rarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'common':
      return theme.colors.textTertiary;
    case 'fine':
      return theme.colors.bridgesAccent;
    case 'rare':
      return theme.colors.towersAccent;
    case 'masterwork':
      return theme.colors.gold;
  }
  return theme.colors.textTertiary;
}

/** Everything the shop sells or awards, for the collection count. */
const COLLECTIBLE = COSMETICS.filter(item => item.price > 0 || item.exclusive);

const CONFIRM_MS = 3000;

/** A six-armed ice crystal, for the streak freeze. */
function FrostMark({ size }: { size: number }): React.JSX.Element {
  const c = size / 2;
  const arm = size * 0.38;
  let d = '';
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = c + Math.cos(a) * arm;
    const y = c + Math.sin(a) * arm;
    d += `M ${c} ${c} L ${x.toFixed(1)} ${y.toFixed(1)} `;
    for (const side of [-1, 1]) {
      const bx = c + Math.cos(a) * arm * 0.6;
      const by = c + Math.sin(a) * arm * 0.6;
      const ba = a + side * 0.7;
      d += `M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + Math.cos(ba) * arm * 0.3).toFixed(1)} ${(by + Math.sin(ba) * arm * 0.3).toFixed(1)} `;
    }
  }
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        <Path path={d} color="#2E7FA0" style="stroke" strokeWidth={size * 0.06} strokeCap="round" />
      </Group>
    </Canvas>
  );
}

/** A four-leaf clover in gilt, for the lucky charm. */
function CloverMark({ size }: { size: number }): React.JSX.Element {
  const c = size / 2;
  const r = size * 0.17;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={`M ${c} ${c} Q ${c + size * 0.12} ${c + size * 0.3} ${c + size * 0.05} ${size * 0.95}`} color="#8C6A1C" style="stroke" strokeWidth={size * 0.05} strokeCap="round" />
      {[
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].map(([dx, dy]) => (
        <Group key={`${dx}${dy}`}>
          <Circle cx={c + dx * r * 1.05 + dy * r * 0.45} cy={c + dy * r * 1.05 - dx * r * 0.45} r={r} color="#C99A2E" />
          <Circle cx={c + dx * r * 1.05 - dy * r * 0.45} cy={c + dy * r * 1.05 + dx * r * 0.45} r={r} color="#C99A2E" />
        </Group>
      ))}
      <Circle cx={c} cy={c} r={r * 0.5} color="#F3D98A" />
    </Canvas>
  );
}

/** A seeded offset from an item's id, so each card catches the light at
 * its own moment rather than the whole shelf flashing at once. */
function phaseOf(id: string, span: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 100003;
  return hash % span;
}

/** A slow band of light across a card, like a print tilted under a lamp.
 * Every card has it, each on its own beat; a Masterwork's is the
 * brightest. Native-driven, so it costs nothing. */
function Shimmer({ seed, strength }: { seed: string; strength: number }): React.JSX.Element | null {
  const reduced = useReducedMotion();
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(3400),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const start = setTimeout(() => loop.start(), phaseOf(seed, 4900));
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [sweep, seed, reduced]);
  if (reduced) return null;
  return (
    <View style={styles.shimmerClip} pointerEvents="none">
      <Animated.View
        style={[
          styles.shimmer,
          { opacity: strength, transform: [{ rotate: '20deg' }, { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-160, 260] }) }] },
        ]}
      />
    </View>
  );
}

/**
 * Retire a game: the player's own veto over what their level sets deal.
 * Tap a game to pick it, then confirm the price; tap a retired one to
 * bring it back, free. Up to three - the almanac stays an almanac.
 */
function RetireCard({ onRetired }: { onRetired: () => void }): React.JSX.Element {
  const { progress, coins, retireGame, reinstateGame } = usePlayerProgress();
  const [picked, setPicked] = useState<GameKind | null>(null);
  const price = retirePrice(progress);
  const full = price === null;
  const affordable = price !== null && coins >= price;
  const pickedPop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pickedPop, { toValue: picked ? 1 : 0, useNativeDriver: true, ...motion.spring.pop }).start();
  }, [picked, pickedPop]);

  const tap = (kind: GameKind) => {
    triggerFeedback('tap');
    if (progress.retired.includes(kind)) {
      reinstateGame(kind);
      setPicked(null);
      return;
    }
    setPicked(current => (current === kind || full ? null : kind));
  };
  const confirm = () => {
    if (!picked) return;
    if (retireGame(picked)) {
      triggerFeedback('coin');
      setPicked(null);
      onRetired();
    } else triggerFeedback('tap');
  };

  return (
    <View style={styles.pass}>
      <Text style={styles.passTitle}>Retire a game</Text>
      <Text style={styles.passText}>
        A game you would rather not play leaves your level sets and errands. Up to {MAX_RETIRED}; bring any back for free. The Daily stays the same for everyone.
      </Text>
      <View style={styles.games}>
        {ROTATION.map(kind => {
          const retired = progress.retired.includes(kind);
          const selected = picked === kind;
          return (
            <PressableScale
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={retired ? `${gameShortName(kind)}, retired. Bring it back` : `Retire ${gameShortName(kind)}`}
              onPress={() => tap(kind)}
              containerStyle={styles.gameCell}
              style={({ pressed }) => [styles.game, selected && styles.gameSelected, pressed && styles.pressed]}
            >
              <View style={retired && styles.gameRetired}>
                <GameEmblem kind={kind} size={40} />
              </View>
              {retired && (
                <View style={styles.stamp}>
                  <Text style={styles.stampText}>RETIRED</Text>
                </View>
              )}
              <Text style={[styles.gameName, retired && styles.gameNameRetired]} numberOfLines={1}>
                {gameShortName(kind)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {!picked && (
        <View style={styles.retirePrompt} pointerEvents="none">
          <Text style={styles.retirePromptText}>{full ? 'Tap a retired game to bring it back' : "Tap a game you'd rather not see"}</Text>
        </View>
      )}
      <Animated.View style={[styles.retireBar, { opacity: pickedPop, transform: [{ scale: pickedPop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]} pointerEvents={picked ? 'auto' : 'none'}>
        <Text style={styles.retireBarText} numberOfLines={1}>
          {picked ? `Retire ${gameShortName(picked)}?` : ' '}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={picked && price !== null ? `Confirm retiring ${gameShortName(picked)} for ${price} coins` : 'Confirm'}
          onPress={confirm}
          style={({ pressed }) => [styles.action, affordable ? styles.actionConfirm : styles.actionShort, pressed && styles.pressed]}
        >
          <View style={styles.priceRow}>
            <CoinGlyph size={13} />
            <Text style={affordable ? styles.actionConfirmText : styles.actionShortText}>{price ?? '-'}</Text>
          </View>
        </PressableScale>
      </Animated.View>
      <Text style={styles.passFoot}>{full ? `${MAX_RETIRED} OF ${MAX_RETIRED} RETIRED · BRING ONE BACK TO SWAP` : `${progress.retired.length} OF ${MAX_RETIRED} RETIRED · NEXT COSTS ${price}`}</Text>
    </View>
  );
}

/** One item: its preview on a sand plate, its name, and what you can do
 * with it - wear it, buy it (tap once to see the price confirm, again to
 * buy), or see it is already worn. */
function ItemCard({ item, onBought, featured = false, wide = false, style }: { item: Cosmetic; onBought: (item: Cosmetic) => void; featured?: boolean; wide?: boolean; style?: object }): React.JSX.Element {
  const { progress, coins, buyCosmetic, equipCosmetic, setShopGoal } = usePlayerProgress();
  const price = priceFor(item, new Date(), progress);
  const pinned = progress.shopGoal === item.id;
  const worn = equipped(progress, item.slot).id === item.id;
  const own = owns(progress, item.id);
  const rarity = rarityOf(item);
  const affordable = coins >= price;
  const [confirming, setConfirming] = useState(false);
  const [short, setShort] = useState(false);
  const pop = useRef(new Animated.Value(1)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const chapter = own ? null : chapterRewarding(item.id);
  // A Grand exclusive is never for sale: it says which Grand wins it.
  const grandAt = item.exclusive ? GRAND_REWARDS.find(r => r.cosmetic === item.id)?.at ?? null : null;
  // Out of season: shown only once owned, or in a set it belongs to.
  const outOfSeason = item.season !== undefined && !inSeason(item);
  const locked = (item.exclusive === true || outOfSeason) && !own;
  const set = setsWith(item.id)[0];
  const chapterDone = chapter !== null && chapter <= chaptersFinished(progress);

  const lockedNote = item.patron
    ? 'COMES WITH PATRON'
    : item.streak !== undefined
      ? `WIN: ${item.streak}-DAY STREAK · ${Math.min(progress.bestDailyStreak, item.streak)}/${item.streak}`
      : grandAt !== null
        ? grandAt === 1
          ? 'WIN: SOLVE A GRAND'
          : `WIN: ${grandAt} GRANDS SOLVED`
        : item.season
          ? `BACK IN ${SEASON_NAMES[item.season].toUpperCase()}`
          : 'NOT SOLD';

  const lockedSpoken = item.patron
    ? 'comes with the Patron pass'
    : item.streak !== undefined
      ? `earned with a ${item.streak}-day Daily streak, not sold`
      : grandAt !== null
        ? 'won in the Weekly Grand, not sold'
        : item.season
          ? `sold again in ${SEASON_NAMES[item.season]}`
          : 'not sold';

  const celebrate = () => {
    pop.setValue(0.9);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
  };
  const press = () => {
    if (worn || locked) return;
    if (own) {
      equipCosmetic(item.id);
      triggerFeedback('tap');
      celebrate();
      return;
    }
    if (!affordable) {
      setShort(true);
      triggerFeedback('tap');
      Animated.sequence([-1, 1, -0.6, 0.6, 0].map(v => Animated.timing(nudge, { toValue: v, duration: 50, useNativeDriver: true }))).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShort(false), 2000);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      triggerFeedback('tap');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS);
      return;
    }
    if (buyCosmetic(item.id)) {
      setConfirming(false);
      triggerFeedback('coin');
      celebrate();
      onBought(item);
    }
  };
  // Long-press a piece you cannot afford yet to save up for it: Home's
  // purse then shows how close you are. Long-press again to let it go.
  const listen = () => {
    if (item.slot !== 'chime') return;
    previewChime(item.sound ?? 'sfx_solve.wav');
  };
  const pin = () => {
    if (own || locked) return;
    triggerFeedback('uiPage');
    setShopGoal(pinned ? null : item.id);
  };

  const preview = (size: number) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${item.slot === 'chime' ? `Listen to ${item.name}. ` : ''}${pinned ? `${item.name}, your savings goal. Long-press to unpin` : `${item.name}. Long-press to save up for it`}`}
      onPress={listen}
      onLongPress={pin}
      delayLongPress={380}
      feedback={false}
      scaleTo={0.97}
    >
      <View style={[styles.preview, wide && styles.previewWide]}>
        <CosmeticPreview item={item} size={size} />
      </View>
    </PressableScale>
  );
  const ribbon = rarity ? (
    <View style={[styles.ribbon, wide && styles.ribbonInline, { borderColor: rarityColor(rarity) }]}>
      <Text style={[styles.ribbonText, { color: rarityColor(rarity) }]}>{RARITY_NAMES[rarity].toUpperCase()}</Text>
    </View>
  ) : null;
  const action = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={worn ? `${item.name}, worn` : own ? `Wear ${item.name}` : locked ? `${item.name}, ${lockedSpoken}` : confirming ? `Confirm buying ${item.name} for ${price} coins` : `Buy ${item.name} for ${price} coins`}
      onPress={press}
      containerStyle={wide && styles.actionWideWrap}
      style={({ pressed }) => [styles.action, wide && styles.actionWide, worn ? styles.actionWorn : own ? styles.actionWear : locked ? styles.actionLocked : confirming ? styles.actionConfirm : affordable ? styles.actionBuy : styles.actionShort, pressed && styles.pressed]}
    >
      {worn ? (
        <Text style={styles.actionWornText}>{'WORN ✓︎'}</Text>
      ) : own ? (
        <Text style={styles.actionConfirmText}>Wear</Text>
      ) : locked ? (
        <Text style={styles.actionLockedText}>{outOfSeason && !item.exclusive ? 'OUT OF SEASON' : 'NOT SOLD'}</Text>
      ) : confirming ? (
        <Text style={styles.actionConfirmText}>{`Buy for ${price}?`}</Text>
      ) : (
        <View style={styles.priceRow}>
          <CoinGlyph size={wide ? 15 : 13} />
          {price < item.price && <Text style={styles.wasPrice}>{item.price}</Text>}
          <Text style={[styles.actionText, wide && styles.actionTextWide, !affordable && styles.actionShortText]}>{price}</Text>
        </View>
      )}
    </PressableScale>
  );
  const hint = locked ? (
    <Text style={[styles.hint, styles.hintReady]}>{lockedNote}</Text>
  ) : short ? (
    <Text style={styles.hint}>{`${price - coins} MORE · HOLD THE PICTURE TO SAVE UP`}</Text>
  ) : chapter ? (
    <Text style={[styles.hint, chapterDone && styles.hintReady]}>{chapterDone ? `FREE IN YOUR ALMANAC` : `OR FINISH CHAPTER ${chapter}`}</Text>
  ) : item.season && !own ? (
    <Text style={[styles.hint, styles.hintSeason]} accessibilityLabel={`${SEASON_NAMES[item.season]} only, ${seasonDaysLeft()} days left`}>{`ONLY ${seasonDaysLeft()} DAYS LEFT`}</Text>
  ) : set ? (
    <Text style={styles.hint} numberOfLines={1}>{`PART OF ${set.name.toUpperCase()}`}</Text>
  ) : wide ? null : (
    <View style={styles.hintSpacer} />
  );
  const shine = <Shimmer seed={item.id} strength={rarity === 'masterwork' ? 0.95 : rarity === 'rare' ? 0.75 : 0.55} />;
  const goal = pinned && (
    <View style={styles.pinned}>
      <Text style={styles.pinnedText}>GOAL</Text>
    </View>
  );
  const motionStyle = { transform: [{ scale: pop }, { translateX: nudge.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] };

  // The wide layout: today's piece, given the room to be looked at.
  if (wide) {
    return (
      <Animated.View style={[styles.wide, style, motionStyle]}>
        {preview(104)}
        <View style={styles.wideBody}>
          <View style={styles.wideTop}>
            {ribbon}
            <Text style={styles.wideKind} numberOfLines={1}>
              {kindOfItem(item).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.wideName}>{item.name}</Text>
          <Text style={styles.wideBlurb} numberOfLines={2}>
            {item.blurb}
          </Text>
          {action}
          {hint}
        </View>
        {goal}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.item, style, item.exclusive && styles.itemExclusive, featured && styles.itemFeatured, worn && styles.itemWorn, motionStyle]}>
      {preview(78)}
      {shine}
      {goal}
      {ribbon}
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemBlurb} numberOfLines={2}>
        {item.blurb}
      </Text>
      {action}
      {hint}
    </Animated.View>
  );
}

/** A set: its pieces in a row (worn ones ticked), how far along it is,
 * and the bonus for finishing it - claimable here the moment it is. */
function SetCard({ set, onClaimed }: { set: CosmeticSet; onClaimed: () => void }): React.JSX.Element {
  const { progress, claimSet } = usePlayerProgress();
  const p = setProgress(progress, set);
  const ready = p.complete && !p.claimed;
  const claim = () => {
    if (claimSet(set.id)) {
      triggerFeedback('coin');
      onClaimed();
    } else triggerFeedback('tap');
  };
  return (
    <View style={[styles.pass, ready && styles.setReady]}>
      <View style={styles.setHead}>
        <Text style={styles.passTitle}>{set.name}</Text>
        <Text style={styles.setCount}>{`${p.owned} / ${p.total}`}</Text>
      </View>
      <Text style={styles.passText}>{set.blurb}</Text>
      <View style={styles.setPieces}>
        {set.items.map(id => {
          const item = cosmeticById(id);
          if (!item) return null;
          const have = owns(progress, id);
          return (
            <View key={id} style={styles.setPiece} accessible accessibilityLabel={`${item.name}, ${have ? 'owned' : 'not owned yet'}`}>
              <View style={[styles.setPlate, !have && styles.setPlateMissing]}>
                <CosmeticPreview item={item} size={40} />
              </View>
              {have && (
                <View style={styles.setTick}>
                  <Text style={styles.setTickText}>✓︎</Text>
                </View>
              )}
              <Text style={[styles.setPieceName, !have && styles.setPieceNameMissing]} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.heroTrack}>
        <View style={[styles.heroFill, { width: `${(p.owned / p.total) * 100}%` }]} />
      </View>
      <View style={styles.freezeFoot}>
        <Text style={[styles.charmCount, !ready && !p.claimed && styles.setFootQuiet]}>
          {p.claimed ? 'COMPLETE · BONUS PAID' : ready ? 'COMPLETE · YOUR BONUS IS READY' : `${p.total - p.owned} TO GO FOR THE BONUS`}
        </Text>
        {ready ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={`Claim ${set.reward} coins for completing ${set.name}`} onPress={claim} style={({ pressed }) => [styles.action, styles.actionConfirm, pressed && styles.pressed]}>
            <View style={styles.priceRow}>
              <CoinGlyph size={13} />
              <Text style={styles.actionConfirmText}>{`Claim ${set.reward}`}</Text>
            </View>
          </PressableScale>
        ) : (
          <View style={[styles.setReward, p.claimed && styles.setRewardPaid]}>
            <CoinGlyph size={12} />
            <Text style={styles.setRewardText}>{`+${set.reward}`}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * The shop: what coins are for. Cosmetics that change how the almanac
 * and every game look and celebrate - never anything that makes a puzzle
 * easier - and a few passes. Three tabs: each game's own sets, the
 * almanac's shared looks, and the passes.
 */
export function ShopScreen({ onExit }: ShopScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress, coins, buyStreakFreeze, buyLuckyCharm } = usePlayerProgress();
  const [burst, setBurst] = useState(0);
  const [tab, setTab] = useState<Tab>('featured');
  const [game, setGame] = useState<GameKind>('gravity');
  const [ownedOnly, setOwnedOnly] = useState(false);
  // Just bought: a note saying where it shows, for a moment.
  const [bought, setBought] = useState<Cosmetic | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const featured = featuredItem();
  const season = seasonOf();
  const seasonal = seasonalItems();
  const setsReady = unclaimedSets(progress).length;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const untilMidnight = (() => {
    const now = new Date(clock);
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const mins = Math.max(0, Math.floor((next - clock) / 60000));
    return `${Math.floor(mins / 60)}H ${String(mins % 60).padStart(2, '0')}M`;
  })();
  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mount, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [mount]);
  const rise = (from: number) => ({
    opacity: mount.interpolate({ inputRange: [from, Math.min(1, from + 0.4)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: mount.interpolate({ inputRange: [from, Math.min(1, from + 0.4)], outputRange: [12, 0], extrapolate: 'clamp' }) }],
  });
  const celebrate = () => setBurst(b => b + 1);
  // A plain message in the toast, for the store preview.
  const [notice, setNotice] = useState<{ title: string; text: string } | null>(null);
  const showNotice = (title: string, text: string) => {
    setBought(null);
    setNotice({ title, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(null), 2600);
  };
  const onBought = (item: Cosmetic) => {
    celebrate();
    setBought(item);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setBought(null), 2600);
  };
  const shown = (items: ReadonlyArray<Cosmetic>) => (ownedOnly ? items.filter(item => owns(progress, item.id)) : items);

  const owned = COLLECTIBLE.filter(item => owns(progress, item.id)).length;
  const ownedIn = (slot: CosmeticSlot) => cosmeticsFor(slot).filter(item => item.price > 0 && owns(progress, item.id)).length;
  // What a shelf shows: everything except another season's pieces not yet owned.
  // In shelf order: the free default, then what is for sale from the
  // cheapest up, then what can only be won.
  const shelfRank = (item: Cosmetic) => (item.exclusive ? 1e6 : item.price);
  const onShelf = (slot: CosmeticSlot) =>
    cosmeticsFor(slot)
      .filter(item => inSeason(item) || owns(progress, item.id))
      .sort((a, b) => shelfRank(a) - shelfRank(b));
  const forSaleIn = (slot: CosmeticSlot) => onShelf(slot).filter(item => item.price > 0).length;

  const freezesFull = progress.streakFreezes >= MAX_STREAK_FREEZES;
  const buyFreeze = () => {
    if (buyStreakFreeze()) {
      triggerFeedback('coin');
      celebrate();
    } else triggerFeedback('tap');
  };

  const gameItems = shown(onShelf(skinSlot(game)));

  // Sets with a bonus waiting come first, then the closest to done.
  const sets = [...COSMETIC_SETS].sort((a, b) => {
    const pa = setProgress(progress, a);
    const pb = setProgress(progress, b);
    const rank = (p: typeof pa) => (p.complete && !p.claimed ? 2 : p.claimed ? -1 : p.owned / p.total);
    return rank(pb) - rank(pa);
  });
  const scroller = useRef<React.ElementRef<typeof ScrollView>>(null);
  const openTab = (next: Tab) => {
    if (next === tab) return;
    triggerFeedback('uiPage');
    setTab(next);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };
  const ownedToggle = (
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: ownedOnly }}
      accessibilityLabel="Show only what you own"
      onPress={() => {
        triggerFeedback('uiPage');
        setOwnedOnly(v => !v);
      }}
      style={[styles.filter, ownedOnly && styles.filterOn]}
    >
      <Text style={[styles.filterText, ownedOnly && styles.filterTextOn]}>{ownedOnly ? 'OWNED ✓︎' : 'OWNED'}</Text>
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Back</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>The Shop</Text>
        </View>
        <View style={[styles.headerSide, styles.headerRight]}>
          {/* The purse doubles as the way to more coins. */}
          <PressableScale accessibilityRole="button" accessibilityLabel={`${coins} coins. Get more coins`} onPress={() => openTab('coins')} hitSlop={6}>
            <View style={styles.purse}>
              <CoinBalance coins={coins} />
              <View style={styles.pursePlus}>
                <Text style={styles.pursePlusText}>+</Text>
              </View>
            </View>
          </PressableScale>
        </View>
      </View>

      <ScrollView ref={scroller} stickyHeaderIndices={[0]} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        {/* The tabs stay pinned under the header, so any room of the shop
            is one tap away however far down a shelf you are. */}
        <Animated.View style={[styles.tabsBar, rise(0)]}>
          <View style={styles.tabs}>
            {TABS.map(t => {
              const on = t.id === tab;
              return (
                <PressableScale
                  key={t.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.id === 'featured' && setsReady > 0 ? `${t.label}, a set bonus is ready` : t.label}
                  onPress={() => openTab(t.id)}
                  feedback={false}
                  containerStyle={styles.tabWrap}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                    {t.label}
                  </Text>
                  {t.id === 'featured' && setsReady > 0 && <View style={styles.tabDot} />}
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        <TabPane key={tab}>
          {tab === 'featured' && (
            <View>
              {/* Today's piece: one a day, a fifth off, the same for everyone. */}
              <View style={styles.featured}>
                <Shimmer seed="featured" strength={0.6} />
                <View style={styles.featuredHead}>
                  <Text style={styles.featuredKicker}>{`TODAY'S PIECE · ${Math.round(FEATURED_DISCOUNT * 100)}% OFF`}</Text>
                  <Text style={styles.featuredClock}>{`ENDS IN ${untilMidnight}`}</Text>
                </View>
                <ItemCard item={featured} onBought={onBought} wide />
              </View>

              <SectionHeader
                kicker={`LEAVES IN ${seasonDaysLeft()} DAYS`}
                title={`${SEASON_NAMES[season]} Collection`}
                blurb="Sold only this season, then gone until next year. Yours for good once bought."
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScroll} contentContainerStyle={styles.seasonRow}>
                {seasonal.map(item => (
                  <ItemCard key={item.id} item={item} onBought={onBought} style={styles.seasonItem} />
                ))}
              </ScrollView>

              <SectionHeader kicker="COLLECT THEM ALL" title="Sets" blurb="Pieces that belong together. Own every piece of a set and it pays you back." />
              {sets.map(set => (
                <SetCard key={set.id} set={set} onClaimed={celebrate} />
              ))}

              {/* How much of the shop is yours - and the one promise it keeps. */}
              <View style={styles.ledgerFoot}>
                <View style={styles.ledgerRow}>
                  <Text style={styles.ledgerKicker}>YOUR COLLECTION</Text>
                  <Text style={styles.ledgerCount}>
                    {owned}
                    <Text style={styles.ledgerOf}>{` / ${COLLECTIBLE.length}`}</Text>
                  </Text>
                </View>
                <View style={styles.heroTrack}>
                  <View style={[styles.heroFill, { width: `${(owned / Math.max(1, COLLECTIBLE.length)) * 100}%` }]} />
                </View>
                <Text style={styles.ledgerNote}>Only looks, never help. Every price is set against what a day of play earns.</Text>
              </View>
            </View>
          )}

          {tab === 'games' && (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker} style={styles.pickerScroll}>
                {ROTATION.map(kind => {
                  const on = kind === game;
                  const slot = skinSlot(kind);
                  return (
                    <PressableScale
                      key={kind}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${gameShortName(kind)} looks`}
                      onPress={() => {
                        triggerFeedback('tap');
                        setGame(kind);
                      }}
                      style={[styles.pick, on && { borderColor: accentColorForKind(kind), backgroundColor: theme.colors.surfaceHi }]}
                    >
                      <GameEmblem kind={kind} size={34} />
                      <Text style={[styles.pickName, on && styles.pickNameOn]} numberOfLines={1}>
                        {gameShortName(kind)}
                      </Text>
                      <Text style={styles.pickCount}>{`${ownedIn(slot)}/${forSaleIn(slot)}`}</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
              <SectionHeader
                kicker={`${ownedIn(skinSlot(game))} OF ${forSaleIn(skinSlot(game))} OWNED`}
                title={gameDisplayName(game)}
                aside={ownedToggle}
                blurb={game === 'bridges' ? 'The sea your islands sit in.' : 'Worn on every board of this game, from the next one you open.'}
              />
              <View style={styles.grid}>
                {gameItems.map(item => (
                  <ItemCard key={item.id} item={item} onBought={onBought} />
                ))}
              </View>
            </View>
          )}

          {tab === 'style' && (
            <View>
              <View style={styles.styleLede}>
                <Text style={styles.styleLedeText}>Looks and sounds shared by every game.</Text>
                {ownedToggle}
              </View>
              {ALMANAC_SECTIONS.map(section => (
                <View key={section.slot} style={styles.section}>
                  <SectionHeader kicker={`${ownedIn(section.slot)} OF ${forSaleIn(section.slot)} OWNED`} title={section.title} blurb={section.blurb} />
                  <View style={styles.grid}>
                    {shown(onShelf(section.slot)).map(item => (
                      <ItemCard key={item.id} item={item} onBought={onBought} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {tab === 'coins' && (
            <CoinsTab
              onNotice={showNotice}
              onPaid={id => {
                celebrate();
                const pack = COIN_PACKS.find(p => p.id === id);
                if (pack) showNotice(`+${pack.coins.toLocaleString('en-US')} coins`, `The ${pack.name} is in your purse.`);
                else showNotice('Welcome, Patron', `${PATRON_COINS.toLocaleString('en-US')} coins, the Patron pieces, and half price on the season.`);
              }}
            />
          )}

          {tab === 'boosts' && (
            <View>
              <SectionHeader kicker="NEVER SOLVES A PUZZLE FOR YOU" title="Boosts" blurb="Keep a streak alive, earn faster, or choose what your level sets deal." />
              <View style={styles.freeze}>
                <View style={styles.freezePlate}>
                  <FrostMark size={46} />
                </View>
                <View style={styles.freezeBody}>
                  <Text style={styles.freezeTitle}>Streak freeze</Text>
                  <Text style={styles.freezeText}>Covers one missed Daily, so a run survives a busy day. Hold up to {MAX_STREAK_FREEZES}.</Text>
                  <View style={styles.freezeFoot}>
                    <View style={styles.freezeSlots}>
                      {Array.from({ length: MAX_STREAK_FREEZES }, (_v, i) => (
                        <View key={i} style={[styles.freezeSlot, i < progress.streakFreezes && styles.freezeSlotFull]} />
                      ))}
                    </View>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={freezesFull ? 'Streak freezes full' : `Buy a streak freeze for ${STREAK_FREEZE_PRICE} coins`}
                      onPress={buyFreeze}
                      style={({ pressed }) => [styles.action, freezesFull ? styles.actionWorn : coins >= STREAK_FREEZE_PRICE ? styles.actionBuy : styles.actionShort, pressed && styles.pressed]}
                    >
                      {freezesFull ? (
                        <Text style={styles.actionWornText}>FULL</Text>
                      ) : (
                        <View style={styles.priceRow}>
                          <CoinGlyph size={13} />
                          <Text style={styles.actionText}>{STREAK_FREEZE_PRICE}</Text>
                        </View>
                      )}
                    </PressableScale>
                  </View>
                </View>
              </View>

              <View style={styles.pass}>
                <View style={styles.charmRow}>
                  <View style={styles.charmPlate}>
                    <CloverMark size={50} />
                  </View>
                  <View style={styles.freezeBody}>
                    <Text style={styles.passTitle}>Lucky charm</Text>
                    <Text style={styles.passText}>Your next {LUCKY_CHARM_CHARGES} solves that pay coins pay double. Stacks up to {MAX_LUCKY_CHARGES}.</Text>
                  </View>
                </View>
                <View style={styles.freezeFoot}>
                  <Text style={styles.charmCount}>{progress.luckyCharges > 0 ? `\u00D72 ACTIVE · ${progress.luckyCharges} SOLVE${progress.luckyCharges === 1 ? '' : 'S'} LEFT` : 'NOT ACTIVE'}</Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Buy a lucky charm for ${LUCKY_CHARM_PRICE} coins`}
                    onPress={() => {
                      if (buyLuckyCharm()) {
                        triggerFeedback('coin');
                        celebrate();
                      } else triggerFeedback('tap');
                    }}
                    style={({ pressed }) => [styles.action, coins >= LUCKY_CHARM_PRICE && progress.luckyCharges + LUCKY_CHARM_CHARGES <= MAX_LUCKY_CHARGES ? styles.actionBuy : styles.actionShort, pressed && styles.pressed]}
                  >
                    <View style={styles.priceRow}>
                      <CoinGlyph size={13} />
                      <Text style={styles.actionText}>{LUCKY_CHARM_PRICE}</Text>
                    </View>
                  </PressableScale>
                </View>
              </View>
              <RetireCard onRetired={celebrate} />
            </View>
          )}
        </TabPane>
      </ScrollView>
      {bought && (
        <View style={[styles.toast, { bottom: insets.bottom + theme.spacing.lg }]} pointerEvents="none">
          <Text style={styles.toastTitle}>{`${bought.name} · worn`}</Text>
          <Text style={styles.toastText}>{whereItShows(bought)}</Text>
        </View>
      )}
      {notice && !bought && (
        <View style={[styles.toast, { bottom: insets.bottom + theme.spacing.lg }]} pointerEvents="none">
          <Text style={styles.toastTitle}>{notice.title}</Text>
          <Text style={styles.toastText}>{notice.text}</Text>
        </View>
      )}
      {burst > 0 && <ConfettiBurst key={burst} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  purse: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 4, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.goldRim, backgroundColor: theme.colors.surfaceHi },
  pursePlus: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.goldFill, alignItems: 'center', justifyContent: 'center' },
  pursePlusText: { color: theme.colors.onGold, fontSize: 14, lineHeight: 16, fontWeight: theme.typography.weights.bold },
  tabsBar: { marginHorizontal: -theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.background },
  sh: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
  shRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.sm },
  shText: { flex: 1 },
  shKicker: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 1.3, color: theme.colors.secondary, marginBottom: 2 },
  shTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  shBlurb: { marginTop: 4, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textSecondary },
  styleLede: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  styleLedeText: { flex: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  wide: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  previewWide: { width: 124, height: 124, borderRadius: 22, marginBottom: 0 },
  wideBody: { flex: 1, alignItems: 'flex-start' },
  wideTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ribbonInline: { position: 'relative', top: 0, left: 0 },
  wideKind: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 1, color: theme.colors.textTertiary, flexShrink: 1 },
  wideName: { marginTop: 6, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  wideBlurb: { marginTop: 2, fontSize: theme.typography.sizes.caption, lineHeight: 17, color: theme.colors.textSecondary },
  actionWideWrap: { alignSelf: 'stretch' },
  actionWide: { marginTop: theme.spacing.md, paddingVertical: 10 },
  actionTextWide: { fontSize: theme.typography.sizes.body },
  ledgerFoot: { marginTop: theme.spacing.lg, padding: theme.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  ledgerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  ledgerKicker: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 1.3, color: theme.colors.textTertiary },
  ledgerCount: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  ledgerOf: { fontSize: theme.typography.sizes.body, color: theme.colors.textTertiary },
  ledgerNote: { marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.micro + 1, lineHeight: 15, color: theme.colors.textTertiary },
  previewNote: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.borderStrong, marginBottom: theme.spacing.md },
  previewNoteText: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 1, color: theme.colors.textTertiary },
  patron: {
    padding: theme.spacing.lg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.colors.goldRim,
    backgroundColor: theme.colors.creamPlate,
    marginBottom: theme.spacing.xl,
    overflow: 'hidden',
  },
  patronTop: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  patronCrest: { width: 72, height: 72, borderRadius: 20, backgroundColor: theme.colors.surfaceHi, borderWidth: 1, borderColor: theme.colors.goldRim, alignItems: 'center', justifyContent: 'center' },
  patronKicker: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 1.2, fontWeight: theme.typography.weights.bold, color: theme.colors.gold },
  patronTitle: { marginTop: 2, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  perks: { marginTop: theme.spacing.md, gap: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkMark: { width: 7, height: 7, borderRadius: 1.5, transform: [{ rotate: '45deg' }], backgroundColor: theme.colors.gold },
  perkTick: { width: 12, fontSize: 11, fontWeight: theme.typography.weights.bold, color: theme.colors.success, textAlign: 'center' },
  patronOwned: { marginTop: theme.spacing.lg, alignItems: 'center', paddingVertical: theme.spacing.md, borderRadius: theme.radii.pill, backgroundColor: 'rgba(92,124,74,0.14)' },
  patronButtonConfirm: { backgroundColor: theme.colors.secondary },
  perkText: { flex: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.textPrimary },
  patronButton: { marginTop: theme.spacing.lg, alignItems: 'center', paddingVertical: theme.spacing.md, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  patronButtonText: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  packTag: { position: 'absolute', top: 10, alignSelf: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: theme.colors.goldFill, zIndex: 1 },
  packTagText: { fontFamily: theme.typography.families.mono, fontSize: 8, letterSpacing: 1, fontWeight: theme.typography.weights.bold, color: theme.colors.onGold },
  packName: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.4, color: theme.colors.secondary, textTransform: 'uppercase' },
  packCoins: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  packBonus: { marginTop: 2, fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, fontWeight: theme.typography.weights.bold, color: theme.colors.success },
  packPlain: { marginTop: 2, fontSize: 9.5 },
  packBuy: { backgroundColor: theme.colors.primary, minWidth: 110 },
  packDays: { marginTop: 6, fontFamily: theme.typography.families.mono, fontSize: 8.5, letterSpacing: 0.6, color: theme.colors.textTertiary, textAlign: 'center' },
  restoreWrap: { alignSelf: 'center', marginTop: theme.spacing.xl },
  restore: { paddingHorizontal: theme.spacing.lg, paddingVertical: 10, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  restoreText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  finePrint: { marginTop: theme.spacing.md, fontSize: theme.typography.sizes.micro + 0.5, lineHeight: 15, color: theme.colors.textTertiary, textAlign: 'center', paddingHorizontal: theme.spacing.md },
  seasonScroll: { marginHorizontal: -theme.spacing.lg },
  seasonRow: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm },
  seasonItem: { width: 164 },
  hintSeason: { color: theme.colors.secondary },
  tabDot: { position: 'absolute', top: 6, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.secondary },
  setReady: { borderColor: theme.colors.goldRim, borderWidth: 1.5 },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  setCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textSecondary },
  setPieces: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.md, marginBottom: theme.spacing.sm, rowGap: theme.spacing.sm },
  setPiece: { width: '20%', alignItems: 'center' },
  setPlate: { width: 50, height: 50, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  setPlateMissing: { opacity: 0.35 },
  setTick: { position: 'absolute', top: -4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.surfaceHi },
  setTickText: { color: theme.colors.surfaceHi, fontSize: 9, fontWeight: theme.typography.weights.bold },
  setPieceName: { marginTop: 4, fontSize: 9.5, lineHeight: 12, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary, maxWidth: '96%', textAlign: 'center' },
  setPieceNameMissing: { color: theme.colors.textTertiary },
  setFootQuiet: { color: theme.colors.textTertiary },
  setReward: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.creamPlate },
  setRewardPaid: { opacity: 0.45 },
  setRewardText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  featured: {
    padding: theme.spacing.md,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: theme.colors.goldRim,
    backgroundColor: theme.colors.surfaceHi,
    marginBottom: theme.spacing.md,
  },
  featuredHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: theme.spacing.sm },
  featuredKicker: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.2, fontWeight: theme.typography.weights.bold, color: theme.colors.gold },
  featuredClock: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textTertiary },
  itemFeatured: { borderColor: theme.colors.goldRim, borderWidth: 1.5 },
  wasPrice: { fontSize: theme.typography.sizes.micro, color: theme.colors.textTertiary, textDecorationLine: 'line-through', marginRight: 2 },
  pinned: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: theme.colors.goldFill },
  pinnedText: { fontFamily: theme.typography.families.mono, fontSize: 8, letterSpacing: 1, fontWeight: theme.typography.weights.bold, color: theme.colors.onGold },
  shimmerClip: { ...StyleSheet.absoluteFill, borderRadius: 20, overflow: 'hidden' },
  shimmer: { position: 'absolute', top: -40, bottom: -40, width: 46, backgroundColor: theme.colors.sheen },
  filter: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border },
  filterOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textSecondary },
  filterTextOn: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.bold },
  toast: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastTitle: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.body },
  toastText: { color: theme.colors.surfaceHi, opacity: 0.8, fontSize: theme.typography.sizes.caption, marginTop: 2 },
  heroTrack: { height: 5, borderRadius: 3, backgroundColor: theme.colors.surfaceAlt, marginTop: theme.spacing.sm, overflow: 'hidden' },
  heroFill: { height: 5, borderRadius: 3, backgroundColor: theme.colors.gold },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceAlt,
    marginBottom: theme.spacing.lg,
  },
  tabWrap: { flex: 1 },
  tab: { paddingVertical: 9, borderRadius: theme.radii.pill, alignItems: 'center' },
  tabOn: {
    backgroundColor: theme.colors.textPrimary,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  tabTextOn: { color: theme.colors.background },
  pickerScroll: { marginHorizontal: -theme.spacing.lg, marginBottom: theme.spacing.md },
  picker: { paddingHorizontal: theme.spacing.lg, gap: 8 },
  pick: {
    width: 74,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface,
  },
  pickName: { marginTop: 5, fontSize: 10.5, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  pickNameOn: { color: theme.colors.textPrimary },
  pickCount: { marginTop: 1, fontFamily: theme.typography.families.mono, fontSize: 9, color: theme.colors.textTertiary },
  ribbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceHi,
  },
  ribbonText: { fontFamily: theme.typography.families.mono, fontSize: 8, letterSpacing: 1, fontWeight: theme.typography.weights.bold },
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 92 },
  headerRight: { alignItems: 'flex-end' },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  freeze: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: 22,
    backgroundColor: theme.colors.icePlate,
    borderWidth: 1,
    borderColor: theme.colors.iceEdge,
    marginBottom: theme.spacing.xl,
  },
  freezePlate: { width: 64, height: 64, borderRadius: 18, backgroundColor: theme.colors.iceFill, alignItems: 'center', justifyContent: 'center' },
  freezeBody: { flex: 1 },
  freezeTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  freezeText: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, lineHeight: 17 },
  freezeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
  freezeSlots: { flexDirection: 'row', gap: 6 },
  freezeSlot: { width: 14, height: 14, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: theme.colors.iceMark, borderRadius: 3 },
  freezeSlotFull: { backgroundColor: theme.colors.iceMarkFull, borderColor: theme.colors.iceMarkFull },
  section: { marginBottom: theme.spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: theme.spacing.md },
  item: {
    width: '48%',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 1, height: 3 },
    elevation: 2,
  },
  itemWorn: { borderColor: theme.colors.success, borderWidth: 1.5 },
  itemExclusive: { borderColor: theme.colors.goldRim, borderWidth: 1.5 },
  actionLocked: { backgroundColor: theme.colors.surfaceAlt },
  actionLockedText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1, color: theme.colors.textTertiary },
  preview: { width: 96, height: 96, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  itemName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  itemBlurb: { marginTop: 2, fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textSecondary, textAlign: 'center', minHeight: 30 },
  action: { marginTop: theme.spacing.sm, minWidth: 96, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radii.pill },
  actionBuy: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderStrong },
  actionShort: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, opacity: 0.6 },
  actionWear: { backgroundColor: theme.colors.primary },
  actionConfirm: { backgroundColor: theme.colors.secondary },
  actionWorn: { backgroundColor: 'rgba(92,124,74,0.14)' },
  actionText: { fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.caption, color: theme.colors.textPrimary },
  actionShortText: { color: theme.colors.textSecondary },
  actionConfirmText: { fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.caption, color: theme.colors.surfaceHi },
  actionWornText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1, color: theme.colors.success },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pressed: { opacity: 0.85 },
  hint: { marginTop: 6, fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textTertiary },
  hintReady: { color: theme.colors.accent },
  pass: {
    padding: theme.spacing.md,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  passTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  passText: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, lineHeight: 17 },
  passFoot: { marginTop: theme.spacing.sm, fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textTertiary, textAlign: 'center' },
  charmRow: { flexDirection: 'row', gap: theme.spacing.md },
  charmPlate: { width: 64, height: 64, borderRadius: 18, backgroundColor: theme.colors.creamPlate, alignItems: 'center', justifyContent: 'center' },
  charmCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1, color: theme.colors.accent },
  games: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.md },
  gameCell: { width: '25%', padding: 3 },
  game: { alignItems: 'center', paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  gameSelected: { borderColor: theme.colors.secondary, backgroundColor: 'rgba(196,108,51,0.08)' },
  gameRetired: { opacity: 0.3 },
  gameName: { marginTop: 4, fontSize: 10.5, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  gameNameRetired: { color: theme.colors.textTertiary, textDecorationLine: 'line-through' },
  stamp: { position: 'absolute', top: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.danger, transform: [{ rotate: '-14deg' }], backgroundColor: 'rgba(255,253,248,0.9)' },
  stampText: { fontFamily: theme.typography.families.mono, fontSize: 8, fontWeight: theme.typography.weights.bold, letterSpacing: 1, color: theme.colors.danger },
  retirePrompt: { position: 'absolute', left: theme.spacing.md, right: theme.spacing.md, bottom: 36, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.borderStrong },
  retirePromptText: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, fontStyle: 'italic' },
  retireBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm, paddingLeft: theme.spacing.sm },
  retireBarText: { flex: 1, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  hintSpacer: { height: 17 },
}));
