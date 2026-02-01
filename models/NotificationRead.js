module.exports = (sequelize, DataTypes) => {
  const NotificationRead = sequelize.define("NotificationRead", {
    read_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    notification_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  });

  NotificationRead.associate = function(models) {
    NotificationRead.belongsTo(models.Notification, { 
      foreignKey: "notification_id" 
    });
    NotificationRead.belongsTo(models.User, { 
      foreignKey: "user_id" 
    });
  };

  return NotificationRead;
};