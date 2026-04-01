import Link from 'next/link';
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout';
import { APP_NAME, APP_SUPPORT_EMAIL, APP_SUPPORT_PATH } from '@/lib/brand';

const sections = [
  { id: 'scope', title: 'Scope and roles' },
  { id: 'data-we-collect', title: 'Information we collect' },
  { id: 'how-we-use', title: 'How we use information' },
  { id: 'sharing', title: 'How information is shared' },
  { id: 'retention-security', title: 'Retention and security' },
  { id: 'rights', title: 'Privacy rights and choices' },
  { id: 'children', title: 'Children and sensitive data' },
  { id: 'changes-contact', title: 'Changes and contact' },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How Clientific collects, uses, stores, and discloses information for its website, dashboard, iPhone app, booking flows, messaging, AI receptionist, and payouts."
      lastUpdated="April 1, 2026"
      sections={sections}
      secondaryCtaHref="/terms"
      secondaryCtaLabel="View Terms"
    >
      <LegalSection id="scope" title="1. Scope and roles">
        <p>
          This Privacy Policy explains how {APP_NAME} collects, uses, and discloses information when you use
          our website, dashboard, iPhone app, booking flows, messaging tools, AI receptionist features, and
          payout tools.
        </p>
        <p>
          In most cases, {APP_NAME} acts as the provider of the software platform used by service businesses.
          When a business stores or uses customer information in {APP_NAME}, that business is responsible for
          its relationship with its customers, including obtaining any notices, consents, and permissions
          required by law.
        </p>
        <p>
          We may act as a business, service provider, processor, or similar role depending on the nature of the
          data and the law that applies. If you are a customer of a business using {APP_NAME} and want to make
          a request about your appointment history, customer profile, or marketing preferences, you should also
          contact that business directly.
        </p>
      </LegalSection>

      <LegalSection id="data-we-collect" title="2. Information we collect">
        <p>We collect information in the following categories:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Business account information.</strong> Name, email address, password hash, business name,
            address, phone number, services, staff details, hours, subscription status, and support messages.
          </li>
          <li>
            <strong>Customer relationship data.</strong> Customer names, phone numbers, email addresses,
            appointments, visit history, notes, review requests, group membership, and messaging preferences
            entered by the business or submitted through booking flows.
          </li>
          <li>
            <strong>Communications data.</strong> SMS consent records, opt-out events, message delivery data,
            email delivery data, support correspondence, and other communication logs needed to operate the
            service.
          </li>
          <li>
            <strong>AI receptionist and call data.</strong> If enabled by the business, inbound caller phone
            numbers, call metadata, recordings, transcripts, call outcomes, and related appointment booking data.
          </li>
          <li>
            <strong>Billing and payout data.</strong> Subscription plan details, billing history, connected
            Stripe account identifiers, payout status information, and transaction metadata. Payment card data is
            processed by our payment providers and is not stored by us in full.
          </li>
          <li>
            <strong>Technical and usage data.</strong> IP address, browser type, device information, pages
            visited, referral URLs, session activity, cookies, and similar technologies used for security,
            authentication, analytics, and product performance.
          </li>
          <li>
            <strong>Mobile app session data.</strong> If you use the iPhone app, we may store an authentication
            token in secure device storage to keep you signed in and to reopen your account on that device.
          </li>
        </ul>
        <p>
          We collect information directly from you, from businesses and customers using the platform, from your
          browser or device, and from service providers that support billing, messaging, hosting, and
          communications.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" title="3. How we use information">
        <p>We use information to operate and improve the platform, including to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>create and manage accounts, authenticate users, and secure access to the platform;</li>
          <li>keep returning mobile app sessions signed in on a device you already authorized;</li>
          <li>power booking pages, customer records, appointment reminders, and review flows;</li>
          <li>send transactional SMS and email communications requested by businesses or triggered by bookings;</li>
          <li>enable optional deal, referral, and promotional messaging workflows where consent and settings allow;</li>
          <li>operate the optional AI receptionist, including generating automated responses and call handling;</li>
          <li>process subscriptions, payouts, transaction records, and fraud-prevention checks;</li>
          <li>troubleshoot issues, monitor abuse, and enforce our Terms of Service; and</li>
          <li>analyze performance, maintain reliability, and develop new features.</li>
        </ul>
        <p>
          Where required by law, we rely on appropriate legal bases such as performing a contract, complying
          with legal obligations, pursuing legitimate interests, or acting on consent.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="4. How information is shared">
        <p>
          We do not sell personal information for money. We also do not share personal information for
          cross-context behavioral advertising.
        </p>
        <p>We may disclose information in the following circumstances:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Service providers and infrastructure partners.</strong> We use providers for hosting,
            databases, payment processing, connected-account payouts, email delivery, SMS and telephony,
            AI model processing, and related technical operations.
          </li>
          <li>
            <strong>Businesses using the platform.</strong> Customer-facing booking, messaging, and appointment
            information is available to the business that owns the account or workflow involved.
          </li>
          <li>
            <strong>Legal compliance and protection.</strong> We may disclose information where reasonably
            necessary to comply with law, enforce agreements, protect users or the public, or investigate fraud
            or misuse.
          </li>
          <li>
            <strong>Corporate transactions.</strong> Information may be disclosed as part of a merger,
            acquisition, financing, reorganization, or sale of assets, subject to applicable confidentiality and
            legal obligations.
          </li>
        </ul>
        <p>
          We require service providers acting on our behalf to process personal information only as needed to
          support the service and under protections designed to provide a level of privacy and security
          consistent with this Privacy Policy.
        </p>
        <p>
          Businesses are responsible for the messages they choose to send through the platform and for ensuring
          they have the necessary permissions to use customer information for those messages.
        </p>
      </LegalSection>

      <LegalSection id="retention-security" title="5. Retention and security">
        <p>
          We retain information for as long as reasonably necessary to provide the service, maintain account
          records, comply with legal obligations, resolve disputes, and enforce agreements. Retention periods may
          vary depending on the type of data and the business workflow involved.
        </p>
        <p>
          We use administrative, technical, and organizational safeguards designed to protect information,
          including access controls, encryption in transit, password hashing, logging, and vendor-based security
          controls. No system is perfectly secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="6. Privacy rights and choices">
        <p>You may have rights under applicable privacy laws, including the right to request:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>access to the personal information we hold about you;</li>
          <li>correction of inaccurate personal information;</li>
          <li>deletion of personal information, subject to legal exceptions;</li>
          <li>a portable copy of certain personal information; and</li>
          <li>information about how we collect, use, and disclose personal information.</li>
        </ul>
        <p>
          California residents may also have rights under the California Consumer Privacy Act, as amended by the
          CPRA, including rights to know, delete, correct, and limit certain uses of sensitive personal
          information where applicable.
        </p>
        <p>
          If you are an end customer of a business using {APP_NAME}, some requests should be directed to that
          business first because it controls the underlying customer relationship data.
        </p>
        <p>
          To exercise a request, contact us at{' '}
          <Link href={APP_SUPPORT_PATH} className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200">
            {APP_SUPPORT_EMAIL}
          </Link>
          . We may need to verify your identity before completing a request.
        </p>
        <p>
          You can also opt out of marketing emails by using the unsubscribe link in the message, and recipients
          of SMS can use STOP or other supported opt-out keywords where applicable.
        </p>
      </LegalSection>

      <LegalSection id="children" title="7. Children and sensitive data">
        <p>
          {APP_NAME} is intended for business use and is not directed to children under 13. We do not knowingly
          collect personal information directly from children under 13 through our own consumer-facing services.
        </p>
        <p>
          Businesses should not use the platform to collect or process sensitive information unless it is
          necessary, lawful, and properly disclosed. We ask businesses not to store highly sensitive personal
          information in free-form notes or other fields unless clearly required for their operations and allowed
          by law.
        </p>
      </LegalSection>

      <LegalSection id="changes-contact" title="8. Changes and contact">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will post the updated version on
          this page and revise the &quot;Last updated&quot; date above. Material changes may also be communicated through the
          platform or by email where appropriate.
        </p>
        <p>
          Questions about this Privacy Policy can be sent to{' '}
          <Link href={APP_SUPPORT_PATH} className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200">
            {APP_SUPPORT_EMAIL}
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
