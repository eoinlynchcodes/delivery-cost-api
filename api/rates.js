import { kv } from '@vercel/kv';
import { ORIGIN, DEFAULTS, FAR_COUNTIES } from './constants.js';

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

    // Shopify uses 'zip'; support both 'zip' and 'postal_code'
    const postcode = dest.zip || dest.postal_code;

    const destination = [
      dest.address1, dest.address2, dest.city, dest.province, postcode, 'Ireland',
    ].filter(Boolean).join(', ');
    if (!destination) return res.status(200).json({ rates: [] });

    console.log('Destination string:', destination);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.log('No GOOGLE_MAPS_API_KEY, using fallback');
      return res.status(200).json({ rates: [getFallbackRate(dest, config)] });
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${encodeURIComponent(ORIGIN)}`
      + `&destinations=${encodeURIComponent(destination)}`
      + `&units=metric&key=${apiKey}`;

    const googleRes = await fetch(googleUrl);
    const googleData = await googleRes.json();

    console.log('Google Maps status:', googleData.status);
    console.log('Google Maps element status:', googleData.rows?.[0]?.elements?.[0]?.status);

    if (googleData.status !== 'OK') {
      console.log('Google Maps non-OK status:', JSON.stringify(googleData));
      return res.status(200).json({ rates: [getFallbackRate(dest, config)] });
    }

    const element = googleData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      console.log('Element not OK:', JSON.stringify(element));
      return res.status(200).json({ rates: [getFallbackRate(dest, config)] });
    }

    const distanceKm = Math.floor(element.distance.value / 1000);
    console.log('Distance km:', distanceKm, 'maxRadius:', maxRadiusKm);

    if (distanceKm > maxRadiusKm) return res.status(200).json({ rates: [getFallbackRate(dest, config)] });

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

    const deliveryCost = baseFee + (distanceKm * perKm);
    const totalPriceCents = Math.round(deliveryCost * 100);

    return res.status(200).json({
      rates: [{
        service_name: 'Local Delivery',
        service_code: 'LOCAL_DELIVERY',
        total_price: String(totalPriceCents),
        currency: 'EUR',
        description: `\u20AC${baseFee} base + ${distanceKm} km \u00D7 \u20AC${perKm}/km = \u20AC${deliveryCost.toFixed(2)}`,
      }],
    });
  } catch (error) {
    console.error('Carrier service error:', error);
    return res.status(200).json({ rates: [getFallbackRate(req.body?.rate?.destination || {}, DEFAULTS)] });
  }
}
