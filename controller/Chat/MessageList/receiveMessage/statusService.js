const { Status, StatusMedia } = require("../../../../models");
const { Op } = require("sequelize");

const getStatusData = async (status_id) => {
  if (status_id) {
    const existingStatus = await Status.findOne({
      include: [
        {
          model: StatusMedia,
          where: { status_media_id: status_id },
          attributes: ["status_media_id", "url", "status_text", "updatedAt"],
        },
      ],
    });
    return existingStatus ? [existingStatus] : [];
  }
  return [];
};

/**
 * Get status data for multiple status IDs in a single query
 * @param {number[]} status_ids
 * @returns {Map<number, Array>} Map of status_id to status data
 */
const getBatchStatusData = async (status_ids) => {
  // Filter out null/undefined/0 values
  const validIds = status_ids.filter(id => id);
  if (!validIds.length) return new Map();

  const uniqueIds = [...new Set(validIds)];

  const statusMedias = await StatusMedia.findAll({
    where: { status_media_id: { [Op.in]: uniqueIds } },
    attributes: ["status_media_id", "url", "status_text", "updatedAt", "status_id"],
    include: [{
      model: Status,
      required: true
    }]
  });

  const statusMap = new Map();
  for (const media of statusMedias) {
    statusMap.set(media.status_media_id, media.Status ? [media.Status] : []);
  }

  return statusMap;
};

module.exports = { getStatusData, getBatchStatusData };
