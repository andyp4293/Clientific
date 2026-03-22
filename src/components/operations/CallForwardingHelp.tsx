'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { APP_SUPPORT_PATH } from '@/lib/brand';

type CallForwardingHelpProps = {
  forwardingNumber: string;
  iphoneForwardingCode: string;
};

type ForwardingOption = {
  title: string;
  steps: ReactNode[];
};

const optionTitleClass = 'text-lg font-semibold text-gray-950 dark:text-white';
const optionTextClass = 'text-sm leading-6 text-gray-700 dark:text-gray-300';
const stepBadgeClass =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary';

function StepList({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-3">
      {steps.map((step, index) => (
        <li key={index} className={`flex items-start gap-3 ${optionTextClass}`}>
          <span className={stepBadgeClass}>{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ToggleChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${
        open ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
    </svg>
  );
}

export function CallForwardingHelp({
  forwardingNumber,
  iphoneForwardingCode,
}: CallForwardingHelpProps) {
  const [showForwardingSteps, setShowForwardingSteps] = useState(false);
  const [showDisableSteps, setShowDisableSteps] = useState(false);

  const options: ForwardingOption[] = [
    {
      title: 'iPhone',
      steps: [
        'Open your Phone app',
        <>
          Dial exactly this:
          <span className="mt-2 block rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            {iphoneForwardingCode}
          </span>
        </>,
        'Press the green call button',
        'If a confirmation screen appears, tap Dismiss. You are done.',
      ],
    },
    {
      title: 'Android',
      steps: [
        'Open your Phone app',
        'Tap the 3 dots (menu) in the top right corner',
        'Tap Settings > Call Forwarding > Always Forward',
        <>
          Type in{' '}
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
            {forwardingNumber}
          </span>{' '}
          and save. You are done.
        </>,
      ],
    },
    {
      title: 'Landline',
      steps: [
        'Pick up your phone',
        <>
          Dial{' '}
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">*72</span>
        </>,
        <>
          Wait for a stutter dial tone, then dial{' '}
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
            {forwardingNumber}
          </span>
        </>,
        'Wait for a confirmation tone. You are done.',
      ],
    },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-green-200 bg-white/70 dark:border-green-800 dark:bg-gray-900/40">
      <button
        type="button"
        onClick={() => setShowForwardingSteps((current) => !current)}
        aria-expanded={showForwardingSteps}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-950 dark:text-white">
            How to forward calls to this number
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Open for simple steps if you already have a business phone number.
          </p>
        </div>
        <ToggleChevron open={showForwardingSteps} />
      </button>

      {showForwardingSteps ? (
        <div className="border-t border-green-200 px-4 pb-4 pt-4 dark:border-green-800">
          <p className="text-base font-semibold text-gray-950 dark:text-white">
            Want all calls to go straight to your AI receptionist? Follow the steps for your
            phone type below.
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white/70 dark:border-gray-700 dark:bg-gray-950/30">
            <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-gray-200 dark:lg:divide-gray-700">
              {options.map((option, index) => (
                <section
                  key={option.title}
                  className={`p-4 ${index > 0 ? 'border-t border-gray-200 dark:border-gray-700 lg:border-t-0' : ''}`}
                >
                  <h4 className={optionTitleClass}>{option.title}</h4>
                  <StepList steps={option.steps} />
                </section>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white/60 dark:border-gray-700 dark:bg-gray-950/20">
            <button
              type="button"
              onClick={() => setShowDisableSteps((current) => !current)}
              aria-expanded={showDisableSteps}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-gray-950 dark:text-white">
                How to turn off forwarding
              </span>
              <ToggleChevron open={showDisableSteps} />
            </button>

            {showDisableSteps ? (
              <div className="grid border-t border-gray-200 lg:grid-cols-3 lg:divide-x lg:divide-gray-200 dark:border-gray-700 dark:lg:divide-gray-700">
                <div className="p-4 text-sm text-gray-700 dark:text-gray-300">
                  <p className="font-semibold text-gray-950 dark:text-white">iPhone</p>
                  <p className="mt-2">
                    Dial{' '}
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      ##21#
                    </span>{' '}
                    and press call
                  </p>
                </div>
                <div className="border-t border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300 lg:border-t-0">
                  <p className="font-semibold text-gray-950 dark:text-white">Android</p>
                  <p className="mt-2">
                    Go back to Call Forwarding settings and tap &quot;Disable&quot;
                  </p>
                </div>
                <div className="border-t border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300 lg:border-t-0">
                  <p className="font-semibold text-gray-950 dark:text-white">Landline</p>
                  <p className="mt-2">
                    Dial{' '}
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                      *73
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href={APP_SUPPORT_PATH}
            className="mt-4 inline-flex text-xs font-medium text-primary hover:underline"
          >
            Need help? Contact support
          </Link>
        </div>
      ) : null}
    </div>
  );
}
