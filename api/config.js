import { kv } from '@vercel/kv';
import { DEFAULTS } from './constants.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const stored = await kv.get('delivery_config');
      return res.status(200).json({ ...DEFAULTS, ...(stored || {}) });
    } catch {
      return res.status(200).json(DEFAULTS);
    }
  }

  if (req.method === 'POST') {
    try {
      const b = req.body;
      const config = {
        baseFee: parseFloat(b.baseFee) || DEFAULTS.baseFee,
        perKm: parseFloat(b.perKm) || DEFAULTS.perKm,
        maxRadiusKm: parseFloat(b.maxRadiusKm) || DEFAULTS.maxRadiusKm,
        courierRateStandard: parseFloat(b.courierRateStandard) || DEFAULTS.courierRateStandard,
        courierRateFar: parseFloat(b.courierRateFar) || DEFAULTS.courierRateFar,
        freeDeliveryThreshold: parseFloat(b.freeDeliveryThreshold) || 0,
        priceBands: Array.isArray(b.priceBands)
          ? b.priceBands.map(band => ({
              minOrderTotal: parseFloat(band.minOrderTotal) || 0,
              baseFee:       parseFloat(band.baseFee)       || DEFAULTS.baseFee,
              perKm:         parseFloat(band.perKm)         || DEFAULTS.perKm,
            }))
          : DEFAULTS.priceBands,
      };
      await kv.set('delivery_config', config);
      return res.status(200).json({ success: true, config });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
