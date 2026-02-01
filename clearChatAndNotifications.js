/**
 * Script to clear Chat, DeleteMessage, Notification, and NotificationRead tables
 *
 * Usage:
 *   NODE_ENV=production node clearChatAndNotifications.js
 *
 * WARNING: This will permanently delete all data from these tables!
 */

const db = require("./models");
const { Chat, DeleteMessage, Notification, NotificationRead } = db;

const clearData = async () => {
  console.log("\n🚀 Starting data clearing process...\n");

  try {
    // Count records before deletion
    console.log("📊 Counting records before deletion...");
    const chatCount = await Chat.count();
    const deleteMessageCount = await DeleteMessage.count();
    const notificationCount = await Notification.count();
    const notificationReadCount = await NotificationRead.count();

    console.log(`  - Chat messages: ${chatCount}`);
    console.log(`  - DeleteMessage records: ${deleteMessageCount}`);
    console.log(`  - Notifications: ${notificationCount}`);
    console.log(`  - NotificationRead records: ${notificationReadCount}`);
    console.log("");

    // Start deletion process
    console.log("🗑️  Deleting data...\n");

    // 1. Clear NotificationRead first (depends on Notification)
    console.log("  ⏳ Clearing NotificationRead table...");
    await NotificationRead.destroy({ where: {}, truncate: false });
    console.log("  ✅ NotificationRead cleared");

    // 2. Clear Notification
    console.log("  ⏳ Clearing Notification table...");
    await Notification.destroy({ where: {}, truncate: false });
    console.log("  ✅ Notification cleared");

    // 3. Clear DeleteMessage (will also be cascade deleted when Chat is deleted)
    console.log("  ⏳ Clearing DeleteMessage table...");
    await DeleteMessage.destroy({ where: {}, truncate: false });
    console.log("  ✅ DeleteMessage cleared");

    // 4. Clear Chat (this will cascade delete related data)
    console.log("  ⏳ Clearing Chat table...");
    console.log("     ℹ️  Note: This will also cascade delete related:");
    console.log("        - Order records");
    console.log("        - StarMessage records");
    console.log("        - PinMessage records");
    console.log("        - ClearAllChat records");
    console.log("        - PollOption records");
    console.log("        - PollVote records");
    await Chat.destroy({ where: {}, truncate: false });
    console.log("  ✅ Chat cleared (with cascade deletes)");

    console.log("\n✨ Data clearing completed successfully!\n");

    // Verify deletion
    console.log("📊 Verifying deletion...");
    const chatCountAfter = await Chat.count();
    const deleteMessageCountAfter = await DeleteMessage.count();
    const notificationCountAfter = await Notification.count();
    const notificationReadCountAfter = await NotificationRead.count();

    console.log(`  - Chat messages: ${chatCountAfter} (deleted: ${chatCount})`);
    console.log(`  - DeleteMessage: ${deleteMessageCountAfter} (deleted: ${deleteMessageCount})`);
    console.log(`  - Notifications: ${notificationCountAfter} (deleted: ${notificationCount})`);
    console.log(`  - NotificationRead: ${notificationReadCountAfter} (deleted: ${notificationReadCount})`);
    console.log("");

    console.log("✅ All specified tables have been cleared successfully!\n");

    process.exit(0);

  } catch (error) {
    console.error("\n❌ Error during data clearing:");
    console.error(error);
    console.error("\nStack trace:");
    console.error(error.stack);
    process.exit(1);
  }
};

// Confirmation prompt
console.log("\n⚠️  WARNING: This script will delete all data from:");
console.log("  - Chat (all messages)");
console.log("  - DeleteMessage");
console.log("  - Notification");
console.log("  - NotificationRead");
console.log("\n  AND will cascade delete:");
console.log("  - Order records");
console.log("  - StarMessage records");
console.log("  - PinMessage records");
console.log("  - ClearAllChat records");
console.log("  - PollOption records");
console.log("  - PollVote records");
console.log("\n⏰ Starting in 3 seconds... Press Ctrl+C to cancel\n");

setTimeout(() => {
  clearData();
}, 3000);
