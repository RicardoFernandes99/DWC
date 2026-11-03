export interface SocketData {
  userId: string;
}

export type {
  AuctionBidAcceptedPayload,
  AuctionBidAcknowledgement,
  AuctionBidPayload,
  AuctionJoinAcknowledgement,
  AuctionLeaveAcknowledgement,
  AuctionLiveStatePayload,
  AuctionRefusalCode,
  AuctionRoomRequestPayload,
  ClientToServerEvents,
  InterServerEvents,
  NotificationCreatedPayload,
  ServerToClientEvents,
} from '@dwc/realtime-contracts';
