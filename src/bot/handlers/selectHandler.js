async function handleSelectMenu(interaction, client) {
    const { customId, values } = interaction;

    if (customId === 'ticket_category_select') {
        return handleCategorySelect(interaction, client, values[0]);
    }
}

async function handleCategorySelect(interaction, client, value) {
    // This is for premium servers that want to use dropdown instead of buttons
    // Implementation similar to button handler
    await interaction.reply({
        embeds: [{
            title: 'تم اختيار الفئة',
            description: `الفئة المختارة: ${value}`,
            color: 0x5865F2
        }],
        ephemeral: true
    });
}

module.exports = { handleSelectMenu };
