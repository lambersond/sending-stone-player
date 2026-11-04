/**
 * Where a party sheet stands: being fetched for the first time, shown, or no longer the seat's to
 * see, as when its access is taken away in Foundry, or its group leaves the campaign.
 */
export type PartyState = 'loading' | 'ready' | 'gone'
