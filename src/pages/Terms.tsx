import { Navigation } from "@/components/Navigation";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-foreground">Terms of Service</h1>
        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing and using PulseFind, you accept and agree to be bound by the terms and provision of this agreement. 
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Description of Service</h2>
            <p>
              PulseFind provides audio fingerprinting and beat matching services to help music producers identify songs 
              that use their beats across digital streaming platforms. Our service includes both free and paid subscription tiers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities 
              that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Subscription and Payment</h2>
            <p>
              Pro subscriptions are billed monthly through Stripe. You may cancel your subscription at any time. 
              Refunds are provided on a case-by-case basis. Promotional offers are subject to availability and terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Acceptable Use</h2>
            <p>
              You agree not to misuse the service, including but not limited to: attempting to access unauthorized data, 
              overloading our systems, violating intellectual property rights, or using the service for illegal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Intellectual Property</h2>
            <p>
              You retain all rights to the audio files you upload. By uploading content, you grant PulseFind permission 
              to process and analyze your files for the purpose of providing our beat matching services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Accuracy of Results</h2>
            <p>
              While we strive for accuracy, beat matching results are provided "as is" without warranty. 
              Results should be used as guidance and may not be 100% accurate in all cases.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Limitation of Liability</h2>
            <p>
              PulseFind shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
              resulting from your use or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the service after changes 
              constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Contact</h2>
            <p>
              For questions about these terms, please contact us through the feedback form on our website.
            </p>
          </section>

          <p className="text-sm mt-8 text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
