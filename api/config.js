import { kv } from '@vercel/kv';
import { DEFAULTS } from './constants.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const config = await kv.get('delivery_config');
      return res.status(200).json(config || DEFAULTS);
    } catch {
      return res.status(200).json(DEFAULTS);
    }
  }

  if (req.method === 'POST') {
    try {
      const b = req.body;
      const config = {
        baseFee: parseFloat(b.baseFee) ?? DEFAULTS.baseFee,
        perKm: parseFloat(b.perKm) ?? DEFAULTS.perKm,
        maxRadiusKm: parseFloat(b.maxRadiusKm) ?? DEFAULTS.maxRadiusKm,
        courierRateStandard: parseFloat(b.courierRateStandard) ?? DEFAULTS.courierRateStandard,
        courierRateFar: parseFloat(b.courierRateFar) ?? DEFAULTS.courierRateFar,
        freeDeliveryThreshold: parseFloat(b.freeDeliveryThreshold) ?? 0,
      };
      await kv.set('delivery_config', config);
      return res.status(200).json({ success: true, config });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
