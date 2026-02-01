const {
  Chat,
  ClearAllChat,
  DeleteMessage,
  ConversationsUser,
  StarMessage,
  Block,
  PollOption,
  PollVote,
  Order,
  User,
} = require("../../../../models");
const { Op, Sequelize } = require("sequelize");
const EmitDataInGroup = require("../../Group/EmitDataInGroup");

const getMessages = async ({
  user_id,
  conversation_id,
  message_id,
  page,
  per_page_message,
}) => {
  const clearAllChatRes = await ClearAllChat.findOne({
    where: { user_id, conversation_id },
    order: [["updatedAt", "DESC"]],
  });
  const isBlocked = await Block.findOne({
    where: {
      user_id: user_id,
      conversation_id,
    },
  });

  let updatedFiled = {};
  // Handle cleared chat case
  if (clearAllChatRes) {
    updatedFiled.message_id = {
      [Op.gt]: clearAllChatRes.dataValues.message_id,
    };
  }

  // Handle block case
  if (isBlocked) {
    updatedFiled.message_id = {
      ...updatedFiled.message_id, // Keep existing conditions if any
      [Op.lte]: isBlocked.dataValues.message_id_before_block, // Add condition for messages before block
    };
  }

  // If message_id is provided, merge the condition with the previous one
  if (message_id) {
    updatedFiled.message_id = {
      ...updatedFiled.message_id, // Retain existing conditions
      [Op.gt]: message_id, // Add the new condition for message_id
    };
  }

  const totalMessages = await Chat.count({
    where: { ...updatedFiled, conversation_id },
  });

  const limit = Number(per_page_message);
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(totalMessages / limit);

  const messages = await Chat.findAll({
    where: { ...updatedFiled, conversation_id },
    // Sort by client_timestamp if available, fallback to createdAt for old messages
    order: [[Sequelize.literal('COALESCE(Chat.client_timestamp, UNIX_TIMESTAMP(Chat.createdAt) * 1000)'), 'DESC']],
    limit: message_id == 0 ? limit : 10000,
    offset,
    include: [
      {
        model: Order,
        required: false,
        attributes: [
          'order_id',
          'message_id',
          'customer_name',
          'delivery_location',
          'note',
          'cost',
          'status',
          'assigned_driver_id',
          'completed_cost',
          'completed_delivery_location',
          'driver_note',
          'createdAt',
          'updatedAt'
        ],
        include: [
          {
            model: User,
            as: 'Driver',
            attributes: ['user_id', 'first_name', 'last_name', 'phone_number'],
            required: false
          }
        ]
      }
    ]
  });

  const conversationUsers = await ConversationsUser.findAll({
    where: { conversation_id },
  });

  return { messages: messages.reverse(), totalPages, conversationUsers };
};

const markMessageAsRead = async (
  conversation_id,
  message_id,
  user_id_list,
  who_seen_list,
  user_id
) => {
  // if (!who_seen_list.includes(String(user_id))) {
  who_seen_list.push(user_id.toString());
  // }

  await Chat.update(
    { who_seen_the_message: who_seen_list.join(",") },
    { where: { conversation_id, message_id } }
  );

  const allSeen = user_id_list.every((uid) => who_seen_list.includes(uid));
  if (allSeen) {
    await Chat.update({ message_read: 1 }, { where: { message_id } });
    // Emit one event to notify the member is removed from group
    await EmitDataInGroup(conversation_id, "update_message_read", {
      message_id: message_id,
    });
  }
};

const getPollData = async (message_id) => {
  return await PollOption.findAll({
    where: { message_id },
    attributes: { exclude: ["createdAt", "updatedAt"] },
    include: {
      model: PollVote,
      attributes: ["user_id", "updatedAt"],
    },
  });
};

const isMessageStarred = async (user_id, message_id) => {
  return !!(await StarMessage.findOne({ where: { user_id, message_id } }));
};

const isMessageDeleted = async (user_id, message_id) => {
  return !!(await DeleteMessage.findOne({ where: { user_id, message_id } }));
};

