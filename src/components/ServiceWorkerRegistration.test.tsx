// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

describe('ServiceWorkerRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the service worker without using the browser cache and forces an update check', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const addEventListener = vi.fn();
    const waitingPostMessage = vi.fn();
    const serviceWorkerAddEventListener = vi.fn();
    const serviceWorkerRemoveEventListener = vi.fn();
    const register = vi.fn().mockResolvedValue({
      update,
      waiting: { postMessage: waitingPostMessage },
      addEventListener,
      installing: null,
    });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        register,
        addEventListener: serviceWorkerAddEventListener,
        removeEventListener: serviceWorkerRemoveEventListener,
      },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
    });
    expect(update).toHaveBeenCalled();
    expect(serviceWorkerAddEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
    expect(waitingPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function));
  });
});
