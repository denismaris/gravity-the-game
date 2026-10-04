import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AD_RULES, AdLedger, EMPTY_LEDGER, adShown, setFinished, videoWatched, videosLeft } from './policy';

export { AD_RULES } from './policy';

/**
 * Google AdMob, used the way `policy.ts` allows: a full-screen ad between
 * level sets now and then, and coin videos the player chooses to watch.
 *
 * Privacy: every ad is requested as non-personalised, so no advertising
 * identifier is used and nothing tracks the player across apps - which is
 * also why the app never shows Apple's tracking prompt. In the EU (and
 * wherever the law asks), Google's consent form appears once before any ad,
 * and the player can change their choice later in Settings.
 */

/** Google's own sample units: labelled test ads that never pay. Every
 * development build uses these, so tapping around while building the game
 * can never count as clicks on real ads (AdMob suspends accounts for that). */
const TEST_UNITS = {
  interstitial: Platform.select({ ios: 'ca-app-pub-3940256099942544/4411468910', default: 'ca-app-pub-3940256099942544/1033173712' }),
  rewarded: Platform.select({ ios: 'ca-app-pub-3940256099942544/1712485313', default: 'ca-app-pub-3940256099942544/5224354917' }),
};

/** Tessellatum's own AdMob units, used only in release builds. An empty
 * one falls back to the test unit until it is filled in. */
const REAL_UNITS = {
  interstitial: Platform.select({ ios: 'ca-app-pub-6910889676255413/5876719533', default: 'ca-app-pub-6910889676255413/2424559685' }),
  rewarded: Platform.select({ ios: 'ca-app-pub-6910889676255413/9746672621', default: 'ca-app-pub-6910889676255413/3621257136' }),
};

/** Turn on only for the build sent to the App Store and Google Play. Off,
 * every build - including Release builds run on your own phone from Xcode
 * or Android Studio - shows test ads, so you can never click your own real
 * ones by accident. */
export const REAL_ADS = false;

const real = REAL_ADS && !__DEV__;
const UNITS = {
  interstitial: (real && REAL_UNITS.interstitial) || TEST_UNITS.interstitial,
  rewarded: (real && REAL_UNITS.rewarded) || TEST_UNITS.rewarded,
};

const LEDGER_KEY = 'tessera.ads.ledger';
const REQUEST = { requestNonPersonalizedAdsOnly: true };

type Ads = typeof import('react-native-google-mobile-ads');
let lib: Ads | null = null;
let ready: Promise<boolean> | null = null;

function ads(): Ads | null {
  if (!lib) {
    try {
      lib = require('react-native-google-mobile-ads') as Ads;
    } catch {
      lib = null;
    }
  }
  return lib;
}

/** Asks for consent where the law requires it, then starts the SDK. Safe
 * to call more than once; resolves to whether ads may be requested. The
 * app calls it at launch only for a player who already sees ads, so a new
 * player meets neither a form nor an ad in their first sessions. */
