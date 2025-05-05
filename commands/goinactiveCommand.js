const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config.js');
const { isAuthorized } = require('../permissionUtils');
const fs = require('fs');
const path = require('path');

const INACTIVITY_FILE = path.join(__dirname, '../savefiles/inactivity.json');

if (!fs.existsSync(path.dirname(INACTIVITY_FILE))) {
    fs.mkdirSync(path.dirname(INACTIVITY_FILE), { recursive: true });
}

if (!fs.existsSync(INACTIVITY_FILE)) {
    fs.writeFileSync(INACTIVITY_FILE, JSON.stringify({}));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goinactive')
        .setDescription('Report your inactivity period'),
    
    async execute(interaction) {
        if (!isAuthorized(interaction)) {
            return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('inactivityModal')
            .setTitle('Report Inactivity');

        const ignInput = new TextInputBuilder()
            .setCustomId('ign')
            .setLabel('Your Minecraft IGN (MAKE SURE ITS CORRECT!!)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (e.g. 1d, 2d, 1w, 2w)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(ignInput);
        const secondActionRow = new ActionRowBuilder().addComponents(durationInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
    },
    async handleModal(interaction) {
        if (interaction.customId !== 'inactivityModal') return;
        const ign = interaction.fields.getTextInputValue('ign');
        const durationInput = interaction.fields.getTextInputValue('duration').trim().toLowerCase();

        let days = 0;

        const dayMatch = durationInput.match(/^(\d{1,2})\s*(tag|tage|d)$/i);
        const weekMatch = durationInput.match(/^(\d{1,2})\s*(woche|wochen|w)$/i);
        if (dayMatch) {
            days = parseInt(dayMatch[1], 10);
        } else if (weekMatch) {
            days = parseInt(weekMatch[1], 10) * 7;
        }
        if (days < 1 || days > 14) {
            return interaction.reply({ content: '❌ Please enter a duration between 1 day and 2 weeks (e.g. "3 days", "1 week", "2w" or "5d")', ephemeral: true });
        }

        const now = new Date();
        const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        let inactivityData = {};
        try {
            if (fs.existsSync(INACTIVITY_FILE)) {
                inactivityData = JSON.parse(fs.readFileSync(INACTIVITY_FILE));
            }
        } catch (error) {
            console.error('Error reading inactivity data:', error);
        }

        inactivityData[ign] = {
            reported: true,
            duration: durationInput,
            timestamp: now.toISOString(),
            endDate: endDate.toISOString(),
            days: days
        };

        try {
            fs.writeFileSync(INACTIVITY_FILE, JSON.stringify(inactivityData, null, 2));
            await interaction.reply({ content: `✅ Your inactivity has been saved for ${days} day(s)!`, ephemeral: true });
        } catch (error) {
            console.error('Error saving inactivity data:', error);
            await interaction.reply({ content: '❌ An error occurred while saving your inactivity.', ephemeral: true });
        }
    }
}; 