import React from "react";

export default function Privacy() {
  return (
    <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1000px] py-16">
      <h1 className="font-serif text-4xl text-black mb-6">
        Privacy Policy
      </h1>

      <div className="space-y-6 text-black/65 leading-relaxed">

        <p>
          At PAM Beauty, your privacy is important to us. This Privacy Policy explains
          how we collect, use, and protect your personal information when you interact
          with our website, purchase our products, or engage with our services.
        </p>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Information We Collect
          </h2>
          <p>
            We may collect the following types of information:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Full name and contact details (phone number, email address)</li>
            <li>Delivery information including location, city, and address</li>
            <li>Order history and purchase details</li>
            <li>Payment-related references (excluding sensitive financial data)</li>
            <li>Website usage data such as browsing behavior and preferences</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            How We Use Your Information
          </h2>
          <p>
            Your information is used to enhance your experience and deliver our services effectively.
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>To process and fulfill your orders</li>
            <li>To communicate order updates and delivery information</li>
            <li>To improve our products, website, and customer experience</li>
            <li>To respond to inquiries and customer support requests</li>
            <li>To send occasional promotional or product updates (if applicable)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Payment & Security
          </h2>
          <p>
            We prioritize your security. PAM Beauty does not store sensitive financial
            information such as PINs or card details. Payments made through M-Pesa or
            other supported methods are processed securely through trusted providers.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Data Protection
          </h2>
          <p>
            We take appropriate measures to protect your personal data from unauthorized
            access, misuse, or disclosure. While we strive to use commercially acceptable
            means to protect your information, no method of transmission over the internet
            is completely secure.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Sharing of Information
          </h2>
          <p>
            We do not sell or trade your personal information. Your data may only be shared
            with trusted service providers strictly for operational purposes such as:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Delivery and logistics partners</li>
            <li>Payment processing services</li>
            <li>Technical and hosting providers</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Cookies & Analytics
          </h2>
          <p>
            Our website may use cookies or analytics tools to understand user behavior,
            improve performance, and enhance your browsing experience. These tools do not
            collect sensitive personal information.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Your Rights
          </h2>
          <p>
            You have the right to access, update, or request deletion of your personal
            information. If you would like to make such a request, please contact us directly.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Policy Updates
          </h2>
          <p>
            This Privacy Policy may be updated occasionally to reflect changes in our
            operations or legal requirements. Continued use of our website implies acceptance
            of any updates.
          </p>
        </div>

        <p>
          By using PAM Beauty, you agree to the terms outlined in this Privacy Policy.
        </p>

      </div>
    </div>
  );
}