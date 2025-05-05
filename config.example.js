module.exports = {
  token: 'your_discord_bot_token',
  guildId: 'your_guild_id',
  API: {
    HypixelAPIKEY: 'your_hypixel_api_key',
    guildName: 'Skyblock Teachers',
  },
  rulesCommand: {
    rulesChannelId: 'your_rules_channel_id',
  },
  ticketCommand: {
    ticketCategoryId: 'your_ticket_category_id',
  },
  permissionscheck: {
    ALLOWED_ROLE_IDS:
         ['your_role_id_1', 'your_role_id_2'],
    ALLOWED_USER_IDS:
         ['your_user_id_1', 'your_user_id_2'],
  },
  dailyQuestCommand: {
    dailyQuestWebhookURL: 'your_webhook_url',
    dailyQuestDifficulties: {
      easy:      { min: 10000, max: 50000, label: 'Easy' },
      normal:    { min: 100000, max: 300000, label: 'Normal' },
      hard:      { min: 500000, max: 1000000, label: 'Hard' },
      superhard: { min: 1000000, max: 1500000, label: 'Super Hard' },
      impossible:{ min: 2000000, max: 5000000, label: 'Impossible' },
    }
  },
}; 