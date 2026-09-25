import { useSyncExternalStore } from "react";

/**
 * Whether the host's left app sidebar is hidden.
 *
 * Plugin SDK has no API for this (`useIsSidebarShowing` is host-internal).
 * The host marks the desktop peer with `data-state` / `data-collapsible`, and
 * the mobile drawer with `data-sidebar="panel"` + `data-state`. We read those
 * attributes and subscribe via MutationObserver so toggles update without a
 * reload. When markers are missing, assume visible so we never duplicate the
 * sidebar-pro usage row.
 */
const COMPACT_QUERY = "(max-width: 767px)";

const DESKTOP_GROUP =
  '[data-side="left"][data-variant="sidebar"][data-state]:not([data-vaul-drawer-direction])';
const MOBILE_PANEL =
  '[data-sidebar="panel"][data-vaul-drawer-direction="left"][data-state]';

export function readBbLeftSidebarHidden(
  doc: Document = document,
  compact: boolean = matchesCompact(),
): boolean {
  if (typeof document === "undefined") return false;

  if (compact) {
    const panel = doc.querySelector(MOBILE_PANEL);
    if (panel === null) return false;
    return panel.getAttribute("data-state") === "closed";
  }

  const group = doc.querySelector(DESKTOP_GROUP);
  if (group === null) return false;
  return group.getAttribute("data-state") === "collapsed";
}

function matchesCompact(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COMPACT_QUERY).matches;
}

type Store = {
  subscribe: (notify: () => void) => () => void;
};

let store: Store | null = null;

function getStore(): Store {
  if (store) return store;

  const listeners = new Set<() => void>();
  let observer: MutationObserver | null = null;
  let media: MediaQueryList | null = null;

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const ensureListening = () => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }
    if (observer === null) {
      observer = new MutationObserver(emit);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [
          "data-state",
          "data-collapsible",
          "data-sidebar",
          "data-side",
          "data-variant",
          "data-vaul-drawer-direction",
        ],
      });
    }
    if (media === null) {
      media = window.matchMedia(COMPACT_QUERY);
      media.addEventListener("change", emit);
    }
  };

  const teardownIfIdle = () => {
    if (listeners.size > 0) return;
    observer?.disconnect();
    observer = null;
    media?.removeEventListener("change", emit);
    media = null;
  };

  store = {
    subscribe(notify) {
      ensureListening();
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
        teardownIfIdle();
      };
    },
  };
  return store;
}

export function useBbSidebarHidden(): boolean {
  return useSyncExternalStore(
    (notify) => getStore().subscribe(notify),
    () => readBbLeftSidebarHidden(),
    () => false,
  );
}
