const { OrderAction, GroupSettings } = require("../models");

/**
 * Checks if a driver must wait due to cooldown settings
 * @param {number} user_id - Driver's user_id
 * @param {number} conversation_id - Group conversation ID (default 1)
 * @throws {Error} If cooldown period hasn't elapsed
 */
const checkCooldown = async (user_id, conversation_id = 1) => {
  // Get group settings
  const settings = await GroupSettings.findOne({
    where: { conversation_id }
  });

  // If cooldown is disabled, allow action
  if (!settings || !settings.enable_cooldown) {
    return; // No cooldown check needed
  }

  // Get cooldown duration from settings
  const cooldownMinutes = settings.cooldown_minutes || 0;

  // If cooldown is 0 minutes, allow action
  if (cooldownMinutes === 0) {
    return;
  }

  // Get driver's last action
  const lastAction = await OrderAction.findOne({
    where: { user_id },
    order: [['action_timestamp', 'DESC']]
  });

  // If no previous action, allow
  if (!lastAction) {
    return;
  }

  // Calculate cooldown period
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const cooldownEndsAt = new Date(lastAction.action_timestamp.getTime() + cooldownMs);
  const now = new Date();

  // Check if cooldown period has elapsed
  if (cooldownEndsAt > now) {
    const remainingMs = cooldownEndsAt.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);

    throw new Error(
      `Hãy đợi ${remainingMinutes} phút trước khi thực hiện hành động đặt hàng tiếp theo của bạn.`
    );
  }
};

module.exports = { checkCooldown };
