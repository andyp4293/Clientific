'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const hadControllerAtMount = Boolean(navigator.serviceWorker.controller);
    let hasReloadedForUpdate = false;

    const handleControllerChange = () => {
      if (!hadControllerAtMount) {
        return;
      }

      if (hasReloadedForUpdate) {
        return;
      }

      hasReloadedForUpdate = true;
      window.location.reload();
    };

    const promoteWaitingWorker = (registration: ServiceWorkerRegistration) => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        void registration.update();

        if (registration.waiting) {
          promoteWaitingWorker(registration);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;

          if (!installing) {
            return;
          }

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promoteWaitingWorker(registration);
            }
          });
        });
      })
      .catch((err) => console.error('SW registration failed:', err));

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
