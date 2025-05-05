const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const { isAuthorized } = require('../permissionUtils');

const GIVEAWAYS_FILE = path.join(__dirname, '../giveaways.json');

// Hilfsfunktionen für JSON-Speicherung
async function loadGiveaways() {
    try {
        return await fs.readJson(GIVEAWAYS_FILE);
    } catch {
        return {};
    }
}

async function saveGiveaways(data) {
    try {
        await fs.outputJson(GIVEAWAYS_FILE, data);
    } catch (err) {
        console.error('Error saving giveaways:', err);
    }
}

// Timer-Map für laufende Giveaways (wird bei Restart neu gesetzt)
const giveawayTimers = new Map();

// Hilfsfunktion: Zeit-String (z.B. 10m, 2h) in ms
function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

// Giveaway automatisch beenden
async function scheduleGiveawayEnd(client, id, endTimestamp, channelId) {
    const ms = endTimestamp - Date.now();
    if (ms <= 0) return;
    if (giveawayTimers.has(id)) clearTimeout(giveawayTimers.get(id));
    const timeout = setTimeout(async () => {
        await endGiveaway(client, id, channelId);
    }, ms);
    giveawayTimers.set(id, timeout);
}

// Giveaway beenden und Gewinner ziehen
async function endGiveaway(client, id, channelId) {
    const giveaways = await loadGiveaways();
    const g = giveaways[id];
    if (!g || g.ended) return;
    g.ended = true;
    await saveGiveaways(giveaways);
    const channel = await client.channels.fetch(channelId);
    let winnerMsg;
    if (g.participants.length === 0) {
        winnerMsg = `❌ Das Giveaway **${g.title}** ist beendet. Es gab keine Teilnehmer.`;
    } else {
        const winner = g.participants[Math.floor(Math.random() * g.participants.length)];
        winnerMsg = `🎉 Das Giveaway **${g.title}** ist beendet! Gewinner: <@${winner}>`;
    }
    await channel.send(winnerMsg);
}

