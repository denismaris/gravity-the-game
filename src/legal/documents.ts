/**
 * The privacy policy and the terms of use, shown in the app (Settings, and
 * the sign-in screen) and meant to be published word for word on the web
 * page the stores link to. Written from what the app actually does - see
 * supabase/migrations for every field it stores - so when that changes,
 * this changes with it.
 */

/** Who stands behind the app. Fill these in before release: the stores and
 * the GDPR both need a real name and a way to reach you. */
export const LEGAL = {
  /** Your full legal name, or your PFA/SRL's name once you have one. */
  owner: 'Maris Denis-Andrei',
  /** An email address for privacy and support questions. */
  email: 'marisdenis3333@gmail.com',
  /** Where the Supabase project's servers are (Dashboard > Project
   * Settings > General), e.g. 'Frankfurt, Germany'. */
  dataRegion: 'Arad, Romania',
  updated: '3 October 2026',
};

const who = () => LEGAL.owner || 'the developer of Tessera';
const contact = () => (LEGAL.email ? `by email at ${LEGAL.email}` : 'through the contact details on the Tessera page of the App Store or Google Play');

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: ReadonlyArray<string>;
}

export interface LegalDocument {
  readonly title: string;
  readonly lede: string;
  readonly sections: ReadonlyArray<LegalSection>;
}

export function privacyPolicy(): LegalDocument {
  return {
    title: 'Privacy policy',
    lede: `Last updated ${LEGAL.updated}. Tessera is made by ${who()}. This policy explains what the game stores about you, why, and what you can do about it. The short version: only what the game needs to save your progress and run its leaderboards. No ads, no tracking, no selling of data.`,
    sections: [
      {
        heading: 'What is stored',
        paragraphs: [
          'Your game progress: puzzles solved, stars, coins, items, streaks and settings. It is kept on your phone and, so it is never lost, backed up to our server under a random account number that is created automatically the first time you play.',
          'Your Daily results: how long your first solve of each day’s Daily took, and its stars, for the leaderboards.',
          'If you sign in with Google or Apple: the name and email address of that account, which we receive from Google or Apple to link your progress to you. We never see your password.',
          'Your leaderboard profile: the name you choose to show (or, only if you say yes, the first name and initial of your Google or Apple account), your country (taken from your phone’s region setting, which you can change) and a city, only if you type one in.',
          'Reports: if you report another player’s name, we store that you reported it, so that names reported by several players can be hidden.',
          'Which kind of phone saved your progress (iPhone or Android), to keep copies on two phones from overwriting each other.',
        ],
      },
      {
        heading: 'What is not',
        paragraphs: [
          'Tessera does not use your location (no GPS), your contacts, your photos, your microphone or camera, or any advertising identifier. It contains no advertising, analytics or tracking tools, and nothing about you is sold or shared for advertising.',
        ],
      },
      {
        heading: 'Why, and on what legal basis',
        paragraphs: [
          'To provide the game you asked for: saving and restoring your progress, and your account (performance of a contract, GDPR Article 6(1)(b)).',
          'To show your name and city on the leaderboards: your consent (Article 6(1)(a)). You can remove them at any time, and you then appear as an anonymous player.',
          'To keep the leaderboards fair and free of offensive names: our legitimate interest in a safe game (Article 6(1)(f)).',
        ],
      },
      {
        heading: 'Who else handles it',
        paragraphs: [
          `Supabase, Inc. hosts our database and sign-in service and processes the data above only on our instructions, under a data processing agreement${LEGAL.dataRegion ? `. The servers are in ${LEGAL.dataRegion}` : ''}. Where data is handled outside the European Economic Area, it is protected by the European Commission’s Standard Contractual Clauses.`,
          'Google and Apple, only if you choose to sign in with them; their own privacy policies apply to your account with them.',
          'Apple and Google also process purchases you make in the app; we never receive your payment details.',
        ],
      },
      {
        heading: 'How long it is kept',
        paragraphs: [
          'For as long as you keep your account. You can delete it at any time in the app: Settings, then your account, then “Delete my account and data”. That permanently removes your saved progress, your profile, your leaderboard results and your reports from our server. Progress kept only on your phone is removed when you delete the app.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You can ask to see, correct, export or delete your data, or object to how it is used, ${contact()}. We answer within one month.`,
          'You can also complain to a data protection authority. In Romania that is the ANSPDCP (www.dataprotection.ro); elsewhere in the EU, the authority in your country.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'Tessera is a general puzzle game and is not aimed at children. Signing in and showing a name on the leaderboards is meant for players aged 16 or older; younger players can play without signing in and appear on the leaderboards only as an anonymous player.',
        ],
      },
      {
        heading: 'Stored on your phone',
        paragraphs: [
          'The game keeps your progress, settings and the list of players you have hidden on your phone, because it needs them to work. This is not used for tracking, so no consent prompt is needed for it.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: ['If this policy changes, the new version will be in the app with a new date. Important changes will be pointed out in the app before they apply.'],
      },
    ],
  };
}

export function termsOfUse(): LegalDocument {
  return {
    title: 'Terms of use',
    lede: `Last updated ${LEGAL.updated}. These terms are between you and ${who()}, the maker of Tessera. By playing, you agree to them. Nothing here takes away the rights you have as a consumer under the law of the country where you live.`,
    sections: [
      {
        heading: 'Playing the game',
        paragraphs: [
          'You may play Tessera for your own, personal use. Please do not copy, sell or reverse-engineer it, or use cheats, bots or modified versions of the app.',
          'The game, its puzzles, art, sounds and music are protected by copyright and belong to us.',
        ],
      },
      {
        heading: 'Coins and items',
        paragraphs: [
          'Coins, items, skins, passes and other things earned or bought in the game are a licence to use them in the game. They have no value outside it, cannot be exchanged for money, and cannot be sold or transferred to someone else.',
          'We may rebalance the game, including what things cost in coins. We will not remove items you have bought with real money without a good reason, such as a legal requirement.',
        ],
      },
      {
        heading: 'Purchases and refunds',
        paragraphs: [
          'Purchases are made through the App Store or Google Play, and their terms and refund processes apply: request a refund from Apple (reportaproblem.apple.com) or Google (through Google Play).',
          'In the EU you normally have 14 days to withdraw from an online purchase. For digital content delivered straight away, that right ends once delivery starts, which you agree to when you buy. This does not affect your rights if something you bought does not work as described.',
        ],
      },
      {
        heading: 'Your account and the leaderboards',
        paragraphs: [
          'Names and cities you show on the leaderboards must not be offensive, hateful, sexual, impersonate someone else, or break the law. We may hide or remove any name, and hide or remove results that look like cheating.',
          'We may suspend an account that cheats or abuses other players. You can delete your account at any time in the app.',
        ],
      },
      {
        heading: 'The service',
        paragraphs: [
          'We work to keep Tessera available and your progress safe, but the game is provided as it is, and online features such as backup and leaderboards may sometimes be unavailable. We may change or end features; if we ever close the game, we will give notice in the app first.',
          'To the extent the law allows, we are not liable for indirect losses, or for losses caused by events outside our reasonable control. Nothing in these terms limits liability that cannot be limited by law.',
        ],
      },
      {
        heading: 'Law and contact',
        paragraphs: [
          'These terms are governed by Romanian law. If you are a consumer living elsewhere in the EU, you also keep the protection of your own country’s law and can go to its courts.',
          `Questions or complaints: ${contact()}.`,
        ],
      },
    ],
  };
}

/** The line at the foot of Settings. */
export function copyrightLine(): string {
  return `© 2026 ${LEGAL.owner || 'Tessera'}. All rights reserved.`;
}
