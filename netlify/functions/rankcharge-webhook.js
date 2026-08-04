// netlify/functions/rankcharge-webhook.js
//
// Receives an article POSTed by RankCharge, verifies the HMAC-SHA256
// signature against RANKCHARGE_SIGNING_SECRET (set in Netlify's
// Environment Variables — never hardcode it here), then stores the
// article in Netlify Blobs so the site can list and render it.
//
// Expected inbound JSON shape (adjust field names if RankCharge's actual
// payload differs — check their docs/a real test payload and update the
// `article.xxx` lines below to match):
//   { title, slug, excerpt, content, publishedAt }

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.RANKCHARGE_SIGNING_SECRET;
  if (!secret) {
    console.error('RANKCHARGE_SIGNING_SECRET is not set in environment variables');
    return { statusCode: 500, body: 'Server not configured' };
  }

  const signature =
    event.headers['x-rankcharge-signature'] ||
    event.headers['X-RankCharge-Signature'];

  if (!signature) {
    return { statusCode: 401, body: 'Missing X-RankCharge-Signature header' };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : (event.body || '');

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  let article;
  try {
    article = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: 'Body was not valid JSON' };
  }

  const slug = slugify(article.slug || article.title || ('article-' + Date.now()));

  const record = {
    title: article.title || 'Untitled',
    slug,
    excerpt: article.excerpt || article.description || '',
    content: article.content || article.html || article.body || '',
    publishedAt: article.publishedAt || article.date || new Date().toISOString()
  };

  try {
    const store = getStore('rankcharge-articles');
    await store.setJSON(slug, record);

    let index = [];
    try {
      index = (await store.get('_index', { type: 'json' })) || [];
    } catch (e) {
      index = [];
    }
    index = index.filter((s) => s !== slug);
    index.unshift(slug);
    await store.setJSON('_index', index);
  } catch (e) {
    console.error('Blob storage error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to store article',
        detail: e && e.message ? e.message : String(e),
        name: e && e.name ? e.name : null
      })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, slug })
  };
};

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}
