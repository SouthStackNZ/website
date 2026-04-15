exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  var body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  var messages = body.messages;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing messages' }) };
  }

  if (messages.length > 10) {
    messages = messages.slice(messages.length - 10);
  }

  var KNOWLEDGE_BASE = `
SOUTHSTACK — COMPANY
SouthStack is a web development company based in Rolleston, Canterbury, New Zealand.
NZBN: 9429053502803. Email: hello@southstack.co.nz.
We build websites and web applications for NZ businesses and organisations.

SERVICES
1. Astro Marketing Site — $350 + GST flat fee. 3–6 week timeline.
   Fast static sites for small NZ businesses. Includes Figma design (up to 8 pages),
   2 rounds of revisions, CMS (Decap or Sanity), contact form, WCAG 2.2 AA,
   Lighthouse >90, cookie consent, Loom handover, full IP transfer.
   Best for: brochure sites, portfolios, local businesses.
   Hosted free on Cloudflare Pages. You pay domain ~$15-25/yr directly.

2. Next.js Business Platform — from $6,000 + GST. 6–16 week timeline.
   Full-stack React applications. E-commerce, bookings, member portals, dashboards, SaaS MVPs.
   Includes Figma design (up to 10 pages), SSR & API routes, database, auth, staging environment.
   Stack: Next.js, Tailwind, Prisma/Supabase, Vercel, Stripe.

3. Maintenance & Retainer — from $150 + GST/mo. Minimum 3-month commitment.
   Monthly security updates, dependency updates, performance monitoring, content changes.
   Tiers: Basic (1hr changes/mo), Standard (3hrs/mo), Managed (hosting included).

4. RAG AI Assistant — from $800 + GST. 1–3 week timeline.
   Custom AI chatbot trained on your content. Answers FAQs, product info, policies.
   Embedded chat widget that matches your site. Fallback to contact form if it can't answer.
   Stack: Claude API, vector embeddings, Supabase pgvector, Cloudflare Workers.

5. Data & Cloud (AWS) — coming soon.
   AWS infrastructure, data pipelines, analytics dashboards, ML integration.

ALWAYS INCLUDED IN EVERY PROJECT
WCAG 2.2 AA accessibility, HTTPS/SSL, fully responsive, Lighthouse >90,
cookie consent (NZ Privacy Act 2020 compliant), full IP transfer on final payment.

PROCESS
1. Discovery call — discuss goals, audience, requirements.
2. Proposal & SOW — fixed-price, written scope and timeline.
3. Design in Figma — signed off before build starts.
4. Development — staging link for review.
5. Launch & handover — pre-launch checklist, Loom walkthrough, you own the site outright.

CHURCHES
SouthStack offers free websites for Canterbury Christian churches and church plants.
Build and hosting are free — churches only pay for their domain (~$15-25/yr).
Available to registered Christian congregations in Selwyn, Christchurch, and wider South Island.
SouthStack is based in Rolleston and prefers to meet in person where possible.

LOCATION & CONTACT
Based in Rolleston, Canterbury, NZ.
Contact: hello@southstack.co.nz
Website: https://southstack.co.nz
Get in touch via the contact form at southstack.co.nz/contact.html
`.trim();

  var systemPrompt = `You are a helpful assistant for SouthStack, a web development company in Rolleston, Canterbury, New Zealand.
Answer questions ONLY using the knowledge base below. Do not make up information or answer questions outside this knowledge base.
If asked something not covered, say you cannot answer that but suggest they contact hello@southstack.co.nz or use the contact form.
Keep answers concise — 1-3 sentences where possible. Use plain, friendly NZ English. Do not use markdown.
Do not discuss confidential business information, pricing negotiations, or staff details beyond what is listed.

KNOWLEDGE BASE:
${KNOWLEDGE_BASE}`;

  try {
    var response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: messages
      })
    });

    var data = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to reach AI service' })
    };
  }
};
