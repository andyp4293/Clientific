const VAPI_API_BASE_URL = 'https://api.vapi.ai';

export const VAPI_CALL_ARTIFACT_KINDS = [
  'mono-recording',
  'stereo-recording',
  'customer-recording',
  'assistant-recording',
  'video-recording',
  'call-logs',
  'pcap',
] as const;

export type VapiCallArtifactKind = typeof VAPI_CALL_ARTIFACT_KINDS[number];

export class VapiArtifactError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'VapiArtifactError';
  }
}

const VAPI_CALL_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isVapiCallArtifactKind(value: unknown): value is VapiCallArtifactKind {
  return (
    typeof value === 'string' &&
    (VAPI_CALL_ARTIFACT_KINDS as readonly string[]).includes(value)
  );
}

function getVapiPrivateKey() {
  const privateKey = process.env.VAPI_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new VapiArtifactError(
      'VAPI_PRIVATE_KEY is required to download Vapi call artifacts.',
      'VAPI_PRIVATE_KEY_MISSING',
    );
  }
  return privateKey;
}

export function buildVapiCallArtifactUrl(
  callId: string,
  artifactKind: VapiCallArtifactKind,
) {
  const normalizedCallId = callId.trim();

  if (!normalizedCallId || !VAPI_CALL_ID_PATTERN.test(normalizedCallId)) {
    throw new VapiArtifactError(
      'Vapi call artifact downloads require a safe call id, not a raw URL.',
      'VAPI_CALL_ID_INVALID',
    );
  }

  if (!isVapiCallArtifactKind(artifactKind)) {
    throw new VapiArtifactError(
      `Unsupported Vapi call artifact kind: ${String(artifactKind)}`,
      'VAPI_ARTIFACT_KIND_INVALID',
    );
  }

  return `${VAPI_API_BASE_URL}/call/${encodeURIComponent(normalizedCallId)}/${artifactKind}`;
}

export async function downloadVapiCallArtifact({
  callId,
  artifactKind,
  fetchImpl = fetch,
  signal,
}: {
  callId: string;
  artifactKind: VapiCallArtifactKind;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}) {
  const privateKey = getVapiPrivateKey();
  const url = buildVapiCallArtifactUrl(callId, artifactKind);
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${privateKey}`,
    },
    redirect: 'follow',
    signal,
  });

  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '';
    }
    const detail = body ? `: ${body.slice(0, 300)}` : '';
    throw new VapiArtifactError(
      `Vapi artifact download failed with status ${response.status}${detail}`,
      'VAPI_ARTIFACT_DOWNLOAD_FAILED',
      response.status,
    );
  }

  const contentLength = response.headers.get('content-length');

  return {
    arrayBuffer: await response.arrayBuffer(),
    contentType: response.headers.get('content-type'),
    contentLength: contentLength ? Number.parseInt(contentLength, 10) : null,
    finalUrl: response.url || url,
  };
}
