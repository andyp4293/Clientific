export interface AiReceptionistSetupFields {
  aiReceptionistEnabled?: boolean;
  vapiPhoneNumber?: string | null;
  smsAiPhoneNumber?: string | null;
}

export const AI_RECEPTIONIST_ACTIVATION_WINDOW_MS = 2 * 60 * 1000;

export function getAiReceptionistActivationStorageKey(
  businessId?: string | null
): string | null {
  const id = businessId?.trim();
  if (!id) return null;
  return `clientific.aiReceptionist.activationUntil.${id}`;
}

export function readAiReceptionistActivationUntil(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  businessId?: string | null,
  nowMs = Date.now()
): Date | null {
  const key = getAiReceptionistActivationStorageKey(businessId);
  if (!key) return null;

  const raw = storage.getItem(key);
  if (!raw) return null;

  const until = new Date(raw);
  if (Number.isNaN(until.getTime()) || until.getTime() <= nowMs) {
    storage.removeItem(key);
    return null;
  }

  return until;
}

export function getAiReceptionistSetupState(
  formData: Partial<AiReceptionistSetupFields>,
  isPending: boolean,
  hasError = false
): { unifiedNumber: string; state: 'active' | 'pending' | 'error' } {
  const unifiedNumber = (formData.vapiPhoneNumber || formData.smsAiPhoneNumber || '').trim();
  if (unifiedNumber) {
    return { unifiedNumber, state: 'active' };
  }
  if (isPending) {
    return { unifiedNumber: '', state: 'pending' };
  }
  if (hasError) {
    return { unifiedNumber: '', state: 'error' };
  }
  if (formData.aiReceptionistEnabled) {
    return { unifiedNumber: '', state: 'pending' };
  }
  return { unifiedNumber: '', state: 'error' };
}
