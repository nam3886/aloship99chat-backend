module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    notification_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    target_driver_ids: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ""  // Empty string = all drivers, "5,7,9" = specific drivers
    },
    type: {
      type: DataTypes.ENUM('normal', 'important'),
      defaultValue: 'normal'
    }
  });

  Notification.associate = function(models) {
    Notification.belongsTo(models.User, { 
      foreignKey: "created_by", 
      as: "Creator" 
    });
    Notification.hasMany(models.NotificationRead, { 
      foreignKey: "notification_id" 
    });
  };

  return Notification;
};