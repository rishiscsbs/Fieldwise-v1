// Keeps the deck and the presenter window on the same slide with BroadcastChannel (same browser, any tab).
// Either side can move. The deck answers "hello" with its slide and announces it on start, so whichever
// window opens second catches up.
import { useEffect, useRef, useState } from 'react';
import { clampSlide } from './slides';

type Msg =
  | { type: 'goto'; index: number; from: string }
  | { type: 'hello'; from: string }
  | { type: 'state'; index: number; from: string };

const CHANNEL = 'fieldwise-pitch';

export function usePitchSync(role: 'deck' | 'presenter') {
  const [index, setIndexState] = useState(() => (role === 'deck' ? readHash() : 0));
  const [peer, setPeer] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const id = useRef(`${role}-${Math.random().toString(36).slice(2)}`);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m.from === id.current) return;
      setPeer(true);
      if (m.type === 'hello' && role === 'deck')
        ch.postMessage({ type: 'state', index: indexRef.current, from: id.current } satisfies Msg);
      if (m.type === 'goto' || m.type === 'state') setIndexState(clampSlide(m.index));
    };
    // Works in either order: the presenter asks, and the deck also announces itself when it starts.
    ch.postMessage({ type: 'hello', from: id.current } satisfies Msg);
    if (role === 'deck')
      ch.postMessage({ type: 'state', index: indexRef.current, from: id.current } satisfies Msg);
    return () => ch.close();
  }, [role]);

  // The deck keeps the slide in the URL hash so a reload stays put.
  useEffect(() => {
    if (role === 'deck') history.replaceState(null, '', `#${index + 1}`);
  }, [index, role]);

  const setIndex = (i: number) => {
    const next = clampSlide(i);
    setIndexState(next);
    channel.current?.postMessage({ type: 'goto', index: next, from: id.current } satisfies Msg);
  };

  return { index, setIndex, peer };
}

function readHash() {
  const n = Number(location.hash.slice(1));
  return Number.isFinite(n) && n > 0 ? clampSlide(n - 1) : 0;
}
