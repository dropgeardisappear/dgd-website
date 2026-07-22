"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SmsTestPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function readResponse(response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Server returned an invalid response. Status: ${response.status}`
      );
    }
  }

  async function sendCode(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be signed in to verify your phone number."
        );
      }

      const response = await fetch("/api/sms/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not send the code.");
      }

      setPhone(data.phone);
      setStep("code");
      setMessage("Code sent. Check your phone.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "You must be signed in to verify your phone number."
        );
      }

      const response = await fetch("/api/sms/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phone,
          code,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not verify the code.");
      }

      setPhone(data.phone || phone);
      setStep("verified");
      setMessage(
        data.message || "Your phone number is verified and saved."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetPhone() {
    setStep("phone");
    setPhone("");
    setCode("");
    setMessage("");
    setError("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#151515",
          border: "1px solid #333333",
          borderRadius: "18px",
          padding: "32px",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            color: "#888888",
            fontSize: "12px",
            fontWeight: "bold",
            letterSpacing: "2px",
            marginTop: 0,
            marginBottom: "8px",
          }}
        >
          DGD NOTIFICATIONS
        </p>

        <h1 style={{ marginTop: 0 }}>Verify your phone</h1>

        {step === "phone" && (
          <form onSubmit={sendCode}>
            <input
              type="tel"
              placeholder="(470) 555-1234"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "16px",
                borderRadius: "10px",
                border: "1px solid #444444",
                background: "#222222",
                color: "#ffffff",
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "14px",
                border: "none",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#000000",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Sending..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode}>
            <p style={{ color: "#aaaaaa" }}>
              Code sent to <strong>{phone}</strong>
            </p>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              maxLength={10}
              required
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "20px",
                letterSpacing: "5px",
                borderRadius: "10px",
                border: "1px solid #444444",
                background: "#222222",
                color: "#ffffff",
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "14px",
                border: "none",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#000000",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Verifying..." : "Verify Phone Number"}
            </button>

            <button
              type="button"
              onClick={resetPhone}
              disabled={loading}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #444444",
                background: "transparent",
                color: "#ffffff",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              Change Phone Number
            </button>
          </form>
        )}

        {step === "verified" && (
          <div
            style={{
              padding: "18px",
              borderRadius: "12px",
              border: "1px solid #315c31",
              background: "#142214",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Phone verified</h2>

            <p style={{ marginBottom: "16px", color: "#b7d6b7" }}>
              {phone} was verified and saved to your DGD account.
            </p>

            <button
              type="button"
              onClick={resetPhone}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #456f45",
                background: "transparent",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Verify Another Number
            </button>
          </div>
        )}

        {message && (
          <p
            style={{
              color: "#79db79",
              textAlign: "center",
              marginTop: "18px",
              marginBottom: 0,
            }}
          >
            {message}
          </p>
        )}

        {error && (
          <p
            style={{
              color: "#ff7070",
              textAlign: "center",
              marginTop: "18px",
              marginBottom: 0,
            }}
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
}