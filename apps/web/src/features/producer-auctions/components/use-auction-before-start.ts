import { useEffect, useState } from 'react';

export function useAuctionBeforeStart(startsAt?: string) {
  const [snapshot, setSnapshot] = useState<{
    startsAt: string;
    checkedAt: number;
  }>();

  useEffect(() => {
    if (!startsAt) return;
    const start = new Date(startsAt).getTime();
    let timer = 0;
    const check = () => {
      const checkedAt = Date.now();
      setSnapshot({ startsAt, checkedAt });
      if (!Number.isFinite(start) || start <= checkedAt) return;
      timer = window.setTimeout(
        check,
        Math.min(start - checkedAt + 1, 2_000_000_000),
      );
    };
    timer = window.setTimeout(check, 0);
    return () => window.clearTimeout(timer);
  }, [startsAt]);

  if (!startsAt || snapshot?.startsAt !== startsAt) return undefined;
  return new Date(startsAt).getTime() > snapshot.checkedAt;
}
