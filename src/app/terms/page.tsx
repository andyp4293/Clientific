import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-primary hover:text-primary-700 font-medium mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-600">Last updated: February 13, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-blue max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing and using ClientFlow ("Service"), you accept and agree to be bound by the terms and 
              provision of this agreement. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed">
              ClientFlow provides a SaaS platform for review management, customer tracking, and booking services 
              for service-based businesses. We reserve the right to modify, suspend, or discontinue the Service 
              at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
            <div className="text-gray-700 leading-relaxed space-y-2">
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
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Free Trial</h2>
            <p className="text-gray-700 leading-relaxed">
              ClientFlow offers a 14-day free trial. After the trial period, you must choose a paid subscription 
              plan to continue using the Service. We reserve the right to modify or cancel free trials at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Payment Terms</h2>
            <div className="text-gray-700 leading-relaxed space-y-2">
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
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Usage</h2>
            <p className="text-gray-700 leading-relaxed">
              You retain all rights to the data you input into ClientFlow. We will not sell, share, or use your 
              customer data for any purpose other than providing the Service. See our Privacy Policy for details 
              on how we handle your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Acceptable Use</h2>
            <div className="text-gray-700 leading-relaxed space-y-2">
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
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service and its original content, features, and functionality are owned by ClientFlow and are 
              protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for any breach of these 
              Terms. Upon termination, your right to use the Service will cease immediately. You may also cancel 
              your subscription at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              ClientFlow shall not be liable for any indirect, incidental, special, consequential, or punitive 
              damages resulting from your use or inability to use the Service. Our total liability shall not 
              exceed the amount you paid us in the last 12 months.
            </p>
          </section>          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. SMS/Text Messaging Terms</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <h3 className="font-semibold text-gray-900 mt-4">Consent to Receive SMS Messages</h3>
              <p>
                By providing your mobile phone number and checking the SMS consent box when booking an appointment, 
                you expressly consent to receive automated text messages from ClientFlow and the business you are 
                booking with regarding your appointment. This includes appointment confirmations, reminders, and 
                cancellation notifications.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">Message Frequency</h3>
              <p>
                Message frequency varies depending on your appointments. You may receive up to 3 messages per appointment:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>One confirmation message when you book</li>
                <li>One or more reminder messages before your appointment</li>
                <li>One cancellation message if your appointment is cancelled</li>
              </ul>

              <h3 className="font-semibold text-gray-900 mt-4">Message and Data Rates</h3>
              <p>
                Message and data rates may apply. The number of messages you receive will depend on how often you 
                book appointments. Standard messaging rates from your wireless carrier will apply.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">How to Opt-Out</h3>
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

              <h3 className="font-semibold text-gray-900 mt-4">Help and Support</h3>
              <p>
                If you need help or have questions about SMS notifications, reply <strong>HELP</strong> to any 
                message or contact us at{' '}
                <a href="mailto:support@clientflow.com" className="text-primary hover:text-primary-700">
                  support@clientflow.com
                </a>
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">Carrier Liability</h3>
              <p>
                Carriers are not liable for delayed or undelivered messages. We are not responsible for any delays 
                or failures in message delivery, or for messages sent to an incorrect phone number you provided.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">Supported Carriers</h3>
              <p>
                Our SMS service works with all major U.S. carriers including AT&T, T-Mobile, Verizon, Sprint, 
                and many regional carriers. International SMS availability may vary.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">Privacy</h3>
              <p>
                Your phone number and SMS consent status will be stored securely and used only for appointment 
                notifications. We will never sell or share your phone number with third parties for marketing 
                purposes. See our Privacy Policy for more details.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify you of any changes by 
              posting the new Terms of Service on this page and updating the "Last updated" date. Your continued 
              use of the Service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
              <br />
              <a href="mailto:support@clientflow.com" className="text-primary hover:text-primary-700">
                support@clientflow.com
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
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
