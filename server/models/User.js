const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // stored as a bcrypt hash, never plain text
  },
  { timestamps: true }
);

// Mongoose middleware: runs automatically right before a user document is saved.
// We hash the password here so we NEVER have to remember to hash it manually
// in every route that creates/updates a user.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // skip if password unchanged
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: lets us call user.comparePassword(plainText) later in the login route
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
