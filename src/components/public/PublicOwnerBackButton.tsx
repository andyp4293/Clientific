'use client';

import { useRouter } from 'next/navigation';

type PublicOwnerBackButtonProps = {
  fallbackHref: string;
  label: string;
  className?: string;
};

export function PublicOwnerBackButton({
  fallbackHref,
  label,
  className = '',
}: PublicOwnerBackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline ${className}`.trim()}
    >
      <span aria-hidden="true">&larr;</span>
      {label}
    </button>
  );
}
