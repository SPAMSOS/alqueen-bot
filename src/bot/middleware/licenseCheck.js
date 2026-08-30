const { checkLicense, isOwner } = require('../utils/licenseService');

// Commands that work even without license (so users can activate)
const ALWAYS_ALLOWED = new Set(['activate', 'license', 'ping', 'help']);

// Premium / panel-setting commands
const LICENSE_REQUIRED = true;

async function requireLicense(interaction, commandName) {
    // Owners can always use
    if (isOwner(interaction.user.id)) {
        return { allowed: true };
    }

    // Some commands are always allowed (activation, info)
    if (ALWAYS_ALLOWED.has(commandName)) {
        return { allowed: true };
    }

    const status = await checkLicense(interaction.guildId);
    if (!status.valid) {
        const reasons = {
            not_registered: '❌ السيرفر غير مسجل. شغّل `/setup` أولاً ثم `/activate` ب كود التفعيل.',
            not_activated: '❌ البوت غير مفعل في هذا السيرفر.\nاستخدم `/activate` مع كود التفعيل من المالك.\n\n📞 تواصل مع مالك البوت للحصول على كود.',
            revoked: '❌ تم إيقاف التفعيل من قبل المالك.\nتواصل مع المالك لإعادة التفعيل.',
            expired: '❌ انتهت صلاحية التفعيل.\nتواصل مع المالك لتجديد الكود.'
        };
        return {
            allowed: false,
            reason: reasons[status.reason] || reasons.not_activated,
            status
        };
    }

    return { allowed: true, status };
}

module.exports = { requireLicense };
