const jwt = require("jsonwebtoken");
const {
  User,
  Chat,
  Block,
  Conversation,
  ConversationsUser,
  AllContact,
} = require("../../../models");
const { Op } = require("sequelize");

const getGroupMembers = async (req, res) => {
  let { conversation_id, role_filter } = req.body; // role_filter: 'vice_admin', 'driver', 'admin'
  const user_id = req.authData.user_id;

  if (conversation_id == "" || conversation_id == undefined) {
    return res.status(400).json({
      success: false,
      message: "conversation_id parameter is required!",
    });
  }

  try {
    // Build where clause for User based on role_filter
    let userWhereClause = {};
    if (role_filter) {
      userWhereClause.role = role_filter;
    }

    let ConversationsUserList = await ConversationsUser.findAll({
      where: {
        conversation_id,
      },
      attributes: ["is_admin", "conversations_user_id", "createdAt"],
      include: [
        {
          model: User,
          where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined,
          attributes: [
            "user_id",
            "phone_number",
            "country_code",
            "profile_image",
            "country",
            "user_name",
            "first_name",
            "last_name",
            "role",
            "Blocked_by_admin",
          ],
        },
      ],
    });

    if (ConversationsUserList.length == 0) {
      return res
        .status(200)
        .json({
          status: true,
          message: role_filter ? `No ${role_filter} found in this group` : "No members found",
          ConversationsUserList: []
        });
    }

    ConversationsUserList = await Promise.all(
      ConversationsUserList.map(async (item) => {
        item = item.toJSON();

        let userDetails = await AllContact.findOne({
          where: {
            phone_number: item.User.phone_number,
            user_id,
          },
          attributes: ["full_name"],
        });

        return {
          ...item,
          User: {
            ...item.User,
            user_name:
              userDetails?.full_name ||
              `${item.User?.first_name} ${item.User?.last_name}`,
          },
        };
      })
    );

    return res.status(200).json({
      status: true,
      total_members: ConversationsUserList.length,
      role_filter: role_filter || 'all',
      ConversationsUserList,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = { getGroupMembers };