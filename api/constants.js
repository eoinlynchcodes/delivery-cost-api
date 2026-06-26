// Single source of truth for all delivery configuration defaults.

export const ORIGIN = 'N91PT7W';

export const DEFAULTS = {
  baseFee: 15.00,
  perKm: 1.25,
  maxRadiusKm: 40,            // road km from the yard for the bordering-county local zone
  courierRateStandard: 92.50, // M&A Couriers flat courier rate
  courierRateFar: 92.50,      // kept separate in case Cork/Kerry/Donegal ever differs again
  localFallbackFee: 35.00,    // flat Local fee if a Westmeath address can't be geocoded
};

// Counties that (optionally) attract the higher courier rate
export const FAR_COUNTIES = ['cork', 'kerry', 'donegal'];

// Home county — always gets Local Delivery, no distance cap.
export const HOME_COUNTY = { code: 'wh', aliases: ['westmeath'] };

// Counties bordering Westmeath — Local Delivery only within maxRadiusKm by road.
// code = ISO 3166-2:IE subdivision code (Shopify may send the code or the name).
export const BORDER_COUNTIES = [
  { code: 'oy', aliases: ['offaly'] },
  { code: 'ke', aliases: ['kildare'] },
  { code: 'mh', aliases: ['meath'] },
  { code: 'cn', aliases: ['cavan'] },
  { code: 'rn', aliases: ['roscommon'] },
  { code: 'ld', aliases: ['longford'] },
];
