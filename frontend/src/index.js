import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AudioProvider } from "./context/AudioContext";

import App from "./components/App";

ReactDOM.render(
  <GoogleOAuthProvider
    clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}
  >
    <AudioProvider>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 2000,
            style: {
              background: "#333",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px",
              fontFamily: "Montserrat, sans-serif",
            },
            success: {
              iconTheme: {
                primary: "#f5ba13",
                secondary: "#fff",
              },
            },
          }}
        />
      </BrowserRouter>
    </AudioProvider>
  </GoogleOAuthProvider>,
  document.getElementById("root")
);