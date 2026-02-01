const axios = require("axios");
const { One_signal_setting } = require("../models");

async function pushNotificationToDevice({
  one_signal_player_id,
  title,
  body,
  notificationData,
}) {
  // Check if OneSignal player ID is provided
  if (!one_signal_player_id || one_signal_player_id === "") {
    console.error("Invalid OneSignal player ID.");
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

  if (!oneSignalSettings || !oneSignalSettings.ONESIGNAL_APPID) {
    console.error("OneSignal App ID not found in database settings.");
    return false;
  }

  const message = {
    app_id: oneSignalSettings.ONESIGNAL_APPID, // Get app_id from database
    include_player_ids: [one_signal_player_id],
    headings: { en: title },
    contents: { en: body },
    data: notificationData,
    large_icon: notificationData.profile_image,
    small_icon: "mipmap/ic_launcher",
  };

  // Add `big_picture` property for specific message types
  if (
    notificationData.messageType === "image" ||
    notificationData.messageType === "video"
  ) {
    message.big_picture = `${process.env.baseUrl}${notificationData.big_picture}`;
  }

  try {
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

    console.log("Successfully sent notification:", response.data);
    return true;
  } catch (error) {
    console.error(
      "Error sending notification:",
      error.response ? error.response.data : error.message
    );
    return false;
  }
}

module.exports = pushNotificationToDevice;
