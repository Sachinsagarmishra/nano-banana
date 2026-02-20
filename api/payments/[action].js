const checkoutHandler = require('../../lib/payments/create-checkout.js');
const webhookHandler = require('../../lib/payments/webhook.js');
const cancelHandler = require('../../lib/payments/cancel.js');

module.exports = async function handler(req, res) {
    const { action } = req.query;

    if (action === 'create-checkout') return checkoutHandler(req, res);
    if (action === 'webhook') return webhookHandler(req, res);
    if (action === 'cancel') return cancelHandler(req, res);

    return res.status(404).json({ error: 'Not found' });
};
