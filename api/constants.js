// Single source of truth for all delivery configuration defaults

export const ORIGIN = 'N91PT7W';

export const DEFAULTS = {
  baseFee: 15.00,
  perKm: 1.25,
  maxRadiusKm: 50,
  courierRateStandard: 69,
  courierRateFar: 79,
  freeDeliveryThreshold: 400,
  priceBands: [
    { minOrderTotal: 0,   baseFee: 15.00, perKm: 1.25 },
    { minOrderTotal: 220, baseFee: 10.00, perKm: 0.50 },
  ],
};

// Counties that attract the higher courier rate
export const FAR_COUNTIES = ['cork', 'kerry', 'donegal'];

// Returns the best-matching band for the given cart total.
// Bands are sorted by minOrderTotal descending; the first band where
// cartTotal >= minOrderTotal wins. Falls back to the lowest band.
export function selectBand(priceBands, cartTotal) {
  const total = parseFloat(cartTotal) || 0;
  const sorted = [...priceBands].sort((a, b) => b.minOrderTotal - a.minOrderTotal);
  return sorted.find(b => total >= b.minOrderTotal) ?? sorted[sorted.length - 1];
}
