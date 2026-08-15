import type { Metadata } from "next";
import Link from "next/link";

import { LegalLayout } from "@/components/features/legal/LegalLayout";
import { LEGAL } from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: `Terms of Service | ${LEGAL.appName}`,
  description: `Read the Terms of Service for ${LEGAL.appName}.`,
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated: {LEGAL.effectiveDate}
      </p>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          1. Agreement to Terms
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the{" "}
          {LEGAL.appName} website and services (the &quot;Service&quot;), operated by{" "}
          {LEGAL.companyName} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By accessing or using the
          Service, you agree to be bound by these Terms. If you do not agree, you
          may not use the Service.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          2. Changes to Terms
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We may modify these Terms at any time. If we make material changes, we
          will notify you by updating the effective date above or by providing
          notice through the Service. Your continued use of the Service after the
          changes become effective constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          3. Accounts and Security
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          To use certain features, you must create an account. You agree to
          provide accurate, current, and complete information and to keep it
          updated. You are responsible for safeguarding your account credentials
          and for all activity that occurs under your account. Notify us
          immediately of any unauthorized use.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          4. Your Content
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          You retain ownership of any text, images, video, or other material you
          submit to the Service (&quot;Content&quot;). By submitting Content, you grant
          us a limited, worldwide, royalty-free license to use, reproduce, and
          display it solely to operate, improve, and support the Service and to
          publish it to the third-party social platforms you authorize.
        </p>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          You represent that you have all necessary rights to your Content and
          that it does not violate any law or infringe any third-party rights.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          5. Prohibited Uses
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          You agree not to use the Service to:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-muted-foreground">
          <li>Violate any applicable law or regulation;</li>
          <li>Infringe intellectual property or other proprietary rights;</li>
          <li>Transmit spam, malware, or harmful code;</li>
          <li>Harass, abuse, or harm others;</li>
          <li>Attempt to interfere with the Service&apos;s infrastructure or security;</li>
          <li>Use the Service to publish content that is defamatory, obscene, or
          otherwise objectionable.</li>
        </ul>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          6. Third-Party Platforms and Integrations
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The Service allows you to connect accounts and publish Content to
          third-party social media platforms. Your use of those platforms is
          governed by their own terms and policies. We are not responsible for
          the availability, actions, or content policies of any third-party
          platform.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          7. Fees and Payment
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Certain features of the Service may require payment. All fees are
          non-refundable except as required by law or as expressly stated in a
          written agreement. We may change our fees at any time, with notice to
          you before the change takes effect.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          8. Termination
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          We may suspend or terminate your access to the Service at any time,
          with or without cause, and with or without notice. You may also delete
          your account at any time. Upon termination, your right to use the
          Service immediately ceases, but provisions that by their nature should
          survive termination will remain in effect.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          9. Disclaimers
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
          warranties of any kind, either express or implied. We do not warrant
          that the Service will be uninterrupted, secure, error-free, or that
          any defects will be corrected. Your use of the Service is at your sole
          risk.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          10. Limitation of Liability
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          To the maximum extent permitted by law, {LEGAL.companyName} and its
          officers, directors, employees, and agents will not be liable for any
          indirect, incidental, special, consequential, or punitive damages
          arising out of or relating to your use of the Service, even if advised
          of the possibility of such damages.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          11. Indemnification
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          You agree to indemnify and hold harmless {LEGAL.companyName} and its
          affiliates from any claims, damages, liabilities, costs, or expenses
          arising out of your Content, your use of the Service, or your violation
          of these Terms.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          12. Governing Law
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          These Terms are governed by and construed in accordance with the laws
          of {LEGAL.governingLaw}, without regard to its conflict of law
          principles. Any disputes arising under these Terms will be resolved in
          the courts located in that jurisdiction.
        </p>
      </section>

      <section>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">
          13. Contact Us
        </h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          If you have any questions about these Terms, please contact us at{" "}
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
            href="/privacy-policy"
            className="text-foreground underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
