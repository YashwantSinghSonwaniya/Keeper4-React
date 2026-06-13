import React, { useState, useEffect, useRef } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { verifyEmail } from "../api";

function VerifyEmail({ onLogin }) {
  const history = useHistory();
  const location = useLocation();

  // status: "verifying" | "success" | "error"
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  // Guard against double-invocation (React StrictMode mounts effects twice in dev)
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage(
        "Missing verification token. Please use the link from your email.",
      );
      return;
    }

    async function runVerification() {
      try {
        const res = await verifyEmail({ token });

        // Account is now created + verified. Log the user in.
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("loggedInUser", JSON.stringify(res.data.user));

        const userKey = res.data.user.id
          ? `user_${res.data.user.id}`
          : `user_${encodeURIComponent(res.data.user.email || "unknown")}`;
        sessionStorage.setItem(`guestImportPromptPending_${userKey}`, "true");
        sessionStorage.setItem(`guestImportPromptHandled_${userKey}`, "false");

        if (typeof onLogin === "function") {
          onLogin(res.data.user);
        }

        setStatus("success");
        setMessage("Your email is verified and your account is now active!");

        // Redirect into the app shortly after.
        setTimeout(() => {
          history.push("/");
        }, 2000);
      } catch (err) {
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "This verification link is invalid or has expired. Please register again.",
        );
      }
    }

    runVerification();
  }, [location.search, history, onLogin]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Email Verification</h2>

        {status === "verifying" && (
          <p className="forgot-msg">
            <span role="img" aria-label="loading">
              ⏳
            </span>{" "}
            Verifying your email, please wait...
          </p>
        )}

        {status === "success" && (
          <>
            <p className="forgot-msg">
              <span role="img" aria-label="success">
                ✅
              </span>{" "}
              {message}
            </p>
            <p style={{ fontSize: "14px" }}>Redirecting you to your notes...</p>
            <p>
              <Link to="/">Go now</Link>
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="error">{message}</p>
            <p>
              <Link to="/register">Register again</Link>
            </p>
            <p className="forgot-password-link">
              <Link to="/login">← Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
