"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function GaragePage() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);

  async function loadGarage() {
const { data, error } = await supabase
  .from("profiles")
  .select("*")
  .eq("username", username);

const profileData = data?.[0];
const profileError = error;

 if (profileError || !profileData) {
  console.log(profileError);
  setProfile("not-found");
  return;
}

    setProfile(profileData);

    const { data: postData } = await supabase
      .from("posts")
      .select("*")
      .or(`user_id.eq.${profileData.id},owner.eq.${profileData.username}`)
      .order("created_at", { ascending: false });

    setPosts(postData || []);

    const total = (postData || []).reduce(
      (sum, post) => sum + (post.likes || 0),
      0
    );

    setTotalLikes(total);

    const { data: favoriteData } = await supabase
      .from("favorites")
      .select("post_id");

    setFavorites(favoriteData || []);

    const { count: followerCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profileData.id);

    const { count: followingCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileData.id);

    setFollowers(followerCount || 0);
    setFollowing(followingCount || 0);
  }

  useEffect(() => {
    if (username) {
      loadGarage();
    }
  }, [username]);

if (profile === "not-found") {
  return (
    <main className="bg-black text-white min-h-screen flex items-center justify-center px-4">
      Garage not found. Check the username.
    </main>
  );
}

if (!profile) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        Loading garage...
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen overflow-x-hidden">
      <section className="relative h-[280px] md:h-[420px] overflow-hidden">
        <img
          src={
            profile.banner_url ||
            "https://images.unsplash.com/photo-1503376780353-7e6692767b70"
          }
          alt="Garage banner"
          className="w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-black/60" />

        <div className="absolute bottom-0 left-0 w-full p-5 md:p-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end gap-6">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-orange-500 bg-zinc-900">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl font-black">
                  {profile.username?.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1">
              <p className="uppercase tracking-[0.25em] text-orange-500 text-xs md:text-sm mb-3">
                DGD GARAGE
              </p>

              <h1 className="text-4xl md:text-7xl font-black leading-none mb-3">
                @{profile.username}
              </h1>

              <p className="text-gray-300 max-w-2xl text-sm md:text-base">
                {profile.bio || "No bio added yet."}
              </p>

              <div className="flex flex-wrap gap-3 mt-5">
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram}`}
                    target="_blank"
                    className="border border-white/20 px-4 py-2 rounded-xl text-sm hover:bg-white hover:text-black transition"
                  >
                    Instagram
                  </a>
                )}

                {profile.tiktok && (
                  <a
                    href={`https://tiktok.com/@${profile.tiktok}`}
                    target="_blank"
                    className="border border-white/20 px-4 py-2 rounded-xl text-sm hover:bg-white hover:text-black transition"
                  >
                    TikTok
                  </a>
                )}

               {profile.youtube && (
  <a
    href={profile.youtube}
    target="_blank"
    className="border border-white/20 px-4 py-2 rounded-xl text-sm hover:bg-white hover:text-black transition"
  >
    YouTube
  </a>
)}

<a
  href="/account"
  className="border border-orange-500 text-orange-500 px-4 py-2 rounded-xl text-sm hover:bg-orange-500 hover:text-black transition"
>
  Edit Profile
</a>

</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Builds" value={posts.length} />
          <Stat label="Likes" value={totalLikes} />
          <Stat label="Followers" value={followers} />
          <Stat label="Following" value={following} />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="uppercase tracking-[0.25em] text-orange-500 text-xs md:text-sm mb-2">
              User Builds
            </p>

            <h2 className="text-3xl md:text-5xl font-black">
              GARAGE BUILDS
            </h2>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-10 text-center text-gray-400">
            No builds uploaded yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
            {posts.map((post) => (
              <a
                key={post.id}
                href={`/build/${post.id}`}
                className="group bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden hover:border-orange-500/50 transition"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full h-64 object-cover group-hover:scale-105 transition duration-500"
                  />

                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-3 py-1 rounded-full text-xs uppercase tracking-widest">
                    {post.category}
                  </div>
                </div>

                <div className="p-5 md:p-6">
                  <h3 className="text-2xl font-black mb-2">
                    {post.title}
                  </h3>

                  <p className="text-gray-400 text-sm mb-5">
                    {post.vehicle}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-4 text-gray-400">
                      <span>❤️ {post.likes || 0}</span>
                      <span>👀 {post.views || 0}</span>
                    </div>

                    <div className="text-orange-500 font-bold">
                      ★ {Number(post.average_rating || 0).toFixed(1)}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-7">
      <p className="text-gray-500 uppercase text-xs md:text-sm mb-3">
        {label}
      </p>

      <h3 className="text-3xl md:text-5xl font-black">
        {value}
      </h3>
    </div>
  );
}