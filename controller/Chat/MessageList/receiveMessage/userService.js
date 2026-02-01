const { User } = require("../../../../models");
const { Op } = require("sequelize");

const getUserById = async (user_id) => {
  return await User.findOne({
    where: { user_id },
  });
};

/**
 * Get multiple users by their IDs in a single query
 * @param {number[]} user_ids
 * @returns {Map<number, Object>} Map of user_id to user data
 */
const getUsersByIds = async (user_ids) => {
  if (!user_ids.length) return new Map();

  const uniqueIds = [...new Set(user_ids)];

  const users = await User.findAll({
    where: { user_id: { [Op.in]: uniqueIds } },
  });

  const userMap = new Map();
  for (const user of users) {
    userMap.set(user.user_id, user);
  }

  return userMap;
};

module.exports = { getUserById, getUsersByIds };
