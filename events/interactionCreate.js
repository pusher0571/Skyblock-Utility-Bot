module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Slash-Commands
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Something went wrong executing this command!', ephemeral: true });
            }
            return;
        }
        // Modal-Interaktionen
        if (interaction.isModalSubmit()) {
            for (const cmd of interaction.client.commands.values()) {
                if (typeof cmd.handleModal === 'function') {
                    try { await cmd.handleModal(interaction); } catch (error) { console.error(error); }
                }
            }
            return;
        }
        // Select-Interaktionen
        if (interaction.isStringSelectMenu()) {
            for (const cmd of interaction.client.commands.values()) {
                if (typeof cmd.handleSelect === 'function') {
                    try { await cmd.handleSelect(interaction); } catch (error) { console.error(error); }
                }
            }
            return;
        }
        // Button-Interaktionen (optional, falls noch benötigt)
        if (interaction.isButton()) {
            for (const cmd of interaction.client.commands.values()) {
                if (typeof cmd.handleButton === 'function') {
                    try { await cmd.handleButton(interaction); } catch (error) { console.error(error); }
                }
            }
            return;
        }
    }
};
  