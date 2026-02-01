const express = require("express");
const { userDetails } = require("../controller/user/userDetails");
const { searchUser } = require("../controller/user/searchUser");
const { blockUser } = require("../controller/user/blockUser");
const { getOneToOneMedia } = require("../controller/Chat/getOneToOneMedia");
const {
  innerChatScreen,
} = require("../controller/Chat/MessageList/innerChatScreen");
const { callUser } = require("../controller/Call/callUser");
const nocache = require("../middleware/callMiddleware");
const { callCutByMe } = require("../controller/Call/callCutByMe");

const { callTime } = require("../controller/Call/callTime");
const { callList } = require("../controller/Call/callList");
const { sendMessage } = require("../controller/Chat/sendMessage");
const { addContactName } = require("../controller/user/addContactName");
const { createGroup } = require("../controller/Chat/Group/createGroup");
const {
  addMemberToGroup,
} = require("../controller/Chat/Group/addMemberToGroup");
const {
  removeMemberFromGroup,
} = require("../controller/Chat/Group/removeMemberFromGroup");
const {
  createGroupAdmin,
} = require("../controller/Chat/Group/createGroupAdmin");
const {
  addToStarMessage,
} = require("../controller/Chat/StarMessage/addToStarMessage");
const {
  starMessageList,
} = require("../controller/Chat/StarMessage/starMessageList");
const {
  getAllAvailableContacts,
} = require("../controller/Contact/getAllAvailableContacts");
const { addStatus } = require("../controller/Status/addStatus");
const { statusList } = require("../controller/Status/statusList");
const { statusViewesList } = require("../controller/Status/statusViewesList");
const { viewStatus } = require("../controller/Status/viewStatus");
const { addToArchive } = require("../controller/Chat/ChatList/addToArchive");
const {
  deleteMessages,
} = require("../controller/Chat/MessageList/deleteMessages");
const { logoutUser } = require("../controller/user/logoutUser");
const { getBlockUserList } = require("../controller/user/getBlockUserList");
const {
  getMessageDetails,
} = require("../controller/Chat/MessageList/getMessageDetails");
const { exitFromGroup } = require("../controller/Chat/Group/exitFromGroup");
const { clearAllChat } = require("../controller/Chat/MessageList/clearAllChat");
const { callCutByReceiver } = require("../controller/Call/callCutByReceiver");
const { getGroupMembers } = require("../controller/Chat/Group/getGroupMembers");
const { deleteStatusById } = require("../controller/Status/deleteStatusById");
const {
  deleteStatusMediaById,
} = require("../controller/Status/deleteStatusMediaById");
const { getStatusDetails } = require("../controller/Status/getStatusDetails");
const { getMyContacts } = require("../controller/Contact/getMyContacts");
const {
  searchMessage,
} = require("../controller/Chat/SearchMessage/searchMessage");
const {
  deleteChatList,
} = require("../controller/Chat/ChatList/deleteChatList");
const { reportUser } = require("../controller/user/reportUser");
const { deleteAccount } = require("../controller/user/deleteAccount");

const {
  addToPinMessage,
} = require("../controller/Chat/PinMessage/addToPinMessage");
const {
  pinMessageList,
} = require("../controller/Chat/PinMessage/pinMessageList");
const { createPoll } = require("../controller/Chat/Poll/createPoll");
const { voteInPoll } = require("../controller/Chat/Poll/voteInPoll");
const getPublicGroup = require("../controller/Chat/Group/getPublicGroup");

// Order Management
const { acceptOrder } = require("../controller/Order/acceptOrder");
const { ignoreOrder } = require("../controller/Order/ignoreOrder");
const { getMyOrders } = require("../controller/Order/getMyOrders");
const { getListOrders } = require("../controller/Order/getListOrders");
const { getOrderDetail } = require("../controller/Order/getOrderDetail");
const { updateOrder } = require("../controller/Order/updateOrder");

// User Management
const { createUserByAdmin } = require("../controller/User/createUserByAdmin");
const { updateUserByAdmin } = require("../controller/User/updateUserByAdmin");
const { changeRole } = require("../controller/User/changeRole");
const { deleteUserByAdmin } = require("../controller/User/deleteUserByAdmin");
const { toggleBanUser } = require("../controller/User/toggleBanUser");
const { updatePassword } = require("../controller/User/updatePassword");

