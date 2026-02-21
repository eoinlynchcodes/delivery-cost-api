const CALLBACK_URL = 'https://delivery-cost-api-vercel.vercel.app/api/auth/callback';
const CARRIER_URL = 'https://delivery-cost-api-vercel.vercel.app/api/rates';

export default async function handler(req, res) {
    const { code, shop } = req.query;

  if (!code || !shop) {
        return res.status(400).send('<h2>Error: Missing code or shop parameter</h2>');
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  try {
        // 1. Exchange code for access token
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });

      const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

      if (!accessToken) {
              return res.status(400).send(`<h2>Failed to get access token</h2><pre>${JSON.stringify(tokenData)}</pre>`);
      }

      // 2. Check if carrier service already exists
      const listRes = await fetch(`https://${shop}/admin/api/2024-01/carrier_services.json`, {
              headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      });
        const listData = await listRes.json();
        const existing = (listData.carrier_services || []).find(cs => cs.callback_url === CARRIER_URL);

      if (existing) {
              return res.status(200).send(`
                      <h2>Carrier service already registered!</h2>
                              <p>ID: ${existing.id} — Name: ${existing.name}</p>
                                      <p>You can close this tab and go back to Shopify shipping settings.</p>
                                            `);
      }

      // 3. Register the carrier service
      const carrierRes = await fetch(`https://${shop}/admin/api/2024-01/carrier_services.json`, {
              method: 'POST',
              headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                        carrier_service: {
                                    name: 'Delivery Cost by Eircode',
                                    callback_url: CARRIER_URL,
                                    service_discovery: true,
                        },
              }),
      });

      const carrierData = await carrierRes.json();

      if (carrierRes.ok && carrierData.carrier_service) {
              return res.status(200).send(`
                      <h2>Carrier Service Registered!</h2>
                              <p>ID: ${carrierData.carrier_service.id}</p>
                                      <p>Name: ${carrierData.carrier_service.name}</p>
                                              <p>Callback URL: ${carrierData.carrier_service.callback_url}</p>
                                                      <p>You can close this tab and go to Shopify Shipping settings to add it as a rate.</p>
                                                            `);
      } else {
              return res.status(400).send(`
                      <h2>Failed to register carrier service</h2>
                              <pre>${JSON.stringify(carrierData, null, 2)}</pre>
                                    `);
      }
  } catch (err) {
        return res.status(500).send(`<h2>Server error</h2><pre>${err.message}</pre>`);
  }
}
