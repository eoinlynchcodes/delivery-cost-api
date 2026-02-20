export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'Mick Lynch Timber - Carrier Service',
    timestamp: new Date().toISOString(),
    config: { origin: 'N91PT7W', baseFee: 20, perKm: 1.25, maxRadius: 50 },
  });
}