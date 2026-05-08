import { kv } from '@vercel/kv';
import { ORIGIN, DEFAULTS } from './constants.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { eircode } = req.query;
  if (!eircode) return res.status(400).json({ error: 'eircode is required' });

  const config = await getConfig();

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Maps API key not configured' });

  const destination = `${eircode}, Ireland`;
  const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json`
    + `?origins=${encodeURIComponent(ORIGIN)}`
    + `&destinations=${encodeURIComponent(destination)}`
    + `&units=metric&key=${apiKey}`;

  try {
    const googleRes = await fetch(googleUrl);
    const googleData = await googleRes.json();

    if (googleData.status !== 'OK') {
      return res.status(502).json({ error: 'Maps API error', detail: googleData.status });
    }

    const element = googleData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return res.status(502).json({ error: 'No route found for that eircode' });
    }

    const distanceKm = Math.floor(element.distance.value / 1000);
    const maxRadius = config.maxRadiusKm ?? DEFAULTS.maxRadiusKm;

    if (distanceKm > maxRadius) {
      return res.status(200).json({ outOfRange: true, distanceKm });
    }

    const baseFee = config.baseFee ?? DEFAULTS.baseFee;
    const perKm = config.perKm ?? DEFAULTS.perKm;
    const cost = parseFloat((baseFee + distanceKm * perKm).toFixed(2));

    return res.status(200).json({ distanceKm, cost, baseFee, perKm });
  } catch (error) {
    console.error('distance.js error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
