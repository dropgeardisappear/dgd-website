"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");

  useEffect(() => {
    async function loadAccount() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      setUser(session.user);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setProfile(data);
        setUsername(data.username || "");
        setBio(data.bio || "");
        setInstagram(data.instagram || "");
        setTiktok(data.tiktok || "");
        setYoutube(data.youtube || "");
      } else {
        const starterUsername = session.user.email.split("@")[0];

        await supabase.from("profiles").insert([
          {
            id: session.user.id,
            email: session.user.email,
            username: starterUsername,
          },
        ]);

        setUsername(starterUsername);
      }
    }

    loadAccount();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);

    let avatarUrl = profile?.avatar_url || "";
    let bannerUrl = profile?.banner_url || "";

    if (avatarFile) {
      const avatarName = `${user.id}-avatar-${Date.now()}-${avatarFile.name}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(avatarName, avatarFile);

      if (error) {
        alert("Error uploading profile picture");
        console.log(error);
        setSaving(false);
        return;
      }

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(avatarName);

      avatarUrl = data.publicUrl;
    }

    if (bannerFile) {
      const bannerName = `${user.id}-banner-${Date.now()}-${bannerFile.name}`;

      const { error } = await supabase.storage
        .from("banners")
        .upload(bannerName, bannerFile);

      if (error) {
        alert("Error uploading banner");
        console.log(error);
        setSaving(false);
        return;
      }

      const { data } = supabase.storage
        .from("banners")
        .getPublicUrl(bannerName);

      bannerUrl = data.publicUrl;
    }

  const cleanUsername = username
  .replace("@", "")
  .toLowerCase()
  .replace(/\s+/g, "")
  .replace(/[^a-z0-9_]/g, "")
  .trim();

    const { error } = await supabase.from("profiles").upsert([
      {
        id: user.id,
        email: user.email,
        username: cleanUsername,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        bio,
        instagram,
        tiktok,
        youtube,
      },
    ]);

    if (error) {
      alert(error.message);
      console.log(error);
    } else {
      alert("Profile saved");
      window.location.href = `/garage/${cleanUsername}`;
    }

    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!user) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        Loading account...
      </div>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen overflow-x-hidden">
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <a
          href="/"
          className="text-gray-400 hover:text-white text-sm md:text-base"
        >
          ← Back Home
        </a>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8 mt-8 md:mt-10">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden">
            <div
              className="h-32 sm:h-40 md:h-48 bg-cover bg-center bg-zinc-900"
              style={{
                backgroundImage: profile?.banner_url
                  ? `url(${profile.banner_url})`
                  : "linear-gradient(135deg, #111, #f97316)",
              }}
            />

            <div className="p-5 md:p-8">
              <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 -mt-16 md:-mt-24 rounded-full bg-orange-500 overflow-hidden mb-5 md:mb-6 flex items-center justify-center text-4xl md:text-5xl font-black text-black border-4 border-zinc-950">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  username?.charAt(0)?.toUpperCase() || "D"
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-black mb-2 break-all">
                @{username || "builder"}
              </h1>

              <p className="text-gray-400 mb-5 text-sm md:text-base break-all">
                {user.email}
              </p>

              <p className="text-gray-300 mb-6 text-sm md:text-base leading-7 break-words">
                {bio || "No bio added yet."}
              </p>

              <div className="space-y-3 text-xs md:text-sm uppercase text-gray-400 break-all">
                {instagram && <div>Instagram: @{instagram}</div>}
                {tiktok && <div>TikTok: @{tiktok}</div>}
                {youtube && <div>YouTube: {youtube}</div>}
              </div>

              <a
                href={`/garage/${username}`}
                className="mt-8 block text-center bg-orange-500 text-black py-4 rounded-2xl uppercase font-black hover:bg-white transition text-sm md:text-base"
              >
                View My Garage
              </a>

              <button
                onClick={logout}
                className="mt-4 w-full border border-white/20 py-4 rounded-2xl uppercase font-black hover:bg-white hover:text-black transition text-sm md:text-base"
              >
                Logout
              </button>
            </div>
          </div>

          <form
            onSubmit={saveProfile}
            className="lg:col-span-2 bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8 space-y-5 md:space-y-6"
          >
            <div>
              <h2 className="text-4xl md:text-5xl font-black mb-2 leading-none">
                EDIT PROFILE
              </h2>

              <p className="text-gray-400 text-sm md:text-base">
                This profile powers your garage, comments, ratings, favorites, and socials.
              </p>
            </div>

            <UploadField
              title="Profile Picture"
              onChange={(e) => setAvatarFile(e.target.files[0])}
            />

            <UploadField
              title="Garage Banner"
              onChange={(e) => setBannerFile(e.target.files[0])}
            />

            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <textarea
              placeholder="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="field h-32 resize-none"
            />

            <Input
              placeholder="Instagram username"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />

            <Input
              placeholder="TikTok username"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
            />

            <Input
              placeholder="YouTube channel link"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-orange-500 text-black px-8 md:px-10 py-5 rounded-2xl uppercase font-black hover:bg-white transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      </section>

      <style jsx>{`
        .field {
          width: 100%;
          background: #050505;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 1rem 1.25rem;
          outline: none;
          color: white;
        }

        @media (min-width: 768px) {
          .field {
            padding: 1.25rem 1.5rem;
          }
        }

        .field:focus {
          border-color: #f97316;
        }
      `}</style>
    </main>
  );
}

function Input(props) {
  return <input type="text" className="field" {...props} />;
}

function UploadField({ title, onChange }) {
  return (
    <label className="block">
      <p className="text-gray-500 uppercase text-xs md:text-sm mb-2">
        {title}
      </p>

      <div className="bg-black border border-white/10 rounded-2xl p-5">
        <input
          type="file"
          accept="image/*"
          onChange={onChange}
          className="w-full text-sm text-gray-400"
        />
      </div>
    </label>
  );
}