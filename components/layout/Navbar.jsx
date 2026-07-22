"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function getCurrentUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);
    }

    getCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(8,8,8,0.92)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1400px",
          minHeight: "68px",
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "18px",
            fontWeight: "900",
            letterSpacing: "0.18em",
          }}
        >
          DGD
        </Link>

        <nav
          className="dgd-desktop-nav"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "26px",
          }}
        >
          <Link href="/" style={navLinkStyle}>
            Home
          </Link>

          <Link href="/garage" style={navLinkStyle}>
            Garage
          </Link>

          <Link href="/submit" style={navLinkStyle}>
            Submit Build
          </Link>
        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {user && <NotificationBell />}

          <Link
            href={user ? "/account" : "/login"}
            aria-label={user ? "Open account" : "Login"}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#9ca3af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            <UserRound size={19} strokeWidth={1.8} />
          </Link>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen((current) => !current)}
            className="dgd-mobile-menu-button"
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#9ca3af",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {menuOpen ? (
              <X size={20} strokeWidth={1.8} />
            ) : (
              <Menu size={20} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="dgd-mobile-nav"
          style={{
            padding: "10px 20px 20px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "#0a0a0a",
          }}
        >
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            style={mobileNavLinkStyle}
          >
            Home
          </Link>

          <Link
            href="/garage"
            onClick={() => setMenuOpen(false)}
            style={mobileNavLinkStyle}
          >
            Garage
          </Link>

          <Link
            href="/submit"
            onClick={() => setMenuOpen(false)}
            style={mobileNavLinkStyle}
          >
            Submit Build
          </Link>
        </nav>
      )}

      <style jsx>{`
        @media (max-width: 760px) {
          .dgd-desktop-nav {
            display: none !important;
          }

          .dgd-mobile-menu-button {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}

const navLinkStyle = {
  color: "#a1a1aa",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: "700",
};

const mobileNavLinkStyle = {
  display: "block",
  padding: "14px 0",
  color: "#d4d4d8",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "700",
};