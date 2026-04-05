import React from "react";

export default function FAQs() {
  return (
    <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1000px] py-16">
      <h1 className="font-serif text-4xl text-charcoal mb-6">FAQs</h1>
      <div className="space-y-6 text-graphite leading-relaxed">
        <div>
          <p className="font-semibold text-charcoal">Do you deliver outside Kenya?</p>
          <p>Currently, we deliver within Kenya only.</p>
        </div>
        <div>
          <p className="font-semibold text-charcoal">How do I track my order?</p>
          <p>We share updates via SMS/phone call where needed.</p>
        </div>
      </div>
    </div>
  );
}