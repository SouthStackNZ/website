// netlify/functions/discovery.js
// Handles two actions:
//   action: "chat"   — runs AI discovery conversation
//   action: "submit" — posts summary to Notion

var SYSTEM_PROMPT = `You are conducting a friendly project discovery interview for SouthStack, a web development company in Rolleston, Canterbury, New Zealand. The founder is Jesse Jacobs.

The client has already filled in a contact form with basic details (name, email, project type, budget, timeline). Your job is to go deeper and understand their project well enough that Jesse can write an accurate, personalised proposal without needing a phone call.

RULES:
- Ask ONE question at a time. Never ask multiple questions in one message.
- Be warm, conversational, and use plain NZ English. No jargon.
- Keep your messages short — 1-3 sentences plus your question.
- Do not repeat information back to the client at length.
- Do not mention Jesse by name in every message.

COVER THESE AREAS (follow the conversation naturally, don't go in rigid order):
1. What does success look like? What's the main goal?
2. Who are their customers — who will use or find this website?
3. Any websites they like the look or feel of? (design direction)
4. Content readiness — do they have copy, photos, logo? Or do they need help?
5. Any specific features or must-haves?
6. Any concerns, constraints, or things we should know upfront?

After 5-7 exchanges, when you feel you have enough to write a good brief, say something like: "I think I have a really good picture of what you're after. Is there anything else you'd like to add before I put the summary together?"

When the client says they're done or nothing to add, respond with ONLY the following format and nothing else:

SUMMARY:
Client: [their name or "Not provided"]
Goal: [1-2 sentences on what they want to achieve]
Audience: [who will use or find the site]
Design direction: [any sites they liked or style notes, or "Not discussed"]
Content: [what they have ready / what they need help with]
Must-haves: [specific requirements, or "None mentioned"]
Constraints: [budget notes, timeline pressure, tech requirements, or "None mentioned"]
Notes: [anything else worth knowing]

Do not include any text before or after the SUMMARY block when producing the final summary.`;

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  var body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid body' }) }; }

  if (body.action === 'chat') return handleChat(body);
  if (body.action === 'submit') return handleSubmit(body);
  return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
};

async function handleChat(body) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };

  var messages = (body.messages || []).slice(-14);

  try {
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    var data = await res.json();
    var reply = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text
      : 'Sorry, something went wrong.';

    // Detect if the response is the final summary
    if (reply.trim().startsWith('SUMMARY:')) {
      var summary = reply.replace(/^SUMMARY:\s*/i, '').trim();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summary })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: reply })
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error' }) };
  }
}

async function handleSubmit(body) {
  var notionKey = process.env.NOTION_API_KEY;
  var databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionKey || !databaseId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Notion not configured' }) };
  }

  var name = body.name || 'Unknown';
  var email = body.email || '';
  var summary = body.summary || '';

  var summaryBlocks = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: 'Client Brief (AI Discovery)' } }] }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: summary } }] }
    }
  ];

  try {
    // Try to find existing Notion page by email
    var pageId = null;
    if (email) {
      var searchRes = await fetch('https://api.notion.com/v1/databases/' + databaseId + '/query', {
        method: 'POST',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
          filter: {
            property: 'Email',
            email: { equals: email }
          },
          page_size: 1
        })
      });
      var searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        pageId = searchData.results[0].id;
      }
    }

    if (pageId) {
      // Append summary blocks to existing page
      await fetch('https://api.notion.com/v1/blocks/' + pageId + '/children', {
        method: 'PATCH',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({ children: summaryBlocks })
      });

      // Update status to Discovery Call Done
      await fetch('https://api.notion.com/v1/pages/' + pageId, {
        method: 'PATCH',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
          properties: {
            'Status': { status: { name: 'Discovery Call Done' } }
          }
        })
      });
    } else {
      // Create a new page in the database
      await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders(notionKey),
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            'Name': { title: [{ type: 'text', text: { content: name } }] },
            'Email': { email: email || null },
            'Status': { status: { name: 'Discovery Call Done' } }
          },
          children: summaryBlocks
        })
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Notion error', detail: err.message }) };
  }
}

function notionHeaders(key) {
  return {
    'Authorization': 'Bearer ' + key,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
}
