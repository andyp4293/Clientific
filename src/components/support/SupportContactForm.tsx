'use client';

import { FormEvent, useState } from 'react';

type SupportFormData = {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  website: string;
};

const INITIAL_FORM: SupportFormData = {
  name: '',
  email: '',
  company: '',
  subject: '',
  message: '',
  website: '',
};

export function SupportContactForm() {
  const [formData, setFormData] = useState<SupportFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateField<K extends keyof SupportFormData>(field: K, value: SupportFormData[K]) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || 'We could not send your message right now.');
        return;
      }

      setSuccess('Your message has been sent to support. We will follow up by email.');
      setFormData(INITIAL_FORM);
    } catch {
      setError('We could not send your message right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card rounded-[28px] p-6 sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          Contact Support
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-gray-950 dark:text-white">
          Send a message
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
          Share the details and the message will be delivered to our support inbox.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-name" className="label">
            Name
          </label>
          <input
            id="support-name"
            name="name"
            type="text"
            autoComplete="name"
            className="input"
            value={formData.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>

        <div>
          <label htmlFor="support-email" className="label">
            Email
          </label>
          <input
            id="support-email"
            name="email"
            type="email"
            autoComplete="email"
            className="input"
            value={formData.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="support-company" className="label">
            Company
          </label>
          <input
            id="support-company"
            name="company"
            type="text"
            autoComplete="organization"
            className="input"
            value={formData.company}
            onChange={(event) => updateField('company', event.target.value)}
            placeholder="Your business name"
          />
        </div>

        <div>
          <label htmlFor="support-subject" className="label">
            Subject
          </label>
          <input
            id="support-subject"
            name="subject"
            type="text"
            className="input"
            value={formData.subject}
            onChange={(event) => updateField('subject', event.target.value)}
            placeholder="Billing, bug report, account question"
          />
        </div>
      </div>

      <div className="mt-4 hidden" aria-hidden="true">
        <label htmlFor="support-website" className="label">
          Website
        </label>
        <input
          id="support-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          className="input"
          value={formData.website}
          onChange={(event) => updateField('website', event.target.value)}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="support-message" className="label">
          Message
        </label>
        <textarea
          id="support-message"
          name="message"
          className="input min-h-[180px] resize-y"
          value={formData.message}
          onChange={(event) => updateField('message', event.target.value)}
          placeholder="Tell us what you need help with."
          required
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-700 dark:text-primary-200"
        >
          {success}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Use this for account help, billing questions, bugs, or anything else you need.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary min-w-[180px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </form>
  );
}
