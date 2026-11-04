import type { components } from '@/lib/api-schema';
import { ApiError, authenticatedRequest, publicRequest } from '@/lib/session';

export type Auction = components['schemas']['AuctionResponseDto'];
export type AuctionLiveState = components['schemas']['AuctionLiveStateDto'];
export type AuctionBid = components['schemas']['AuctionBidResponseDto'];
export type AuctionHistory = components['schemas']['AuctionHistoryResponseDto'];
export type AuctionList = components['schemas']['AuctionListResponseDto'];
export type AuctionResult =
  components['schemas']['AuctionBuyerResultResponseDto'];
export type AuctionState = Auction['state'];

export const auctionListKey = (params: {
  page: number;
  state?: AuctionState;
  producerId?: string;
}) => ['public-auctions', params] as const;
export const auctionKey = (id: string) => ['public-auction', id] as const;
export const auctionLiveKey = (id: string) =>
  ['public-auction-live', id] as const;
export const auctionHistoryKey = (id: string, page: number) =>
  ['public-auction-history', id, page] as const;
export const auctionResultKey = (id: string, buyerId: string) =>
  ['buyer-auction-result', buyerId, id] as const;

export function validAuctionId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function requireAuctionId(id: string) {
  if (!validAuctionId(id))
    throw new ApiError(400, 'This auction identifier is invalid.');
}

export function fetchPublicAuctions(params: {
  page: number;
  state?: AuctionState;
  producerId?: string;
}): Promise<AuctionList> {
  const query = new URLSearchParams({ page: String(params.page), limit: '12' });
  if (params.state) query.set('state', params.state);
  if (params.producerId) query.set('producerId', params.producerId);
  return publicRequest<AuctionList>(`auctions?${query.toString()}`);
}

export function fetchPublicAuction(id: string): Promise<Auction> {
  requireAuctionId(id);
  return publicRequest<Auction>(`auctions/${encodeURIComponent(id)}`);
}

export function fetchAuctionLive(id: string): Promise<AuctionLiveState> {
  requireAuctionId(id);
  return publicRequest<AuctionLiveState>(
    `auctions/${encodeURIComponent(id)}/live`,
  );
}

export function fetchAuctionHistory(
  id: string,
  page: number,
): Promise<AuctionHistory> {
  requireAuctionId(id);
  const query = new URLSearchParams({ page: String(page), limit: '10' });
  return publicRequest<AuctionHistory>(
    `auctions/${encodeURIComponent(id)}/bids?${query.toString()}`,
  );
}

export function fetchAuctionResult(id: string): Promise<AuctionResult> {
  requireAuctionId(id);
  return authenticatedRequest<AuctionResult>(
    `auctions/${encodeURIComponent(id)}/result`,
  );
}

export type PaymentMethod = components['schemas']['PaymentMethodResponseDto'];

export function fetchAuctionPaymentMethods(): Promise<PaymentMethod[]> {
  return authenticatedRequest<PaymentMethod[]>('payment-methods');
}
