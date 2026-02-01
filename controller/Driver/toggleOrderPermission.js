const { DriverProfile, User } = require("../../models");

const toggleOrderPermission = async (req, res) => {
  try {
    const { driver_id } = req.params;
    const { can_create_order } = req.body;

    // Validate can_create_order is boolean
    if (typeof can_create_order !== 'boolean') {
      return res.status(400).json({
        status: false,
        message: "can_create_order must be a boolean value (true/false)"
      });
    }

    // Check if driver exists
    const driver = await User.findOne({
      where: {
        user_id: driver_id,
        role: 'driver'
      }
    });

    if (!driver) {
      return res.status(404).json({
        status: false,
        message: "Driver not found"
      });
    }

    // Find driver profile
    const driverProfile = await DriverProfile.findOne({
      where: { user_id: driver_id }
    });

    if (!driverProfile) {
      return res.status(404).json({
        status: false,
        message: "Driver profile not found"
      });
    }

    // Update permission
    await driverProfile.update({
      can_create_order
    });

    return res.status(200).json({
      status: true,
      message: `Order creation permission ${can_create_order ? 'granted' : 'revoked'} successfully`,
      data: {
        driver_id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        can_create_order
      }
    });

  } catch (error) {
    console.error("Error toggling order permission:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating permission"
    });
  }
};

module.exports = { toggleOrderPermission };
