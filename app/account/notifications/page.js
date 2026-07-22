"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const defaultPreferences = {
  comments: false,
  replies: false,
  likes: false,
  ratings: false,
  build_approved: true,
  marketing_sms: false,
  marketing_email: false,
};

export default function NotificationSettingsPage() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(defaultPreferences);

  const [phone, setPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [verificationStep, setVerificationStep] = useState("idle");
  const [code, setCode] = useState("");

  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    setPageLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error(
          "You must be signed in to manage notification settings."
        );
      }

      setUser(session.user);

      const { data, error: preferenceError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (preferenceError) {
        throw preferenceError;
      }

      if (data) {
        setPhone(data.phone || "");
        setPhoneInput(data.phone || "");
        setPhoneVerified(Boolean(data.phone_verified));

        setPreferences({
          comments: Boolean(data.comments),
          replies: Boolean(data.replies),
          likes: Boolean(data.likes),
          ratings: Boolean(data.ratings),
          build_approved: Boolean(data.build_approved),
          marketing_sms: Boolean(data.marketing_sms),
          marketing_email: Boolean(data.marketing_email),
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load your notification settings."
      );
    } finally {
      setPageLoading(false);
    }
  }

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "You must be signed in to manage notification settings."
      );
    }

    return session.access_token;
  }

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

    setActionLoading("send");
    setMessage("");
    setError("");

    try {
      const accessToken = await getAccessToken();

      const response = await fetch("/api/sms/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          phone: phoneInput,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not send the code.");
      }

      setPhoneInput(data.phone);
      setVerificationStep("code");
      setMessage("Verification code sent. Check your phone.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send the verification code."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function verifyCode(event) {
    event.preventDefault();

    setActionLoading("verify");
    setMessage("");
    setError("");

    try {
      const accessToken = await getAccessToken();

      const response = await fetch("/api/sms/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          phone: phoneInput,
          code,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not verify the code.");
      }

      const verifiedPhone = data.phone || phoneInput;

      setPhone(verifiedPhone);
      setPhoneInput(verifiedPhone);
      setPhoneVerified(true);
      setVerificationStep("idle");
      setCode("");
      setMessage("Your phone number was verified and saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not verify the code."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function savePreferences() {
    if (!user) {
      setError("You must be signed in to save preferences.");
      return;
    }

    setActionLoading("save");
    setMessage("");
    setError("");

    try {
      const { error: saveError } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            ...preferences,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (saveError) {
        throw saveError;
      }

      setMessage("Notification preferences saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your notification preferences."
      );
    } finally {
      setActionLoading("");
    }
  }

  function updatePreference(name) {
    setPreferences((current) => ({
      ...current,
      [name]: !current[name],
    }));
  }

  function beginPhoneChange() {
    setPhoneInput(phone);
    setCode("");
    setVerificationStep("phone");
    setMessage("");
    setError("");
  }

  if (pageLoading) {
    return (
      <main style={styles.page}>
        <p>Loading notification settings...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <p style={styles.eyebrow}>DGD ACCOUNT</p>
        <h1 style={styles.title}>Notification Settings</h1>

        <p style={styles.description}>
          Choose how Drop Gear Disappear should notify you.
        </p>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Phone Number</h2>

          {phoneVerified && verificationStep === "idle" ? (
            <>
              <div style={styles.verifiedBox}>
                <div>
                  <strong>{phone}</strong>
                  <p style={styles.smallText}>
                    Verified for SMS notifications
                  </p>
                </div>

                <span style={styles.verifiedBadge}>Verified</span>
              </div>

              <button
                type="button"
                onClick={beginPhoneChange}
                style={styles.secondaryButton}
              >
                Change Phone Number
              </button>
            </>
          ) : (
            <>
              {verificationStep !== "code" && (
                <form onSubmit={sendCode}>
                  <label style={styles.label}>Phone number</label>

                  <input
                    type="tel"
                    placeholder="(470) 555-1234"
                    value={phoneInput}
                    onChange={(event) =>
                      setPhoneInput(event.target.value)
                    }
                    required
                    style={styles.input}
                  />

                  <button
                    type="submit"
                    disabled={actionLoading === "send"}
                    style={styles.primaryButton}
                  >
                    {actionLoading === "send"
                      ? "Sending..."
                      : "Send Verification Code"}
                  </button>
                </form>
              )}

              {verificationStep === "code" && (
                <form onSubmit={verifyCode}>
                  <p style={styles.smallText}>
                    Enter the code sent to{" "}
                    <strong>{phoneInput}</strong>
                  </p>

                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value.replace(/\D/g, "")
                      )
                    }
                    maxLength={10}
                    required
                    style={styles.codeInput}
                  />

                  <button
                    type="submit"
                    disabled={actionLoading === "verify"}
                    style={styles.primaryButton}
                  >
                    {actionLoading === "verify"
                      ? "Verifying..."
                      : "Verify Phone Number"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCode("");
                      setVerificationStep("phone");
                    }}
                    style={styles.secondaryButton}
                  >
                    Change Phone Number
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>SMS Activity Notifications</h2>

          <PreferenceToggle
            label="Build approved"
            description="Receive an SMS when your submitted build is approved."
            checked={preferences.build_approved}
            onChange={() => updatePreference("build_approved")}
          />

          <PreferenceToggle
            label="Comments"
            description="Receive an SMS when someone comments on your build."
            checked={preferences.comments}
            onChange={() => updatePreference("comments")}
          />

          <PreferenceToggle
            label="Replies"
            description="Receive an SMS when someone replies to your comment."
            checked={preferences.replies}
            onChange={() => updatePreference("replies")}
          />

          <PreferenceToggle
            label="Likes"
            description="Receive an SMS when someone likes your build."
            checked={preferences.likes}
            onChange={() => updatePreference("likes")}
          />

          <PreferenceToggle
            label="Ratings"
            description="Receive an SMS when someone rates your build."
            checked={preferences.ratings}
            onChange={() => updatePreference("ratings")}
          />
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Promotional Notifications</h2>

          <PreferenceToggle
            label="SMS promotions"
            description="Receive texts about DGD updates, events, and merch drops."
            checked={preferences.marketing_sms}
            onChange={() => updatePreference("marketing_sms")}
            disabled={!phoneVerified}
          />

          <PreferenceToggle
            label="Email promotions"
            description="Receive emails about DGD updates, events, and merch drops."
            checked={preferences.marketing_email}
            onChange={() => updatePreference("marketing_email")}
          />

          {!phoneVerified && (
            <p style={styles.warning}>
              Verify your phone before enabling promotional SMS.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={savePreferences}
          disabled={actionLoading === "save"}
          style={styles.saveButton}
        >
          {actionLoading === "save"
            ? "Saving..."
            : "Save Notification Settings"}
        </button>

        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </section>
    </main>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <label
      style={{
        ...styles.toggleRow,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div>
        <strong>{label}</strong>
        <p style={styles.smallText}>{description}</p>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={styles.checkbox}
      />
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080808",
    color: "#ffffff",
    padding: "60px 20px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto",
  },
  eyebrow: {
    color: "#888888",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "2px",
    marginBottom: "8px",
  },
  title: {
    fontSize: "38px",
    marginTop: 0,
    marginBottom: "8px",
  },
  description: {
    color: "#aaaaaa",
    marginBottom: "30px",
  },
  card: {
    background: "#151515",
    border: "1px solid #333333",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "18px",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: "20px",
    fontSize: "21px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid #444444",
    background: "#222222",
    color: "#ffffff",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  codeInput: {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid #444444",
    background: "#222222",
    color: "#ffffff",
    fontSize: "20px",
    letterSpacing: "5px",
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    marginTop: "14px",
    padding: "14px",
    border: "none",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#000000",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #444444",
    background: "transparent",
    color: "#ffffff",
    cursor: "pointer",
  },
  saveButton: {
    width: "100%",
    padding: "16px",
    border: "none",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#000000",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  verifiedBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    border: "1px solid #315c31",
    background: "#102010",
    borderRadius: "12px",
  },
  verifiedBadge: {
    color: "#79db79",
    fontSize: "13px",
    fontWeight: "bold",
  },
  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "16px 0",
    borderBottom: "1px solid #2c2c2c",
    cursor: "pointer",
  },
  checkbox: {
    width: "22px",
    height: "22px",
    flexShrink: 0,
    accentColor: "#ffffff",
  },
  smallText: {
    color: "#aaaaaa",
    fontSize: "14px",
    lineHeight: "1.5",
    marginTop: "5px",
    marginBottom: 0,
  },
  warning: {
    color: "#e0b65c",
    fontSize: "14px",
    marginBottom: 0,
  },
  success: {
    color: "#79db79",
    textAlign: "center",
  },
  error: {
    color: "#ff7070",
    textAlign: "center",
  },
};