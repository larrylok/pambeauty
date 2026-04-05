import React from "react";

export default function SizeGuide() {
  return (
    <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1000px] py-16">
      <h1 className="font-serif text-4xl text-charcoal mb-6">Size Guide</h1>
      <div className="space-y-4 text-graphite leading-relaxed">
        <p><span className="font-semibold text-charcoal">Bracelets:</span> measure your wrist and add 1–2 cm for comfort.</p>
        <p><span className="font-semibold text-charcoal">Necklaces:</span> choose length based on preferred drop. We can advise on request.</p>
      </div>
    </div>
  );
}