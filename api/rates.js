import { kv } from '@vercel/kv';
import { ORIGIN, DEFAULTS, FAR_COUNTIES, HOME_COUNTY, BORDER_COUNTIES } from './constants.js';

function isFarCounty(dest) {
  const province = (dest?.province || '').toLowerCase();
  const city = (dest?.city || '').toLowerCase();
  return FAR_COUNTIES.some(c => province.includes(c) || city.includes(c));
}

function countyMatches(entry, province, haystacks) {
  if (province && province === entry.code) return true;          // ISO code, e.g. "wh"
  return entry.aliases.some(alias => {
    const re = new RegExp('\\b' + alias + '\\b', 'i');           // word-boundary: "meath" won't match "westmeath"
    return haystacks.some(h => re.test(h));
  });
}

// 'home' (Westmeath) | 'border' | 'other'. Uses Google's geocoded county first
// (most reliable, tied to the real Eircode), then dest.province, then the town.
// Pass googleData = null to classify from the checkout address alone.
function classifyCounty(dest, googleData) {
  const province = (dest?.province || '').toString().trim().toLowerCase();
  const haystacks = [
    (googleData?.destination_addresses?.[0] || '').toLowerCase(),
    province,
    (dest?.city || '').toLowerCase(),
  ];
  if (countyMatches(HOME_COUNTY, province, haystacks)) return 'home';
  if (BORDER_COUNTIES.some(c => countyMatches(c, province, haystacks))) return 'border';
  return 'other';
}

function localRate(cost, baseFee, perKm) {
  return {
    service_name: 'Local Delivery',
    service_code: 'LOCAL_DELIVERY',
    total_price: String(Math.round(cost * 100)),
    currency: 'EUR',
    description: `€${baseFee} base + €${perKm}/km`,
  };
}

function courierRate(dest, config) {
  const rate = isFarCounty(dest)
    ? (config.courierRateFar ?? DEFAULTS.courierRateFar)
    : (config.courierRateStandard ?? DEFAULTS.courierRateStandard);
  return {
    service_name: 'Courier Delivery',
    service_code: 'COURIER',
    total_price: String(Math.round(rate * 100)),
    currency: 'EUR',
    description: `Courier delivery — €${rate} flat rate`,
  };
}

async function getConfig() {
  try {
    const stored = await kv.get('delivery_config');
    return { ...DEFAULTS, ...(stored || {}) };
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

  const config = await getConfig();
  const baseFee = config.baseFee ?? DEFAULTS.baseFee;
  const perKm = config.perKm ?? DEFAULTS.perKm;
  const maxRadiusKm = config.maxRadiusKm ?? DEFAULTS.maxRadiusKm;
  const localFallbackFee = config.localFallbackFee ?? DEFAULTS.localFallbackFee;

  const dest = req.body?.rate?.destination;
  if (!dest) return res.status(200).json({ rates: [] });

  // Always return exactly ONE rate so the customer sees one option:
  //   Westmeath              -> Local Delivery (any distance)
  //   Within maxRadiusKm road -> Local Delivery
  //   Everything else / errors -> flat Courier rate
  // Westmeath never falls through to Courier: if it can't be geocoded it gets a
  // flat Local fallback so a local order is never blocked or quoted as courier.
  const homeByAddress = () => classifyCounty(dest, null) === 'home';

  try {
    const postcode = dest.zip || dest.postal_code;
    const destination = [
      dest.address1, dest.address2, dest.city, dest.province, postcode, 'Ireland',
    ].filter(Boolean).join(', ');

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey || !destination) {
      return res.status(200).json({
        rates: [homeByAddress() ? localRate(localFallbackFee, baseFee, perKm) : courierRate(dest, config)],
      });
    }

    const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${encodeURIComponent(ORIGIN)}`
      + `&destinations=${encodeURIComponent(destination)}`
      + `&units=metric&key=${apiKey}`;

    const googleRes = await fetch(googleUrl);
    const googleData = await googleRes.json();
    const element = googleData?.rows?.[0]?.elements?.[0];

    if (googleData.status !== 'OK' || !element || element.status !== 'OK') {
      return res.status(200).json({
        rates: [homeByAddress() ? localRate(localFallbackFee, baseFee, perKm) : courierRate(dest, config)],
      });
    }

    const distanceKm = Math.floor(element.distance.value / 1000);
    const tier = classifyCounty(dest, googleData);
    const qualifiesLocal = tier === 'home' || distanceKm <= maxRadiusKm;

    if (qualifiesLocal) {
      const cost = baseFee + distanceKm * perKm;
      return res.status(200).json({ rates: [localRate(cost, baseFee, perKm)] });
    }
    return res.status(200).json({ rates: [courierRate(dest, config)] });

  } catch (error) {
    console.error('Carrier service error:', error);
    return res.status(200).json({
      rates: [homeByAddress() ? localRate(localFallbackFee, baseFee, perKm) : courierRate(dest, DEFAULTS)],
    });
  }
}
