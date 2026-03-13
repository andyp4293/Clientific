import Link from 'next/link';
import { APP_NAME, APP_SUPPORT_EMAIL } from '@/lib/brand';

export default function TermsOfServicePage() {
  return (
    <div className="brand-shell min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="brand-panel max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-primary hover:text-primary-700 font-medium mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">Terms of Service</h1>
          <p className="text-gray-700 dark:text-gray-100">Last updated: March 6, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              By accessing and using {APP_NAME} (&quot;Service&quot;), you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">2. Description of Service</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              {APP_NAME} provides a SaaS platform for service-based businesses, including: appointment booking and
              management, customer relationship management, online booking pages, SMS appointment reminders, an
              AI-powered phone receptionist (automated voice system), deals and promotions management, loyalty
              points tracking, and business analytics. We reserve the right to modify, suspend, or discontinue
              the Service at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">3. User Accounts</h2>
            <div className="text-gray-800 dark:text-gray-100 leading-relaxed space-y-2">
              <p>When you create an account with us, you must provide accurate and complete information.</p>
              <p>You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Maintaining the security of your account and password</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">4. Free Trial</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              {APP_NAME} offers a 14-day free trial. After the trial period, you must choose a paid subscription
              plan to continue using the Service. We reserve the right to modify or cancel free trials at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">5. Payment Terms</h2>
            <div className="text-gray-800 dark:text-gray-100 leading-relaxed space-y-2">
              <p>Subscription fees are:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Billed monthly or annually based on your selected plan</li>
                <li>Non-refundable except as required by law</li>
                <li>Subject to change with 30 days notice</li>
                <li>Processed through secure third-party payment processors</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">6. Data Usage</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              You retain all rights to the data you input into {APP_NAME}. We will not sell, share, or use your
              customer data for any purpose other than providing the Service. See our Privacy Policy for details
              on how we handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">7. Acceptable Use</h2>
            <div className="text-gray-800 dark:text-gray-100 leading-relaxed space-y-2">
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Transmit viruses, malware, or harmful code</li>
                <li>Spam, harass, or send unsolicited messages through our Service</li>
                <li>Reverse engineer or copy our software</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">8. Intellectual Property</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              The Service and its original content, features, and functionality are owned by {APP_NAME} and are
              protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">9. Termination</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for any breach of these 
              Terms. Upon termination, your right to use the Service will cease immediately. You may also cancel 
              your subscription at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">10. Limitation of Liability</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              {APP_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages resulting from your use or inability to use the Service. Our total liability shall not
              exceed the amount you paid us in the last 12 months.
            </p>
          </section>          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">11. SMS/Text Messaging Terms</h2>
            <div className="text-gray-800 dark:text-gray-100 leading-relaxed space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Consent to Receive SMS Messages</h3>
              <p>
                By providing your mobile phone number and checking the SMS consent box when booking an appointment, 
                you expressly consent to receive automated text messages from {APP_NAME} and the business you are
                booking with regarding your appointment. This includes appointment confirmations, reminders, and
                cancellation notifications.
              </p>
              <p>
                Promotional or marketing SMS (such as deal alerts and limited-time offers) are sent only when you
                separately opt in to promotional messaging. You can opt out of any SMS category at any time by
                replying STOP.
              </p>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Message Frequency</h3>
              <p>
                Message frequency varies depending on your appointments. You may receive up to 3 messages per appointment:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>One confirmation message when you book</li>
                <li>One or more reminder messages before your appointment</li>
                <li>One cancellation message if your appointment is cancelled</li>
              </ul>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Message and Data Rates</h3>
              <p>
                Message and data rates may apply. The number of messages you receive will depend on how often you 
                book appointments. Standard messaging rates from your wireless carrier will apply.
              </p>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">How to Opt-Out</h3>
              <p>
                You can opt-out of SMS notifications at any time by:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Replying <strong>STOP</strong> to any text message you receive from us</li>
                <li>Contacting the business directly to request removal from SMS notifications</li>
              </ul>
              <p className="mt-2">
                After you send the SMS message "STOP" to us, we will send you an SMS message to confirm that you 
                have been unsubscribed. You will no longer receive SMS messages from us unless you re-opt-in.
              </p>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Help and Support</h3>
              <p>
                If you need help or have questions about SMS notifications, reply <strong>HELP</strong> to any 
                message or contact us at{' '}
                <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="text-primary hover:text-primary-700">
                  {APP_SUPPORT_EMAIL}
                </a>
              </p>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Carrier Liability</h3>
              <p>
                Carriers are not liable for delayed or undelivered messages. We are not responsible for any delays 
                or failures in message delivery, or for messages sent to an incorrect phone number you provided.
              </p>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Supported Carriers</h3>
              <p>
                Our SMS service works with all major U.S. carriers including AT&T, T-Mobile, Verizon, Sprint, 
                and many regional carriers. International SMS availability may vary.
              </p>

              <h3 className="font-semibold text-gray-900 dark:text-gray-50 mt-4">Privacy</h3>
              <p>
                Your phone number and SMS consent status will be stored securely and used only for appointment 
                notifications. We will never sell or share your phone number with third parties for marketing 
                purposes. See our Privacy Policy for more details.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">12. AI Phone Receptionist</h2>
            <div className="text-gray-800 dark:text-gray-100 leading-relaxed space-y-3">
              <p>
                {APP_NAME} offers an optional AI-powered phone receptionist feature. By enabling this feature, you agree to the following:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>A dedicated phone number will be provisioned for your business through our telephony provider</li>
                <li>Inbound calls will be answered by an automated AI voice system, not a human</li>
                <li>Call transcripts and recordings may be stored to improve the service and for your business records</li>
                <li>You are responsible for disclosing to your customers that calls may be answered by an automated AI system, as required by applicable law</li>
                <li>You may not use the AI receptionist to impersonate a human, deceive callers, or engage in any unlawful conduct</li>
                <li>The AI receptionist is provided &quot;as is&quot; and may not be available 100% of the time</li>
              </ul>
              <p>
                Voice generation and call infrastructure are provided by third-party service providers. Call data is processed under their applicable terms and privacy policies.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">13. Changes to Terms</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify you of any changes by 
              posting the new Terms of Service on this page and updating the "Last updated" date. Your continued 
              use of the Service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">14. Contact Us</h2>
            <p className="text-gray-800 dark:text-gray-100 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
              <br />
              <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="text-primary hover:text-primary-700">
                {APP_SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/privacy" className="text-primary hover:text-primary-700 font-medium">
              Privacy Policy →
            </Link>
            <Link href="/register" className="btn-primary">
              Start Your Free Trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

