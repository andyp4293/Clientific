import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public business profile page source', () => {
  it('removes legacy cluttered sections and keeps a single booking CTA label', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('Back to Booking');
    expect(source).not.toContain('Booking Policies');
    expect(source).not.toContain('Quick Facts');
    expect(source).not.toContain('Need Help?');
    expect(source.match(/Book Appointment/g)?.length ?? 0).toBe(1);
  });

  it('does not render timezone details in the public contact card', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('Globe2');
    expect(source).not.toContain('{business.timezone}');
  });

  it('only shows location details in the public sidebar', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('Location');
    expect(source).toContain('Customer Feedback');
    expect(source).toContain('Leave feedback');
    expect(source).toContain("href={`/feedback/${business.publicId ?? business.slug}`}");
    expect(source).not.toContain('mailto:');
    expect(source).not.toContain('tel:');
    expect(source).not.toContain('Mail');
    expect(source).not.toContain('Phone');
  });

  it('uses the shared primary button style for the booking CTA', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('className="btn-primary px-5 py-3 font-semibold"');
    expect(source).not.toContain('bg-white text-gray-900 font-semibold hover:bg-primary-50');
  });

  it('uses the shared owner back button with viewer-aware access', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('PublicOwnerBackButton');
    expect(source).toContain('const viewerCanManage = businessData?.viewerCanManage === true;');
    expect(source).not.toContain('useSession');
  });

  it('surfaces staff bios on the public team profile', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('bio: string | null');
    expect(source).toContain('member.bio');
  });
});
