const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../../database/models/User');
const config = require('../../config/settings');

// Login page redirect
router.get('/login', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = `${process.env.DASHBOARD_URL || 'https://alqueen-bot.onrender.com'}/auth/callback`;
    const scope = 'identify guilds email';

    if (!clientId || !/^\d{17,20}$/.test(clientId)) {
        console.error('Invalid CLIENT_ID:', clientId);
        return res.redirect('/?error=invalid_client_id');
    }

    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    res.redirect(url);
});

// OAuth callback - FAST (no DB blocking)
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
        const clientSecret = process.env.CLIENT_SECRET;

        if (!clientId || !/^\d{17,20}$/.test(clientId)) {
            return res.redirect('/?error=invalid_client_id');
        }

        if (!clientSecret) {
            return res.redirect('/?error=missing_client_secret');
        }

        const redirectUri = `${process.env.DASHBOARD_URL || 'https://alqueen-bot.onrender.com'}/auth/callback`;

        // Exchange code for token
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
                redirect_uri: redirectUri
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('Token error:', tokens);
            return res.redirect(`/?error=${tokens.error}`);
        }

        // Get user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        });

        const userData = await userResponse.json();

        if (userData.error || !userData.id) {
            console.error('User fetch error:', userData);
            return res.redirect('/?error=user_fetch_failed');
        }

        // Get user's guilds
        let userGuilds = [];
        try {
            const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`
                }
            });
            userGuilds = await guildsResponse.json();
        } catch (e) {
            console.error('Guilds fetch error:', e.message);
        }

        // Set session IMMEDIATELY (don't wait for DB)
        const userData_for_session = {
            id: userData.id,
            tag: userData.username + '#' + userData.discriminator,
            username: userData.username,
            global_name: userData.global_name,
            avatar: userData.avatar,
            email: userData.email,
            discriminator: userData.discriminator,
            mfa_enabled: userData.mfa_enabled,
            verified: userData.verified,
            guilds: Array.isArray(userGuilds) ? userGuilds
                .filter(g => g.owner || (g.permissions & 0x20) === 0x20)
                .map(g => ({
                    guildId: g.id,
                    name: g.name,
                    icon: g.icon,
                    owner: g.owner,
                    permissions: g.permissions
                })) : [],
            loginAt: new Date()
        };

        // Set in session too (for non-cookie access)
        req.session.user = userData_for_session;

        // Sign JWT token and store in cookie (persists across restarts on Render)
        const token = jwt.sign(userData_for_session, config.security.jwtSecret, { expiresIn: '7d' });
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: false, // Render uses proxy
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7
        });

        console.log(`✅ User logged in: ${userData.username}#${userData.discriminator} (${userData.id})`);

        // Save to DB in background (non-blocking)
        if (Array.isArray(userGuilds)) {
            User.findOneAndUpdate(
                { userId: userData.id },
                {
                    userId: userData.id,
                    tag: userData.username + '#' + userData.discriminator,
                    username: userData.username,
                    discriminator: userData.discriminator,
                    avatar: userData.avatar,
                    email: userData.email,
                    guilds: userGuilds
                        .filter(g => g.owner || (g.permissions & 0x20) === 0x20)
                        .map(g => ({
                            guildId: g.id,
                            name: g.name,
                            icon: g.icon,
                            owner: g.owner,
                            permissions: g.permissions,
                            joinedAt: new Date()
                        })),
                    lastSeen: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).catch(err => console.error('DB save error:', err.message));
        }

        // Redirect immediately (cookie is already set above)
        res.redirect('/dashboard');
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Get current user (with REAL Discord data)
router.get('/me', (req, res) => {
    console.log(`🔍 /api/me hit. SessionID: ${req.sessionID?.slice(0, 8)}... hasUser: ${!!req.session.user}`);
    if (!req.session.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = req.session.user;
    const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(user.discriminator || '0') % 5)}.png`;

    const licenseService = require('../../bot/utils/licenseService');
    const isOwner = licenseService.isOwner(user.id);

    res.json({
        success: true,
        data: {
            id: user.id,
            tag: user.tag,
            username: user.username,
            global_name: user.global_name,
            avatar: user.avatar,
            avatarUrl: avatarUrl,
            email: user.email,
            discriminator: user.discriminator,
            mfa_enabled: user.mfa_enabled,
            verified: user.verified,
            guilds: user.guilds || [],
            loginAt: user.loginAt,
            isOwner
        }
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
