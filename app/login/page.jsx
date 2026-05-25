"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleEmailAuth(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (data.user) {
        await supabase.from("profiles").upsert([
          {
            id: data.user.id,
            email: data.user.email,
            username: email.split("@")[0],
          },
        ]);
      }

      alert("Account created. You can login now.");
      setMode("login");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      window.location.href = "/account";
    }
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
       redirectTo: `${window.location.origin}/account`,
      },
    });
  }

  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center px-6">
      <form
        onSubmit={handleEmailAuth}
        className="bg-zinc-950 border border-white/10 rounded-3xl p-8 w-full max-w-md"
      >
        <h1 className="text-4xl font-black mb-2">
          {mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
        </h1>

        <p className="text-gray-400 mb-8">
          Sign in to rate builds, comment, reply, and build your garage.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 mb-4"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 mb-5"
        />

        <button
          type="submit"
          className="w-full bg-orange-500 text-black py-4 rounded-xl uppercase font-black hover:bg-white transition mb-4"
        >
          {mode === "login" ? "Login" : "Create Account"}
        </button>

        <button
          type="button"
          onClick={loginWithGoogle}
          className="w-full border border-white/20 py-4 rounded-xl uppercase font-black hover:bg-white hover:text-black transition mb-5"
        >
          Continue With Google
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-gray-400 hover:text-white"
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Login"}
        </button>
      </form>
    </div>
  );
}