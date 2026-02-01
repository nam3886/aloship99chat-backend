module.exports = (sequelize, DataTypes) => {
  const DriverRating = sequelize.define("DriverRating", {
    rating_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    driver_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    star_rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  DriverRating.associate = function(models) {
    DriverRating.belongsTo(models.User, {
      foreignKey: "driver_id",
      as: "Driver"
    });
  };

  return DriverRating;
};