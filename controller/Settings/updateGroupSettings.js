const { GroupSettings, User } = require("../../models");

const updateGroupSettings = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const { conversation_id = 1 } = req.body;

    // Extract settings from request body
    const {
      enable_cooldown,
      cooldown_minutes,
      auto_assign_orders,
      max_orders_per_driver,
      order_timeout_minutes,
      allow_driver_cancellation,
      require_photo_proof,
      min_driver_rating,
      enable_notifications,
      working_hours_start,
      working_hours_end,
      weekend_working
    } = req.body;

    // Find existing settings or create new
    let settings = await GroupSettings.findOne({
      where: { conversation_id }
    });

    const updateData = {
      updated_by: user_id
    };

    // Only update fields that are provided
    if (enable_cooldown !== undefined) updateData.enable_cooldown = enable_cooldown;
    if (cooldown_minutes !== undefined) {
      // Validate cooldown minutes
      if (cooldown_minutes < 0 || cooldown_minutes > 60) {
        return res.status(400).json({
          status: false,
          message: "Cooldown minutes must be between 0 and 60"
        });
      }
      updateData.cooldown_minutes = cooldown_minutes;
    }
    if (auto_assign_orders !== undefined) updateData.auto_assign_orders = auto_assign_orders;
    if (max_orders_per_driver !== undefined) updateData.max_orders_per_driver = max_orders_per_driver;
    if (order_timeout_minutes !== undefined) updateData.order_timeout_minutes = order_timeout_minutes;
    if (allow_driver_cancellation !== undefined) updateData.allow_driver_cancellation = allow_driver_cancellation;
    if (require_photo_proof !== undefined) updateData.require_photo_proof = require_photo_proof;
    if (min_driver_rating !== undefined) {
      // Validate rating
      if (min_driver_rating < 0 || min_driver_rating > 5) {
        return res.status(400).json({
          status: false,
          message: "Minimum driver rating must be between 0 and 5"
        });
      }
      updateData.min_driver_rating = min_driver_rating;
    }
    if (enable_notifications !== undefined) updateData.enable_notifications = enable_notifications;
    if (working_hours_start !== undefined) updateData.working_hours_start = working_hours_start;
    if (working_hours_end !== undefined) updateData.working_hours_end = working_hours_end;
    if (weekend_working !== undefined) updateData.weekend_working = weekend_working;

    if (settings) {
      // Update existing settings
      await settings.update(updateData);
    } else {
      // Create new settings
      updateData.conversation_id = conversation_id;
      settings = await GroupSettings.create(updateData);
    }

    // Reload with associations
    settings = await GroupSettings.findOne({
      where: { setting_id: settings.setting_id },
      include: [{
        model: User,
        as: 'UpdatedBy',
        attributes: ['user_id', 'first_name', 'last_name', 'role']
      }]
    });

    const response = {
      setting_id: settings.setting_id,
      conversation_id: settings.conversation_id,
      cooldown_settings: {
        enable_cooldown: settings.enable_cooldown,
        cooldown_minutes: settings.cooldown_minutes
      },
      order_settings: {
        auto_assign_orders: settings.auto_assign_orders,
        max_orders_per_driver: settings.max_orders_per_driver,
        order_timeout_minutes: settings.order_timeout_minutes,
        allow_driver_cancellation: settings.allow_driver_cancellation,
        require_photo_proof: settings.require_photo_proof
      },
      driver_settings: {
        min_driver_rating: settings.min_driver_rating
      },
      notification_settings: {
        enable_notifications: settings.enable_notifications
      },
      working_hours: {
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
        weekend_working: settings.weekend_working
      },
      last_updated: {
        updatedAt: settings.updatedAt,
        updated_by: settings.UpdatedBy ? {
          user_id: settings.UpdatedBy.user_id,
          name: `${settings.UpdatedBy.first_name} ${settings.UpdatedBy.last_name}`,
          role: settings.UpdatedBy.role
        } : null
      }
    };

    return res.status(200).json({
      status: true,
      message: "Settings updated successfully",
      data: response
    });

  } catch (error) {
    console.error("Error updating group settings:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating settings"
    });
  }
};

module.exports = { updateGroupSettings };