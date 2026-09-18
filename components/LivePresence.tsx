"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

function getVisitorId() {
  if (typeof window === "undefined") return "";

  const existing = sessionStorage.getItem("dgd_visitor_id");

  if (existing) {
    return existing;
  }

  const newId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  sessionStorage.setItem("dgd_visitor_id", newId);

  return newId;
}

export default function LivePresence() {
  const pathname = usePathname();

  useEffect(() => {
    // Do not count admin pages as visitors
    if (!pathname || pathname.startsWith("/admin")) {
      return;
    }

    const visitorId = getVisitorId();

    if (!visitorId) return;

    const channel = supabase.channel("dgd-live-visitors", {
      config: {
        presence: {
          key: visitorId,
        },
      },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          visitor_id: visitorId,
          page: pathname,
          online_at: new Date().toISOString(),
          user_agent:
            typeof navigator !== "undefined"
              ? navigator.userAgent
              : "",
        });
      }
    });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  return null;
}