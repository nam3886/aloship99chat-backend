const { DriverRating, User } = require("../../models");

const getDriverRatingDetail = async (req, res) => {
  try {
    const { rating_id } = req.params;

    const rating = await DriverRating.findOne({
      where: { rating_id },
      include: [
        {
          model: User,
          as: 'Driver',
          attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'profile_image', 'email_id']
        }
      ]
    });

    if (!rating) {
      return res.status(404).json({
        status: false,
        message: "Rating not found"
      });
    }

    return res.status(200).json({
      status: true,
      message: "Driver rating retrieved successfully",
      data: {
        rating_id: rating.rating_id,
        driver: {
          user_id: rating.Driver.user_id,
          name: `${rating.Driver.first_name} ${rating.Driver.last_name}`,
          phone_number: rating.Driver.phone_number,
          profile_image: rating.Driver.profile_image,
          email_id: rating.Driver.email_id
        },
        star_rating: rating.star_rating,
        feedback: rating.feedback,
        createdAt: rating.createdAt,
        updatedAt: rating.updatedAt
      }
    });

  } catch (error) {
    console.error("Error getting driver rating detail:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching rating detail"
    });
  }
};

module.exports = { getDriverRatingDetail };
