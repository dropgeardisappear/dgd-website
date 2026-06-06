"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function BuildPage() {
  const { id } = useParams();

  const [build, setBuild] = useState(null);
  const [similarBuilds, setSimilarBuilds] = useState([]);
  const [comments, setComments] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [activeMedia, setActiveMedia] = useState(null);
  const [myRating, setMyRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (id) loadBuildPage();
  }, [id]);

  async function loadBuildPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user || null);
    

    if (user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData || null);
    }
    if (user) {
  const { data: existingLike } = await supabase
    .from("likes")
    .select("*")
    .eq("post_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  setLiked(!!existingLike);
}

    const { data: post, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !post) {
      setBuild(null);
      setLoading(false);
      return;
    }

    setBuild(post);
    setActiveMedia(post.video_url || post.image_url || null);

    await supabase
      .from("posts")
      .update({ views: (post.views || 0) + 1 })
      .eq("id", id);

    const { data: commentData } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: false });

    const { data: ratingData } = await supabase
      .from("ratings")
      .select("*")
      .eq("post_id", id);

    const { data: similarData } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "approved")
      .eq("category", post.category)
      .neq("id", id)
      .limit(3);

    setComments(commentData || []);
    setRatings(ratingData || []);
    setSimilarBuilds(similarData || []);

    if (user && ratingData?.length) {
      const mine = ratingData.find((item) => item.user_id === user.id);
      setMyRating(mine?.rating || 0);
      setSelectedRating(mine?.rating || 0);
    }

    setLoading(false);
  }

  const averageRating = useMemo(() => {
    if (!ratings.length) return 0;
    const total = ratings.reduce((sum, item) => sum + Number(item.rating), 0);
    return total / ratings.length;
  }, [ratings]);

  const mediaItems = useMemo(() => {
    if (!build) return [];

    const items = [];

    if (build.video_url) {
      items.push({ type: "video", url: build.video_url, label: "Video" });
    }

    if (build.image_url) {
      items.push({ type: "image", url: build.image_url, label: "Main" });
    }

    const photos = build.gallery_images || build.gallery || [];

    if (Array.isArray(photos)) {
      photos.forEach((url, index) => {
        if (url && !items.some((item) => item.url === url)) {
          items.push({
            type: isVideo(url) ? "video" : "image",
            url,
            label: `Photo ${index + 1}`,
          });
        }
      });
    }

    return items;
  }, [build]);

  function isVideo(url) {
    return /\.(mp4|mov|webm|m4v)$/i.test(url || "");
  }

  function garageUsername() {
    return (build?.owner || "")
      .replace("@", "")
      .replace(/\s+/g, "")
      .toLowerCase()
      .trim();
  }

