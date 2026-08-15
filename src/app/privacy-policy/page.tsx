import type { Metadata } from "next";
import Link from "next/link";

import { LegalLayout } from "@/components/features/legal/LegalLayout";
import { LEGAL } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: `Privacy Policy | ${LEGAL.appName}`,
  description: `Read the Privacy Policy for ${LEGAL.appName}.`,
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: {LEGAL.effectiveDate}
      </p>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          1. Introduction
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {LEGAL.companyName} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the {LEGAL.appName}{" "}
          Service. This Privacy Policy explains how we collect, use, store, and
          share information when you use our website and services. By using the
          Service, you consent to the practices described in this policy.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          2. Information We Collect
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We collect the following types of information:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-muted-foreground">
          <li>
            <strong className="text-foreground">Account information:</strong>{" "}
            name, email address, and authentication credentials when you
            register or sign in.
          </li>
          <li>
            <strong className="text-foreground">Content:</strong> posts, media,
            drafts, and other material you create or upload for publishing.
          </li>
          <li>
            <strong className="text-foreground">Usage data:</strong> log data,
            device information, browser type, IP address, and pages visited.
          </li>
          <li>
            <strong className="text-foreground">Cookies and similar
            technologies:</strong> data collected through cookies and similar
            tracking technologies.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          3. How We Use Your Information
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We use the information we collect to:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-muted-foreground">
          <li>Provide, maintain, and improve the Service;</li>
          <li>Authenticate your account and secure the Service;</li>
          <li>Publish Content to the third-party platforms you authorize;</li>
          <li>Communicate with you about updates, support, and marketing;</li>
          <li>Monitor usage and analyze trends to improve user experience;</li>
          <li>Detect, prevent, and address fraud, abuse, and security issues.</li>
        </ul>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          4. Sharing Your Information
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We do not sell your personal information. We may share information in
          the following circumstances:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-muted-foreground">
          <li>
            <strong className="text-foreground">Service providers:</strong>{" "}
            trusted vendors who perform services on our behalf, such as hosting,
            analytics, and customer support.
          </li>
          <li>
            <strong className="text-foreground">Legal compliance:</strong>{" "}
            when required by law, regulation, or legal process.
          </li>
          <li>
            <strong className="text-foreground">Business transfers:</strong>{" "}
            in connection with a merger, acquisition, or sale of assets.
          </li>
          <li>
            <strong className="text-foreground">With your consent:</strong>{" "}
            when you explicitly authorize us to share information.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          5. Third-Party Integrations
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The Service integrates with third-party social media platforms. When
          you connect an account, we collect and store tokens and profile
          information necessary to publish Content on your behalf. Those
          platforms have their own privacy policies, and we encourage you to
          review them.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          6. Cookies and Tracking Technologies
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We use cookies and similar technologies to recognize you, remember your
          preferences, and understand how you use the Service. You can control
          cookies through your browser settings, but disabling cookies may affect
          certain features.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          7. Data Security
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We implement reasonable administrative, technical, and physical
          safeguards to protect your information. However, no method of
          transmission over the Internet or electronic storage is completely
          secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          8. Data Retention
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We retain your information for as long as your account is active or as
          needed to provide the Service, comply with legal obligations, resolve
          disputes, and enforce our agreements. You may request deletion of your
          account and associated data at any time.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          9. Your Rights
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Depending on your location, you may have the right to access, correct,
          delete, or restrict the processing of your personal information. You
          may also have the right to object to processing or request data
          portability. To exercise these rights, contact us at the email below.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          10. Children&apos;s Privacy
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The Service is not directed to children under the age of 13 (or the
          applicable age of majority in your jurisdiction). We do not knowingly
          collect personal information from children. If you believe we have
          collected information from a child, please contact us.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          11. International Transfers
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Your information may be transferred to and processed in countries other
          than the one in which you reside. We take appropriate measures to
          protect your information in accordance with this Privacy Policy and
          applicable law.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          12. Changes to This Policy
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We may update this Privacy Policy from time to time. We will notify you
          of material changes by posting the new policy on this page and updating
          the effective date. Your continued use of the Service after any changes
          constitutes acceptance of the revised policy.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          13. Contact Us
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          If you have any questions or concerns about this Privacy Policy, please
          contact us at{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="text-foreground underline underline-offset-4"
          >
            {LEGAL.contactEmail}
          </a>
          .
        </p>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          You can also review our{" "}
          <Link
            href="/terms-of-service"
            className="text-foreground underline underline-offset-4"
          >
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
