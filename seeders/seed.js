const { User, Conversation, ConversationsUser, Admin } = require("../models");

/**
 * Ship99 Database Seeder
 * Seeds core data required for the application to function
 */
const seed = async () => {
  try {
    console.log("🚀 Seed - Starting...");
    console.log("============================================\n");

    // 1. Create Admin Panel Account
    const [adminCreated] = await Admin.findOrCreate({
      where: { admin_id: 1 },
      defaults: {
        admin_id: 1,
        user_id: 1,
        admin_email: "demo@admin.com",
        admin_name: "Admin",
        admin_password: "Admin@123",
        profile_pic: "uploads/avtars/Admin.png"
      }
    });

    if (adminCreated) {
      console.log("✓ Admin panel account created");
    } else {
      console.log("- Admin panel account already exists");
    }

    // 2. Create Default Group
    const [groupCreated] = await Conversation.findOrCreate({
      where: { conversation_id: 1 },
      defaults: {
        conversation_id: 1,
        is_group: true,
        group_name: "Main Chat",
        public_group: false,
        created_by_admin: true
      }
    });

    if (groupCreated) {
      console.log("✓ Default group 'Main Chat' created");
    } else {
      console.log("- Default group already exists");
    }

    // 3. Create Users
    const users = [
      // Admin
      {
        phone_number: '0901234567',
        email_id: '',
        first_name: 'Chat',
        last_name: 'Admin',
        user_name: 'admin',
        role: 'admin',
        is_group_admin: true
      },

      // Vice Admin 1
      {
        phone_number: '0901234568',
        email_id: '',
        first_name: 'Vice Admin',
        last_name: 'One',
        user_name: 'viceadmin1',
        role: 'vice_admin',
        is_group_admin: false
      },

      // Vice Admin 2
      {
        phone_number: '0901234569',
        email_id: '',
        first_name: 'Vice Admin',
        last_name: 'Two',
        user_name: 'viceadmin2',
        role: 'vice_admin',
        is_group_admin: false
      }
    ];

    console.log("\n👥 Creating users:");

    for (const userData of users) {
      const [user, created] = await User.findOrCreate({
        where: { phone_number: userData.phone_number },
        defaults: {
          phone_number: userData.phone_number,
          email_id: userData.email_id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          user_name: userData.user_name,
          bio: `${userData.role}`,
          country: 'VN',
          country_full_name: 'Vietnam',
          country_code: '+84',
          gender: 'male',
          is_mobile: true,
          role: userData.role
        }
      });

      if (created) {
        // Add user to the group
        await ConversationsUser.findOrCreate({
          where: {
            conversation_id: 1,
            user_id: user.user_id
          },
          defaults: {
            is_admin: userData.is_group_admin
          }
        });
        console.log(`✓ ${userData.first_name} ${userData.last_name} (${userData.role}) - ${userData.phone_number}`);
      } else {
        console.log(`- ${userData.first_name} ${userData.last_name} already exists`);
      }
    }

    console.log("\n✅ Seeding Complete!");
    console.log("\n📋 User Accounts:");
    console.log("=========================================");
    console.log("1️⃣ Admin:        0901234567");
    console.log("2️⃣ Vice Admin 1: 0901234568");
    console.log("3️⃣ Vice Admin 2: 0901234569");
    console.log("   (All login via OTP)");

    console.log("\n🔐 Admin Panel (whoxa_admin):");
    console.log("=========================================");
    console.log("Email:    demo@admin.com");
    console.log("Password: Admin@123");

    console.log("\n📊 Summary:");
    console.log("=========================================");
    console.log("- Group: Main Chat (ID: 1)");
    console.log("- 1 Admin (full permissions)");
    console.log("- 2 Vice Admins (manage orders & messages)");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
};

// Run the seed
seed();
