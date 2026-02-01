const { User, DriverProfile } = require("../../models");
const bcrypt = require("bcryptjs");

const updateUserByAdmin = async (req, res) => {
  try {
    const userRole = req.authData.role;
    const { user_id } = req.params;

    const {
      phone_number,
      user_name,
      first_name,
      last_name,
      email_id,
      gender,
      dob,
      profile_image,
      bio,
      role,
      password,
      driver_profile
    } = req.body;

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required"
      });
    }

    // Get existing user
    const user = await User.findOne({
      where: { user_id },
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Build update fields for User
    const userUpdateFields = {};

    if (phone_number !== undefined) userUpdateFields.phone_number = phone_number;
    if (user_name !== undefined) userUpdateFields.user_name = user_name;
    if (first_name !== undefined) userUpdateFields.first_name = first_name;
    if (last_name !== undefined) userUpdateFields.last_name = last_name;
    if (email_id !== undefined) userUpdateFields.email_id = email_id;
    if (gender !== undefined) userUpdateFields.gender = gender;
    if (dob !== undefined) userUpdateFields.dob = dob;
    if (profile_image !== undefined) userUpdateFields.profile_image = profile_image;
    if (bio !== undefined) userUpdateFields.bio = bio;
    if (role !== undefined) {
      // Validate role based on who is updating
      if (userRole === 'vice_admin') {
        // Vice admin can ONLY set role to 'driver', NOT 'vice_admin' or 'admin'
        if (role !== 'driver') {
          return res.status(403).json({
            status: false,
            message: "Vice admin can only update users to role 'driver'"
          });
        }
      } else if (userRole === 'admin') {
        // Admin can set any role
        if (!['admin', 'vice_admin', 'driver'].includes(role)) {
          return res.status(400).json({
            status: false,
            message: "Invalid role. Must be 'admin', 'vice_admin', or 'driver'"
          });
        }
      }
      userUpdateFields.role = role;
    }

    // Hash password if provided
    if (password !== undefined && password !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      userUpdateFields.password = hashedPassword;
    }

    // Check if phone number is being changed and already exists
    if (phone_number && phone_number !== user.phone_number) {
      const existingUser = await User.findOne({
        where: { phone_number }
      });

      if (existingUser) {
        return res.status(400).json({
          status: false,
          message: "Phone number already exists"
        });
      }
    }

    // Update user
    if (Object.keys(userUpdateFields).length > 0) {
      await User.update(userUpdateFields, {
        where: { user_id }
      });
    }

    // Handle driver profile update
    if (driver_profile && (user.role === 'driver' || userUpdateFields.role === 'driver')) {
      const driverUpdateFields = {};

      if (driver_profile.address !== undefined) driverUpdateFields.address = driver_profile.address;
      if (driver_profile.license_plate !== undefined) driverUpdateFields.license_plate = driver_profile.license_plate;
      if (driver_profile.deposit_amount !== undefined) driverUpdateFields.deposit_amount = driver_profile.deposit_amount;
      if (driver_profile.interviewer_name !== undefined) driverUpdateFields.interviewer_name = driver_profile.interviewer_name;
      if (driver_profile.interview_notes !== undefined) driverUpdateFields.interview_notes = driver_profile.interview_notes;
      if (driver_profile.identification_front_image !== undefined) driverUpdateFields.identification_front_image = driver_profile.identification_front_image;
      if (driver_profile.identification_back_image !== undefined) driverUpdateFields.identification_back_image = driver_profile.identification_back_image;
      if (driver_profile.driving_license_image !== undefined) driverUpdateFields.driving_license_image = driver_profile.driving_license_image;
      if (driver_profile.can_create_order !== undefined) driverUpdateFields.can_create_order = driver_profile.can_create_order;

      if (user.profile) {
        // Update existing driver profile
        if (Object.keys(driverUpdateFields).length > 0) {
          await DriverProfile.update(driverUpdateFields, {
            where: { user_id }
          });
        }
      } else {
        // Create new driver profile if user is being changed to driver
        if (userUpdateFields.role === 'driver') {
          await DriverProfile.create({
            user_id,
            ...driverUpdateFields
          });
        }
      }
    }

    // Get updated user data
    const updatedUser = await User.findOne({
      where: { user_id },
    });

    // Prepare response
    const responseData = {
      user_id: updatedUser.user_id,
      phone_number: updatedUser.phone_number,
      user_name: updatedUser.user_name,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      email_id: updatedUser.email_id,
      role: updatedUser.role,
      gender: updatedUser.gender,
      dob: updatedUser.dob,
      bio: updatedUser.bio,
      profile_image: updatedUser.profile_image,
      updatedAt: updatedUser.updatedAt
    };

    if (updatedUser.profile) {
      responseData.driver_profile = {
        profile_id: updatedUser.profile.profile_id,
        address: updatedUser.profile.address,
        license_plate: updatedUser.profile.license_plate,
        deposit_amount: updatedUser.profile.deposit_amount,
        interviewer_name: updatedUser.profile.interviewer_name,
        interview_notes: updatedUser.profile.interview_notes,
        identification_front_image: updatedUser.profile.identification_front_image,
        identification_back_image: updatedUser.profile.identification_back_image,
        driving_license_image: updatedUser.profile.driving_license_image,
        can_create_order: updatedUser.profile.can_create_order,
        registration_date: updatedUser.profile.registration_date
      };
    }

    return res.status(200).json({
      status: true,
      message: "User updated successfully",
      data: responseData
    });

  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating the user",
      error: error.message
    });
  }
};

module.exports = { updateUserByAdmin };
