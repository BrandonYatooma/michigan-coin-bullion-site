// netlify/functions/get-rankcharge-article.js
//
// Returns one stored article by slug, e.g.
// /.netlify/functions/get-rankcharge-article?slug=my-article

const { getArticleStore } = require('./_blobs-helper');

exports.handler = async (event) => {
  const slug = event.queryStringParameters && event.queryStringParameters.slug;
  if (!slug) {
    return { statusCode: 400, body: 'Missing slug parameter' };
  }

  try {
    const store = getArticleStore();
    const rec = await store.get(slug, { type: 'json' });
    if (!rec) {
      return { statusCode: 404, body: 'Article not found' };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify(rec)
    };
  } catch (e) {
    console.error('Error fetching article:', e);
    return { statusCode: 500, body: 'Failed to fetch article' };
  }
};
