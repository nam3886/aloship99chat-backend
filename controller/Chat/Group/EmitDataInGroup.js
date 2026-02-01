const { ConversationsUser, UserSocket } = require("../../../models");
// const socketService = require("../../../reusable/socketService");

/**
 * Emit data to all users in a conversation (group or one-to-one) via socket.
 *
 * @param {number} conversation_id - The ID of the conversation (group or single chat).
 * @param {string} event_name - The name of the event to emit.
 * @param {any} data - The data to send to the receivers.
 *
 * @returns {Promise<void>} - A Promise that resolves when the event is sent to all users.
 *
 * This function fetches all users in a conversation, identifies their socket IDs,
 * and emits the provided event with data to each of their sockets.
 */
const EmitDataInGroup = async (conversation_id, event_name, data) => {
  try {
    const { Op } = require("sequelize");

    // OPTIMIZED: Fetch users from the conversation
    const ConversationsUserList = await ConversationsUser.findAll({
      where: {
        conversation_id,
      },
      attributes: ["user_id"],
    });

    // Collect receiver IDs
    const receiverIdList = ConversationsUserList.map((user) => user.user_id);

    if (receiverIdList.length === 0) {
      return; // No users in conversation
    }

    // OPTIMIZED: Fetch all sockets for all users in ONE query instead of N queries
    // This fixes the N+1 query problem
    const allReceiverSockets = await UserSocket.findAll({
      where: {
        user_id: {
          [Op.in]: receiverIdList,
        },
      },
      attributes: ["socketId", "user_id"],
    });

    if (allReceiverSockets.length === 0) {
      console.log(`No active sockets for conversation ${conversation_id}`);
      return; // No active sockets
    }

    const socketService = require("../../../reusable/socketService");
    const io = socketService.getIo();

    // Emit to all sockets in one loop
    let emitCount = 0;
    allReceiverSockets.forEach((socket) => {
      io.to(socket.socketId).emit(event_name, data);
      emitCount++;
    });

    console.log(
      `Event '${event_name}' sent to ${emitCount} socket(s) for ${receiverIdList.length} user(s) in conversation ${conversation_id}`
    );
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

module.exports = EmitDataInGroup;
