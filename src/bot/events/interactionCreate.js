const { Events, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/settings');
const { requireLicense } = require('../middleware/licenseCheck');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
                // License check for guild commands (skip in DMs)
                if (interaction.guildId) {
                    const check = await requireLicense(interaction, interaction.commandName);
                    if (!check.allowed) {
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(config.colors.danger)
                                    .setTitle('🔒 البوت غير مفعل')
                                    .setDescription(check.reason)
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                await command.execute(interaction, client);
            } catch (error) {
                console.error(`❌ Error executing ${interaction.commandName}:`, error);
                const reply = {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.danger)
                            .setTitle('❌ حدث خطأ')
                            .setDescription('حدث خطأ أثناء تنفيذ الأمر. حاول مرة أخرى لاحقاً.')
                    ],
                    flags: MessageFlags.Ephemeral
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        } else if (interaction.isButton()) {
            // License check for buttons (except panel buttons that lead to activation modal)
            if (interaction.guildId) {
                const check = await requireLicense(interaction, 'button');
                if (!check.allowed) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(config.colors.danger)
                                .setTitle('🔒 البوت غير مفعل')
                                .setDescription(check.reason)
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
            // Handle button interactions
            const { handleButton } = require('../handlers/buttonHandler');
            await handleButton(interaction, client);
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.guildId) {
                const check = await requireLicense(interaction, 'select');
                if (!check.allowed) {
                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(config.colors.danger)
                                .setTitle('🔒 البوت غير مفعل')
                                .setDescription(check.reason)
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }
            // Handle select menu interactions
            const { handleSelectMenu } = require('../handlers/selectHandler');
            await handleSelectMenu(interaction, client);
        } else if (interaction.isModalSubmit()) {
            if (interaction.guildId) {
                // Modal submits are usually ticket creation - check license
                const customId = interaction.customId || '';
                if (!customId.startsWith('modal_subject_') || true) { // always check on modal submit
                    const check = await requireLicense(interaction, 'modal');
                    if (!check.allowed) {
                        return interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(config.colors.danger)
                                    .setTitle('🔒 البوت غير مفعل')
                                    .setDescription(check.reason)
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }
            // Handle modal submissions
            const { handleModal } = require('../handlers/modalHandler');
            await handleModal(interaction, client);
        }
    }
};
