import React from "react";

export default function Care() {
  return (
    <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1000px] py-16">
      <h1 className="font-serif text-4xl text-charcoal mb-6">Care Instructions</h1>
      <div className="space-y-4 text-graphite leading-relaxed">
        <ul className="list-disc pl-6 space-y-2">
          <li>Avoid water, perfumes, and harsh chemicals.</li>
          <li>Store in a dry pouch/box to prevent scratches.</li>
          <li>Wipe gently with a soft cloth after use.</li>
        </ul>
      </div>
    </div>
  );
}