export interface ServerToClientEvents {
  'notification.created': (payload: NotificationCreatedPayload) => void;
  'auction.state': (payload: AuctionLiveStatePayload) => void;
  'auction.bid.accepted': (payload: AuctionBidAcceptedPayload) => void;
  'auction.closed': (payload: AuctionClosedPayload) => void;
}

export interface ClientToServerEvents {
  'auction.join': (
    payload: AuctionRoomRequestPayload,
    acknowledge: (result: AuctionJoinAcknowledgement) => void,
  ) => void;
  'auction.leave': (
    payload: AuctionRoomRequestPayload,
    acknowledge: (result: AuctionLeaveAcknowledgement) => void,
  ) => void;
  'auction.bid': (
    payload: AuctionBidRequestPayload & { accessToken: string },
    acknowledge: (result: AuctionBidAcknowledgement) => void,
  ) => void;
}
export type InterServerEvents = Record<never, never>;

export interface NotificationCreatedPayload {
  notificationId: string;
}

export interface AuctionRoomRequestPayload {
  auctionId: string;
}

export interface AuctionBidRequestPayload {
  requestId: string;
  auctionId: string;
  amountCents: number;
  paymentMethodId: string;
}

export interface AuctionLiveStatePayload {
  auctionId: string;
  state: 'upcoming' | 'active' | 'finished';
  startingPriceCents: number;
  minimumIncrementCents: number;
  currentBidCents: number | null;
  currentBidderName: string | null;
  serverTime: string;
  endsAt: string;
  revision: number;
  viewerCount: number;
}

export interface AuctionBidPayload {
  id: string;
  auctionId: string;
  amountCents: number;
  bidderName: string;
  acceptedAt: string;
  endsAt: string;
  revision: number;
}

export interface AuctionBidAcceptedPayload {
  bid: AuctionBidPayload;
  state: AuctionLiveStatePayload;
}

export interface AuctionClosedPayload {
  auctionId: string;
  state: 'finished';
  winningAmountCents: number | null;
  winnerName: string | null;
  revision: number;
  serverTime: string;
}

export type AuctionRefusalCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'bid_rejected'
  | 'rate_limited'
  | 'service_unavailable';

export type AuctionJoinAcknowledgement =
  | { ok: true; state: AuctionLiveStatePayload }
  | { ok: false; code: 'invalid_input' | 'not_found' | 'service_unavailable' };

export type AuctionLeaveAcknowledgement =
  { ok: true; auctionId: string } | { ok: false; code: 'invalid_input' };

export type AuctionBidAcknowledgement =
  | {
      ok: true;
      duplicate: boolean;
      bid: AuctionBidPayload;
      state: AuctionLiveStatePayload;
    }
  | { ok: false; code: AuctionRefusalCode; message: string };
