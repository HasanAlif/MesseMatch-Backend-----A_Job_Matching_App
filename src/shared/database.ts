import mongoose from "mongoose";
import config from "../config";
import dns from "dns";
import { User, UserRole } from "../app/models";
import bcrypt from "bcrypt";

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

async function connectMongoDB() {
  try {
    await mongoose.connect(config.database_url as string, {
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 2000,
    });
    console.log("MongoDB connected successfully!");

    // await initiateSuperAdmin();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected from MongoDB");
});

// async function initiateSuperAdmin() {
//   const adminEmail = "admin@messematch.com";

//   const existingAdmin = await User.findOne({ email: adminEmail });
//   if (existingAdmin) return;

//   const hashedPassword = await bcrypt.hash(
//     "Admin@123456",
//     Number(config.bcrypt_salt_rounds)
//   );

//   await User.create({
//     fullName: "Super Admin",
//     email: adminEmail,
//     mobileNumber: "0000000000",
//     password: hashedPassword,
//     role: UserRole.ADMIN,
//   });

//   console.log("Super Admin created successfully");
// }

connectMongoDB();

export { connectMongoDB };
