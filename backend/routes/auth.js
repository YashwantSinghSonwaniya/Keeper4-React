const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  register,
  login,
  googleAuth,
  forgotPassword,
  changePassword,
  deleteAccount,
  updateProfile,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);           // ✅ New Google OAuth endpoint
router.post("/forgot-password", forgotPassword);
router.put("/change-password", authenticateToken, changePassword);
router.delete("/delete-account", authenticateToken, deleteAccount);
router.put("/update-profile", authenticateToken, updateProfile);

module.exports = router;