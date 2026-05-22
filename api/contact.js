import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, message } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const submission = {
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone || '').trim(),
      message: String(message || '').trim(),
      submittedAt: new Date().toISOString(),
    };

    // Store submission — non-fatal if KV is unavailable
    try {
      const key = `contact:${Date.now()}`;
      await kv.set(key, submission, { ex: 60 * 60 * 24 * 90 }); // 90-day TTL
    } catch {
      console.error('KV write failed — submission not stored');
    }

    return res.status(200).json({
      success: true,
      message: "Thanks for getting in touch! We'll get back to you within one business day.",
    });
  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}
