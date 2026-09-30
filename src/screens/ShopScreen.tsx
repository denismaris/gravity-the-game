import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { GameEmblem } from '../components/GameEmblem';
import { GameKind, ROTATION, accentColorForKind, gameDisplayName, gameShortName } from '../game/journey';
import { ConfettiBurst, PressableScale } from '../components';
import { CoinBalance, CoinGlyph } from '../components/Coins';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { PageBloom } from '../components/PageBloom';
import { triggerFeedback } from '../game/rendering';
import {
  COSMETICS,
  Cosmetic,
  CosmeticSlot,
  RARITY_NAMES,
  RARITY_PRICES,
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
  cosmeticsFor,
  equipped,
  owns,
  usePlayerProgress,
} from '../progression';
import { motion, theme, themedStyles } from '../theme';

export interface ShopScreenProps {
  onExit: () => void;
}

const ALMANAC_SECTIONS: ReadonlyArray<{ slot: CosmeticSlot; title: string; blurb: string }> = [
  { slot: 'confetti', title: 'SOLVE CONFETTI', blurb: 'The burst behind every solved puzzle, in every game.' },
  { slot: 'garden', title: 'PAGE ART', blurb: 'The blossom in the corner of every page.' },
  { slot: 'ball', title: 'BREAK MARBLE', blurb: 'The marble you roll through the relaxation mazes.' },
];

