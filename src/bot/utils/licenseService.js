const License = require('../../database/models/License');
const Guild = require('../../database/models/Guild');
const config = require('../../config/settings');

// Owner Discord IDs who can create licenses (set in .env or config)
const OWNER_IDS = (process.env.BOT_OWNER_IDS || config.bot?.ownerId || '').split(',').filter(Boolean);

function generateCode() {
    // ALQ-XXXX-XXXX-XXXX (12 chars + ALQ prefix)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let raw = '';
    for (let i = 0; i < 12; i++) {
        raw += chars[Math.floor(Math.random() * chars.length)];
    }
    return `ALQ-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function createLicense(durationDays = 30, note = '', createdBy = 'owner') {
    // Generate unique code (retry if collision)
    let code;
    for (let i = 0; i < 5; i++) {
        code = generateCode();
        const exists = await License.findOne({ code }).lean();
        if (!exists) break;
    }
    const license = new License({
        code,
        durationDays,
        note,
        createdBy
    });
    await license.save();
    return license;
}

async function activateLicense(guildId, code) {
    const license = await License.findOne({ code: code.trim().toUpperCase() });
    if (!license) return { success: false, error: 'الكود غير موجود' };
    if (!license.isActive) return { success: false, error: 'هذا الكود معطّل من المالك' };
    if (license.usedBy?.guildId) return { success: false, error: 'هذا الكود مُستخدم بالفعل' };

    const guild = await Guild.findOne({ guildId });
    if (!guild) return { success: false, error: 'السيرفر غير مسجل. شغّل /setup أولاً' };

    // If the guild already has a license, deactivate old (free up the old code? no - keep used)
    // Mark this license as used
    const now = new Date();
    const expiresAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

    license.usedBy = {
        guildId,
        guildName: guild.name,
        ownerId: guild.ownerId
    };
    license.usedAt = now;
    license.expiresAt = expiresAt;
    await license.save();

    // Update guild
    guild.license = {
        code: license.code,
        activatedAt: now,
        expiresAt,
        revoked: false
    };
    await guild.save();

    return {
        success: true,
        expiresAt,
        durationDays: license.durationDays,
        code: license.code
    };
}

async function checkLicense(guildId) {
    const guild = await Guild.findOne({ guildId }).select('license name').lean();
    if (!guild) return { valid: false, reason: 'not_registered' };
    const lic = guild.license;
    if (!lic || !lic.code) return { valid: false, reason: 'not_activated' };
    if (lic.revoked) return { valid: false, reason: 'revoked' };
    if (!lic.expiresAt || new Date() > new Date(lic.expiresAt)) {
        return { valid: false, reason: 'expired', expiresAt: lic.expiresAt };
    }
    return { valid: true, expiresAt: lic.expiresAt, code: lic.code };
}

async function revokeGuild(guildId) {
    const guild = await Guild.findOne({ guildId });
    if (!guild) return { success: false, error: 'السيرفر غير موجود' };
    guild.license.revoked = true;
    await guild.save();
    return { success: true };
}

async function unrevokeGuild(guildId) {
    const guild = await Guild.findOne({ guildId });
    if (!guild) return { success: false, error: 'السيرفر غير موجود' };
    guild.license.revoked = false;
    await guild.save();
    return { success: true };
}

async function deleteGuild(guildId) {
    const guild = await Guild.findOne({ guildId });
    if (!guild) return { success: false, error: 'السيرفر غير موجود' };
    guild.license = { code: null, activatedAt: null, expiresAt: null, revoked: false };
    await guild.save();
    return { success: true };
}

function isOwner(userId) {
    return OWNER_IDS.includes(String(userId));
}

function getOwnerIds() {
    return OWNER_IDS;
}

module.exports = {
    generateCode,
    createLicense,
    activateLicense,
    checkLicense,
    revokeGuild,
    unrevokeGuild,
    deleteGuild,
    isOwner,
    getOwnerIds
};