export function startAds(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      const a = ads();
      if (!a) return false;
      try {
        const info = await a.AdsConsent.gatherConsent();
        if (!info.canRequestAds) return false;
        await a.default().initialize();
        preloadInterstitial();
        return true;
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

/** Whether Settings should offer "Ad privacy choices" (required in the EU
 * once the consent form has been shown). */
export async function privacyChoicesRequired(): Promise<boolean> {
  const a = ads();
  if (!a) return false;
  try {
    const info = await a.AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === a.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function showPrivacyChoices(): Promise<void> {
  try {
    await ads()?.AdsConsent.showPrivacyOptionsForm();
  } catch {
    // Nothing to show.
  }
}

async function readLedger(): Promise<AdLedger> {
  try {
    const raw = await AsyncStorage.getItem(LEDGER_KEY);
    return raw ? { ...EMPTY_LEDGER, ...(JSON.parse(raw) as Partial<AdLedger>) } : EMPTY_LEDGER;
  } catch {
    return EMPTY_LEDGER;
  }
}

async function writeLedger(ledger: AdLedger): Promise<void> {
  try {
    await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // The worst case is one ad too few.
  }
}

function today(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// One interstitial is kept loaded ahead, so the break never waits on it.
let interstitial: ReturnType<Ads['InterstitialAd']['createForAdRequest']> | null = null;

function preloadInterstitial(): void {
  const a = ads();
  if (!a) return;
  const ad = a.InterstitialAd.createForAdRequest(UNITS.interstitial, REQUEST);
  interstitial = ad;
  ad.load();
}

/**
 * The player just finished a level set. Shows a full-screen ad if the
 * rules allow one and it is loaded, and resolves once it is closed (or
 * straight away when there is none) - so the caller simply carries on.
 */
export async function betweenSets(context: { solved: number; adFree: boolean }, now = Date.now()): Promise<void> {
  const ledger = await readLedger();
  const { ledger: counted, showAd } = setFinished(ledger, { now, dayKey: today(now), solved: context.solved, adFree: context.adFree });
  const a = ads();
  // Starting here (not at launch) puts Google's consent form, the first
  // time, at this break between sets rather than over the game.
  if (!showAd || !a || !(await startAds())) {
    await writeLedger(counted);
    return;
  }
  const ad = interstitial;
  if (!ad?.loaded) {
    await writeLedger(counted);
    return;
  }
  await new Promise<void>(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      unsubscribeClosed();
      unsubscribeError();
      resolve();
    };
    const unsubscribeClosed = ad.addAdEventListener(a.AdEventType.CLOSED, finish);
    const unsubscribeError = ad.addAdEventListener(a.AdEventType.ERROR, finish);
    ad.show().catch(finish);
  });
  await writeLedger(adShown(counted, Date.now(), today(Date.now())));
  preloadInterstitial();
}

/** Rewarded videos (for coins, or for Insight) the player can still watch
 * today. */
export async function coinVideosLeft(now = Date.now()): Promise<number> {
  return videosLeft(await readLedger(), today(now));
}

/** A rewarded video for anything the player chose to watch one for - the
 * same daily allowance as the coin videos. */
export function watchRewardedVideo(): Promise<boolean> {
  return watchCoinVideo();
}

/**
 * Plays a coin video the player asked for. Resolves to true only if they
 * watched it to the end (the reward is earned), false if it could not
 * load, was closed early, or today's videos are used up.
 */
export async function watchCoinVideo(now = Date.now()): Promise<boolean> {
  const a = ads();
  if (!a || (await coinVideosLeft(now)) <= 0 || !(await startAds())) return false;
  const ad = a.RewardedAd.createForAdRequest(UNITS.rewarded, REQUEST);
  const earned = await new Promise<boolean>(resolve => {
    let rewarded = false;
    let settled = false;
    const subs: Array<() => void> = [];
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      subs.forEach(unsubscribe => unsubscribe());
      resolve(value);
    };
    // A video that never loads must not leave the button spinning.
    const loading = setTimeout(() => settle(false), 20_000);
    subs.push(() => clearTimeout(loading));
    subs.push(
      ad.addAdEventListener(a.RewardedAdEventType.LOADED, () => {
        clearTimeout(loading);
        ad.show().catch(() => settle(false));
      }),
    );
    subs.push(ad.addAdEventListener(a.RewardedAdEventType.EARNED_REWARD, () => (rewarded = true)));
    subs.push(ad.addAdEventListener(a.AdEventType.CLOSED, () => settle(rewarded)));
    subs.push(ad.addAdEventListener(a.AdEventType.ERROR, () => settle(false)));
    ad.load();
  });
  if (earned) await writeLedger(videoWatched(await readLedger(), today(Date.now())));
  return earned;
}

export const VIDEO_COINS = AD_RULES.videoCoins;
