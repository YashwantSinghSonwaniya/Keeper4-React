export const EMAIL_SERVICES_UNAVAILABLE =
  process.env.NODE_ENV === "production";

export const EMAIL_REGISTRATION_NOTICE = {
  title: "Email Registration Temporarily Unavailable",
  message:
    "We’re currently upgrading our email verification service. To create your account instantly, please continue with Google Sign-In. We appreciate your patience.",
};

export const PASSWORD_RESET_NOTICE = {
  title: "Password Reset Temporarily Unavailable",
  message:
    "We’re currently upgrading our email verification service. Password reset emails are temporarily unavailable, but Google Sign-In remains available.",
};
