const ORIGIN = 'N91PT7W';
const BASE_FEE = 20.00;
const PER_KM = 1.25;
const MAX_RADIUS_KM = 50;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const dest = req.body?.rate?.destination;
    if (!dest) return res.status(200).json({ rates: [] });

    const destination = [
      dest.address1, dest.address2, dest.city,
      dest.province, dest.zip, dest.country,
    ].filter(Boolean).join(', ');

    if (!destination) return res.status(200).json({ rates: [] });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(200).json({ rates: [] });

    const googleUrl =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(ORIGIN)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&units=metric&key=${apiKey}`;

    const googleRes = await fetch(googleUrl);
    const googleData = await googleRes.json();

    if (googleData.status !== 'OK') return res.status(200).json({ rates: [] });

    const element = googleData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return res.status(200).json({ rates: [] });

    const distanceKm = element.distance.value / 1000;
    const durationMin = Math.round(element.duration.value / 60);

    if (distanceKm > MAX_RADIUS_KM) return res.status(200).json({ rates: [] });

    const deliveryCost = BASE_FEE + (distanceKm * PER_KM);
    const totalPriceCents = Math.round(deliveryCost * 100);

    return res.status(200).json({
      rates: [{
        service_name: 'Local Delivery',
        service_code: 'LOCAL_DELIVERY',
        total_price: String(totalPriceCents),
        currency: 'EUR',
        description: `Delivery (~${Math.round(distanceKm)}km, ~${durationMin} min)`,
      }],
    });
  } catch (error) {
    console.error('Carrier service error:', error);
    return res.status(200).json({ rates: [] });
  }
}