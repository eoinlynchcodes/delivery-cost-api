import { kv } from '@vercel/kv';
import { ORIGIN, DEFAULTS } from './constants.js';

export default async function handler(req, res) {
  let config = DEFAULTS;
  try {
    const stored = await kv.get('delivery_config');
    if (stored) config = stored;
  } catch {
    // fall through to DEFAULTS
  }

  res.status(200).json({
    status: 'ok',
    service: 'Mick Lynch Timber - Carrier Service',
    timestamp: new Date().toISOString(),
    config: {
      origin: ORIGIN,
      baseFee: config.baseFee,
      perKm: config.perKm,
      maxRadiusKm: config.maxRadiusKm,
      courierRateStandard: config.courierRateStandard,
      courierRateFar: config.courierRateFar,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
    },
  });
}
