const { User, ConversationsUser } = require("../../models");
const socketService = require("../../reusable/socketService");
const { UserSocket } = require("../../models");

const changeRole = async (req, res) => {
  try {
    const admin_id = req.authData.user_id;
    const adminRole = req.authData.role;
    const { user_id, new_role } = req.body;

    const isAdmin = await ConversationsUser.findOne({
      where: {
        conversation_id: 1,
        user_id: admin_id,
        is_admin: true
      }
    });

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required"
      });
    }

    const targetUser = await User.findOne({
      where: { user_id }
    });

    if (!targetUser) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    if (!new_role) {
      return res.status(400).json({
        status: false,
        message: "new_role is required"
      });
    }

    if (!['admin', 'vice_admin', 'driver'].includes(new_role)) {
      return res.status(400).json({
        status: false,
        message: "Invalid role. Must be admin, vice_admin, or driver"
      });
    }

    const updateData = { role: new_role };

    // Update group admin status based on role
    if (new_role === 'admin') {
      await ConversationsUser.update(
        { is_admin: true },
        {
          where: {
            conversation_id: 1,
            user_id
          }
        }
      );
    } else {
      await ConversationsUser.update(
        { is_admin: false },
        {
          where: {
            conversation_id: 1,
            user_id
          }
        }
      );
    }

    await User.update(updateData, {
      where: { user_id }
    });

    const updatedUser = await User.findOne({
      where: { user_id },
      attributes: ['user_id', 'phone_number', 'role', 'first_name', 'last_name']
    });

    const userSocketIds = await UserSocket.findAll({
      where: { user_id }
    });

    userSocketIds.forEach((socketData) => {
      socketService
        .getIo()
        .to(socketData.dataValues.socketId)
        .emit("roleChanged", {
          user_id,
          new_role: updatedUser.role
        });
    });

    return res.status(200).json({
      status: true,
      message: "User role updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("Error changing role:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while changing the role"
    });
  }
};

module.exports = { changeRole };