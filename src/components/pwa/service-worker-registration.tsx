"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/base-path";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/`, updateViaCache: "none" });
    }
  }, []);
  return null;
}
