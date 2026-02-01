const { DriverRating } = require("../../models");

const deleteDriverRating = async (req, res) => {
  try {
    const userRole = req.authData.role;
    const { rating_id } = req.params;

    // Check permissions - admin and vice_admin can delete ratings
    if (userRole !== 'admin' && userRole !== 'vice_admin') {
      return res.status(403).json({
        status: false,
        message: "Only admin and vice admin can delete driver ratings"
      });
    }

    // Find the rating
    const rating = await DriverRating.findOne({
      where: { rating_id }
    });

    if (!rating) {
      return res.status(404).json({
        status: false,
        message: "Rating not found"
      });
    }

    // Delete the rating
    await rating.destroy();

    return res.status(200).json({
      status: true,
      message: "Driver rating deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting driver rating:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while deleting rating"
    });
  }
};

module.exports = { deleteDriverRating };
