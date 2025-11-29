import React from "react";

export default function Privacy() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-semibold mb-6">Our Privacy Policy</h1>

        {/* Introduction */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Introduction</h2>
          <p>
            At <strong>Appliance Part Geeks</strong>, we value your privacy and
            are committed to protecting your personal information. This Privacy
            Policy explains how we collect, use, and protect your data when you
            visit our website.
          </p>
        </section>

        {/* Information We Collect */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <p>When you visit our website, we may collect the following information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Personal Information</strong> – Name, email address, phone
              number, and shipping/billing address when placing an order.
            </li>
            <li>
              <strong>Payment Information</strong> – We use <strong>PayPal</strong> as our payment
              gateway, meaning we do not store or process your credit card
              details directly.
            </li>
            <li>
              <strong>Browsing Data</strong> – We use <strong>Google Analytics</strong> to track
              website performance and user behavior, including IP address,
              device type, browser type, and referring pages.
            </li>
          </ul>
        </section>

        {/* How We Use Your Information */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">How We Use Your Information</h2>
          <p>We use the information collected for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Order Processing</strong> – To fulfill purchases and
              provide customer support.
            </li>
            <li>
              <strong>Website Improvement</strong> – To analyze traffic and
              optimize user experience using Google Analytics.
            </li>
            <li>
              <strong>Marketing</strong> – To send promotions or newsletters (only
              with user consent).
            </li>
          </ul>
        </section>

        {/* Google Analytics */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Google Analytics</h2>
          <p>
            We use <strong>Google Analytics</strong> to track visitor interactions and
            enhance website performance. Google may collect and process data in
            accordance with their{" "}
            <a
              className="text-amber-300 underline"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
          <p>
            You can opt out of Google Analytics tracking by using the{" "}
            <a
              className="text-amber-300 underline"
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Analytics Opt-Out Browser Add-on
            </a>
            .
          </p>
        </section>

        {/* PayPal Transactions */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">PayPal Transactions</h2>
          <p>
            Payments are processed securely through <strong>PayPal</strong>. We do not
            store credit card details on our servers. PayPal&apos;s data handling
            practices are outlined in their{" "}
            <a
              className="text-amber-300 underline"
              href="https://www.paypal.com/us/webapps/mpp/ua/privacy-full"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>

        {/* Data Protection & Security */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Data Protection &amp; Security</h2>
          <p>We take necessary measures to safeguard user data, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Using <strong>SSL encryption</strong> to secure data transmission.
            </li>
            <li>Restricting access to personal information.</li>
            <li>Ensuring payment data security through PayPal.</li>
          </ul>
        </section>

        {/* Cookies */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Cookies</h2>
          <p>
            Our website uses cookies to improve user experience. By continuing to
            browse, you consent to our cookie use. You can manage cookies through
            your browser settings.
          </p>
        </section>

        {/* GDPR */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">
            GDPR Compliance (For European Visitors)
          </h2>
          <p>
            If you are a resident of the European Economic Area (EEA), you have
            the following rights under the{" "}
            <strong>General Data Protection Regulation (GDPR)</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Right to Access</strong> – You can request a copy of the
              personal data we store.
            </li>
            <li>
              <strong>Right to Rectification</strong> – You may request
              corrections to inaccurate data.
            </li>
            <li>
              <strong>Right to Erasure</strong> – You can request your data be
              deleted (“Right to be Forgotten”).
            </li>
            <li>
              <strong>Right to Restrict Processing</strong> – You can limit how
              we use your data.
            </li>
            <li>
              <strong>Right to Object</strong> – You can opt out of direct
              marketing.
            </li>
          </ul>
          <p>
            If you wish to exercise any of these rights, please{" "}
            <a
              className="text-amber-300 underline"
              href="mailto:support@appliancepartgeeks.com"
            >
              contact us
            </a>
            .
          </p>
        </section>

        {/* Third-Party Disclosure */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Third-Party Disclosure</h2>
          <p>We do not sell, trade, or transfer your personal information to outside parties, except:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>To comply with legal requirements.</li>
            <li>To process payments via PayPal.</li>
            <li>To improve site analytics through Google services.</li>
          </ul>
        </section>

        {/* Your Rights */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Request access to the data we hold about you.</li>
            <li>Request corrections or deletion of your data.</li>
            <li>Opt out of marketing emails at any time.</li>
          </ul>
        </section>

        {/* Changes */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Changes to This Privacy Policy</h2>
          <p>
            We may update this policy as needed. Any changes will be posted on
            this page with an updated effective date.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold">Contact Us</h2>
          <p>If you have any questions regarding this Privacy Policy, please contact us at:</p>
          <p>
            <strong>Email:</strong>{" "}
            <a
              className="text-amber-300 underline"
              href="mailto:derek@appliancepartgeeks.com"
            >
              derek@appliancepartgeeks.com
            </a>
            <br />
            <strong>Address:</strong> 6101 Blair Rd NW Suite C, Washington, DC
            <br />
            <strong>Phone:</strong>{" "}
            <a
              className="text-amber-300 underline"
              href="tel:+12028821699"
            >
              (202)-882-1699
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
