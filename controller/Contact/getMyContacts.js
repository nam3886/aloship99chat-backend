const { User } = require("../../models");
const { Op, Sequelize } = require("sequelize");

const getMyContacts = async (req, res) => {
  const user_id = req.authData.user_id;
  let { page = 1, per_page_message = 100, full_name } = req.body;

  try {
    // Return empty array if no search term provided
    if (!full_name || full_name.trim() === "") {
      return res.status(200).json({
        success: true,
        message: "Search term required",
        myContactList: [],
        pagination: {
          count: 0,
          currentPage: parseInt(page),
          totalPages: 0,
        },
      });
    }

    page = parseInt(page);
    const limit = parseInt(per_page_message);
    const offset = (page - 1) * limit;

    // Search in User model across multiple fields
    const searchConditions = {
      [Op.and]: [
        // Exclude the current user from results
        { user_id: { [Op.ne]: user_id } },
        // Search across multiple fields
        {
          [Op.or]: [
            { phone_number: { [Op.like]: `%${full_name}%` } },
            { email_id: { [Op.like]: `%${full_name}%` } },
            { first_name: { [Op.like]: `%${full_name}%` } },
            { last_name: { [Op.like]: `%${full_name}%` } },
            { user_name: { [Op.like]: `%${full_name}%` } },
            // Search in concatenated full name (first_name + space + last_name)
            {
              [Op.where]: Sequelize.literal(`CONCAT(first_name, ' ', last_name) LIKE '%${full_name.replace(/'/g, "''")}%'`)
            },
          ]
        }
      ]
    };

    // Get users matching search criteria
    const users = await User.findAll({
      where: searchConditions,
      attributes: [
        "user_id",
        "phone_number",
        "email_id",
        "first_name",
        "last_name",
        "user_name",
        "profile_image",
        "role"
      ],
      limit,
      offset,
    });

    // Get total count for pagination
    const totalCount = await User.count({ where: searchConditions });

    // Transform users to match expected response format
    const myContactList = users.map((user) => {
      const userData = user.toJSON();
      return {
        contact_id: userData.user_id, // Use user_id as contact_id
        phone_number: userData.phone_number,
        full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.user_name || 'Unknown User',
        user_id: userData.user_id,
        userDetails: {
          profile_image: userData.profile_image,
          user_id: userData.user_id,
          user_name: userData.user_name,
          email_id: userData.email_id,
          role: userData.role,
        }
      };
    });

    return res.status(200).json({
      success: true,
      message: "Contact list of who use our app",
      myContactList,
      pagination: {
        count: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getMyContacts };