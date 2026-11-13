import type { AuctionLiveStatePayload } from '@dwc/realtime-contracts';
import type { components } from '@/lib/api-schema';
import type { AuctionLiveState } from '../auction-data';

export type AnchoredState = { state: AuctionLiveState; receivedAt: number };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAuctionLiveStatePayload(
  value: unknown,
): value is AuctionLiveStatePayload {
  return (
    record(value) &&
    typeof value.auctionId === 'string' &&
    /^[a-f\d]{24}$/i.test(value.auctionId) &&
    (value.state === 'upcoming' ||
      value.state === 'active' ||
      value.state === 'finished') &&
    Number.isSafeInteger(value.startingPriceCents) &&
    Number.isSafeInteger(value.minimumIncrementCents) &&
    (value.currentBidCents === null ||
      Number.isSafeInteger(value.currentBidCents)) &&
    (value.currentBidderName === null ||
      typeof value.currentBidderName === 'string') &&
    (value.currentBidderId === null ||
      typeof value.currentBidderId === 'string') &&
    typeof value.serverTime === 'string' &&
    Number.isFinite(Date.parse(value.serverTime)) &&
    typeof value.endsAt === 'string' &&
    Number.isFinite(Date.parse(value.endsAt)) &&
    Number.isSafeInteger(value.revision) &&
    typeof value.viewerCount === 'number' &&
    Number.isSafeInteger(value.viewerCount) &&
    value.viewerCount >= 0
  );
}

export function toAuctionLiveState(
  value: AuctionLiveStatePayload,
): AuctionLiveState {
  return {
    auctionId: value.auctionId,
    state: value.state,
    startingPriceCents: value.startingPriceCents,
    minimumIncrementCents: value.minimumIncrementCents,
    currentBidCents: value.currentBidCents,
    currentBidderName: value.currentBidderName,
    currentBidderId: value.currentBidderId,
    serverTime: value.serverTime,
    endsAt: value.endsAt,
    revision: value.revision,
    viewerCount: value.viewerCount,
  };
}

export function mergeLiveState(
  current: AnchoredState | null,
  next: AuctionLiveState,
  source: 'http' | 'socket',
  socketConnected: boolean,
  receivedAt: number,
): AnchoredState {
  if (!Number.isFinite(Date.parse(next.serverTime)))
    return current ?? { state: next, receivedAt };
  if (current) {
    if (next.revision < current.state.revision) return current;
    if (
      next.revision === current.state.revision &&
      Date.parse(next.serverTime) < Date.parse(current.state.serverTime)
    )
      return current;
    if (source === 'http' && socketConnected)
      next = { ...next, viewerCount: current.state.viewerCount };
  }
  return { state: next, receivedAt };
}

export function auctionStatusLabel(
  auction: components['schemas']['AuctionResponseDto'],
) {
  if (auction.status === 'finished') return 'Finished';
  if (auction.state === 'finished') return 'Auction ended · settlement pending';
  if (auction.state === 'active') return 'Live now';
  return 'Upcoming';
}

export function localDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function minimumBid(state: AuctionLiveState | undefined) {
  return state
    ? (state.currentBidCents ?? state.startingPriceCents) +
        (state.currentBidCents === null ? 0 : state.minimumIncrementCents)
    : 0;
}
