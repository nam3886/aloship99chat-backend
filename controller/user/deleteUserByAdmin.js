const { User, ConversationsUser, Chat } = require("../../models");
const EmitDataInGroup = require("../Chat/Group/EmitDataInGroup");

const deleteUserByAdmin = async (req, res) => {
  try {
    const adminId = req.authData.user_id;
    const userRole = req.authData.role;
    const { user_id, conversation_id } = req.body;

    // Validate required fields
    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required"
      });
    }

    if (!conversation_id) {
      return res.status(400).json({
        status: false,
        message: "conversation_id is required"
      });
    }

    // Check if user exists
    const user = await User.findOne({
      where: { user_id }
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Vice admin can only delete drivers
    if (userRole === 'vice_admin' && user.role !== 'driver') {
      return res.status(403).json({
        status: false,
        message: "Vice admin can only delete driver accounts"
      });
    }

    // Prevent deleting the admin account (even by admin)
    if (user.role === 'admin') {
      return res.status(403).json({
        status: false,
        message: "Cannot delete admin account"
      });
    }

    // Check if user is in the group
    const userInGroup = await ConversationsUser.findOne({
      where: {
        conversation_id,
        user_id
      }
    });

    // Step 1: Remove user from the group if they are in it
    if (userInGroup) {
      await ConversationsUser.destroy({
        where: {
          conversation_id,
          user_id
        }
      });

      // Step 2: Create a message indicating member was removed
      await Chat.create({
        message: adminId,
        message_type: "member_removed",
        senderId: user_id,
        conversation_id
      });
    }

    // Step 3: Set is_account_deleted to true
    await User.update(
      {
        is_account_deleted: true,
        one_signal_player_id: "",
        device_token: ""
      },
      {
        where: { user_id }
      }
    );

    // Step 4: Emit event to notify the group (only if user was in the group)
    if (userInGroup) {
      await EmitDataInGroup(conversation_id, "update_data", {
        conversation_id: conversation_id,
        delete_from_everyone_id: []
      });
    }

    return res.status(200).json({
      status: true,
      message: userInGroup
        ? "User removed from group and account deleted successfully"
        : "User account deleted successfully",
      data: {
        user_id,
        conversation_id,
        is_account_deleted: true
      }
    });

  } catch (error) {
    console.error("Error deleting user by admin:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while deleting the user",
      error: error.message
    });
  }
};

module.exports = { deleteUserByAdmin };