// Notification Management
const { createNotification } = require("../controller/Notification/createNotification");
const { getNotifications } = require("../controller/Notification/getNotifications");
const { markAsRead } = require("../controller/Notification/markAsRead");
const { deleteNotification } = require("../controller/Notification/deleteNotification");

// Driver Management
const { getDriverList } = require("../controller/Driver/getDriverList");
const { getDriverDetail } = require("../controller/Driver/getDriverDetail");
const { getDriverOrders } = require("../controller/Driver/getDriverOrders");
const { toggleOrderPermission } = require("../controller/Driver/toggleOrderPermission");

// Vice Admin Management
const { getViceAdminList } = require("../controller/ViceAdmin/getViceAdminList");
const { getViceAdminDetail } = require("../controller/ViceAdmin/getViceAdminDetail");

// Group Settings
const { getGroupSettings } = require("../controller/Settings/getGroupSettings");
const { updateGroupSettings } = require("../controller/Settings/updateGroupSettings");

// Driver Rating
const { createDriverRating } = require("../controller/Rating/createDriverRating");

// Role middleware
const { checkRole } = require("../middleware/roleCheck");

// Upload
const { uploadFile } = require("../controller/Upload/uploadFile");

// Profile Request Management
const { submitProfileRequest } = require("../controller/ProfileRequest/submitProfileRequest");
const { cancelProfileRequest } = require("../controller/ProfileRequest/cancelProfileRequest");
const { getAllProfileRequests } = require("../controller/ProfileRequest/getAllProfileRequests");
const { getProfileRequestDetail } = require("../controller/ProfileRequest/getProfileRequestDetail");
const { approveProfileRequest } = require("../controller/ProfileRequest/approveProfileRequest");
const { rejectProfileRequest } = require("../controller/ProfileRequest/rejectProfileRequest");

// Driver Rating
const { deleteDriverRating } = require("../controller/Rating/deleteDriverRating");
const { getDriverRatings } = require("../controller/Rating/getDriverRatings");
const { getDriverRatingDetail } = require("../controller/Rating/getDriverRatingDetail");

const router = express.Router();

// Routes Start ==============================================================================================================================
router.post("/user-details", userDetails);
router.post("/search-user", searchUser);
router.post("/block-user", blockUser);
router.post("/report-user", reportUser);
router.post("/delete-account", deleteAccount);
router.post("/block-user-list", getBlockUserList);
router.post("/get-one-to-one-media", getOneToOneMedia);

// Archive ==================================================================================
router.post("/add-to-archive", addToArchive);

// Contact ==================================================================================
router.post("/get-all-available-contacts", getAllAvailableContacts);

// Chat ==================================================================================
// router.post("/send-message", nocache, callUser);
router.post("/send-message", sendMessage);
router.post("/create-group", createGroup);
router.post("/add-member-to-group", addMemberToGroup);
router.post("/remove-member-from-group", removeMemberFromGroup);
router.post("/exit-from-group", exitFromGroup);
router.post("/create-group-admin", createGroupAdmin);
router.post("/get-message-details", getMessageDetails);
router.post("/delete-chatlist", deleteChatList);
router.post("/create-poll", createPoll);
router.post("/vote", voteInPoll);
router.post("/get-public-groups", getPublicGroup);

// Star Message ==================================================================================
router.post("/add-to-star-message", addToStarMessage);
router.post("/star-message-list", starMessageList);

// Pin Message ==================================================================================
router.post("/add-to-pin-message", addToPinMessage);
router.post("/pin-message-list", pinMessageList);

// Search Message ===========================================================================
router.post("/search-message", searchMessage);

// Delete Chat ==================================================================================
router.post("/clear-all-chat", clearAllChat);
router.post("/delete-messages", deleteMessages);

// Status ==================================================================================
router.post("/add-status", addStatus);
router.post("/status-list", statusList);
router.post("/view-status", viewStatus);
router.post("/status-view-list", statusViewesList);
router.post("/delete-status", deleteStatusById);
router.post("/delete-status-media-by-id", deleteStatusMediaById);
router.post("/status-details", getStatusDetails);

// Call ==================================================================================
router.post("/call-user", callUser);
router.post("/call-cut-by-me", callCutByMe);
router.post("/call-cut-by-receiver", callCutByReceiver);
router.post("/get-group-members", getGroupMembers);

// router.post("/call-time", callTime);
router.post("/call-list", callList);

