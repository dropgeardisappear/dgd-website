"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { isShopProfilePath, shopFinderReturnPath } from "@/lib/shop-finder/login-return";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");



  async function handleEmailAuth(e) {
    e.preventDefault();

    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    if (mode === "signup") {
      const chosenUsername = username.trim().toLowerCase().replace(/^@/, "");
      if (!/^[a-z0-9_]{3,30}$/.test(chosenUsername) || chosenUsername === email.split("@")[0].toLowerCase()) {
        alert("Choose a username with 3–30 letters, numbers, or underscores. Do not use your email.");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: chosenUsername } },
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (data.session && data.user) {
        await supabase.from("profiles").upsert([
          {
            id: data.user.id,
            email: data.user.email,
            username: chosenUsername,
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

      window.location.href = shopFinderReturnPath(window.location.search);
    }
  }

  async function loginWithGoogle() {
    const destination = shopFinderReturnPath(window.location.search);
    let callback = destination;
    try {
      sessionStorage.removeItem("dgd-shop-login-return");
      if (isShopProfilePath(destination)) {
        sessionStorage.setItem("dgd-shop-login-return", JSON.stringify({path:destination,expires:Date.now()+30*60*1000}));
        callback = "/shop-finder/dashboard";
      }
    } catch {
      alert("Allow browser session storage to return to this shop after Google sign-in.");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
       redirectTo: `${window.location.origin}${callback}`,
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

        {mode === "signup" && <input aria-label="Username" autoComplete="username" placeholder="Choose your public username" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={30} required className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 mb-4" />}
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