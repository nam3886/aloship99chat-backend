/**
 * OneSignal Token Cleanup Script
 *
 * This script validates all OneSignal player IDs in the database and removes invalid ones.
 * Run this periodically via cron or manually to clean up stale tokens.
 *
 * Usage: node scripts/cleanupOneSignalTokens.js
 */

require('dotenv').config();
const axios = require("axios");
const { User, One_signal_setting, sequelize } = require("../models");
const { Op } = require("sequelize");

async function validateAndCleanupTokens() {
  console.log("🔍 Starting OneSignal token cleanup...");

  try {
    // Get OneSignal settings
    const oneSignalSettings = await One_signal_setting.findOne({
      where: { setting_id: 1 }
    });

    if (!oneSignalSettings) {
      console.error("❌ OneSignal settings not found in database");
      process.exit(1);
    }

    // Get all users with OneSignal player IDs
    const users = await User.findAll({
      where: {
        one_signal_player_id: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: '' }
          ]
        },
        is_account_deleted: false
      },
      attributes: ['user_id', 'phone_number', 'one_signal_player_id']
    });

    console.log(`📊 Found ${users.length} users with OneSignal player IDs`);

    if (users.length === 0) {
      console.log("✅ No tokens to validate");
      process.exit(0);
    }

    // Batch validate tokens (OneSignal API accepts up to 2000 player IDs per request)
    const batchSize = 2000;
    const allInvalidIds = [];

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const playerIds = batch.map(u => u.one_signal_player_id);

      console.log(`\n🔄 Validating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${playerIds.length} tokens)...`);

      try {
        // Send a silent test notification to validate player IDs
        const response = await axios.post(
          "https://onesignal.com/api/v1/notifications",
          {
            app_id: oneSignalSettings.ONESIGNAL_APPID,
            include_player_ids: playerIds,
            contents: { en: "Token validation test" },
            // Don't actually show notification - just validate
            android_channel_id: "silent",
            priority: 1,
            // Expire immediately
            ttl: 0
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${oneSignalSettings.ONESIGNAL_API_KEY}`,
            },
          }
        );

        if (response.data.errors && response.data.errors.invalid_player_ids) {
          const invalidIds = response.data.errors.invalid_player_ids;
          allInvalidIds.push(...invalidIds);
          console.log(`   ⚠️  Found ${invalidIds.length} invalid tokens in this batch`);
        } else {
          console.log(`   ✅ All tokens in this batch are valid`);
        }

        // Rate limiting - wait 1 second between batches
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`   ❌ Error validating batch:`, error.message);
        if (error.response?.data?.errors?.invalid_player_ids) {
          allInvalidIds.push(...error.response.data.errors.invalid_player_ids);
        }
      }
    }

    // Clean up invalid tokens
    if (allInvalidIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${allInvalidIds.length} invalid tokens...`);

      const result = await User.update(
        { one_signal_player_id: null },
        {
          where: {
            one_signal_player_id: { [Op.in]: allInvalidIds }
          }
        }
      );

      console.log(`✅ Successfully cleaned up ${result[0]} user records`);

      // Log affected users for reference
      const affectedUsers = users.filter(u => allInvalidIds.includes(u.one_signal_player_id));
      console.log("\n📋 Affected users:");
      affectedUsers.forEach(u => {
        console.log(`   - User ${u.user_id} (${u.phone_number})`);
      });
    } else {
      console.log("\n✅ All OneSignal tokens are valid! No cleanup needed.");
    }

    console.log("\n🎉 Cleanup completed successfully!");

  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the cleanup
validateAndCleanupTokens();
