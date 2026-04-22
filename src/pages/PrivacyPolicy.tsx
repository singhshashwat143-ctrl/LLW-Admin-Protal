export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,168,76,0.18),_transparent_22%),linear-gradient(180deg,_#0a0a0a,_#080808)] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="glass-card rounded-[28px] p-6 md:p-8">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[var(--accent)]">Livelong Wealth</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
            This policy explains how Livelong Wealth collects, uses, stores, and protects personal information when learners use our website, webinars, payment pages, onboarding forms, and support channels.
          </p>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Effective date: April 20, 2026</p>
        </section>

        <section className="glass-card rounded-[28px] p-6 md:p-8">
          <div className="space-y-6 text-sm leading-7 text-[var(--text-secondary)]">
            <div>
              <h2 className="text-lg font-semibold text-white">Information We Collect</h2>
              <p className="mt-2">
                We may collect your name, phone number, email address, webinar attendance details, course interest, payment details, coupon usage, and support communication history. Payment card or UPI credentials are handled by trusted payment partners such as Razorpay and are not stored by us in raw form.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">How We Use Information</h2>
              <p className="mt-2">
                We use your information to process enrollments, generate payment links, verify payments, deliver webinar access, manage student onboarding, provide customer support, share class-related communication, and improve our internal sales and operations workflows.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Payments</h2>
              <p className="mt-2">
                Online payments are processed through Razorpay and other approved payment partners. When you make a payment, basic transaction metadata such as payment status, transaction reference, order amount, and payment timestamps may be stored in our system for accounting, support, and access management purposes.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Webinars And Classes</h2>
              <p className="mt-2">
                When you join a webinar or live class, we may store attendance information such as join time, leave time, interaction events, enrollment clicks, and related room activity in order to operate the session and support enrolled learners.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Data Sharing</h2>
              <p className="mt-2">
                We may share information only with service providers or internal teams that help us deliver classes, payments, messaging, analytics, onboarding, or compliance processes. We do not sell personal information to third parties.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Data Security</h2>
              <p className="mt-2">
                We use reasonable administrative and technical safeguards to protect your information. However, no online system can guarantee absolute security, so users should also exercise care when sharing personal or payment information.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Your Rights</h2>
              <p className="mt-2">
                You may contact us to request correction or deletion of your information, subject to operational, legal, accounting, or compliance requirements that may require us to retain certain records.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">Contact</h2>
              <p className="mt-2">
                For privacy or payment-related questions, contact Livelong Wealth at <a className="text-[var(--accent)] underline underline-offset-4" href="mailto:support@livelongwealth.com">support@livelongwealth.com</a>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
