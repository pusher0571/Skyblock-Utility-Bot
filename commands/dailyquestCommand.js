const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config.js');

const HYPIXEL_API_KEY = process.env.HYPIXEL_API_KEY || config.API.HypixelAPIKEY;

const SKILLS = ['Mining', 'Foraging', 'Farming', 'Combat', 'Fishing'];
const DIFFICULTY_RANGES = config.dailyQuestCommand.dailyQuestDifficulties;
const DATA_PATH = path.join(__dirname, '../savefiles/dailyquests.json');
const WEBHOOK_URL = config.dailyQuestCommand.dailyQuestWebhookURL;

function loadData() {
    if (!fs.existsSync(DATA_PATH)) return {};
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestsWithDifficulty(difficulty) {
    const shuffled = SKILLS.sort(() => 0.5 - Math.random());
    const range = DIFFICULTY_RANGES[difficulty];
    return shuffled.slice(0, 3).map(skill => ({
        skill,
        goal: getRandomInt(range.min, range.max)
    }));
}

async function getMinecraftUUID(username) {
    try {
        const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        return res.data.id;
    } catch (error) {
        throw new Error('Minecraft-Username not found.');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dailyquest')
        .setDescription('Start, update, or end your Daily Quest session')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('What do you want to do?')
                .setRequired(true)
                .addChoices(
                    { name: 'start', value: 'start' },
                    { name: 'update', value: 'update' },
                    { name: 'end', value: 'end' }
                )
        )
        .addStringOption(opt =>
            opt.setName('username')
                .setDescription('Your Minecraft username')
                .setRequired(true)
        ),
    async execute(interaction) {
        const userId = interaction.user.id;
        const today = getToday();
        let data = loadData();
        if (!data[today]) {
            data[today] = { quests: generateQuestsWithDifficulty('normal'), users: {} };
            saveData(data);
        }
        const action = interaction.options.getString('action');
        const username = interaction.options.getString('username');
        await interaction.deferReply({ ephemeral: true });
        try {
            const uuid = await getMinecraftUUID(username);
            const res = await axios.get('https://api.hypixel.net/v2/skyblock/profiles', {
                params: {
                    key: HYPIXEL_API_KEY,
                    uuid: uuid
                }
            });
            if (!res.data.success || !res.data.profiles || res.data.profiles.length === 0) {
                return interaction.editReply({ content: '❌ No SkyBlock profiles found.' });
            }

            const selectedProfile = res.data.profiles.find(p => p.selected) || res.data.profiles[0];
            const profileName = selectedProfile.cute_name || selectedProfile.profile_id;

            const options = res.data.profiles.map(profile => ({
                label: profile.cute_name || profile.profile_id,
                value: profile.profile_id,
                description: profile.selected ? 'Active profile' : undefined
            })).slice(0, 25);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_profile_dq')
                .setPlaceholder('Select a profile')
                .addOptions(options);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.editReply({
                content: 'Select the profile you want to use for this action:',
                components: [row]
            });
            const filter = i => i.customId === 'select_profile_dq' && i.user.id === interaction.user.id;
            const selectInteraction = await interaction.channel.awaitMessageComponent({ filter, time: 30000 });
            const selectedProfileId = selectInteraction.values[0];
            await selectInteraction.deferUpdate();
            if (action === 'start') {
                if (data.sessions && data.sessions[userId] && data.sessions[userId][selectedProfileId]) {
                    const session = data.sessions[userId][selectedProfileId];
                    const now = Date.now();
                    if (now - session.start < 24 * 60 * 60 * 1000) {
                        const embed = new EmbedBuilder()
                            .setTitle('Session already active!')
                            .setDescription('You already have an active Daily Quest session for this profile! Please finish it first (wait 24h) before starting a new one.')
                            .setColor(0xffcc00)
                            .setTimestamp();
                        return interaction.editReply({ embeds: [embed], components: [] });
                    }
                }
                const profileRes = await axios.get('https://api.hypixel.net/v2/skyblock/profile', {
                    params: {
                        key: HYPIXEL_API_KEY,
                        profile: selectedProfileId
                    }
                });
                if (!profileRes.data.success || !profileRes.data.profile) {
                    return interaction.editReply({ content: '❌ Error loading profile.' });
                }
                const difficultyMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_difficulty_dq')
                    .setPlaceholder('Select a difficulty')
                    .addOptions(Object.entries(DIFFICULTY_RANGES).map(([key, value]) => ({
                        label: value.label,
                        value: key,
                        description: `${value.min.toLocaleString()} – ${value.max.toLocaleString()} XP`
                    })));
                const diffRow = new ActionRowBuilder().addComponents(difficultyMenu);
                await interaction.editReply({
                    content: 'Select the difficulty for your Daily Quest:',
                    components: [diffRow]
                });
                const diffFilter = i => i.customId === 'select_difficulty_dq' && i.user.id === interaction.user.id;
                const diffInteraction = await interaction.channel.awaitMessageComponent({ filter: diffFilter, time: 30000 });
                const selectedDifficulty = diffInteraction.values[0];
                await diffInteraction.deferUpdate();
                const exp = profileRes.data?.profile?.members?.[uuid]?.player_data?.experience || {};
                const quests = generateQuestsWithDifficulty(selectedDifficulty);
                if (!data.sessions) data.sessions = {};
                if (!data.sessions[userId]) data.sessions[userId] = {};
                data.sessions[userId][selectedProfileId] = {
                    start: Date.now(),
                    startXP: {
                        Mining: exp.SKILL_MINING || 0,
                        Foraging: exp.SKILL_FORAGING || 0,
                        Farming: exp.SKILL_FARMING || 0,
                        Combat: exp.SKILL_COMBAT || 0,
                        Fishing: exp.SKILL_FISHING || 0
                    },
                    quests,
                    difficulty: selectedDifficulty
                };
                saveData(data);
                const embed = new EmbedBuilder()
                    .setTitle('Daily Quest session started!')
                    .setDescription(`Your session for profile **${profileName}** has started.\nDifficulty: **${DIFFICULTY_RANGES[selectedDifficulty].label}**\nYou now have 24 hours to complete the quests.\nUse /dailyquest with update to see your progress.`)
                    .setColor(0x00ff99)
                    .setTimestamp();
                for (const q of quests) {
                    embed.addFields({
                        name: `${q.skill}`,
                        value: `Goal: **${q.goal.toLocaleString()} XP**`,
                        inline: false
                    });
                }
                await interaction.editReply({ embeds: [embed], components: [] });
            } else if (action === 'update') {
                if (!data.sessions || !data.sessions[userId] || !data.sessions[userId][selectedProfileId]) {
                    const embed = new EmbedBuilder()
                        .setTitle('No active session')
                        .setDescription('You do not have an active Daily Quest session for this profile. Start one with /dailyquest start.')
                        .setColor(0xff0000)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed], components: [] });
                }
                const session = data.sessions[userId][selectedProfileId];
                const now = Date.now();
                if (now - session.start > 24 * 60 * 60 * 1000) {
                    const embed = new EmbedBuilder()
                        .setTitle('Session expired')
                        .setDescription('Your session has expired. Start a new one with /dailyquest start.')
                        .setColor(0xff0000)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed], components: [] });
                }
                const profileRes = await axios.get('https://api.hypixel.net/v2/skyblock/profile', {
                    params: {
                        key: HYPIXEL_API_KEY,
                        profile: selectedProfileId
                    }
                });
                if (!profileRes.data.success || !profileRes.data.profile) {
                    return interaction.editReply({ content: '❌ Error loading profile.' });
                }
                const exp = profileRes.data?.profile?.members?.[uuid]?.player_data?.experience || {};
                const skills = {
                    Mining: Number(((exp.SKILL_MINING || 0) - (session.startXP.Mining || 0)).toFixed(2)),
                    Foraging: Number(((exp.SKILL_FORAGING || 0) - (session.startXP.Foraging || 0)).toFixed(2)),
                    Farming: Number(((exp.SKILL_FARMING || 0) - (session.startXP.Farming || 0)).toFixed(2)),
                    Combat: Number(((exp.SKILL_COMBAT || 0) - (session.startXP.Combat || 0)).toFixed(2)),
                    Fishing: Number(((exp.SKILL_FISHING || 0) - (session.startXP.Fishing || 0)).toFixed(2))
                };
                const quests = session.quests;
                let updated = false;
                for (const q of quests) {
                    if (skills[q.skill] > (q.progress || 0)) {
                        q.progress = skills[q.skill];
                        updated = true;
                    }
                }
                saveData(data);
                const allDone = quests.every(q => (q.progress || 0) >= q.goal);
                if (allDone && WEBHOOK_URL) {
                    try {
                        await axios.post(WEBHOOK_URL, {
                            embeds: [
                                {
                                    title: 'Daily Quest Completed',
                                    description: `User **${interaction.user.username}** has completed their daily quest on profile **${profileName}**!`,
                                    color: 0x00ff99,
                                    footer: {
                                        text: `Completed at: ${new Date().toLocaleString()}`
                                    }
                                }
                            ]
                        });
                    } catch (err) {
                        console.error('Webhook failed:', err.message);
                    }
                }
                let embed;
                if (allDone) {
                    embed = new EmbedBuilder()
                        .setTitle('All Daily Goals Fulfilled!')
                        .setDescription(`You've fulfilled all daily goals. Good Job!`)
                        .setColor(0x00ff99)
                        .setTimestamp();
                } else {
                    embed = new EmbedBuilder()
                        .setTitle('Daily Quest Progress')
                        .setDescription(`Profile: **${profileName}**\nSession active, ${(24*60*60*1000 - (now-session.start))/3600000|0}h left.`)
                        .setColor(updated ? 0x00ff99 : 0xffcc00)
                        .setTimestamp();
                }
                for (const q of quests) {
                    const cappedProgress = Math.min(q.progress || 0, q.goal);
                    embed.addFields({
                        name: `${q.skill}`,
                        value: `Progress: **${cappedProgress.toFixed(2)}/${q.goal.toLocaleString()} XP**\nGained today: **${skills[q.skill].toFixed(2)} XP**`,
                        inline: false
                    });
                }
                if (!allDone) {
                    if (updated) {
                        embed.setFooter({ text: '✅ Progress updated!' });
                    } else {
                        embed.setFooter({ text: '❌ No new progress found.\nHypixel API updates all 5 minutes!' });
                    }
                }
                await interaction.editReply({ embeds: [embed], components: [] });
            } else if (action === 'end') {
                if (!data.sessions || !data.sessions[userId] || !data.sessions[userId][selectedProfileId]) {
                    const embed = new EmbedBuilder()
                        .setTitle('No active session')
                        .setDescription('You do not have an active Daily Quest session for this profile.')
                        .setColor(0xff0000)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed], components: [] });
                }
                delete data.sessions[userId][selectedProfileId];
                if (Object.keys(data.sessions[userId]).length === 0) {
                    delete data.sessions[userId];
                }
                saveData(data);
                const embed = new EmbedBuilder()
                    .setTitle('Session ended')
                    .setDescription(`Your Daily Quest session for profile **${profileName}** has been ended.`)
                    .setColor(0x00aaff)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed], components: [] });
            } else {
                await interaction.editReply({ content: '❌ Unknown action.', components: [] });
            }
        } catch (error) {
            console.error('DailyQuest process failed:', error);
            return interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
};
