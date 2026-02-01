const { DriverRating, User } = require("../../models");
const sequelize = require("../../models").sequelize;

const createDriverRating = async (req, res) => {
  try {
    const userRole = req.authData.role;
    const {
      driver_id,
      star_rating,
      feedback
    } = req.body;

    // Check permissions - admin and vice_admin can rate drivers
    if (userRole !== 'admin' && userRole !== 'vice_admin') {
      return res.status(403).json({
        status: false,
        message: "Only admin and vice admin can rate drivers"
      });
    }

    // Validate required fields
    if (!driver_id || !star_rating) {
      return res.status(400).json({
        status: false,
        message: "Driver ID and star rating are required"
      });
    }

    // Validate star rating
    if (star_rating < 1 || star_rating > 5) {
      return res.status(400).json({
        status: false,
        message: "Star rating must be between 1 and 5"
      });
    }

    // Check if driver exists and is actually a driver
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

    // Check if driver already has a rating
    const existingRating = await DriverRating.findOne({
      where: { driver_id }
    });

    let rating;
    let isUpdate = false;

    if (existingRating) {
      // Update existing rating
      await existingRating.update({
        star_rating,
        feedback
      });
      rating = existingRating;
      isUpdate = true;
    } else {
      // Create new rating
      rating = await DriverRating.create({
        driver_id,
        star_rating,
        feedback
      });
    }

    // Get the rating with associations
    const fullRating = await DriverRating.findOne({
      where: { rating_id: rating.rating_id },
      include: [
        {
          model: User,
          as: 'Driver',
          attributes: ['user_id', 'first_name', 'last_name', 'phone_number']
        }
      ]
    });

    return res.status(isUpdate ? 200 : 201).json({
      status: true,
      message: isUpdate ? "Driver rating updated successfully" : "Driver rating created successfully",
      data: {
        rating_id: fullRating.rating_id,
        driver: {
          user_id: fullRating.Driver.user_id,
          name: `${fullRating.Driver.first_name} ${fullRating.Driver.last_name}`,
          phone_number: fullRating.Driver.phone_number
        },
        star_rating: fullRating.star_rating,
        feedback: fullRating.feedback,
        createdAt: fullRating.createdAt,
        ...(isUpdate && { updatedAt: fullRating.updatedAt })
      }
    });

  } catch (error) {
    console.error("Error creating/updating driver rating:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while processing rating"
    });
  }
};

module.exports = { createDriverRating };