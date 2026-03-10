# delivery-cost-api

A Vercel serverless API for calculating distance-based delivery costs, designed to integrate with Shopify as a carrier service.

## Pricing Formula

```
Delivery Fee = €15 base + (distance km × €1.25/km)
```

Orders over the free delivery threshold (if set) qualify for free delivery. Destinations outside the 50km radius fall back to a flat courier rate.

## Endpoints

- `POST /api/rates` — Shopify carrier service endpoint
- `GET /api/config` — Get current pricing config
- `POST /api/config` — Update pricing config
- `GET /api/health` — Health check with live config
- `GET /api/test?eircode=D01F5P2` — Test the rates endpoint
