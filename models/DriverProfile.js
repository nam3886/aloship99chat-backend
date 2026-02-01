module.exports = (sequelize, DataTypes) => {
  const DriverProfile = sequelize.define("DriverProfile", {
    profile_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    identification_front_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    identification_back_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    driving_license_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deposit_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    registration_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    license_plate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    interviewer_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    interview_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    can_create_order: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Permission for driver to create order messages'
    }
  });

  DriverProfile.associate = function(models) {
    DriverProfile.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "User"
    });
  };

  return DriverProfile;
};