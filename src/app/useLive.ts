/**
 * src/app/useLive.ts: reads part of the live store in a component.
 *
 * Layer: UI.
 */
import { useStore } from 'zustand';

import { type LiveState, liveStore } from '@/store/live';

/** Reads part of the live state (re-rendering when it changes). */
export function useLive<T>(select: (s: LiveState) => T): T {
  return useStore(liveStore, select);
}
