const { Events, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/settings');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
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
            // Handle button interactions
            const { handleButton } = require('../handlers/buttonHandler');
            await handleButton(interaction, client);
        } else if (interaction.isStringSelectMenu()) {
            // Handle select menu interactions
            const { handleSelectMenu } = require('../handlers/selectHandler');
            await handleSelectMenu(interaction, client);
        } else if (interaction.isModalSubmit()) {
            // Handle modal submissions
            const { handleModal } = require('../handlers/modalHandler');
            await handleModal(interaction, client);
        }
    }
};
