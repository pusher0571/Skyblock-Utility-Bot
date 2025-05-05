// events/ready.js
// this event automatically sends the rules embed to the rules channel when the bot is online

const { EmbedBuilder } = require('discord.js');
const rules = require('../commands/rules.js');
const config = require('../config.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Bot is online as ${client.user.tag}`);
        
        const rulesChannelId = config.rulesCommand.rulesChannelId;
        if (!rulesChannelId) {
            console.error('Rules channel ID not set!');
            return;
        }

        const rulesChannel = await client.channels.fetch(rulesChannelId);
        if (!rulesChannel) {
            console.error('Rules channel not found!');
            return;
        }

        try {
            // Delete old messages in the rules channel
            const messages = await rulesChannel.messages.fetch({ limit: 100 });
            await rulesChannel.bulkDelete(messages);

            // Create and send the new rules embed
            const embed = rules.createRulesEmbed(rulesChannel.guild);
            await rulesChannel.send({ embeds: [embed] });
            
            console.log('✅ Rules have been updated successfully');
        } catch (error) {
            console.error('Error updating rules:', error);
        }
    }
};
  