// ============== BATCH QUERY METHODS (Performance Optimization) ==============

/**
 * Get all starred message IDs for a user in a single query
 * @param {number} user_id
 * @param {number[]} message_ids
 * @returns {Set<number>} Set of starred message IDs
 */
const getStarredMessageIds = async (user_id, message_ids) => {
  if (!message_ids.length) return new Set();

  const starredMessages = await StarMessage.findAll({
    where: {
      user_id,
      message_id: { [Op.in]: message_ids }
    },
    attributes: ['message_id']
  });

  return new Set(starredMessages.map(m => m.message_id));
};

/**
 * Get all deleted message IDs for a user in a single query
 * @param {number} user_id
 * @param {number[]} message_ids
 * @returns {Set<number>} Set of deleted message IDs
 */
const getDeletedMessageIds = async (user_id, message_ids) => {
  if (!message_ids.length) return new Set();

  const deletedMessages = await DeleteMessage.findAll({
    where: {
      user_id,
      message_id: { [Op.in]: message_ids }
    },
    attributes: ['message_id']
  });

  return new Set(deletedMessages.map(m => m.message_id));
};

/**
 * Get poll data for multiple messages in a single query
 * @param {number[]} message_ids
 * @returns {Map<number, Array>} Map of message_id to poll data
 */
const getBatchPollData = async (message_ids) => {
  if (!message_ids.length) return new Map();

  const pollOptions = await PollOption.findAll({
    where: { message_id: { [Op.in]: message_ids } },
    attributes: { exclude: ["createdAt", "updatedAt"] },
    include: {
      model: PollVote,
      attributes: ["user_id", "updatedAt"],
    },
  });

  const pollDataMap = new Map();
  for (const option of pollOptions) {
    const msgId = option.message_id;
    if (!pollDataMap.has(msgId)) {
      pollDataMap.set(msgId, []);
    }
    pollDataMap.get(msgId).push(option);
  }

  return pollDataMap;
};

/**
 * Batch update who_seen_the_message for multiple messages
 * @param {number} conversation_id
 * @param {number[]} message_ids
 * @param {number} user_id
 */
const batchMarkMessagesAsSeen = async (conversation_id, message_ids, user_id, user_id_list) => {
  if (!message_ids.length) return;

  // Get all messages that need to be updated
  const messages = await Chat.findAll({
    where: {
      conversation_id,
      message_id: { [Op.in]: message_ids }
    },
    attributes: ['message_id', 'who_seen_the_message', 'message_read']
  });

  const updatePromises = [];
  const fullySeenMessageIds = [];

  for (const msg of messages) {
    let who_seen_list = msg.who_seen_the_message
      ? msg.who_seen_the_message.split(",")
      : [];

    if (!who_seen_list.includes(String(user_id))) {
      who_seen_list.push(user_id.toString());

      updatePromises.push(
        Chat.update(
          { who_seen_the_message: who_seen_list.join(",") },
          { where: { message_id: msg.message_id } }
        )
      );

      // Check if all users have seen this message
      const allSeen = user_id_list.every((uid) => who_seen_list.includes(uid.toString()));
      if (allSeen) {
        fullySeenMessageIds.push(msg.message_id);
      }
    }
  }

  // Execute all updates in parallel
  await Promise.all(updatePromises);

  // Batch update message_read for fully seen messages
  if (fullySeenMessageIds.length > 0) {
    await Chat.update(
      { message_read: 1 },
      { where: { message_id: { [Op.in]: fullySeenMessageIds } } }
    );

    // Emit events for fully seen messages
    const EmitDataInGroup = require("../../Group/EmitDataInGroup");
    for (const msgId of fullySeenMessageIds) {
      await EmitDataInGroup(conversation_id, "update_message_read", {
        message_id: msgId,
      });
    }
  }
};

module.exports = {
  getMessages,
  markMessageAsRead,
  isMessageStarred,
  isMessageDeleted,
  getPollData,
  // Batch methods
  getStarredMessageIds,
  getDeletedMessageIds,
  getBatchPollData,
  batchMarkMessagesAsSeen,
};
