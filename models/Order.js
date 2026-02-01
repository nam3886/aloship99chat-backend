module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define("Order", {
    order_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    customer_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    delivery_location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('open', 'assigned', 'in_delivery', 'completed', 'cancelled'),
      defaultValue: 'open'
    },
    assigned_driver_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    completed_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    completed_delivery_location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    driver_note: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  Order.associate = function(models) {
    Order.belongsTo(models.Chat, { foreignKey: "message_id" });
    Order.belongsTo(models.User, { foreignKey: "assigned_driver_id", as: "Driver" });
    Order.hasMany(models.OrderAction, { foreignKey: "order_id" });
  };

  return Order;
};