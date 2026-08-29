const express = require('express');
const router = express.Router();
const User = require('../../database/models/User');

// Login page redirect
router.get('/login', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/auth/callback`;
    const scope = 'identify guilds';

    // Validate client_id is numeric (snowflake)
    if (!clientId || !/^\d{17,20}$/.test(clientId)) {
        console.error('Invalid CLIENT_ID:', clientId);
        return res.redirect('/?error=invalid_client_id');
    }

    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    res.redirect(url);
});

// OAuth callback
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error('OAuth error:', error);
        return res.redirect(`/?error=${error}`);
    }

    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.DISCORD_TOKEN_SECRET || process.env.CLIENT_SECRET;

        if (!clientId || !/^\d{17,20}$/.test(clientId)) {
            return res.redirect('/?error=invalid_client_id');
        }

        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code.toString(),
                redirect_uri: `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/auth/callback`
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('Token error:', tokens);
            return res.redirect(`/?error=${tokens.error}`);
        }

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        });

        const userData = await userResponse.json();

        if (userData.error) {
            console.error('User fetch error:', userData);
            return res.redirect('/?error=user_fetch_failed');
        }

        // Save or update user
        let user = await User.findOne({ userId: userData.id });
        if (!user) {
            user = new User({
                userId: userData.id,
                tag: userData.username + '#' + userData.discriminator,
                username: userData.username,
                discriminator: userData.discriminator,
                avatar: userData.avatar
            });
        } else {
            user.tag = userData.username + '#' + userData.discriminator;
            user.avatar = userData.avatar;
            user.username = userData.username;
            user.lastSeen = new Date();
        }
        await user.save();

        // Set session
        req.session.user = {
            id: userData.id,
            tag: userData.username + '#' + userData.discriminator,
            username: userData.username,
            avatar: userData.avatar
        };

        res.redirect('/dashboard');
    } catch (error) {
        console.error('OAuth error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Get current user
router.get('/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    res.json({ success: true, data: req.session.user });
});

module.exports = router;
