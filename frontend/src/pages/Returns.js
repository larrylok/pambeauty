import React from "react";

export default function Returns() {
  return (
    <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1000px] py-16">
      <h1 className="font-serif text-4xl text-black mb-6">
        Returns & Exchanges
      </h1>

      <div className="space-y-6 text-black/65 leading-relaxed">

        <p>
          At PAM Beauty, we are committed to delivering premium quality wigs,
          hair products, and beauty accessories. If there is an issue with your
          order, we are here to help and ensure a smooth resolution.
        </p>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Eligibility for Returns & Exchanges
          </h2>
          <p>
            Due to the nature of beauty and hair products, returns and exchanges
            are handled carefully to maintain hygiene and product integrity.
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>
              Requests must be made within <strong>48 hours</strong> of delivery.
            </li>
            <li>
              Items must be <strong>unused, unworn, and unaltered</strong>.
            </li>
            <li>
              Products must be returned in their <strong>original packaging</strong>.
            </li>
            <li>
              Wigs must not be installed, styled, cut, or tampered with in any way.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Non-Returnable Items
          </h2>
          <p>
            For hygiene and safety reasons, certain items cannot be returned or exchanged:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Used or worn wigs</li>
            <li>Opened hair products (oils, sprays, treatments)</li>
            <li>Customized or made-to-order items</li>
            <li>Items without original packaging</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Damaged or Incorrect Orders
          </h2>
          <p>
            If you receive a damaged, defective, or incorrect item, please contact us immediately.
            We will prioritize resolving the issue by offering:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>A replacement product</li>
            <li>An exchange</li>
            <li>Or an appropriate resolution based on the situation</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Exchange Process
          </h2>
          <p>
            To request a return or exchange:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li>Contact our support team within 48 hours of delivery</li>
            <li>Provide your order number and clear photos if necessary</li>
            <li>Wait for confirmation before sending any item back</li>
          </ul>
          <p className="mt-2">
            Once approved, we will guide you through the next steps.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Shipping Costs
          </h2>
          <p>
            Shipping fees for returns or exchanges may apply depending on the situation.
            If the issue is due to our error, we will cover the cost of replacement or correction.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-black mb-2">
            Final Notes
          </h2>
          <p>
            We encourage customers to review product details carefully before purchasing.
            If you are unsure about a product, feel free to reach out before placing your order.
          </p>
          <p>
            PAM Beauty is dedicated to providing a premium experience, and we will always do our
            best to ensure you are satisfied with your purchase.
          </p>
        </div>

      </div>
    </div>
  );
}