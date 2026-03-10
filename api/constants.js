// Single source of truth for all delivery configuration defaults

export const ORIGIN = 'N91PT7W';

export const DEFAULTS = {
  baseFee: 15.00,
  perKm: 1.25,
  maxRadiusKm: 50,
  courierRateStandard: 69,
  courierRateFar: 79,
  freeDeliveryThreshold: 0,
};

// Counties that attract the higher courier rate
export const FAR_COUNTIES = ['cork', 'kerry', 'donegal'];
