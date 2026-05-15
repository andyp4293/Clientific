'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

type StaffSetPasswordFormProps = {
  email: string;
};

export function StaffSetPasswordForm({ email }: StaffSetPasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/staff/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update password.');
      }

      const signInResult = await signIn('credentials', {
        email,
        password: newPassword,
        redirect: false,
      });
      if (signInResult?.error) {
        throw new Error('Password saved. Please sign in again with your new password.');
      }

      window.location.assign('/staff/appointments');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update password.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">
          Temporary password
        </label>
        <input
          autoComplete="current-password"
          className="input w-full"
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Paste the temporary password from your email"
          type="password"
          value={currentPassword}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">
          New password
        </label>
        <input
          autoComplete="new-password"
          className="input w-full"
          minLength={8}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="At least 8 characters"
          type="password"
          value={newPassword}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">
          Confirm new password
        </label>
        <input
          autoComplete="new-password"
          className="input w-full"
          minLength={8}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Type the new password again"
          type="password"
          value={confirmPassword}
        />
      </div>

      <button
        className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? 'Saving password...' : 'Create password'}
      </button>
    </form>
  );
}
