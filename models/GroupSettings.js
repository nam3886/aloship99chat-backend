module.exports = (sequelize, DataTypes) => {
  const GroupSettings = sequelize.define("GroupSettings", {
    setting_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1 // Default to main group
    },
    enable_cooldown: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Enable/disable cooldown between driver actions"
    },
    cooldown_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      validate: {
        min: 0,
        max: 60
      },
      comment: "Cooldown time in minutes between driver actions"
    },
    auto_assign_orders: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Automatically assign orders to available drivers"
    },
    max_orders_per_driver: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      comment: "Maximum concurrent orders per driver"
    },
    order_timeout_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: "Time before unaccepted orders expire"
    },
    allow_driver_cancellation: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Allow drivers to cancel orders"
    },
    require_photo_proof: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Require photo proof for delivery completion"
    },
    min_driver_rating: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 3.0,
      validate: {
        min: 0,
        max: 5
      },
      comment: "Minimum rating required for drivers to receive orders"
    },
    enable_notifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Enable push notifications for new orders"
    },
    working_hours_start: {
      type: DataTypes.TIME,
      defaultValue: '08:00:00',
      comment: "Start of working hours"
    },
    working_hours_end: {
      type: DataTypes.TIME,
      defaultValue: '22:00:00',
      comment: "End of working hours"
    },
    weekend_working: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Allow orders on weekends"
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  });

  GroupSettings.associate = function(models) {
    GroupSettings.belongsTo(models.Conversation, { 
      foreignKey: "conversation_id" 
    });
    GroupSettings.belongsTo(models.User, { 
      foreignKey: "updated_by",
      as: "UpdatedBy"
    });
  };

  return GroupSettings;
};