const { GroupSettings, User } = require("../../models");

const getGroupSettings = async (req, res) => {
  try {
    const { conversation_id = 1 } = req.query;

    // Get settings or create default if not exists
    let settings = await GroupSettings.findOne({
      where: { conversation_id },
      include: [{
        model: User,
        as: 'UpdatedBy',
        attributes: ['user_id', 'first_name', 'last_name', 'role']
      }]
    });

    if (!settings) {
      // Create default settings
      settings = await GroupSettings.create({
        conversation_id
      });

      settings = await GroupSettings.findOne({
        where: { conversation_id },
        include: [{
          model: User,
          as: 'UpdatedBy',
          attributes: ['user_id', 'first_name', 'last_name', 'role']
        }]
      });
    }

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
      message: "Settings retrieved successfully",
      data: response
    });

  } catch (error) {
    console.error("Error getting group settings:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching settings"
    });
  }
};

module.exports = { getGroupSettings };