// router.post("/inner-chat-screen", innerChatScreen); // call this api when you go back from inner screen to outer screen
// AllContact ==================================================================================
router.post("/add-contact-name", addContactName);
router.post("/my-contacts", getMyContacts);

// Logout ==================================================================================
router.post("/logout-user", logoutUser);

// Order Management ==================================================================================
// Driver endpoints
router.get("/orders/my-orders", checkRole(['driver']), getMyOrders);
router.post("/orders/accept", checkRole(['driver']), acceptOrder);
router.post("/orders/ignore", checkRole(['driver']), ignoreOrder);

// Everyone can view order list and details
router.get("/orders/list", getListOrders);
router.get("/orders/detail/:order_id", getOrderDetail);

// Update can be done by driver (for their orders) or admin/vice_admin
// Admin/Vice_admin cancelling assigned order will notify driver
// Driver cancelling will notify admin and vice_admins
router.put("/orders/update", checkRole(['driver', 'admin', 'vice_admin']), updateOrder);

// Upload Management ========================================================================
router.post("/upload", uploadFile);

// User Management ========================================================================
router.post("/user/create", checkRole(['admin', 'vice_admin']), createUserByAdmin);
router.put("/user/:user_id", checkRole(['admin', 'vice_admin']), updateUserByAdmin);
router.post("/user/change-role", checkRole(['admin']), changeRole);
router.post("/user/delete", checkRole(['admin', 'vice_admin']), deleteUserByAdmin);
router.post("/user/toggle-ban", checkRole(['admin', 'vice_admin']), toggleBanUser);
router.post("/user/update-password", checkRole(['admin', 'vice_admin', 'driver']), updatePassword);

// Notification Management ========================================================================
router.post("/notifications/create", checkRole(['admin', 'vice_admin']), createNotification);
router.get("/notifications", checkRole(['admin', 'vice_admin', 'driver']), getNotifications);
router.put("/notifications/:notification_id/read", checkRole(['driver', 'vice_admin']), markAsRead);
router.delete("/notifications/:notification_id", checkRole(['admin', 'vice_admin']), deleteNotification);

// Driver Management ========================================================================
router.get("/drivers/list", checkRole(['admin', 'vice_admin']), getDriverList);
router.get("/drivers/:driver_id", checkRole(['admin', 'vice_admin']), getDriverDetail);
router.get("/drivers/:driver_id/orders", checkRole(['admin', 'vice_admin']), getDriverOrders);
router.put("/drivers/:driver_id/order-permission", checkRole(['admin', 'vice_admin']), toggleOrderPermission);

// Vice Admin Management ========================================================================
router.get("/vice-admins/list", checkRole(['admin']), getViceAdminList);
router.get("/vice-admins/:vice_admin_id", checkRole(['admin']), getViceAdminDetail);

// Group Settings ========================================================================
router.get("/settings/group", checkRole(['admin', 'vice_admin']), getGroupSettings);
router.put("/settings/group", checkRole(['admin', 'vice_admin']), updateGroupSettings);

// Driver Rating ========================================================================
router.post("/ratings/driver", checkRole(['admin', 'vice_admin']), createDriverRating);
router.delete("/ratings/driver/:rating_id", checkRole(['admin', 'vice_admin']), deleteDriverRating);
router.get("/ratings/driver", getDriverRatings);
router.get("/ratings/driver/:rating_id", getDriverRatingDetail);

// Statistics ========================================================================
const { getStatistics } = require("../controller/Statistics/getStatistics");

router.get("/statistics", checkRole(['driver', 'admin', 'vice_admin']), getStatistics);

// Profile Request Management ========================================================================
// Unified endpoints (role-based logic inside controllers)
router.post("/profile-request", checkRole(['driver']), submitProfileRequest);
router.get("/profile-requests", checkRole(['driver', 'admin', 'vice_admin']), getAllProfileRequests);
router.get("/profile-request/:request_id", checkRole(['driver', 'admin', 'vice_admin']), getProfileRequestDetail);
router.post("/profile-request/:request_id/cancel", checkRole(['driver']), cancelProfileRequest);
router.post("/profile-request/:request_id/approve", checkRole(['admin', 'vice_admin']), approveProfileRequest);
router.post("/profile-request/:request_id/reject", checkRole(['admin', 'vice_admin']), rejectProfileRequest);

module.exports = router;
