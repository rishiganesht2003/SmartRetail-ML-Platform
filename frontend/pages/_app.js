import { useEffect } from "react";
import { applyTheme, getTheme } from "@/lib/theme";

import "@/styles/globals.css";
import "@/styles/home.css";
import "@/styles/login.css";
import "@/styles/admin.css";
import "@/styles/customer.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return <Component {...pageProps} />;
}
