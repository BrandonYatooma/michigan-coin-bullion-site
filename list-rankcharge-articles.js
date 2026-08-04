// netlify/functions/_blobs-helper.js
//
// Netlify's automatic Blobs environment detection has known reliability
// issues in production for some sites (see netlify/blobs GitHub issues
// and the Netlify support forums). To avoid depending on it, we pass the
// site ID and an access token explicitly instead.
//
// Required setup in Netlify (Site settings -> Environment variables):
//   NETLIFY_BLOBS_TOKEN = a Personal Access Token
//     (created at: Netlify avatar menu -> User settings -> Applications
//      -> Personal access tokens -> New access token)
//
// The site ID below is not secret (it's visible in your site's URL/API
// responses), so it's safe to leave hardcoded here.

const { getStore } = require('@netlify/blobs');

const SITE_ID = process.env.NETLIFY_BLOBS_SITE_ID || '385de348-fc5d-46ea-a810-b0b229dc51fa';

function getArticleStore() {
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!token) {
    const err = new Error(
      'NETLIFY_BLOBS_TOKEN is not set. Add it in Site settings -> Environment variables.'
    );
    err.name = 'MissingBlobsTokenError';
    throw err;
  }
  return getStore({
    name: 'rankcharge-articles',
    siteID: SITE_ID,
    token
  });
}

module.exports = { getArticleStore };
