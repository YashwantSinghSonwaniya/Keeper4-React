const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  register,
  login,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
  updateProfile,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);                  // ✅ Google OAuth endpoint
router.post("/forgot-password", forgotPassword);     // ✅ Sends reset email
router.post("/reset-password", resetPassword);       // ✅ Resets password via token
router.put("/change-password", authenticateToken, changePassword);
router.delete("/delete-account", authenticateToken, deleteAccount);
router.put("/update-profile", authenticateToken, updateProfile);

module.exports = router;