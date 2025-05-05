const config = require('./config.js');
const ALLOWED_ROLE_IDS = config.permissionscheck.ALLOWED_ROLE_IDS;
const ALLOWED_USER_IDS = config.permissionscheck.ALLOWED_USER_IDS;

// Prüft, ob der User berechtigt ist
function isAuthorized(interaction) {
  // Direkt freigeben, wenn User explizit erlaubt ist
  if (ALLOWED_USER_IDS.includes(interaction.user.id)) return true;
  // Rollen prüfen (nur bei Guild-Commands)
  if (interaction.member && interaction.member.roles) {
    return interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
  }
  return false;
}

module.exports = { isAuthorized };