function createGiveawayEmbed(g) {
    const endsRel = `<t:${Math.floor(g.endTimestamp/1000)}:R>`;
    const endsAbs = `<t:${Math.floor(g.endTimestamp/1000)}:f>`;
    return new EmbedBuilder()
        .setTitle(`🎁 ${g.title}`)
        .setDescription(
            (g.description ? `*${g.description}*\n\n` : '') +
            `**How to enter:** Click the JOIN GIVEAWAY button below!`
        )
        .addFields(
            { name: '🕒 Ends', value: `${endsRel} (${endsAbs})`, inline: false },
            { name: '👑 Hosted by', value: g.hostId ? `<@${g.hostId}>` : 'Unknown', inline: true },
            { name: '🎟️ Entries', value: `${g.participants.length}`, inline: true },
            { name: '🏆 Winners', value: `${g.winners || 1}`, inline: true }
        )
        .setColor('#FFD700')
        .setFooter({ text: 'Skyblock Teachers Giveaway', iconURL: 'https://i.imgur.com/1Cak3Mo.png' })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('What do you want to do?')
                .setRequired(true)
                .addChoices(
                    { name: 'Start', value: 'start' },
                    { name: 'End', value: 'end' },
                    { name: 'List', value: 'list' }
                )
        )
        .addStringOption(opt =>
            opt.setName('id')
                .setDescription('ID or title of the giveaway (for end/list)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const action = interaction.options.getString('action');
        const giveaways = await loadGiveaways();
        const client = interaction.client;

        // Permission check only for start, end, list
        if (['start', 'end', 'list'].includes(action)) {
            if (!isAuthorized(interaction)) {
                return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
            }
        }

        if (action === 'start') {
            // Show modal (English)
            const modal = new ModalBuilder()
                .setCustomId('giveaway_create')
                .setTitle('Create a Giveaway')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('duration')
                            .setLabel('Duration *')
                            .setPlaceholder('Ex: 10 minutes')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('winners')
                            .setLabel('Number Of Winners *')
                            .setPlaceholder('1')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('prize')
                            .setLabel('Prize *')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('description')
                            .setLabel('Description')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
            return interaction.showModal(modal);
        } else if (action === 'join') {
            // Dropdown with all active giveaways
            const active = Object.entries(giveaways).filter(([id, g]) => !g.ended && g.endTimestamp > Date.now());
            if (active.length === 0) {
                return interaction.reply({ content: 'There are currently no active giveaways.', ephemeral: true });
            }
            const select = new StringSelectMenuBuilder()
                .setCustomId('giveaway_join_select')
                .setPlaceholder('Select a giveaway')
                .addOptions(
                    active.map(([id, g]) => ({
                        label: g.title,
                        description: g.description && g.description.length > 0 ? g.description.substring(0, 80) : undefined,
                        value: id
                    }))
                );
            const row = new ActionRowBuilder().addComponents(select);
            return interaction.reply({ content: 'Select a giveaway to join:', components: [row], ephemeral: true });
        } else if (action === 'end') {
            const id = interaction.options.getString('id');
            const g = giveaways[id] || Object.values(giveaways).find(g => g.title === id);
            if (!g || g.ended) {
                return interaction.reply({ content: '❌ No active giveaway found with this ID/title.', ephemeral: true });
            }
            await endGiveaway(client, id, g.channelId);
            return interaction.reply({ content: `The giveaway **${g.title}** has been ended.`, ephemeral: true });
        } else if (action === 'list') {
            const id = interaction.options.getString('id');
            const g = giveaways[id] || Object.values(giveaways).find(g => g.title === id);
            if (!g) {
                return interaction.reply({ content: '❌ No giveaway found with this ID/title.', ephemeral: true });
            }
            let list;
            if (g.participants.length > 0) {
                list = `**${g.participants.length} entries:**\n` +
                    g.participants.map((id, idx) => `${idx + 1}. <@${id}>`).join('\n');
            } else {
                list = 'No participants.';
            }
            const embed = new EmbedBuilder()
                .setTitle(`👥 Participants for ${g.title}`)
                .setDescription(list)
                .setColor('#ffaa00');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
    // Modal-Handler
    async handleModal(interaction) {
        if (interaction.customId !== 'giveaway_create') return;
        const durationStr = interaction.fields.getTextInputValue('duration');
        const winnersStr = interaction.fields.getTextInputValue('winners');
        const prize = interaction.fields.getTextInputValue('prize');
        const description = interaction.fields.getTextInputValue('description');
        const ms = parseDuration(durationStr);
        const winners = Math.max(1, parseInt(winnersStr) || 1);
        if (!ms || ms < 10000) {
            return interaction.reply({ content: '❌ Invalid duration. Use e.g. 10m, 2h, 1d.', ephemeral: true });
        }
        if (!prize) {
            return interaction.reply({ content: '❌ Prize cannot be empty.', ephemeral: true });
        }
        const endTimestamp = Date.now() + ms;
        const id = `${prize.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
        const giveaways = await loadGiveaways();
        giveaways[id] = {
            id,
            title: prize,
            description,
            endTimestamp,
            channelId: interaction.channel.id,
            participants: [],
            ended: false,
            winners,
            hostId: interaction.user.id
        };
        const embed = createGiveawayEmbed(giveaways[id]);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_join_${id}`)
                .setLabel('🎉 Join Giveaway')
                .setStyle(ButtonStyle.Success)
        );
        await interaction.reply({ content: 'Giveaway created!', embeds: [embed], components: [row] });
        const replyMsg = await interaction.fetchReply();
        giveaways[id].messageId = replyMsg.id;
        await saveGiveaways(giveaways);
    },
    // Button-Handler
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('giveaway_join_')) return;
        const id = interaction.customId.replace('giveaway_join_', '');
        const giveaways = await loadGiveaways();
        const g = giveaways[id];
        if (!g) {
            return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
        }
        if (g.ended) {
            return interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
        }
        if (g.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ You are already a participant!', ephemeral: true });
        }
        g.participants.push(interaction.user.id);
        await saveGiveaways(giveaways);
        // Update embed in channel
        if (g.messageId) {
            try {
                const channel = await interaction.client.channels.fetch(g.channelId);
                const msg = await channel.messages.fetch(g.messageId);
                const newEmbed = createGiveawayEmbed(g);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`giveaway_join_${id}`)
                        .setLabel('🎉 Join Giveaway')
                        .setStyle(ButtonStyle.Success)
                );
                await msg.edit({ embeds: [newEmbed], components: [row] });
            } catch (err) {
                console.error('Error updating giveaway embed:', err);
            }
        }
        return interaction.reply({ content: `You have joined the giveaway **${g.title}**! 🎉`, ephemeral: true });
    },
    // Select-Handler
    async handleSelect(interaction) {
        if (interaction.customId !== 'giveaway_join_select') return;
        const id = interaction.values[0];
        const giveaways = await loadGiveaways();
        const g = giveaways[id];
        if (!g) {
            return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
        }
        if (g.ended) {
            return interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
        }
        if (g.participants.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ You are already a participant!', ephemeral: true });
        }
        g.participants.push(interaction.user.id);
        await saveGiveaways(giveaways);
        // Update embed in channel
        if (g.messageId) {
            try {
                const channel = await interaction.client.channels.fetch(g.channelId);
                const msg = await channel.messages.fetch(g.messageId);
                const newEmbed = createGiveawayEmbed(g);
                await msg.edit({ embeds: [newEmbed] });
            } catch (err) {
                console.error('Error updating giveaway embed:', err);
            }
        }
        return interaction.reply({ content: `You have joined the giveaway **${g.title}**! 🎉`, ephemeral: true });
    },
    // Beim Bot-Start Timer für laufende Giveaways setzen
    async initGiveawayTimers(client) {
        const giveaways = await loadGiveaways();
        for (const id in giveaways) {
            const g = giveaways[id];
            if (!g.ended) {
                await scheduleGiveawayEnd(client, id, g.endTimestamp, g.channelId);
            }
        }
    }
};
