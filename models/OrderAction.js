module.exports = (sequelize, DataTypes) => {
  const OrderAction = sequelize.define("OrderAction", {
    action_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    action_type: {
      type: DataTypes.ENUM('accept', 'ignore'),
      allowNull: false
    },
    action_timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  OrderAction.associate = function(models) {
    OrderAction.belongsTo(models.Order, { foreignKey: "order_id" });
    OrderAction.belongsTo(models.User, { foreignKey: "user_id" });
  };

  return OrderAction;
};