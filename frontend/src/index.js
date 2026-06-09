import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./components/App";
// import "./../public/styles.css";

ReactDOM.render(
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
  </BrowserRouter>,
  document.getElementById("root")
);