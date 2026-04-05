import React from "react";

export default function Shipping() {
  return (
    <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1000px] py-16">
      <h1 className="font-serif text-4xl text-black mb-6">Shipping & Delivery</h1>

      <div className="space-y-4 text-black/65 leading-relaxed">
        <p>
          PAM Beauty currently delivers within Kenya.
        </p>

        <ul className="list-disc pl-6 space-y-2">
          <li>Nairobi: 1–2 business days</li>
          <li>Major towns: 2–4 business days</li>
          <li>Other areas: 3–5 business days</li>
        </ul>

        <p>
          Delivery updates are shared via phone or SMS where needed.
        </p>

        <p>
          Delivery timelines may vary slightly during holidays, public holidays, or high-order periods.
        </p>
      </div>
    </div>
  );
}