const { ProfileRequest, User, DriverProfile, Conversation, ConversationsUser } = require("../../models");
const { pushNotificationAlert } = require("../../reusable/pushNotificationAlert");

const approveProfileRequest = async (req, res) => {
  const sequelize = require("../../models").sequelize;
  const transaction = await sequelize.transaction();

  try {
    const admin_id = req.authData.user_id;
    const { request_id } = req.params;
    const { notes = '' } = req.body;

    // Get request
    const request = await ProfileRequest.findOne({
      where: { request_id },
      include: [
        {
          model: User,
          as: 'User'
        }
      ]
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Check if pending
    if (request.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Can only approve pending requests"
      });
    }

    // Get admin user_name
    const admin = await User.findByPk(admin_id);

    // 1. Update ProfileRequest
    await ProfileRequest.update(
      {
        status: 'approved',
        notes,
        processed_by: admin_id,
        processed_at: new Date()
      },
      {
        where: { request_id },
        transaction
      }
    );

    // 2. Create/Update DriverProfile
    await DriverProfile.upsert(
      {
        user_id: request.user_id,
        address: request.address,
        license_plate: request.license_plate,
        identification_front_image: request.identification_front_image,
        identification_back_image: request.identification_back_image,
        driving_license_image: request.driving_license_image,
        deposit_amount: 0, // Always 0
        interviewer_name: admin.user_name, // Admin's user_name
        interview_notes: notes,
        is_verified: true,
        is_active: true
      },
      { transaction }
    );

    // 3. Update User
    await User.update(
      {
        is_profile_approved: true,
        current_request_id: request_id,
        profile_image: request.profile_image,
      },
      {
        where: { user_id: request.user_id },
        transaction
      }
    );

    // 4. Add to main group conversation
    const mainGroup = await Conversation.findOne({
      where: { created_by_admin: true },
      transaction
    });

    if (mainGroup) {
      // Check if already in group
      const existingMember = await ConversationsUser.findOne({
        where: {
          conversation_id: mainGroup.conversation_id,
          user_id: request.user_id
        },
        transaction
      });

      if (!existingMember) {
        await ConversationsUser.create(
          {
            conversation_id: mainGroup.conversation_id,
            user_id: request.user_id,
            is_admin: false
          },
          { transaction }
        );
      }
    }

    // Commit transaction
    await transaction.commit();

    // 5. Send push notification to driver
    try {
      await pushNotificationAlert(
        request.user_id,
        {
          title: "Profile Approved!",
          body: "Your driver profile has been approved. Welcome!",
          data: {
            type: 'profile_approved',
            request_id: request_id
          }
        }
      );
    } catch (notifError) {
      console.error("Push notification error:", notifError);
      // Don't fail the request if notification fails
    }

    return res.status(200).json({
      success: true,
      message: "Driver profile approved successfully"
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Approve Profile Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { approveProfileRequest };
