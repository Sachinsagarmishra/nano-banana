const loginHandler = require('../../lib/auth/login.js');
const signupHandler = require('../../lib/auth/signup.js');
const profileHandler = require('../../lib/auth/profile.js');
const createadminHandler = require('../../lib/auth/createadmin.js');
const refreshHandler = require('../../lib/auth/refresh.js');

module.exports = async function handler(req, res) {
    const { action } = req.query;

    if (action === 'login') return loginHandler(req, res);
    if (action === 'signup') return signupHandler(req, res);
    if (action === 'profile') return profileHandler(req, res);
    if (action === 'createadmin') return createadminHandler(req, res);
    if (action === 'refresh') return refreshHandler(req, res);

    return res.status(404).json({ error: 'Not found' });
};

