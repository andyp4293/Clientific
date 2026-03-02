import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-primary hover:text-primary-700 font-medium mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-600">Last updated: February 13, 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-blue max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Clientell ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.1 Account Information</h3>
            <div className="text-gray-700 leading-relaxed space-y-2">
              <p>When you register for Clientell, we collect:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Business name and contact information</li>
                <li>Email address</li>
                <li>Password (encrypted)</li>
                <li>Business address and phone number</li>
                <li>Payment information (processed securely through Stripe)</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.2 Customer Data</h3>
            <p className="text-gray-700 leading-relaxed">
              You input customer information into our Service, including:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Customer names and contact details</li>
              <li>Visit history and check-ins</li>
              <li>Reviews and ratings</li>
              <li>Loyalty points and rewards</li>
              <li>Appointment information</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.3 Usage Information</h3>
            <p className="text-gray-700 leading-relaxed">
              We automatically collect certain information when you use our Service:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Device information</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Usage patterns and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <div className="text-gray-700 leading-relaxed space-y-2">
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process your transactions and send confirmations</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, prevent, and address technical issues and fraud</li>
                <li>Send marketing communications (with your consent)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">4.1 We Do NOT Sell Your Data</h3>
            <p className="text-gray-700 leading-relaxed">
              We will never sell, rent, or trade your personal information or customer data to third parties for 
              marketing purposes.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">4.2 Service Providers</h3>
            <p className="text-gray-700 leading-relaxed">
              We may share your information with trusted third-party service providers:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700">
              <li><strong>Stripe</strong> - Payment processing</li>
              <li><strong>Twilio</strong> - SMS messaging</li>
              <li><strong>Resend</strong> - Email delivery</li>
              <li><strong>Neon/Vercel</strong> - Database and hosting</li>
              <li><strong>Mapbox</strong> - Address autocomplete</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-2">
              These providers are contractually obligated to protect your data and use it only for the services 
              they provide to us.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">4.3 Legal Requirements</h3>
            <p className="text-gray-700 leading-relaxed">
              We may disclose your information if required by law or in response to valid requests by public 
              authorities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
            <div className="text-gray-700 leading-relaxed space-y-2">
              <p>We implement industry-standard security measures to protect your data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>SSL/TLS encryption for data in transit</li>
                <li>Encrypted passwords using bcrypt</li>
                <li>Secure database with access controls</li>
                <li>Regular security audits and updates</li>
                <li>Limited employee access to personal data</li>
              </ul>
              <p className="mt-2">
                However, no method of transmission over the Internet is 100% secure. While we strive to protect 
                your data, we cannot guarantee absolute security.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide you services. 
              If you close your account, we will delete your data within 30 days, except where we are required to 
              retain it for legal or compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights</h2>
            <div className="text-gray-700 leading-relaxed space-y-2">
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Access</strong> - Request a copy of your personal data</li>
                <li><strong>Correction</strong> - Update or correct inaccurate information</li>
                <li><strong>Deletion</strong> - Request deletion of your account and data</li>
                <li><strong>Export</strong> - Download your customer data</li>
                <li><strong>Opt-out</strong> - Unsubscribe from marketing emails</li>
                <li><strong>Object</strong> - Object to certain data processing activities</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:privacy@clientell.io" className="text-primary hover:text-primary-700">
                  privacy@clientell.io
                </a>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking</h2>
            <p className="text-gray-700 leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our Service and hold certain 
              information. You can instruct your browser to refuse all cookies or to indicate when a cookie is 
              being sent. However, some parts of our Service may not function properly without cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Our Service is not intended for users under the age of 18. We do not knowingly collect personal 
              information from children. If you become aware that a child has provided us with personal data, 
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Users</h2>
            <p className="text-gray-700 leading-relaxed">
              Your information may be transferred to and maintained on servers located outside of your state, 
              province, country, or other governmental jurisdiction where data protection laws may differ. By 
              using our Service, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. GDPR Compliance</h2>
            <p className="text-gray-700 leading-relaxed">
              If you are located in the European Economic Area (EEA), you have certain data protection rights 
              under GDPR. We process your data based on:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-gray-700 mt-2">
              <li>Your consent</li>
              <li>Performance of our contract with you</li>
              <li>Compliance with legal obligations</li>
              <li>Our legitimate business interests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. CCPA Compliance</h2>
            <p className="text-gray-700 leading-relaxed">
              If you are a California resident, you have specific rights under the California Consumer Privacy Act 
              (CCPA), including the right to know what personal information we collect and the right to request 
              deletion of your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to 
              review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="text-gray-700 leading-relaxed mt-2">
              <p>Email: <a href="mailto:privacy@clientell.io" className="text-primary hover:text-primary-700">privacy@clientell.io</a></p>
              <p>Support: <a href="mailto:support@clientell.io" className="text-primary hover:text-primary-700">support@clientell.io</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <Link href="/terms" className="text-primary hover:text-primary-700 font-medium">
              Terms of Service →
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
