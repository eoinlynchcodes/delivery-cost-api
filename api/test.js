export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const eircode = req.body?.eircode || req.query?.eircode || 'D02XY00';

  const shopifyPayload = {
    rate: {
      origin: { country: 'IE', postal_code: 'N91PT7W', city: 'Ballinea' },
      destination: { country: 'IE', postal_code: eircode, city: '' },
      items: [{ name: 'Test Product', quantity: 1, grams: 1000, price: 5000 }],
      currency: 'EUR',
    },
  };

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;

  try {
    const response = await fetch(`${protocol}://${host}/api/rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopifyPayload),
    });
    const data = await response.json();
    return res.status(200).json({ test_eircode: eircode, rates_response: data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}