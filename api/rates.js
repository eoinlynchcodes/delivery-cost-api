import { kv } from '@vercel/kv';

const ORIGIN = 'N91PT7W';

const DEFAULTS = {
  baseFee: 20.00,
  perKm: 1.25,
  maxRadiusKm: 50,
  courierRateStandard: 69,
  courierRateFar: 79,
  freeDeliveryThreshold: 0,
};

// Counties that attract the higher courier rate
const FAR_COUNTIES = ['cork', 'kerry', 'donegal'];

function isFarCounty(dest) {
  const province = (dest?.province || '').toLowerCase();
  const city = (dest?.city || '').toLowerCase();
  return FAR_COUNTIES.some(c => province.includes(c) || city.includes(c));
}

function getFallbackRate(dest, config) {
  const far = isFarCounty(dest);
  const standardCents = Math.round((config.courierRateStandard ?? DEFAULTS.courierRateStandard) * 100);
  const farCents = Math.round((config.courierRateFar ?? DEFAULTS.courierRateFar) * 100);
  return {
    service_name: far ? 'Courier Delivery (Cork / Kerry / Donegal)' : 'Courier Delivery',
    service_code: 'COURIER',
    total_price: String(far ? farCents : standardCents),
    currency: 'EUR',
    description: far
      ? `Courier delivery — EUR${config.courierRateFar ?? DEFAULTS.courierRateFar} flat rate to your county`
      : `Courier delivery — EUR${config.courierRateStandard ?? DEFAULTS.courierRateStandard} flat rate`,
  };
}

async function getConfig() {
  try {
    const config = await kv.get('delivery_config');
    return config || DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const config = await getConfig();
    const baseFee = config.baseFee ?? DEFAULTS.baseFee;
    const perKm = config.perKm ?? DEFAULTS.perKm;
    const maxRadiusKm = config.maxRadiusKm ?? DEFAULTS.maxRadiusKm;
    const freeDeliveryThreshold = config.freeDeliveryThreshold ?? DEFAULTS.freeDeliveryThreshold;

    const dest = req.body?.rate?.destination;
    if (!dest) return res.status(200).json({ rates: [] });

    const destination = [
      dest.address1,
      dest.address2,
      dest.city,
      dest.province,
      dest.zip,
      dest.country,
    ].filter(Boolean).join(', ');

    if (!destination) return res.status(200).json({ rates: [] });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(200).json({ rates: [getFallbackRate(dest, config)] });

    const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${encodeURIComponent(ORIGIN)}`
      + `&destinations=${encodeURIComponent(destination)}`
      + `&units=metric&key=${apiKey}`;

    const googleRes = await fetch(googleUrl);
    const googleData = await googleRes.json();

    if (googleData.status !== 'OK') return res.status(200).json({ rates: [getFallbackRate(dest, config)] });

    const element = googleData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return res.status(200).json({ rates: [getFallbackRate(dest, config)] });

    const distanceKm = Math.floor(element.distance.value / 1000);

    if (distanceKm > maxRadiusKm) return res.status(200).json({ rates: [getFallbackRate(dest, config)] });

    const deliveryCost = baseFee + (distanceKm * perKm);

    // Apply free delivery threshold
    if (freeDeliveryThreshold > 0) {
      const orderTotal = (req.body?.rate?.line_items || []).reduce((sum, item) => {
        return sum + (parseFloat(item.price || 0) * (item.quantity || 1));
      }, 0);
      if (orderTotal >= freeDeliveryThreshold) {
        return res.status(200).json({
          rates: [{
            service_name: 'Free Delivery',
            service_code: 'FREE_DELIVERY',
            total_price: '0',
            currency: 'EUR',
            description: 'Free delivery on this order',
          }],
        });
      }
    }

    const totalPriceCents = Math.round(deliveryCost * 100);

    return res.status(200).json({
      rates: [{
        service_name: 'Local Delivery',
        service_code: 'LOCAL_DELIVERY',
        total_price: String(totalPriceCents),
        currency: 'EUR',
        description: `Delivery by our Truck`,
      }],
    });
  } catch (error) {
    console.error('Carrier service error:', error);
    return res.status(200).json({ rates: [getFallbackRate(req.body?.rate?.destination || {}, DEFAULTS)] });
  }
}
