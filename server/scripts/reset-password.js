import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.model.js";

dotenv.config();

const run = async () => {
  const [,, targetInput, newPassword] = process.argv;

  try {
    if (!process.env.MONGODB_URI) {
      console.error("Error: MONGODB_URI is not defined in server/.env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });

    if (!targetInput) {
      console.log("\n=== Pulse Messenger: Reset Password Tool ===");
      console.log("Usage: node scripts/reset-password.js <email-or-username> <new-password>\n");
      
      const allUsers = await User.find({}).select("username email createdAt").sort({ createdAt: -1 }).lean();
      
      // Separate human/named users from test run artifacts
      const isTestName = (name = "") => /^(testuser_|layout_|probe_|stprobe_|cc_|ccf_|studio_|pv_|st\d_)/i.test(name);
      const humanUsers = allUsers.filter((u) => !isTestName(u.username));
      
      console.log(`Registered User Accounts (${humanUsers.length} found):`);
      humanUsers.forEach((u, idx) => {
        console.log(`  [${idx + 1}] Username: "${u.username}" | Email: "${u.email}"`);
      });

      console.log("\nDemo / Seed Accounts default password is: password123");
      console.log("\nTo reset any password, run:");
      console.log('  node scripts/reset-password.js "<username-or-email>" "<new_password>"\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (!newPassword || newPassword.length < 6) {
      console.error("\nError: Password must be at least 6 characters long.");
      console.log('Example: node scripts/reset-password.js "your_username" "MyNewSecurePassword123"\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    const cleanInput = targetInput.trim();
    const escaped = cleanInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const user = await User.findOne({
      $or: [
        { email: cleanInput.toLowerCase() },
        { username: new RegExp(`^${escaped}$`, "i") },
      ],
    });

    if (!user) {
      console.error(`\n❌ User not found matching "${cleanInput}".`);
      console.log("Please check your username or email and try again.");
      await mongoose.disconnect();
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    console.log(`\n✅ Password successfully updated for account!`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${newPassword}`);
    console.log(`\nYou can now log in at http://localhost:5173 or the deployed app.\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error during password reset:", error.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
};

run();
