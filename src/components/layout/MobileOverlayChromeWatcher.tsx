'use client';

import { useEffect } from 'react';

const OVERLAY_SELECTOR = '[data-mobile-overlay="true"]';
const BODY_CLASS = 'dashboard-mobile-overlay-open';

function syncOverlayBodyClass() {
  if (typeof document === 'undefined') return;
  const hasOverlay = document.querySelector(OVERLAY_SELECTOR) !== null;
  document.body.classList.toggle(BODY_CLASS, hasOverlay);
}

export function MobileOverlayChromeWatcher() {
  useEffect(() => {
    syncOverlayBodyClass();

    const observer = new MutationObserver(() => {
      syncOverlayBodyClass();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-mobile-overlay'],
    });

    return () => {
      observer.disconnect();
      document.body.classList.remove(BODY_CLASS);
    };
  }, []);

  return null;
}
