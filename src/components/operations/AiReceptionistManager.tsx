'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AI_RECEPTIONIST_ACTIVATION_WINDOW_MS,
  getAiReceptionistActivationStorageKey,
  getAiReceptionistSetupState,
  readAiReceptionistActivationUntil,
} from '@/lib/ai-receptionist-settings';

interface Business {
  id: string;
  name: string;
  aiReceptionistEnabled: boolean;
  aiReceptionistPhone: string | null;
  aiReceptionistGreeting: string | null;
  aiReceptionistFaq: { question: string; answer: string }[] | null;
  smsAiEnabled: boolean;
  smsAiPhoneNumber: string | null;
  smsAiGreeting: string | null;
  vapiPhoneNumber: string | null;
}

export default function AiReceptionistManager() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Business>>({});
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [activatingUntil, setActivatingUntil] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.business) {
      setFormData(data.business);
    }
  }, [data]);

  const business: Business | undefined = data?.business;
  const activationStorageKey = getAiReceptionistActivationStorageKey(formData.id ?? business?.id);

  const startActivationCountdown = useCallback(() => {
    const until = new Date(Date.now() + AI_RECEPTIONIST_ACTIVATION_WINDOW_MS);
    setActivatingUntil(until);
    if (typeof window !== 'undefined' && activationStorageKey) {
      window.localStorage.setItem(activationStorageKey, until.toISOString());
    }
  }, [activationStorageKey]);

  const clearActivationCountdown = useCallback(() => {
    setActivatingUntil(null);
    if (typeof window !== 'undefined' && activationStorageKey) {
      window.localStorage.removeItem(activationStorageKey);
    }
  }, [activationStorageKey]);

  useEffect(() => {
    if (!activatingUntil) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((activatingUntil.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setActivatingUntil(null);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activatingUntil]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Business>) => {
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update business');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-info'] });
      toast.success('AI receptionist settings saved!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save AI receptionist settings');
    },
  });

  const aiToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiReceptionistEnabled: enabled }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: (response) => {
      const nextBusiness = response.business;
      const newNumber = nextBusiness.vapiPhoneNumber ?? null;
      const unifiedNumber = (nextBusiness.vapiPhoneNumber || nextBusiness.smsAiPhoneNumber || '').trim();

      setFormData((prev) => ({
        ...prev,
        aiReceptionistEnabled: nextBusiness.aiReceptionistEnabled,
        vapiPhoneNumber: newNumber,
        smsAiEnabled: Boolean(nextBusiness.smsAiEnabled),
        smsAiPhoneNumber: nextBusiness.smsAiPhoneNumber ?? newNumber,
      }));

      if (nextBusiness.aiReceptionistEnabled && !unifiedNumber) {
        startActivationCountdown();
      } else {
        clearActivationCountdown();
      }

      queryClient.invalidateQueries({ queryKey: ['business-info'] });
    },
  });

  const handleInputChange = <K extends keyof Business>(field: K, value: Business[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEnableConfirm = () => {
    setShowEnableModal(false);
    setFormData((prev) => ({ ...prev, aiReceptionistEnabled: true }));
    startActivationCountdown();
    aiToggleMutation.mutate(true);
  };

  const handleDisableConfirm = () => {
    setShowDisableModal(false);
    setFormData((prev) => ({
      ...prev,
      aiReceptionistEnabled: false,
      vapiPhoneNumber: null,
      smsAiEnabled: false,
      smsAiPhoneNumber: null,
    }));
    clearActivationCountdown();
    aiToggleMutation.mutate(false);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persisted = readAiReceptionistActivationUntil(window.localStorage, data?.business?.id);
    if (persisted) {
      setActivatingUntil(persisted);
      return;
    }

    const unified = (data?.business?.vapiPhoneNumber || data?.business?.smsAiPhoneNumber || '').trim();
    if (!data?.business?.aiReceptionistEnabled || unified) {
      setActivatingUntil(null);
      const key = getAiReceptionistActivationStorageKey(data?.business?.id);
      if (key) {
        window.localStorage.removeItem(key);
      }
    }
  }, [
    data?.business?.id,
    data?.business?.aiReceptionistEnabled,
    data?.business?.smsAiPhoneNumber,
    data?.business?.vapiPhoneNumber,
  ]);

  const aiSetupState = getAiReceptionistSetupState(
    formData,
    aiToggleMutation.isPending,
    aiToggleMutation.isError
  );
  const unifiedBusinessAiNumber = aiSetupState.unifiedNumber;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          AI Receptionist
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your AI phone number, transfer routing, SMS booking, and FAQ answers.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              AI Phone Receptionist
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Let AI answer your business calls 24/7. It handles questions about services,
              hours, and pricing, and transfers to your personal phone if the caller asks
              to speak with a real person.
            </p>

            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.aiReceptionistEnabled ?? false}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setShowEnableModal(true);
                    } else {
                      setShowDisableModal(true);
                    }
                  }}
                  className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Enable AI Receptionist
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    A dedicated phone number will be set up for your business
                  </p>
                  {(formData.aiReceptionistEnabled ?? false) &&
                    !unifiedBusinessAiNumber &&
                    activatingUntil && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Setup in progress: {Math.floor(secondsLeft / 60)}:
                        {String(secondsLeft % 60).padStart(2, '0')} remaining
                      </p>
                    )}
                </div>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transfer-to Phone Number
              </label>

              <input
                type="tel"
                value={formData.aiReceptionistPhone || ''}
                onChange={(e) => handleInputChange('aiReceptionistPhone', e.target.value)}
                className="input"
                placeholder="(555) 123-4567"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When a caller asks for a real person, the AI will transfer the call here
                (for example, your personal cell).
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Greeting <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.aiReceptionistGreeting || ''}
                onChange={(e) => handleInputChange('aiReceptionistGreeting', e.target.value)}
                className="input"
                placeholder={`Hi, thank you for calling ${formData.name || 'us'}. How can I help you today?`}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave blank to use the default greeting above.
              </p>
            </div>

            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    SMS AI Booking
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Calls and booking texts share one business number.
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    (formData.smsAiEnabled ?? false) && !!unifiedBusinessAiNumber
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}
                >
                  {(formData.smsAiEnabled ?? false) && !!unifiedBusinessAiNumber
                    ? 'Active'
                    : 'Pending setup'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business AI Number (calls + booking SMS)
                  </label>
                  <input
                    type="tel"
                    value={unifiedBusinessAiNumber}
                    readOnly
                    className="input bg-gray-50 dark:bg-gray-800 text-sm font-mono"
                    placeholder="+18557654989"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Auto-generated when AI receptionist is enabled. This number is managed
                    by Clientific.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SMS Greeting <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.smsAiGreeting || ''}
                    onChange={(e) => handleInputChange('smsAiGreeting', e.target.value)}
                    className="input"
                    placeholder={`Hi from ${formData.name || 'our business'}. I can help you book by text.`}
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    FAQ <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Common questions the AI will answer on calls.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const faq = formData.aiReceptionistFaq ?? [];
                    setFormData((prev) => ({
                      ...prev,
                      aiReceptionistFaq: [...faq, { question: '', answer: '' }],
                    }));
                  }}
                  className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
              {(formData.aiReceptionistFaq ?? []).length === 0 ? (
                <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-4 py-6 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No FAQ entries yet. Click &quot;Add&quot; to create one.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(formData.aiReceptionistFaq ?? []).map((item, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800/50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-4 shrink-0">
                          Q
                        </span>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) => {
                            const faq = [...(formData.aiReceptionistFaq ?? [])];
                            faq[i] = { ...faq[i], question: e.target.value };
                            setFormData((prev) => ({ ...prev, aiReceptionistFaq: faq }));
                          }}
                          className="flex-1 bg-transparent text-sm font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none"
                          placeholder="e.g. Do you accept walk-ins?"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const faq = (formData.aiReceptionistFaq ?? []).filter((_, idx) => idx !== i);
                            setFormData((prev) => ({ ...prev, aiReceptionistFaq: faq }));
                          }}
                          className="p-1 rounded text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-start gap-3 px-3 py-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-4 shrink-0 mt-0.5">
                          A
                        </span>
                        <textarea
                          value={item.answer}
                          onChange={(e) => {
                            const faq = [...(formData.aiReceptionistFaq ?? [])];
                            faq[i] = { ...faq[i], answer: e.target.value };
                            setFormData((prev) => ({ ...prev, aiReceptionistFaq: faq }));
                          }}
                          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none resize-none"
                          rows={2}
                          placeholder="e.g. Yes, walk-ins are welcome when we have availability."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formData.aiReceptionistEnabled && (
              <div className="mb-6">
                {aiSetupState.state === 'active' ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                      Your AI Receptionist Number
                    </p>
                    {activatingUntil ? (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                          Activating - ready in {Math.floor(secondsLeft / 60)}:
                          {String(secondsLeft % 60).padStart(2, '0')}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                          Active - ready to receive calls
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={unifiedBusinessAiNumber}
                        readOnly
                        className="input flex-1 bg-white dark:bg-gray-800 text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(unifiedBusinessAiNumber);
                          toast.success('Copied to clipboard!');
                        }}
                        className="btn-outline whitespace-nowrap"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-3">
                      Update your Google Business Profile with this number. That is all you
                      need to do.
                    </p>
                    <details className="border border-green-200 dark:border-green-800 rounded-lg bg-white dark:bg-gray-800">
                      <summary className="px-3 py-2 cursor-pointer text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg">
                        Already have a number? Forward calls to this number
                      </summary>
                      <div className="px-3 pb-3 pt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <p><strong>iPhone:</strong> Settings -&gt; Phone -&gt; Call Forwarding -&gt; enter {unifiedBusinessAiNumber}</p>
                        <p><strong>Android:</strong> Phone app -&gt; Settings -&gt; Call Forwarding -&gt; Always forward -&gt; enter {unifiedBusinessAiNumber}</p>
                        <p><strong>Google Voice:</strong> Settings -&gt; Calls -&gt; Forward calls -&gt; Add forwarding number</p>
                        <p><strong>Other VoIP:</strong> Go to your provider&apos;s call forwarding or routing settings and enter {unifiedBusinessAiNumber}</p>
                      </div>
                    </details>
                  </div>
                ) : aiSetupState.state === 'pending' ? (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Setting up your AI receptionist number...
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activatingUntil
                          ? `Activation can take up to 2 minutes (${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} remaining).`
                          : 'Activation can take up to 2 minutes.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                      Setup did not complete.
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                      {aiToggleMutation.error?.message || 'Your AI receptionist number could not be created.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => aiToggleMutation.mutate(true)}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={() => {
            setFormData(business || {});
          }}
          className="btn-outline"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {showEnableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary dark:text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Enable AI Receptionist
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You&apos;re about to set up an AI phone receptionist for <strong>{formData.name}</strong>.
            </p>
            <ul className="space-y-2 mb-4">
              {[
                'A dedicated phone number will be created in your area code',
                'The AI answers calls 24/7 and handles questions about services, hours, and pricing',
                'Callers can book appointments directly over the phone',
                'Transfers to your personal number when someone asks for a real person',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-6">
              Once enabled, update your Google Business Profile with the new number. That is all you need to do.
            </p>
            {aiToggleMutation.isError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                {aiToggleMutation.error?.message}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowEnableModal(false)} className="btn-outline flex-1">
                Cancel
              </button>
              <button
                onClick={handleEnableConfirm}
                disabled={aiToggleMutation.isPending}
                className="btn-primary flex-1"
              >
                {aiToggleMutation.isPending ? 'Setting up...' : 'Enable AI Receptionist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Disable AI Receptionist?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will release your dedicated number
              {formData.vapiPhoneNumber ? <> <strong>{formData.vapiPhoneNumber}</strong></> : ''}.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Any customers who have this number saved will no longer reach your AI receptionist.
            </p>
            {aiToggleMutation.isError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                {aiToggleMutation.error?.message}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowDisableModal(false)} className="btn-outline flex-1">
                Keep it enabled
              </button>
              <button
                onClick={handleDisableConfirm}
                disabled={aiToggleMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {aiToggleMutation.isPending ? 'Disabling...' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
