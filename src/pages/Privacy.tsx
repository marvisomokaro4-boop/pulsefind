import { Navigation } from "@/components/Navigation";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-foreground">Privacy Policy</h1>
        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account information (email address)</li>
              <li>Audio files you upload for analysis</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Usage data and analytics</li>
              <li>Feedback and support communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and improve our beat matching services</li>
              <li>Process your subscription payments</li>
              <li>Send you service updates and notifications</li>
              <li>Respond to your support requests</li>
              <li>Analyze usage patterns to improve our platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Data Storage and Security</h2>
            <p>
              Your data is stored securely using industry-standard encryption. Audio files are processed for analysis 
              and results are stored in our secure database. We implement appropriate technical and organizational 
              measures to protect your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Third-Party Services</h2>
            <p>
              We use third-party services to provide our platform:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>ACRCloud for audio fingerprinting</li>
              <li>Stripe for payment processing</li>
              <li>Spotify API for streaming data</li>
              <li>Cloud hosting and database services</li>
            </ul>
            <p>
              These services have their own privacy policies and data handling practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide services. 
              You can request deletion of your account and associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Your Rights</h2>
            <p>
              You have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session and analyze usage patterns. 
              You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Children's Privacy</h2>
            <p>
              Our service is not intended for users under 13 years of age. We do not knowingly collect 
              information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. 
              We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Changes to Privacy Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of significant changes 
              via email or through our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Contact Us</h2>
            <p>
              For privacy-related questions or to exercise your rights, please contact us through the feedback 
              form on our website.
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

export default Privacy;
