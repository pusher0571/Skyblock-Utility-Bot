//To use this command you need to modify your Category Permissions in discord. Make it a private category and set everyone to view=false. Support, admins etc. 
//will be set on true. In the server permissions @everyone should be set to view=false. Then make a member role and set it to view=false. Edit every category 
// so @everyone is set to false and the member role is set to true except for the ticket category. 
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAuthorized, ALLOWED_ROLE_IDS } = require('../permissionUtils');
const config = require('../config');

function createTicketMessage() {
    const embed = new EmbedBuilder()
        .setTitle('Ticket System')
        .setDescription('Want to open a ticket?')
        .setColor('#0099ff');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Open Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

    return { embeds: [embed], components: [row] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a permanent ticket message')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel where the ticket message should be posted')
                .setRequired(true)),
    
    async execute(interaction) {
        if (!isAuthorized(interaction)) {
            return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        
        try {
            const messages = await channel.messages.fetch();
            await channel.bulkDelete(messages);
        } catch (error) {
            console.error('Error deleting messages:', error);
        }

        const ticketMessage = await channel.send(createTicketMessage());
        
        await ticketMessage.pin();

        await interaction.reply({ content: '✅ Ticket message has been created and pinned!', ephemeral: true });
    },

    async handleButton(interaction) {
        if (interaction.customId === 'create_ticket') {
            try {
                console.log('Starting ticket creation...');
                
                const category = await interaction.guild.channels.fetch(config.ticketCommand.ticketCategoryId);
                
                if (!category) {
                    return interaction.reply({ 
                        content: '❌ Could not find the ticket category. Please contact an administrator.', 
                        ephemeral: true 
                    });
                }
                
                const existingTicket = category.children.cache.find(
                    channel => channel.name.startsWith(`ticket-${interaction.user.username.toLowerCase()}`)
                );

                if (existingTicket) {
                    return interaction.reply({ 
                        content: `❌ You already have an open ticket: ${existingTicket}`, 
                        ephemeral: true 
                    });
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username.toLowerCase()}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        }
                    ],
                });

                const embed = new EmbedBuilder()
                    .setTitle('Ticket Created')
                    .setDescription(`Ticket created for ${interaction.user}`)
                    .setColor('#0099ff');

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Close Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                await ticketChannel.send({ 
                    content: `${interaction.user}`, 
                    embeds: [embed], 
                    components: [row] 
                });

                await interaction.reply({ 
                    content: `✅ Your ticket has been created: ${ticketChannel}`, 
                    ephemeral: true 
                });

            } catch (error) {
                console.error('Error creating ticket:', error);
                await interaction.reply({ 
                    content: `❌ Error: ${error.message}`, 
                    ephemeral: true 
                });
            }
        } else if (interaction.customId === 'close_ticket') {
            try {
                console.log('Starting ticket close process...');
                const channel = interaction.channel;
                
                if (!channel.name.startsWith('ticket-')) {
                    return interaction.reply({ 
                        content: '❌ This command can only be used in ticket channels!', 
                        ephemeral: true 
                    });
                }

                console.log('Current channel name:', channel.name);

                const username = channel.name.replace('ticket-', '');
                console.log('Extracted username:', username);

                const embed = new EmbedBuilder()
                    .setTitle('Ticket Closed')
                    .setDescription(`This ticket has been closed by ${interaction.user}`)
                    .setColor('#ff0000');

                await interaction.reply({ embeds: [embed] });
                console.log('Sent close confirmation message');

                const creatorPermission = channel.permissionOverwrites.cache.find(
                    perm => perm.type === 1 && perm.allow.has(PermissionFlagsBits.ViewChannel)
                );

                if (creatorPermission) {
                    console.log('Removing ticket creator permissions...');

                    await channel.permissionOverwrites.edit(creatorPermission.id, {
                        ViewChannel: false,
                        SendMessages: false
                    });
                    console.log('Permissions updated successfully');
                }

                console.log('Attempting to rename channel to:', `closed-${username}`);
                await channel.setName(`closed-${username}`);
                console.log('Channel renamed successfully');

            } catch (error) {
                console.error('Error in close ticket process:', error);
                await interaction.followUp({ 
                    content: `❌ Error: ${error.message}`, 
                    ephemeral: true 
                });
            }
        }
    }
};
