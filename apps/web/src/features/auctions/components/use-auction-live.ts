import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type {
  AuctionLiveStatePayload,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@dwc/realtime-contracts';
import { auctionKey, auctionLiveKey, auctionResultKey } from '../auction-data';
import {
  isAuctionLiveStatePayload,
  mergeLiveState,
  toAuctionLiveState,
  type AnchoredState,
} from './auction-room-utils';

type AuctionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function applyPayload(
  setState: Dispatch<SetStateAction<AnchoredState | null>>,
  payload: unknown,
  auctionId: string,
  socketConnected: boolean,
  receivedAt: number,
  setViewers?: (count: number) => void,
) {
  if (!isAuctionLiveStatePayload(payload) || payload.auctionId !== auctionId)
    return;
  setViewers?.(payload.viewerCount);
  setState((current) =>
    mergeLiveState(
      current,
      toAuctionLiveState(payload),
      'socket',
      socketConnected,
      receivedAt,
    ),
  );
}

export function useAuctionLive(
  auctionId: string,
  buyerId: string | undefined,
  httpSnapshot: AnchoredState | undefined,
) {
  const client = useQueryClient();
  const [socketState, setSocketState] = useState<AuctionSocket | null>(null);
  const [socketLive, setSocketLive] = useState<AnchoredState | null>(null);
  const [socketViewers, setSocketViewers] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(
    'Connecting to live auction…',
  );

  useEffect(() => {
    let active = true;
    const socket = io('/auctions', {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    }) as AuctionSocket;
    const historyPrefix = ['public-auction-history', auctionId] as const;
    const refreshServerData = () => {
      void Promise.all([
        client.invalidateQueries({ queryKey: auctionKey(auctionId) }),
        client.invalidateQueries({ queryKey: auctionLiveKey(auctionId) }),
        client.invalidateQueries({ queryKey: historyPrefix }),
      ]);
    };
    const join = () => {
      socket.emit('auction.join', { auctionId }, (acknowledgement) => {
        if (!active) return;
        if (acknowledgement.ok) {
          applyPayload(
            setSocketLive,
            acknowledgement.state,
            auctionId,
            socket.connected,
            performance.now(),
            setSocketViewers,
          );
          setConnectionMessage('Live updates connected');
          refreshServerData();
        } else {
          setConnectionMessage(
            acknowledgement.code === 'not_found'
              ? 'This auction is no longer available.'
              : 'Live updates could not connect. The server clock will keep syncing over HTTP.',
          );
        }
      });
    };
    const onState = (payload: unknown) => {
      applyPayload(
        setSocketLive,
        payload,
        auctionId,
        socket.connected,
        performance.now(),
        setSocketViewers,
      );
    };
    const onAccepted = (payload: unknown) => {
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('state' in payload)
      )
        return;
      applyPayload(
        setSocketLive,
        payload.state,
        auctionId,
        socket.connected,
        performance.now(),
        setSocketViewers,
      );
      refreshServerData();
    };
    const onClosed = (payload: unknown) => {
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('auctionId' in payload) ||
        payload.auctionId !== auctionId
      )
        return;
      refreshServerData();
      void client.invalidateQueries({
        queryKey: auctionResultKey(auctionId, buyerId ?? ''),
      });
    };
    const onConnect = () => {
      setConnected(true);
      setSocketViewers(null);
      setSocketState(socket);
      setConnectionMessage('Reconnecting to auction state…');
      join();
      refreshServerData();
    };
    const onDisconnect = () => {
      setConnected(false);
      setConnectionMessage('Live connection paused. Reconnecting…');
    };
    const onConnectError = () => {
      setConnected(false);
      setConnectionMessage(
        'Live connection unavailable. The server clock is syncing over HTTP.',
      );
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('auction.state', onState);
    socket.on('auction.bid.accepted', onAccepted);
    socket.on('auction.closed', onClosed);
    socket.connect();
    const membershipRefresh = window.setInterval(() => {
      if (socket.connected) join();
    }, 15_000);
    return () => {
      active = false;
      window.clearInterval(membershipRefresh);
      socket.emit('auction.leave', { auctionId }, () => {});
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('auction.state', onState);
      socket.off('auction.bid.accepted', onAccepted);
      socket.off('auction.closed', onClosed);
      socket.disconnect();
    };
  }, [auctionId, buyerId, client]);

  const live = httpSnapshot
    ? mergeLiveState(
        socketLive,
        httpSnapshot.state,
        'http',
        connected,
        httpSnapshot.receivedAt,
      )
    : socketLive;
  const applyAcknowledgedState = (payload: AuctionLiveStatePayload) =>
    applyPayload(
      setSocketLive,
      payload,
      auctionId,
      socketState?.connected ?? connected,
      performance.now(),
      setSocketViewers,
    );

  return {
    live,
    viewerCount: connected ? socketViewers : null,
    connected,
    connectionMessage,
    socket: socketState,
    applyAcknowledgedState,
  };
}
