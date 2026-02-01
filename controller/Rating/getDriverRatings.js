const { DriverRating, User } = require("../../models");

const getDriverRatings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      driver_id,
      star_rating
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = {};

    // Filter by driver_id if provided
    if (driver_id) {
      whereClause.driver_id = driver_id;
    }

    // Filter by star rating if provided
    if (star_rating) {
      whereClause.star_rating = star_rating;
    }

    const ratings = await DriverRating.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'Driver',
          attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'profile_image']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const formattedRatings = ratings.rows.map(rating => ({
      rating_id: rating.rating_id,
      driver: {
        user_id: rating.Driver.user_id,
        name: `${rating.Driver.first_name} ${rating.Driver.last_name}`,
        phone_number: rating.Driver.phone_number,
        profile_image: rating.Driver.profile_image
      },
      star_rating: rating.star_rating,
      feedback: rating.feedback,
      createdAt: rating.createdAt
    }));

    const totalPages = Math.ceil(ratings.count / limit);

    return res.status(200).json({
      status: true,
      message: "Driver ratings retrieved successfully",
      data: {
        ratings: formattedRatings,
        pagination: {
          total: ratings.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Error getting driver ratings:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching ratings"
    });
  }
};

module.exports = { getDriverRatings };
