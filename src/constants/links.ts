/**
 * Where to report a bug in the app, or ask for a feature (round 0.39.0): this repository's own
 * issue forms, each of which points to the module's for what happens in Foundry. Never with
 * anything filled in from here, such as a campaign, an address or a secret.
 */
export const ISSUE_FORMS = {
  bug: 'https://github.com/lambersond/sending-stone-player/issues/new?template=bug_report.yml',
  feature:
    'https://github.com/lambersond/sending-stone-player/issues/new?template=feature_request.yml',
} as const
