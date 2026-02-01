let ioInstance;

const emitConnectedUserList = require("../controller/Call/emitConnectedUserList");
const { ChatList } = require("../controller/Chat/ChatList/getChatList");
const {
  messageViewed,
} = require("../controller/Chat/MessageList/receiveMessage/messageViewed");
const {
  receiveMessage,
} = require("../controller/Chat/MessageList/receiveMessage/receiveMessage");
const { isTyping } = require("../controller/Typing/isTyping");
const { userLastSeenList } = require("../controller/Typing/userLastSeenList");
const {
  User,
  isUserTyping,
  Chat,
  Call,
  UserSocket,
  ConversationsUser,
} = require("../models");
const onlineUserStatusChange = require("./onlineUserStatusChange");
const { Op } = require("sequelize");

function initSocket(io) {
  ioInstance = io;

  io.on("connection", async (socket) => {
    console.log("New client connected", socket.id);
    const user_id = socket.handshake.query.user_id;

    // Register ALL event handlers FIRST (synchronously)
    // BEFORE any await operations to prevent race conditions
    socket.on("messageReceived", (data) => {
      receiveMessage(io, socket, data);
    });

    socket.on("ChatList", (data) => {
      ChatList(io, socket, data);
    });

    socket.on("isTyping", (data) => {
      isTyping(io, socket, data);
    });

    socket.on("messageViewed", (data) => {
      messageViewed(io, socket, data);
    });

    socket.on(
      "join-call",
      ({ room_id, peer_id, user_id, call_type, user_name }) => {
        socket.join(room_id);
        socket
          .to(room_id)
          .emit("user-connected-to-call", { peer_id, user_name, user_id });
        emitConnectedUserList(room_id, io);
      }
    );

    socket.on("call-changes", (data) => {
      socket.to(data.room_id).emit("call-changes", data);
    });

    socket.on("leave-call", ({ room_id, peer_id, call_type }) => {
      socket.leave(room_id);
      socket.to(room_id).emit("user-disconnected-from-call", peer_id);
      emitConnectedUserList(room_id, io);
    });

    socket.on("app_heartbeat", (data) => {
      socket.emit("app_heartbeat_ack", {
        id: data?.id,
        server_time: Date.now(),
        user_id: user_id
      });
    });

    socket.on("disconnect", async (reason) => {
      try {
        await isUserTyping.destroy({ where: { user_id: user_id } });
        await UserSocket.destroy({ where: { user_id: user_id, socketId: socket.id } });
        await User.update({ last_seen: 0 }, { where: { user_id: user_id } });

        onlineUserStatusChange(io, user_id);
        userLastSeenList(io, socket);
      } catch (error) {
        console.error("Disconnect cleanup error:", error);
      }
    });

    // NOW do async initialization (after handlers are ready)
    try {
      const oldSockets = await UserSocket.findAll({
        where: { user_id: user_id }
      });

      for (const oldSocket of oldSockets) {
        const socketExists = io.sockets.sockets.get(oldSocket.socketId);
        if (!socketExists) {
          await UserSocket.destroy({ where: { socketId: oldSocket.socketId } });
        }
      }
    } catch (error) {
      console.error("Error cleaning old sockets:", error);
    }

    await User.update({ last_seen: 0 }, { where: { user_id: user_id } });

    // Notify other user that new user is online
    onlineUserStatusChange(io, user_id);

    // Update user last seen
    userLastSeenList(io, socket);

    // Send typing status
    try {
      const userConversations = await ConversationsUser.findAll({
        where: { user_id: user_id },
        attributes: ["conversation_id"],
      });

      const conversation_ids = userConversations.map(
        (conversation) => conversation.conversation_id
      );

      const typingUsers = await isUserTyping.findAll({
        where: {
          conversation_id: { [Op.in]: conversation_ids },
        },
        attributes: ["user_id", "conversation_id"],
      });

      socket.emit("isTyping", { typingUserList: typingUsers });
    } catch (error) {
      console.error("Error fetching typing users:", error);
    }
  });
}

function getIo() {
  if (!ioInstance) {
    throw new Error("IO not initialized");
  }
  return ioInstance;
}

// Create and export a singleton instance
const socketService = {
  initSocket,
  getIo,
};

module.exports = socketService;
