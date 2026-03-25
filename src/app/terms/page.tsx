import Link from 'next/link';
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_SUPPORT_PATH } from '@/lib/brand';

const sections = [
  { id: 'acceptance', title: 'Acceptance and eligibility' },
  { id: 'service', title: 'Service scope' },
  { id: 'accounts-billing', title: 'Accounts, trials, and billing' },
  { id: 'customer-data', title: 'Customer data and compliance' },
  { id: 'messaging-ai', title: 'Messaging, telephony, and AI' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'ownership', title: 'Ownership and feedback' },
  { id: 'disclaimers-liability', title: 'Disclaimers and liability' },
  { id: 'termination', title: 'Termination and changes' },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="The rules for using Clientific, including subscriptions, messaging, AI receptionist, deals, and payouts."
      lastUpdated="March 25, 2026"
      sections={sections}
      secondaryCtaHref="/privacy"
      secondaryCtaLabel="View Privacy Policy"
    >
      <LegalSection id="acceptance" title="1. Acceptance and eligibility">
        <p>
          These Terms of Service govern your access to and use of {APP_NAME}. By creating an account, accessing
          the platform, or using our services, you agree to these Terms.
        </p>
        <p>
          You may use {APP_NAME} only if you can form a binding contract and are authorized to act on behalf of
          the business or organization using the account. If you do not agree to these Terms, do not use the
          service.
        </p>
      </LegalSection>

      <LegalSection id="service" title="2. Service scope">
        <p>
          {APP_NAME} provides software tools for service businesses, including booking flows, customer CRM,
          appointment management, reminders, deal and referral campaigns, business analytics, subscription
          billing, Stripe-connected payout workflows, and optional AI receptionist features.
        </p>
        <p>
          We may add, change, remove, or suspend features from time to time. Some features may depend on third
          party providers or availability in specific regions, devices, or plans.
        </p>
      </LegalSection>

      <LegalSection id="accounts-billing" title="3. Accounts, trials, and billing">
        <p>
          You must provide accurate, current information and keep your login credentials secure. You are
          responsible for all activity under your account and for promptly notifying us of unauthorized access.
        </p>
        <p>
          Clientific currently offers a 14-day free trial on self-serve plans. Trial availability, eligibility,
          and length may change at any time.
        </p>
        <p>Paid subscriptions are billed according to the plan and cadence you select. Unless required by law:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>subscription fees are charged in advance;</li>
          <li>fees are generally non-refundable;</li>
          <li>you authorize us and our payment providers to charge your selected payment method; and</li>
          <li>we may change pricing prospectively with notice.</li>
        </ul>
        <p>
          If you connect payouts or payment features, you may also be subject to the terms and requirements of
          the relevant payment providers, including Stripe.
        </p>
      </LegalSection>

      <LegalSection id="customer-data" title="4. Customer data and compliance">
        <p>
          As between you and {APP_NAME}, you retain your rights in the business and customer data you submit to
          the platform. You grant us the rights needed to host, process, transmit, display, and use that data to
          provide the service.
        </p>
        <p>You are responsible for your own compliance with laws that apply to your business, including laws about:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>consumer notices, privacy, and data protection;</li>
          <li>marketing consent, SMS and email compliance, and opt-out handling;</li>
          <li>promotions, discounts, referral incentives, and advertising claims;</li>
          <li>call recording and AI disclosure rules where applicable; and</li>
          <li>tax, labor, and industry-specific business requirements.</li>
        </ul>
        <p>
          You may not upload or use data you do not have the right to use. We may remove content or suspend
          activity that appears unlawful, abusive, or non-compliant.
        </p>
      </LegalSection>

      <LegalSection id="messaging-ai" title="5. Messaging, telephony, and AI">
        <p>
          {APP_NAME} supports appointment reminders, transactional messages, deal SMS messages, and other
          communications. You are responsible for choosing when to send messages and for making sure the
          recipients are eligible to receive them.
        </p>
        <p>
          Message delivery depends on carrier networks, telephony vendors, and other third parties. We do not
          guarantee delivery, timing, or availability of any message, call, or phone feature.
        </p>
        <p>
          If you enable the optional AI receptionist, calls may be answered by an automated system and may
          involve AI-generated responses, recordings, and transcripts. You are responsible for any caller-facing
          disclosures required by applicable law and for using the feature in a lawful, non-deceptive manner.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="6. Acceptable use">
        <p>You may not use the service to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>break the law or violate the rights of others;</li>
          <li>send spam, unlawful marketing, or deceptive communications;</li>
          <li>harvest data, scrape the service, or bypass platform protections;</li>
          <li>interfere with platform performance, security, or availability;</li>
          <li>reverse engineer or attempt to copy the service except where the law clearly permits it; or</li>
          <li>use the service in a way that could expose us, our users, or our providers to harm or liability.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ownership" title="7. Ownership and feedback">
        <p>
          {APP_NAME} and its software, design, branding, and underlying technology are owned by us or our
          licensors and are protected by intellectual property laws.
        </p>
        <p>
          If you send us feedback or suggestions, we may use them without restriction or compensation to you.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers-liability" title="8. Disclaimers and liability">
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law,
          we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, and any
          warranty that the service will be uninterrupted, error-free, secure, or suitable for your specific
          business needs.
        </p>
        <p>
          To the fullest extent permitted by law, {APP_NAME} will not be liable for any indirect, incidental,
          special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, goodwill,
          data, customers, or business opportunities.
        </p>
        <p>
          To the fullest extent permitted by law, our total liability for claims arising out of or related to the
          service will not exceed the amount you paid us for the service during the 12 months before the event
          giving rise to the claim.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="9. Termination and changes">
        <p>
          You may stop using the service at any time. We may suspend or terminate access if you violate these
          Terms, create risk for the platform or others, or if we are legally required to do so.
        </p>
        <p>
          We may update these Terms from time to time. When we do, we will post the revised version and update
          the &quot;Last updated&quot; date above. Continued use of the service after the updated Terms take effect means
          you accept the revised Terms.
        </p>
        <p>
          Questions about these Terms can be sent to{' '}
          <Link href={APP_SUPPORT_PATH} className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200">
            {APP_SUPPORT_EMAIL}
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
