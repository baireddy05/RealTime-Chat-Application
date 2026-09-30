import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/models/User.model.js";
import PasswordReset from "../src/models/PasswordReset.model.js";
import { forgotPassword, verifyOtp, resetPasswordWithOtp } from "../src/controllers/auth.controller.js";

dotenv.config();

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

const runTest = async () => {
  console.log("--- Starting Password Reset OTP Flow Integration Test ---");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB Connected.");

  // Test target: User1
  const testUser = await User.findOne({ username: "User1" });
  if (!testUser) {
    console.error("Test user User1 not found");
    process.exit(1);
  }

  // Clear any existing reset records for clean test
  await PasswordReset.deleteMany({ email: testUser.email });

  // 1. Test forgotPassword (request OTP)
  console.log("\n1. Testing forgotPassword (request OTP) for identifier 'User1'...");
  const req1 = { body: { identifier: "User1" } };
  const res1 = mockRes();
  await forgotPassword(req1, res1);
  console.log("Response:", res1.statusCode, res1.body);
  if (res1.statusCode !== 200) throw new Error("Step 1 failed");

  // Retrieve the generated record
  const resetRecord = await PasswordReset.findOne({ email: testUser.email });
  if (!resetRecord) throw new Error("Reset record not found in MongoDB");
  console.log("PasswordReset record created with TTL expiry:", resetRecord.expiresAt);

  // 2. Test verifyOtp with wrong code
  console.log("\n2. Testing verifyOtp with invalid code '000000'...");
  const req2Fail = { body: { email: testUser.email, otp: "000000" } };
  const res2Fail = mockRes();
  await verifyOtp(req2Fail, res2Fail);
  console.log("Response (expect 400):", res2Fail.statusCode, res2Fail.body);
  if (res2Fail.statusCode !== 400) throw new Error("Invalid OTP should have returned 400");

  // We need to know what OTP was generated to test the success case. Let's find the OTP by brute-checking or testing verify
  // In the real app, user reads the OTP from their email / console.
  // Let's test all 6-digit combinations or inspect: since it's 100000..999999, bcrypt compare takes ~50ms each.
  // Instead, let's create a known OTP in PasswordReset to test verify and reset:
  const knownOtp = "789123";
  const salt = await bcrypt.genSalt(10);
  resetRecord.otp = await bcrypt.hash(knownOtp, salt);
  resetRecord.attempts = 0;
  await resetRecord.save();

  // 3. Test verifyOtp with valid code
  console.log("\n3. Testing verifyOtp with valid code '789123'...");
  const req2Pass = { body: { email: testUser.email, otp: knownOtp } };
  const res2Pass = mockRes();
  await verifyOtp(req2Pass, res2Pass);
  console.log("Response (expect 200):", res2Pass.statusCode, res2Pass.body);
  if (res2Pass.statusCode !== 200) throw new Error("Valid OTP should have returned 200");

  // 4. Test resetPasswordWithOtp
  console.log("\n4. Testing resetPasswordWithOtp with new password 'tempNewPass123'...");
  const req3 = { body: { email: testUser.email, otp: knownOtp, newPassword: "tempNewPass123" } };
  const res3 = mockRes();
  await resetPasswordWithOtp(req3, res3);
  console.log("Response (expect 200):", res3.statusCode, res3.body);
  if (res3.statusCode !== 200) throw new Error("Reset password should have returned 200");

  // Check that User1 password was changed
  const updatedUser = await User.findOne({ username: "User1" });
  const isMatchNew = await bcrypt.compare("tempNewPass123", updatedUser.password);
  console.log("Is new password valid on User1?", isMatchNew);
  if (!isMatchNew) throw new Error("User password was not updated in DB");

  // Verify OTP was consumed
  const consumedRecord = await PasswordReset.findOne({ email: testUser.email });
  console.log("Is OTP record removed after use?", consumedRecord === null);
  if (consumedRecord !== null) throw new Error("OTP record was not consumed");

  // 5. Restore User1 back to original "password123"
  console.log("\n5. Restoring User1 password back to 'password123'...");
  const defaultSalt = await bcrypt.genSalt(12);
  updatedUser.password = await bcrypt.hash("password123", defaultSalt);
  await updatedUser.save();
  console.log("User1 password restored successfully.");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
  await mongoose.disconnect();
  process.exit(0);
};

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
