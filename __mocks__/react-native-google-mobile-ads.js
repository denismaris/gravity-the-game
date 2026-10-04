// Jest stand-in for the Google Mobile Ads native module: consent is
// granted, the SDK starts, and ads never load - so nothing in a test ever
// waits on one.
function ad() {
  return { loaded: false, load() {}, show: () => Promise.resolve(), addAdEventListener: () => () => {} };
}
module.exports = {
  __esModule: true,
  default: () => ({ initialize: () => Promise.resolve([]) }),
  AdsConsent: {
    gatherConsent: () => Promise.resolve({ canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }),
    getConsentInfo: () => Promise.resolve({ canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }),
    showPrivacyOptionsForm: () => Promise.resolve({}),
  },
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED', UNKNOWN: 'UNKNOWN' },
  AdEventType: { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed' },
  RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' },
  InterstitialAd: { createForAdRequest: ad },
  RewardedAd: { createForAdRequest: ad },
  TestIds: { INTERSTITIAL: 'test-interstitial', REWARDED: 'test-rewarded' },
};
