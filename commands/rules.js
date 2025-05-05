const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAuthorized } = require('../permissionUtils');

const rules = [
    {
        title: "1️⃣ Common Sense",
        description: "Use your common sense and be respectful to others. Treat everyone with kindness and understanding."
    },
    {
        title: "2️⃣ Bridge Chat Rules",
        description: "Keep the bridge chat clean and friendly. No profanity or inappropriate language is allowed in the bridge channel."
    },
    {
        title: "3️⃣ Respect Boundaries",
        description: "Respect other members' boundaries and personal space. Harassment or unwanted attention will not be tolerated."
    },
    {
        title: "4️⃣ Hypixel TOS",
        description: "All members must follow the Hypixel Terms of Service. Any violations will be reported to Hypixel staff."
    },
    {
        title: "5️⃣ NSFW Content",
        description: "No NSFW content is allowed in any public channels. What you do in private chats is your own business."
    },
    {
        title: "6️⃣ Reporting Members",
        description: "If you notice any rule violations or suspicious behavior, please report it to the staff team immediately."
    },
    {
        title: "7️⃣ No Arguments",
        description: "Keep discussions civil. If a disagreement arises, take it to private messages or contact staff for mediation."
    },
    {
        title: "8️⃣ Staff Communication",
        description: "Please use the bridge channel for questions that can be answered there. Only DM staff for urgent or private matters."
    },
    {
        title: "9️⃣ Language",
        description: "This is an international guild. Please keep all public communications in English to ensure everyone can participate."
    }
];

function createRulesEmbed(guild) {
    const iconURL = "https://i.imgur.com/1Cak3Mo.png";
    const embed = new EmbedBuilder()
        .setTitle('📜 Server Rules')
        .setColor('#5865F2')
        .setThumbnail(iconURL)
        .setDescription('Please read and follow these rules to maintain a friendly and welcoming community.')
        .setTimestamp()
        .setFooter({ 
            text: `${guild.name} • Rules`, 
            iconURL: iconURL
        });

    rules.forEach(rule => {
        embed.addFields({ name: rule.title, value: rule.description, inline: false });
    });

    embed.addFields({
        name: "⚠️ Important Note",
        value: "Breaking these rules may result in warnings, mutes, or bans depending on the severity of the offense.",
        inline: false
    });

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Displays the server rules'),
    async execute(interaction) {
        if (!isAuthorized(interaction)) {
            return interaction.reply({ content: '❌ Insufficient permissions', ephemeral: true });
        }
        try {
            const embed = createRulesEmbed(interaction.guild);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in Rules command:', error);
            await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
        }
    },
    createRulesEmbed
}; 