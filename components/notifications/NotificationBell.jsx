"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Heart,
  MessageCircle,
  ShieldCheck,
  Star,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function NotificationBell() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  useEffect(() => {
    async function loadNotifications() {
      try {
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();
        console.log("Current user:", currentUser);
console.log("Current user ID:", currentUser?.id);

        if (userError) {
          console.error("User error:", userError);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(20);
          
          console.log("Notifications:", data);
console.log("Notification error:", error);

        if (error) {
          console.error("Notification loading error:", error);
          setLoading(false);
          return;
        }

        setNotifications(data || []);
        setLoading(false);
      } catch (error) {
        console.error("Notification error:", error);
        setLoading(false);
      }
    }

    loadNotifications();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((current) => [
            payload.new,
            ...current,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  async function markAsRead(notificationId) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Mark as read error:", error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );
  }

  async function markAllAsRead() {
    if (!user || unreadCount === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Mark all read error:", error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  }

  function getNotificationIcon(type) {
    switch (type) {
      case "comment":
        return <MessageCircle size={17} strokeWidth={1.7} />;

      case "reply":
        return <MessageCircle size={17} strokeWidth={1.7} />;

      case "like":
        return <Heart size={17} strokeWidth={1.7} />;

      case "rating":
        return <Star size={17} strokeWidth={1.7} />;

      case "build_approved":
        return <ShieldCheck size={17} strokeWidth={1.7} />;

      default:
        return <Bell size={17} strokeWidth={1.7} />;
    }
  }

  function formatTime(dateString) {
    const createdDate = new Date(dateString);
    const now = new Date();

    const difference = now.getTime() - createdDate.getTime();

    const minutes = Math.floor(difference / 60000);
    const hours = Math.floor(difference / 3600000);
    const days = Math.floor(difference / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return createdDate.toLocaleDateString();
  }

  if (loading || !user) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label="Open notifications"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-8 w-8 items-center justify-center text-zinc-300 transition hover:text-white"
      >
        <Bell size={19} strokeWidth={1.8} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-200 px-1 text-[9px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-[1000] w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">
                DGD
              </p>

              <h2 className="mt-1 text-sm font-bold text-white">
                Notifications
              </h2>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 transition hover:text-white"
              >
                <Check size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[390px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Bell
                  size={27}
                  strokeWidth={1.5}
                  className="mx-auto text-zinc-600"
                />

                <p className="mt-3 text-sm font-semibold text-white">
                  No notifications yet
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Comments, ratings and build updates will appear
                  here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const notificationContent = (
                  <div
                    onClick={() => markAsRead(notification.id)}
                    className={`grid cursor-pointer grid-cols-[34px_1fr] gap-3 border-b border-white/[0.06] px-4 py-4 transition hover:bg-white/[0.04] ${
                      notification.is_read
                        ? "bg-transparent"
                        : "bg-white/[0.035]"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400">
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs leading-5 text-zinc-200">
                          {notification.message}
                        </p>

                        {!notification.is_read && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-200" />
                        )}
                      </div>

                      <p className="mt-1 text-[10px] text-zinc-600">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                );

                if (notification.post_id) {
                  return (
                    <Link
                      key={notification.id}
                      href={`/build/${notification.post_id}`}
                      onClick={() => setOpen(false)}
                      className="block no-underline"
                    >
                      {notificationContent}
                    </Link>
                  );
                }

                return (
                  <div key={notification.id}>
                    {notificationContent}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}