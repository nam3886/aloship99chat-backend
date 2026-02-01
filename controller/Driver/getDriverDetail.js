const { User } = require("../../models");

const getDriverDetail = async (req, res) => {
  try {
    const { driver_id } = req.params;

    // Get driver with profile and ratings (automatically included via defaultScope)
    const driver = await User.findOne({
      where: {
        user_id: driver_id,
        role: 'driver',
        is_account_deleted: false
      }
    });

    if (!driver) {
      return res.status(404).json({
        status: false,
        message: "Driver not found"
      });
    }

    // Convert to plain object
    const driverData = driver.get({ plain: true });
    const profileData = driver.profile ? (driver.profile.get ? driver.profile.get({ plain: true }) : driver.profile) : null;

    // Format response
    const response = {
      ...driverData,
      profile: profileData,
      rating: driverData.rating,
    };

    return res.status(200).json({
      status: true,
      message: "Driver details retrieved successfully",
      data: response
    });

  } catch (error) {
    console.error("Error getting driver details:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching driver details"
    });
  }
};

module.exports = { getDriverDetail };