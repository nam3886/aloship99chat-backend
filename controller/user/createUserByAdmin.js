const { User, DriverProfile, ConversationsUser } = require("../../models");
const bcrypt = require("bcryptjs");

const createUserByAdmin = async (req, res) => {
  try {
    const userRole = req.authData.role;

    const {
      phone_number,
      user_name,
      first_name,
      last_name,
      role,
      gender,
      profile_image,
      driver_profile
    } = req.body;

    // Validate required fields
    if (!phone_number || !user_name || !first_name || !last_name || !role || !gender) {
      return res.status(400).json({
        status: false,
        message: "Required fields: phone_number, user_name, first_name, last_name, role, gender"
      });
    }

    // Validate role based on who is creating
    if (userRole === 'vice_admin') {
      // Vice admin can ONLY create drivers, NOT vice_admins
      if (role !== 'driver') {
        return res.status(403).json({
          status: false,
          message: "Vice admin can only create users with role 'driver'"
        });
      }
    } else if (userRole === 'admin') {
      // Admin can create vice_admin or driver
      if (!['vice_admin', 'driver'].includes(role)) {
        return res.status(400).json({
          status: false,
          message: "Role must be either 'vice_admin' or 'driver'"
        });
      }
    }

    // Check if phone number already exists
    const existingUser = await User.findOne({
      where: { phone_number }
    });

    // If user exists and is NOT deleted, return error
    if (existingUser && !existingUser.is_account_deleted) {
      return res.status(400).json({
        status: false,
        message: "Phone number already exists"
      });
    }

    // If driver, validate driver_profile fields
    if (role === 'driver') {
      if (!driver_profile) {
        return res.status(400).json({
          status: false,
          message: "driver_profile is required for driver role"
        });
      }

      const {
        address,
        license_plate,
        deposit_amount,
        interviewer_name,
        interview_notes,
        identification_front_image,
        identification_back_image,
        driving_license_image
      } = driver_profile;

      // Required fields validation
      if (!address || !license_plate || deposit_amount === undefined ||
          !interviewer_name || !interview_notes ||
          !identification_front_image || !identification_back_image || !driving_license_image) {
        return res.status(400).json({
          status: false,
          message: "For drivers, all fields are required: address, license_plate, deposit_amount, interviewer_name, interview_notes, identification_front_image, identification_back_image, driving_license_image"
        });
      }
    }

    // Hash default password "123456"
    const hashedPassword = bcrypt.hashSync("123456", 10);

    let user;
    let createdDriverProfile = null;

    // If user exists and was deleted, restore and update them
    if (existingUser && existingUser.is_account_deleted) {

      // Update user with new data and mark as not deleted
      await existingUser.update({
        user_name,
        first_name,
        last_name,
        role,
        gender,
        password: hashedPassword,
        profile_image: profile_image || existingUser.profile_image,
        is_account_deleted: false,
        is_mobile: true,
        is_profile_approved: true,
        country: "VN",
        country_full_name: "Vietnam",
        country_code: "+84"
      });

      user = existingUser;

      // If driver, update or create driver profile
      if (role === 'driver') {
        const existingDriverProfile = await DriverProfile.findOne({
          where: { user_id: user.user_id }
        });

        if (existingDriverProfile) {
          // Update existing driver profile
          await existingDriverProfile.update({
            address: driver_profile.address,
            license_plate: driver_profile.license_plate,
            deposit_amount: driver_profile.deposit_amount,
            interviewer_name: driver_profile.interviewer_name,
            interview_notes: driver_profile.interview_notes,
            identification_front_image: driver_profile.identification_front_image,
            identification_back_image: driver_profile.identification_back_image,
            driving_license_image: driver_profile.driving_license_image
          });
          createdDriverProfile = existingDriverProfile;
        } else {
          // Create new driver profile
          createdDriverProfile = await DriverProfile.create({
            user_id: user.user_id,
            address: driver_profile.address,
            license_plate: driver_profile.license_plate,
            deposit_amount: driver_profile.deposit_amount,
            interviewer_name: driver_profile.interviewer_name,
            interview_notes: driver_profile.interview_notes,
            identification_front_image: driver_profile.identification_front_image,
            identification_back_image: driver_profile.identification_back_image,
            driving_license_image: driver_profile.driving_license_image
          });
        }
      }

      // Check if user is in default group, if not add them
      const existingGroupMembership = await ConversationsUser.findOne({
        where: {
          conversation_id: 1,
          user_id: user.user_id
        }
      });

      if (!existingGroupMembership) {
        await ConversationsUser.create({
          conversation_id: 1,
          user_id: user.user_id,
          is_admin: false
        });
      }

    } else {
      // Create new user
      user = await User.create({
        phone_number,
        user_name,
        first_name,
        last_name,
        role,
        gender,
        password: hashedPassword,
        profile_image: profile_image || "",
        country: "VN",
        country_full_name: "Vietnam",
        country_code: "+84",
        is_mobile: true,
        is_profile_approved: true
      });

      // If driver, create driver profile
      if (role === 'driver') {
        createdDriverProfile = await DriverProfile.create({
          user_id: user.user_id,
          address: driver_profile.address,
          license_plate: driver_profile.license_plate,
          deposit_amount: driver_profile.deposit_amount,
          interviewer_name: driver_profile.interviewer_name,
          interview_notes: driver_profile.interview_notes,
          identification_front_image: driver_profile.identification_front_image,
          identification_back_image: driver_profile.identification_back_image,
          driving_license_image: driver_profile.driving_license_image
        });
      }

      // Add user to default group (conversation_id = 1)
      await ConversationsUser.create({
        conversation_id: 1,
        user_id: user.user_id,
        is_admin: false
      });
    }

    // Prepare response
    const responseData = {
      user_id: user.user_id,
      phone_number: user.phone_number,
      user_name: user.user_name,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      gender: user.gender,
      profile_image: user.profile_image,
      default_password: "123456",
      in_group: true,
      createdAt: user.createdAt,
      is_profile_approved: user.is_profile_approved
    };

    if (role === 'driver' && createdDriverProfile) {
      responseData.driver_profile = {
        profile_id: createdDriverProfile.profile_id,
        address: createdDriverProfile.address,
        license_plate: createdDriverProfile.license_plate,
        deposit_amount: createdDriverProfile.deposit_amount,
        interviewer_name: createdDriverProfile.interviewer_name,
        interview_notes: createdDriverProfile.interview_notes,
        identification_front_image: createdDriverProfile.identification_front_image,
        identification_back_image: createdDriverProfile.identification_back_image,
        driving_license_image: createdDriverProfile.driving_license_image,
        registration_date: createdDriverProfile.registration_date
      };
    }

    return res.status(201).json({
      status: true,
      message: `${role === 'driver' ? 'Driver' : 'Vice admin'} created successfully`,
      data: responseData
    });

  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while creating the user",
      error: error.message
    });
  }
};

module.exports = { createUserByAdmin };