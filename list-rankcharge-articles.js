// netlify/functions/list-rankcharge-articles.js
//
// Returns every article received via the RankCharge webhook, newest first.
// Called client-side from blog.html to render them alongside the
// hand-written posts.

const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore('rankcharge-articles');
    const index = (await store.get('_index', { type: 'json' })) || [];

    const articles = [];
    for (const slug of index) {
      const rec = await store.get(slug, { type: 'json' });
      if (rec) articles.push(rec);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify(articles)
    };
  } catch (e) {
    console.error('Error listing articles:', e);
    return {
      statusCode: 200, // fail soft — an empty list just means no dynamic posts show yet
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([])
    };
  }
};
