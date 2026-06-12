const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  register,
  verifyEmail,
  login,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
  updateProfile,
} = require("../controllers/authController");

router.post("/register", register);                  // ✅ Stages in pending_users + sends verification email
router.post("/verify-email", verifyEmail);           // ✅ Creates the real user after verification
router.post("/login", login);
router.post("/google", googleAuth);                  // ✅ Google OAuth (auto-verified)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", authenticateToken, changePassword);
router.delete("/delete-account", authenticateToken, deleteAccount);
router.put("/update-profile", authenticateToken, updateProfile);

module.exports = router;