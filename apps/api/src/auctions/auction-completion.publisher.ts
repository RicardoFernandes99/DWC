import { Injectable } from '@nestjs/common';

export interface AuctionCompletionPayload {
  auctionId: string;
  state: 'finished';
  winningAmountCents: number | null;
  winnerName: string | null;
  revision: number;
  serverTime: string;
}

@Injectable()
export class AuctionCompletionPublisher {
  private dispatch: ((payload: AuctionCompletionPayload) => void) | null = null;

  bind(dispatch: (payload: AuctionCompletionPayload) => void): void {
    this.dispatch = dispatch;
  }

  publishCommitted(payload: AuctionCompletionPayload): void {
    this.dispatch?.(payload);
  }
}