async function handleLike() {
if (!user) {
  alert("Sign in to like this build.");
  return;
}
  const { data: existingLike } = await supabase
    .from("likes")
    .select("*")
    .eq("post_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingLike) {
    await supabase
      .from("likes")
      .delete()
      .eq("post_id", id)
      .eq("user_id", user.id);
  } else {
    await supabase.from("likes").insert({
      post_id: id,
      user_id: user.id,
    });
  }

  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", id);

  await supabase
    .from("posts")
    .update({ likes: count || 0 })
    .eq("id", id);
    
setLiked(!existingLike);
  setBuild({ ...build, likes: count || 0 });
}

  async function handleRating() {
    if (!user) {
      alert("Sign in to rate this build.");
      return;
    }

    if (!selectedRating) {
      alert("Select a rating first.");
      return;
    }

    const { error } = await supabase.from("ratings").upsert(
      {
        post_id: id,
        user_id: user.id,
        rating: selectedRating,
      },
      {
        onConflict: "post_id,user_id",
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setMyRating(selectedRating);
    loadBuildPage();
  }

  async function handleComment(e) {
    e.preventDefault();

    if (!user) {
      alert("Sign in to comment.");
      return;
    }

    if (!commentText.trim()) return;

    const { error } = await supabase.from("comments").insert({
      post_id: id,
      user_id: user.id,
      author: profile?.username ? `@${profile.username}` : user.email,
      author_email: user.email,
      content: commentText.trim(),
    });

    if (!error) {
      setCommentText("");
      loadBuildPage();
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    alert("Build link copied.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">Loading build...</p>
      </main>
    );
  }

  if (!build) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-black">Build not found</h1>
        <Link href="/" className="text-red-500 underline">
          Go back home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-24 md:pb-10">
      <section className="relative border-b border-zinc-900">
        <div className="absolute inset-0 opacity-25">
          {activeMedia && isVideo(activeMedia) ? (
            <video
              src={activeMedia}
              autoPlay
              muted
              loop
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={activeMedia || build.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/80 to-black" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-5 py-8 md:py-10">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Back to builds
          </Link>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 md:gap-8 mt-8 items-center">
            <div className="rounded-3xl overflow-hidden border border-zinc-800 bg-black shadow-2xl">
              {activeMedia && isVideo(activeMedia) ? (
                <video
                  src={activeMedia}
                  controls
                  className="w-full max-h-[620px] object-contain bg-black"
                />
              ) : (
                <img
                  src={activeMedia || build.image_url}
                  alt={build.title}
                  className="w-full max-h-[620px] object-cover"
                />
              )}
            </div>

            <div className="bg-black/70 backdrop-blur border border-zinc-800 rounded-3xl p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                <span className="bg-red-600 text-white text-xs font-black uppercase px-3 py-1 rounded-full">
                  {build.category || "Build"}
                </span>
                <span className="bg-zinc-900 text-zinc-300 text-xs font-bold uppercase px-3 py-1 rounded-full">
                  DGD Garage
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black mt-4 leading-none">
                {build.title}
              </h1>

              <p className="text-zinc-300 mt-3 text-lg">
                by{" "}
                <span className="text-white font-bold">
                  {build.owner || "@unknown"}
                </span>
              </p>

              <p className="text-zinc-400 mt-3">
                {build.vehicle || "Vehicle details not added yet."}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <Link
                  href={`/garage/${garageUsername()}`}
                  className="bg-red-600 hover:bg-red-700 px-5 py-3 rounded-2xl font-black text-center transition"
                >
                  View Garage
                </Link>

                <button
                  onClick={handleShare}
                  className="border border-zinc-700 hover:border-white px-5 py-3 rounded-2xl font-black transition"
                >
                  Share Build
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-6">
                <Stat label="Rating" value={averageRating ? averageRating.toFixed(1) : "0.0"} />
                <Stat label="Views" value={build.views || 0} />
                <Stat label="Likes" value={build.likes || 0} />
                <Stat label="Comments" value={comments.length} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hidden md:block sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-5 py-3 flex gap-3">
          <ActionButton onClick={() => document.getElementById("specs")?.scrollIntoView({ behavior: "smooth" })}>
            Specs
          </ActionButton>
          <ActionButton onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}>
            Gallery
          </ActionButton>
          <ActionButton onClick={() => document.getElementById("rating")?.scrollIntoView({ behavior: "smooth" })}>
            Rate
          </ActionButton>
          <ActionButton onClick={() => document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" })}>
            Comment
          </ActionButton>
     <ActionButton onClick={handleLike}>
  {liked ? "🔥 Build Liked" : "🔥 Like This Build"}
</ActionButton>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-5 py-10 space-y-10">
        <section id="specs">
          <SectionTitle eyebrow="Build Details" title="Specs" />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <SpecCard title="Engine" text={build.engine || "Not added yet"} />
            <SpecCard title="Suspension" text={build.suspension || "Not added yet"} />
            <SpecCard title="Wheels" text={build.wheels || "Not added yet"} />
            <SpecCard title="Tires" text={build.tires || "Not added yet"} />
            <SpecCard title="Interior" text={build.interior || "Not added yet"} />
            <SpecCard title="Exterior" text={build.exterior || "Not added yet"} />
          </div>
        </section>

        <section id="gallery">
          <SectionTitle eyebrow="Media" title="Gallery / Videos" />

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
            <div className="rounded-2xl overflow-hidden bg-black border border-zinc-800">
              {activeMedia && isVideo(activeMedia) ? (
                <video
                  src={activeMedia}
                  controls
                  className="w-full max-h-[700px] object-contain bg-black"
                />
              ) : (
                <img
                  src={activeMedia || build.image_url}
                  alt={build.title}
                  className="w-full max-h-[700px] object-cover"
                />
              )}
            </div>

            {mediaItems.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mt-4">
                {mediaItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={() => setActiveMedia(item.url)}
                    className={`h-20 md:h-24 rounded-xl overflow-hidden border bg-black ${
                      activeMedia === item.url ? "border-red-500" : "border-zinc-800"
                    }`}
                  >
                    {item.type === "video" || isVideo(item.url) ? (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-300">
                        ▶
                      </div>
                    ) : (
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Story" title="About This Build" />

          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 md:p-6">
            <p className="text-zinc-300 leading-relaxed">
              {build.description || "No story added yet."}
            </p>

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <StoryCard title="Why they built it" text={build.why_built || "Not added yet"} />
              <StoryCard title="Favorite mod" text={build.favorite_mod || "Not added yet"} />
              <StoryCard title="Future plans" text={build.future_plans || "Not added yet"} />
            </div>
          </div>
        </section>

        <section id="rating" className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 md:p-6">
          <SectionTitle eyebrow="Community" title="Rating" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mt-5">
            <div>
              <div className="text-4xl text-yellow-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star}>{star <= Math.round(averageRating) ? "★" : "☆"}</span>
                ))}
              </div>

              <p className="text-zinc-300 mt-2">
                {averageRating ? averageRating.toFixed(1) : "0.0"} / 5 · {ratings.length} ratings
              </p>
            </div>

            <div>
              <p className="text-sm text-zinc-500 mb-2">
                {user ? "Select stars, then submit." : "Sign in to rate this build."}
              </p>

              <div className="flex gap-2 text-4xl mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    className={star <= selectedRating ? "text-yellow-400" : "text-zinc-700"}
                  >
                    ★
                  </button>
                ))}
              </div>

              <button
                onClick={handleRating}
                disabled={!selectedRating}
                className="w-full bg-white text-black font-black rounded-2xl px-6 py-3 disabled:opacity-40"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </section>

        <section id="comments" className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 md:p-6">
          <SectionTitle eyebrow="Community" title="Comments" />

          <form onSubmit={handleComment} className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? "Drop a comment..." : "Sign in to comment..."}
              className="flex-1 bg-black border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-red-500"
            />
            <button className="bg-white text-black font-black rounded-2xl px-5 py-3">
              Post
            </button>
          </form>

          <div className="mt-6 space-y-4">
            {comments.length === 0 && (
              <p className="text-zinc-500">No comments yet. Be the first.</p>
            )}

            {comments.map((comment) => (
              <div key={comment.id} className="bg-black border border-zinc-800 rounded-2xl p-4">
                <div className="flex justify-between gap-3 flex-wrap">
                  <p className="text-red-500 font-black">
                    {comment.author || "@user"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-zinc-300 mt-2">{comment.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="More Builds" title={`More ${build.category || "Similar"} Builds`} />

          {similarBuilds.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 text-zinc-500">
              No similar builds yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {similarBuilds.map((item) => (
                <Link
                  href={`/build/${item.id}`}
                  key={item.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden hover:border-red-500 transition"
                >
                  <img src={item.image_url} alt={item.title} className="w-full h-52 object-cover" />
                  <div className="p-5">
                    <p className="text-xs text-red-500 font-black uppercase">
                      {item.category}
                    </p>
                    <h3 className="text-xl font-black mt-1">{item.title}</h3>
                    <p className="text-zinc-500 text-sm mt-1">{item.vehicle}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-t border-zinc-800 px-3 py-3">
        <div className="grid grid-cols-4 gap-2">
          <MobileAction onClick={() => document.getElementById("specs")?.scrollIntoView({ behavior: "smooth" })}>
            Specs
          </MobileAction>
          <MobileAction onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}>
            Gallery
          </MobileAction>
          <MobileAction onClick={() => document.getElementById("rating")?.scrollIntoView({ behavior: "smooth" })}>
            Rate
          </MobileAction>
          <MobileAction onClick={() => document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" })}>
            Comment
          </MobileAction>
        </div>
      </section>
    </main>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div className="mb-5">
      <p className="text-red-500 uppercase text-xs font-black tracking-[0.25em]">
        {eyebrow}
      </p>
      <h2 className="text-3xl md:text-4xl font-black mt-2">{title}</h2>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-center">
      <p className="text-xl font-black">{value}</p>
      <p className="text-[11px] text-zinc-500 uppercase">{label}</p>
    </div>
  );
}

function ActionButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-full px-5 py-3 font-bold transition"
    >
      {children}
    </button>
  );
}

function MobileAction({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl py-3 text-xs font-black"
    >
      {children}
    </button>
  );
}

function StoryCard({ title, text }) {
  return (
    <div className="bg-black border border-zinc-800 rounded-2xl p-4">
      <h3 className="font-black">{title}</h3>
      <p className="text-zinc-500 text-sm mt-2">{text}</p>
    </div>
  );
}

function SpecCard({ title, text }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="text-zinc-400 mt-3 leading-relaxed">{text}</p>
    </div>
  );
}