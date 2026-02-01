module.exports = (sequelize, DataTypes) => {
  const ProfileRequest = sequelize.define("ProfileRequest", {
    request_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'user_id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    // Driver-submitted fields
    address: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    profile_image: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    license_plate: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    identification_front_image: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    identification_back_image: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    driving_license_image: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    // Admin processing
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Used for approval notes or rejection reason'
    },
    processed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'user_id'
      },
      comment: 'Admin user_id who approved/rejected'
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  ProfileRequest.associate = function(models) {
    ProfileRequest.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "User"
    });
    ProfileRequest.belongsTo(models.User, {
      foreignKey: "processed_by",
      as: "ProcessedBy"
    });
  };

  return ProfileRequest;
};
