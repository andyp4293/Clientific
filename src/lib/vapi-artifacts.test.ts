import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VapiArtifactError,
  buildVapiCallArtifactUrl,
  downloadVapiCallArtifact,
  isVapiCallArtifactKind,
} from './vapi-artifacts';

const ORIGINAL_VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

describe('Vapi call artifact downloads', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_VAPI_PRIVATE_KEY === undefined) {
      delete process.env.VAPI_PRIVATE_KEY;
    } else {
      process.env.VAPI_PRIVATE_KEY = ORIGINAL_VAPI_PRIVATE_KEY;
    }
  });

  it('builds the authenticated Vapi artifact endpoint instead of using webhook recording URLs', () => {
    expect(buildVapiCallArtifactUrl('call_123-ABC', 'mono-recording')).toBe(
      'https://api.vapi.ai/call/call_123-ABC/mono-recording',
    );
    expect(isVapiCallArtifactKind('stereo-recording')).toBe(true);
    expect(isVapiCallArtifactKind('recordingUrl')).toBe(false);
  });

  it('rejects raw public recording URLs and unsafe call ids', () => {
    expect(() =>
      buildVapiCallArtifactUrl('https://storage.vapi.ai/call.wav', 'mono-recording'),
    ).toThrowError(VapiArtifactError);
    expect(() =>
      buildVapiCallArtifactUrl('../call-1', 'mono-recording'),
    ).toThrowError(VapiArtifactError);
  });

  it('downloads through Vapi with bearer auth and follows signed-url redirects', async () => {
    process.env.VAPI_PRIVATE_KEY = '  vapi_private_key\n';
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'content-type': 'audio/wav',
          'content-length': '3',
        },
      }),
    );

    const result = await downloadVapiCallArtifact({
      callId: 'call_123',
      artifactKind: 'mono-recording',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.vapi.ai/call/call_123/mono-recording',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer vapi_private_key' },
        redirect: 'follow',
      }),
    );
    expect(result.contentType).toBe('audio/wav');
    expect(result.contentLength).toBe(3);
    expect(Array.from(new Uint8Array(result.arrayBuffer))).toEqual([1, 2, 3]);
  });

  it('fails closed when Vapi credentials are missing', async () => {
    delete process.env.VAPI_PRIVATE_KEY;
    const fetchImpl = vi.fn();

    await expect(
      downloadVapiCallArtifact({
        callId: 'call_123',
        artifactKind: 'mono-recording',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'VAPI_PRIVATE_KEY_MISSING',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces Vapi artifact download failures with status context', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_private_key';
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    );

    await expect(
      downloadVapiCallArtifact({
        callId: 'call_123',
        artifactKind: 'mono-recording',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'VAPI_ARTIFACT_DOWNLOAD_FAILED',
      status: 404,
    });
  });
});
