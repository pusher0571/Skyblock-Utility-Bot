const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../config.js');
const { isAuthorized } = require('../permissionUtils');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const HYPIXEL_API_KEY = process.env.HYPIXEL_API_KEY || config.API.HypixelAPIKEY;
const GUILD_NAME = process.env.GUILD_NAME || config.API.guildName;
const INACTIVITY_FILE = path.join(__dirname, '../data/inactivity.json');

async function getGuildData() {
    const res = await axios.get('https://api.hypixel.net/guild', {
        params: {
            key: HYPIXEL_API_KEY,
            name: GUILD_NAME
        }
    });
    if (!res.data.success) throw new Error('Error fetching guild data');
    return res.data.guild;
}

async function getUsername(uuid) {
    try {
        const res = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        return res.data.name;
    } catch {
        return uuid;
    }
}

async function getInactivityData() {
    try {
        if (fs.existsSync(INACTIVITY_FILE)) {
            return JSON.parse(fs.readFileSync(INACTIVITY_FILE));
        }
    } catch (error) {
        console.error('Error reading inactivity data:', error);
    }
    return {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inactivity')
        .setDescription('Listet alle inaktiven Spieler der letzten 7 Tage auf'),
    async execute(interaction) {
        if (!isAuthorized(interaction)) {
            return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
        }
        await interaction.deferReply();
        try {
            const guild = await getGuildData();
            const members = guild.members;
            const inactive = [];
            const inactivityData = await getInactivityData();

            for (const member of members) {
                const totalXP = Object.values(member.expHistory || {}).reduce((a, b) => a + b, 0);
                if (totalXP === 0) {
                    inactive.push(member.uuid);
                }
            }

            let description = '';
            if (inactive.length === 0) {
                description = 'All members have gained XP in the last 7 days!';
            } else {
                const now = new Date();
                for (const uuid of inactive) {
                    const name = await getUsername(uuid);
                    let status = '❌';
                    if (inactivityData[name]) {
                        const endDate = inactivityData[name].endDate ? new Date(inactivityData[name].endDate) : null;
                        if (endDate && endDate > now) {
                            status = '✅';
                        }
                    }
                    description += `• ${name} ${status}\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🛌 Inactive Members (7 days without XP)')
                .setDescription(description)
                .setColor('#ff9900')
                .setTimestamp()
                .setFooter({ text: '✅ = Reported inactivity | ❌ = Not reported or expired' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in Inactivity command:', error);
            await interaction.editReply('An error occurred while fetching inactivity data.');
        }
    }
};
