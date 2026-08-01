// api/create-payment.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerName, customerAddress, contactNumber, gcashRef, items, total, timestamp } = req.body;

  if (!customerName || !customerAddress || !contactNumber || !items || items.length === 0 || !total) {
    return res.status(400).json({ error: 'Missing required order details' });
  }

  const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY;
  if (!PAYMONGO_SECRET) {
    console.error('PAYMONGO_SECRET_KEY not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const description = items.map(i => `${i.name} (₱${i.price})`).join(', ');

const payload = {
  data: {
    attributes: {
      amount: Math.round(total * 100),
      currency: 'PHP',

      payment_method_allowed: ['card', 'gcash', 'qrph'], // ✅

      payment_method_options: {
        card: {
          request_three_d_secure: 'any'
        }
      },

      description: `Cafe Tamia Order: ${customerName}`,
      statement_descriptor: 'Cafe Tamia',
      capture_type: 'automatic'
    }
  }
};

  try {
    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET + ':').toString('base64')}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo error:', data);
      throw new Error(data.errors?.[0]?.detail || 'PayMongo request failed');
    }

    const paymentIntentId = data.data.id;
    const clientKey = data.data.attributes.client_key;

    // I-return sa frontend ang client_key (dili checkout_url — wala pa na siya sa stage)
    return res.status(200).json({
      paymentIntentId,
      clientKey,
      orderRef: paymentIntentId.slice(0, 8)
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}