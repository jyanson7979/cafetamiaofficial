// api/attach-payment.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentIntentId, clientKey } = req.body;

  if (!paymentIntentId || !clientKey) {
    return res.status(400).json({ error: 'Missing paymentIntentId or clientKey' });
  }

  const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY;
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://cafetamiaofficial.vercel.app';

  try {
    // Step 1: Create a Payment Method (GCash)
    const pmResponse = await fetch('https://api.paymongo.com/v1/payment_methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET + ':').toString('base64')}`
      },
      body: JSON.stringify({
        data: { attributes: { type: 'gcash' } }
      })
    });

    const pmData = await pmResponse.json();
    if (!pmResponse.ok) {
      throw new Error(pmData.errors?.[0]?.detail || 'Failed to create payment method');
    }

    const paymentMethodId = pmData.data.id;

    // Step 2: Attach the Payment Method to the Payment Intent
    const attachResponse = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET + ':').toString('base64')}`
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId,
              client_key: clientKey,
              return_url: `${baseUrl}/success.html`
            }
          }
        })
      }
    );

    const attachData = await attachResponse.json();
    if (!attachResponse.ok) {
      throw new Error(attachData.errors?.[0]?.detail || 'Failed to attach payment method');
    }

    const status = attachData.data.attributes.status;
    const redirectUrl = attachData.data.attributes.next_action?.redirect?.url || null;

    return res.status(200).json({
      status,
      redirectUrl
    });
  } catch (error) {
    console.error('Attach payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}