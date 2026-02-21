const SHOP = 'mick-lynch-timber-and-bark-mulch.myshopify.com';
const REDIRECT_URI = 'https://delivery-cost-api-vercel.vercel.app/api/auth/callback';
const SCOPES = 'write_shipping';

export default function handler(req, res) {
    const shop = req.query.shop || SHOP;
    const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!clientId) {
        return res.status(500).send('<h2>Error: SHOPIFY_CLIENT_ID env var not set</h2>');
  }

  const authUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${clientId}` +
        `&scope=${SCOPES}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&state=setup`;

  res.redirect(302, authUrl);
}
