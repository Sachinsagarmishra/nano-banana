const usersHandler = require('../../lib/admin/users.js');
const settingsHandler = require('../../lib/admin/settings.js');
const subscriptionsHandler = require('../../lib/admin/subscriptions.js');

module.exports = async function handler(req, res) {
    const { action } = req.query;

    if (action === 'users') {
        return usersHandler(req, res);
    }

    if (action === 'settings') {
        return settingsHandler(req, res);
    }

    if (action === 'subscriptions') {
        return subscriptionsHandler(req, res);
    }

    return res.status(404).json({ error: 'Not found' });
};
