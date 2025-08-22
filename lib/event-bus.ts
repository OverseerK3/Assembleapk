export type AppEvent =
  | { type: 'event:joined'; eventId: string }
  | { type: 'event:left'; eventId: string };

type Listener = (e: AppEvent) => void;

const listeners = new Set<Listener>();

export function onAppEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitAppEvent(e: AppEvent) {
  listeners.forEach((fn) => {
    try { fn(e); } catch {}
  });
}
