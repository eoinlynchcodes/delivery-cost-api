const ORIGIN = 'N91PT7W';
const BASE_FEE = 20.00;
const PER_KM = 1.25;
const MAX_RADIUS_KM = 50;

const COURIER_RATE_STANDARD = 6900; // €69 in cents
const COURIER_RATE_FAR = 7900;      // €79 in cents — Cork, Kerry, Donegal

// Counties that attract the higher courier rate
const FAR_COUNTIES = ['cork', 'kerry', 'donegal'];

function isFarCounty(dest) {
    const province = (dest?.province || '').toLowerCase();
    const city = (dest?.city || '').toLowerCase();
    return FAR_COUNTIES.some(c => province.includes(c) || city.includes(c));
}

function getFallbackRate(dest) {
    const far = isFarCounty(dest);
    return {
          service_name: far ? 'Courier Delivery (Cork / Kerry / Donegal)' : 'Courier Delivery',
          service_code: 'COURIER',
          total_price: String(far ? COURIER_RATE_FAR : COURIER_RATE_STANDARD),
          currency: 'EUR',
          description: far
            ? 'Courier delivery — €79 flat rate to your county'
                  : 'Courier delivery — €69 flat rate',
    };
}

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
        if (!apiKey) return res.status(200).json({ rates: [getFallbackRate(dest)] });

      const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json`
          + `?origins=${encodeURIComponent(ORIGIN)}`
          + `&destinations=${encodeURIComponent(destination)}`
          + `&units=metric&key=${apiKey}`;

      const googleRes = await fetch(googleUrl);
        const googleData = await googleRes.json();

      if (googleData.status !== 'OK') return res.status(200).json({ rates: [getFallbackRate(dest)] });

      const element = googleData.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') return res.status(200).json({ rates: [getFallbackRate(dest)] });

      const distanceKm = element.distance.value / 1000;
        const durationMin = Math.round(element.duration.value / 60);

      if (distanceKm > MAX_RADIUS_KM) return res.status(200).json({ rates: [getFallbackRate(dest)] });

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
        return res.status(200).json({ rates: [getFallbackRate(req.body?.rate?.destination || {})] });
  }
}
