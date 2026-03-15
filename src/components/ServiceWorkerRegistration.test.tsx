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
    const register = vi.fn().mockResolvedValue({ update });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
    });
    expect(update).toHaveBeenCalled();
  });
});
