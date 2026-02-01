const axios = require("axios");
const { One_signal_setting, User } = require("../models");
const { Op } = require("sequelize");

/**
 * Clean up invalid OneSignal player IDs from the database
 * @param {Array<string>} invalidPlayerIds - Array of invalid player IDs
 */
async function cleanupInvalidPlayerIds(invalidPlayerIds) {
  if (!invalidPlayerIds || invalidPlayerIds.length === 0) return;

  try {
    const result = await User.update(
      { one_signal_player_id: null },
      {
        where: {
          one_signal_player_id: { [Op.in]: invalidPlayerIds }
        }
      }
    );
    if (result[0] > 0) {
      console.log(`🧹 Cleaned up ${result[0]} invalid OneSignal player IDs`);
    }
  } catch (error) {
    console.error("Error cleaning up invalid player IDs:", error.message);
  }
}

/**
 * Send OneSignal push notification for system notifications
 * (Admin/Vice_admin notifications to drivers/vice_admins)
 *
 * @param {Object} params
 * @param {Array<string>} params.player_ids - Array of OneSignal player IDs
 * @param {string} params.title - Notification title
 * @param {string} params.content - Notification content
 * @param {Object} params.data - Additional data (notification_id, created_by, etc.)
 */
async function pushNotificationAlert({ player_ids, title, content, data = {} }) {
  try {
    // Validate player IDs
    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
      console.log("No valid OneSignal player IDs provided");
      return false;
    }

    // Filter out empty player IDs
    const validPlayerIds = player_ids.filter(id => id && id !== "");

    if (validPlayerIds.length === 0) {
      console.log("No valid OneSignal player IDs after filtering");
      return false;
    }

    // Get OneSignal settings from database
    let oneSignalSettings;
    try {
      oneSignalSettings = await One_signal_setting.findOne({
        where: { setting_id: 1 }
      });
    } catch (error) {
      console.error("Error fetching OneSignal settings:", error);
      return false;
    }

    if (!oneSignalSettings) {
      console.error("OneSignal settings not found in database");
      return false;
    }

    // Build notification message (same structure as chat messages)
    const message = {
      app_id: oneSignalSettings.ONESIGNAL_APPID,
      include_player_ids: validPlayerIds,
      headings: { en: title },
      contents: { en: content },
      data: {
        type: "notification_alert",
        notification_id: data.notification_id,
        created_by: data.created_by,
        order_id: data.order_id, // Only if notification is related to order
        ...data
      },
      large_icon: data.creator_profile_image || "mipmap/ic_launcher",
      small_icon: "mipmap/ic_launcher"
    };

    // Send to OneSignal API
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      message,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${oneSignalSettings.ONESIGNAL_API_KEY}`,
        },
      }
    );

    console.log(`✅ OneSignal notification sent to ${validPlayerIds.length} devices`);
    console.log(`   Response: ${response.data.id}, Recipients: ${response.data.recipients}`);

    // Clean up invalid player IDs returned by OneSignal
    if (response.data.errors && response.data.errors.invalid_player_ids) {
      const invalidIds = response.data.errors.invalid_player_ids;
      // Run cleanup in background - don't await
      cleanupInvalidPlayerIds(invalidIds).catch(err =>
        console.error("Background cleanup error:", err)
      );
    }

    return true;

  } catch (error) {
    console.error("❌ Error sending OneSignal notification:", error.message);
    if (error.response) {
      console.error("   OneSignal API Error:", error.response.data);
      // Also clean up invalid player IDs from error response
      if (error.response.data?.errors?.invalid_player_ids) {
        cleanupInvalidPlayerIds(error.response.data.errors.invalid_player_ids).catch(err =>
          console.error("Background cleanup error:", err)
        );
      }
    }
    return false;
  }
}

module.exports = { pushNotificationAlert, cleanupInvalidPlayerIds };