type Tab = 'games' | 'almanac' | 'passes';
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'games', label: 'Game sets' },
  { id: 'almanac', label: 'Almanac' },
  { id: 'passes', label: 'Passes' },
];

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
      triggerFeedback('solved');
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
function ItemCard({ item, onBought }: { item: Cosmetic; onBought: () => void }): React.JSX.Element {
  const { progress, coins, buyCosmetic, equipCosmetic } = usePlayerProgress();
  const worn = equipped(progress, item.slot).id === item.id;
  const own = owns(progress, item.id);
  const rarity = rarityOf(item);
  const affordable = coins >= item.price;
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
  const locked = item.exclusive === true && !own;
  const chapterDone = chapter !== null && chapter <= chaptersFinished(progress);

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
      triggerFeedback('solved');
      celebrate();
      onBought();
    }
  };

  return (
    <Animated.View style={[styles.item, item.exclusive && styles.itemExclusive, worn && styles.itemWorn, { transform: [{ scale: pop }, { translateX: nudge.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] }]}>
      <View style={styles.preview}>
        <CosmeticPreview item={item} size={78} />
      </View>
      {rarity && (
        <View style={[styles.ribbon, { borderColor: rarityColor(rarity) }]}>
          <Text style={[styles.ribbonText, { color: rarityColor(rarity) }]}>{RARITY_NAMES[rarity].toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemBlurb} numberOfLines={2}>
        {item.blurb}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={worn ? `${item.name}, worn` : own ? `Wear ${item.name}` : locked ? `${item.name}, won in the Weekly Grand, not sold` : confirming ? `Confirm buying ${item.name} for ${item.price} coins` : `Buy ${item.name} for ${item.price} coins`}
        onPress={press}
        style={({ pressed }) => [styles.action, worn ? styles.actionWorn : own ? styles.actionWear : locked ? styles.actionLocked : confirming ? styles.actionConfirm : affordable ? styles.actionBuy : styles.actionShort, pressed && styles.pressed]}
      >
        {worn ? (
          <Text style={styles.actionWornText}>{'WORN ✓︎'}</Text>
        ) : own ? (
          <Text style={styles.actionConfirmText}>Wear</Text>
        ) : locked ? (
          <Text style={styles.actionLockedText}>NOT SOLD</Text>
        ) : confirming ? (
          <Text style={styles.actionConfirmText}>{`Buy for ${item.price}?`}</Text>
        ) : (
          <View style={styles.priceRow}>
            <CoinGlyph size={13} />
            <Text style={[styles.actionText, !affordable && styles.actionShortText]}>{item.price}</Text>
          </View>
        )}
      </PressableScale>
      {locked ? <Text style={[styles.hint, styles.hintReady]}>{grandAt === 1 ? 'WIN: SOLVE A GRAND' : `WIN: ${grandAt} GRANDS SOLVED`}</Text> : short ? <Text style={styles.hint}>{`${item.price - coins} MORE NEEDED`}</Text> : chapter ? <Text style={[styles.hint, chapterDone && styles.hintReady]}>{chapterDone ? `FREE IN YOUR ALMANAC` : `OR FINISH CHAPTER ${chapter}`}</Text> : <View style={styles.hintSpacer} />}
    </Animated.View>
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
  const [tab, setTab] = useState<Tab>('games');
  const [game, setGame] = useState<GameKind>('gravity');
  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mount, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [mount]);
  const rise = (from: number) => ({
    opacity: mount.interpolate({ inputRange: [from, Math.min(1, from + 0.4)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: mount.interpolate({ inputRange: [from, Math.min(1, from + 0.4)], outputRange: [12, 0], extrapolate: 'clamp' }) }],
  });
  const celebrate = () => setBurst(b => b + 1);

  const owned = COLLECTIBLE.filter(item => owns(progress, item.id)).length;
  const ownedIn = (slot: CosmeticSlot) => cosmeticsFor(slot).filter(item => item.price > 0 && owns(progress, item.id)).length;
  const forSaleIn = (slot: CosmeticSlot) => cosmeticsFor(slot).filter(item => item.price > 0).length;

  const freezesFull = progress.streakFreezes >= MAX_STREAK_FREEZES;
  const buyFreeze = () => {
    if (buyStreakFreeze()) {
      triggerFeedback('solved');
      celebrate();
    } else triggerFeedback('tap');
  };

  const gameItems = cosmeticsFor(skinSlot(game));

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
          <CoinBalance coins={coins} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        {/* The collection: how much of the shop is yours, and the four
            tiers everything is priced in. */}
        <Animated.View style={[styles.hero, rise(0)]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroKicker}>YOUR COLLECTION</Text>
              <Text style={styles.heroCount}>
                {owned}
                <Text style={styles.heroOf}>{` / ${COLLECTIBLE.length}`}</Text>
              </Text>
            </View>
            <Text style={styles.heroNote}>{'Only looks, never help.\nEvery price is set against\nwhat a day of play earns.'}</Text>
          </View>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${(owned / Math.max(1, COLLECTIBLE.length)) * 100}%` }]} />
          </View>
          <View style={styles.legend}>
            {(Object.keys(RARITY_PRICES) as Rarity[]).map(r => (
              <View key={r} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: rarityColor(r) }]} />
                <Text style={styles.legendText}>{RARITY_NAMES[r]}</Text>
                <CoinGlyph size={10} />
                <Text style={styles.legendPrice}>{RARITY_PRICES[r]}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.tabs, rise(0.06)]}>
          {TABS.map(t => {
            const on = t.id === tab;
            return (
              <PressableScale
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.label}
                onPress={() => {
                  triggerFeedback('tap');
                  setTab(t.id);
                }}
                containerStyle={styles.tabWrap}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              </PressableScale>
            );
          })}
        </Animated.View>

        {tab === 'games' && (
          <Animated.View style={rise(0.12)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker} style={styles.pickerScroll}>
              {ROTATION.map(kind => {
                const on = kind === game;
                const slot = skinSlot(kind);
                return (
                  <PressableScale
                    key={kind}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${gameShortName(kind)} sets`}
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
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionSwatch, { backgroundColor: accentColorForKind(game) }]} />
                <Text style={styles.sectionName}>{gameDisplayName(game)}</Text>
              </View>
              <Text style={styles.sectionBlurb}>
                {game === 'bridges' ? 'The sea your islands sit in.' : 'Worn on every board of this game, from the next one you open.'}
              </Text>
              <View style={styles.grid}>
                {gameItems.map(item => (
                  <ItemCard key={item.id} item={item} onBought={celebrate} />
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {tab === 'almanac' && (
          <Animated.View style={rise(0.12)}>
            {ALMANAC_SECTIONS.map(section => (
              <View key={section.slot} style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionCount}>{`${ownedIn(section.slot)} / ${forSaleIn(section.slot)} OWNED`}</Text>
                </View>
                <Text style={styles.sectionBlurb}>{section.blurb}</Text>
                <View style={styles.grid}>
                  {cosmeticsFor(section.slot).map(item => (
                    <ItemCard key={item.id} item={item} onBought={celebrate} />
                  ))}
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {tab === 'passes' && (
          <Animated.View style={rise(0.12)}>
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
                      triggerFeedback('solved');
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
          </Animated.View>
        )}
      </ScrollView>
      {burst > 0 && <ConfettiBurst key={burst} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  hero: {
    padding: theme.spacing.md,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroKicker: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.secondary },
  heroCount: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.headline + 4, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  heroOf: { fontSize: theme.typography.sizes.subtitle, color: theme.colors.textTertiary },
  heroNote: { fontSize: theme.typography.sizes.micro + 0.5, lineHeight: 15, color: theme.colors.textSecondary, textAlign: 'right' },
  heroTrack: { height: 5, borderRadius: 3, backgroundColor: theme.colors.surfaceAlt, marginTop: theme.spacing.sm, overflow: 'hidden' },
  heroFill: { height: 5, borderRadius: 3, backgroundColor: theme.colors.gold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6, marginTop: theme.spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  legendText: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.6, color: theme.colors.textSecondary, marginRight: 2 },
  legendPrice: { fontFamily: theme.typography.families.mono, fontSize: 9.5, color: theme.colors.textTertiary },
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
    backgroundColor: theme.colors.surfaceHi,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  tabTextOn: { color: theme.colors.textPrimary },
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  sectionSwatch: { width: 10, height: 10, borderRadius: 3 },
  sectionName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionCount: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textTertiary },
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
  lede: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg, lineHeight: 18 },
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
  sectionTitle: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.secondary },
  sectionBlurb: { marginTop: 2, marginBottom: theme.spacing.md, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
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
