"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function BuildPage() {
  const { id } = useParams();

  const [post, setPost] = useState(null);
  const [user, setUser] = useState(null);
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [likes, setLikes] = useState(0);
  const [views, setViews] = useState(0);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  async function loadComments() {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: false });

    if (!error) setComments(data || []);
  }

  async function loadRatings(currentUser) {
    const { data } = await supabase.from("ratings").select("*").eq("post_id", id);
    const ratings = data || [];
    const total = ratings.reduce((sum, item) => sum + item.rating, 0);
    const avg = ratings.length ? total / ratings.length : 0;

    setAverageRating(avg);
    setRatingCount(ratings.length);

    if (currentUser) {
      const existing = ratings.find((item) => item.user_id === currentUser.id);
      setUserRating(existing?.rating || null);
    }
  }

  async function submitRating(ratingValue) {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!ratingValue) {
      alert("Please select a rating first.");
      return;
    }

    const { error } = await supabase.from("ratings").insert([
      { post_id: id, user_id: user.id, rating: ratingValue },
    ]);

if (error) {
  console.log(error);
  alert(error.message);
  return;
}
    const { data: allRatings } = await supabase
      .from("ratings")
      .select("*")
      .eq("post_id", id);

    const total = allRatings.reduce((sum, item) => sum + item.rating, 0);
    const avg = total / allRatings.length;

    await supabase
      .from("posts")
      .update({ average_rating: avg, rating_count: allRatings.length })
      .eq("id", id);

    setUserRating(ratingValue);
    setAverageRating(avg);
    setRatingCount(allRatings.length);
  }

  async function submitComment(e) {
    e.preventDefault();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!content.trim()) return;

    const { error } = await supabase.from("comments").insert([
      {
        post_id: id,
        user_id: user.id,
        author: user.email,
        author_email: user.email,
        content,
        parent_id: null,
      },
    ]);

    if (error) {
      alert("Error posting comment");
      return;
    }

    if (post.user_id && post.user_id !== user.id) {
      await supabase.from("notifications").insert([
        {
          user_id: post.user_id,
          post_id: id,
          type: "comment",
          message: `${user.email} commented on your build: ${post.title}`,
          is_read: false,
        },
      ]);
    }

    setContent("");
    loadComments();
  }

  async function submitReply(commentId) {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!replyContent.trim()) return;

    const { error } = await supabase.from("comments").insert([
      {
        post_id: id,
        user_id: user.id,
        author: user.email,
        author_email: user.email,
        content: replyContent,
        parent_id: commentId,
      },
    ]);

    if (error) {
      alert("Error posting reply");
      return;
    }

    setReplyTo(null);
    setReplyContent("");
    loadComments();
  }

  async function handleLike() {
    const likedKey = `liked-${id}`;
    const newLikes = liked ? likes - 1 : likes + 1;

    setLikes(newLikes);
    setLiked(!liked);

    if (liked) localStorage.removeItem(likedKey);
    else localStorage.setItem(likedKey, "true");

    await supabase.from("posts").update({ likes: newLikes }).eq("id", id);
  }

  async function toggleFavorite() {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (favorited) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("post_id", id);
      setFavorited(false);
    } else {
      await supabase.from("favorites").insert([{ user_id: user.id, post_id: id }]);
      setFavorited(true);
    }
  }

  async function submitReport(e) {
    e.preventDefault();

    if (!reportReason) {
      alert("Please choose a reason");
      return;
    }

    const { error } = await supabase.from("reports").insert([
      {
        post_id: id,
        user_id: user?.id || null,
        reason: reportReason,
        details: reportDetails,
        status: "pending",
      },
    ]);

    if (error) {
      alert("Error submitting report");
      return;
    }

    alert("Report submitted. Thank you.");
    setReportReason("");
    setReportDetails("");
  }

  function formatDate(date) {
    if (!date) return "";
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user || null;
      setUser(currentUser);
      loadRatings(currentUser);

      if (currentUser) {
        const { data: fav } = await supabase
          .from("favorites")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("post_id", id)
          .maybeSingle();

        setFavorited(!!fav);
      }
    }

    async function loadPost() {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();

      if (!error && data) {
        setPost(data);
        setLikes(data.likes || 0);
        setViews((data.views || 0) + 1);
        setAverageRating(data.average_rating || 0);
        setRatingCount(data.rating_count || 0);
        setLiked(localStorage.getItem(`liked-${id}`) === "true");

        await supabase.from("posts").update({ views: (data.views || 0) + 1 }).eq("id", id);
      }
    }

    if (id) {
      checkUser();
      loadPost();
      loadComments();
    }
  }, [id]);

  if (!post) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        Loading build...
      </div>
    );
  }

  const galleryImages =
    post.gallery_images && post.gallery_images.length > 0
      ? post.gallery_images
      : [post.image_url];

  const mainComments = comments.filter((comment) => !comment.parent_id);

  return (
    <main className="bg-black text-white min-h-screen overflow-x-hidden">
      <section
        className="relative min-h-[65vh] md:min-h-[75vh] bg-cover bg-center flex items-end"
        style={{ backgroundImage: `url(${post.image_url})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-10 md:pb-16 w-full">
          <a href="/" className="inline-block mb-6 border border-white/20 px-4 py-2 rounded-xl text-xs uppercase hover:bg-white hover:text-black transition">
            ← Back Home
          </a>

          <p className="uppercase tracking-[0.25em] text-orange-500 font-bold mb-4 text-xs md:text-sm">
            Featured Build
          </p>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-4 leading-none">
            {post.title}
          </h1>

          <p className="text-base md:text-xl text-gray-300">
            {post.vehicle} • {post.category}
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16 grid lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <Card title="Build Story">
            <p className="text-gray-300 leading-7 md:leading-8 text-sm md:text-base">
              {post.description || "No build description added yet."}
            </p>
          </Card>

          <Card title="Gallery">
            <div className="grid sm:grid-cols-2 gap-4">
              {galleryImages.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`${post.title} photo ${index + 1}`}
                  onClick={() => setSelectedImage(image)}
                  className="w-full h-56 sm:h-64 md:h-72 object-cover rounded-2xl border border-white/10 cursor-pointer hover:scale-[1.02] transition"
                />
              ))}
            </div>
          </Card>

          <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
            <SpecCard label="Engine" value={post.engine} />
            <SpecCard label="Suspension" value={post.suspension} />
            <SpecCard label="Wheels" value={post.wheels} />
          </div>
        </div>

        <aside className="space-y-6 md:space-y-8">
          <Panel>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-orange-500 flex items-center justify-center text-xl md:text-2xl font-black text-black">
                {post.owner?.charAt(0)}
              </div>

              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-black truncate">{post.owner}</h2>
                <p className="text-gray-500 text-xs md:text-sm uppercase">Garage Owner</p>
              </div>
            </div>

           <a
  href={`/garage/${post.owner?.replace("@", "")}`}
  className="block text-center bg-orange-500 text-black font-black uppercase py-4 rounded-2xl hover:bg-white transition text-sm md:text-base"
>
  View Garage
</a>
{user?.id === post.user_id && (
  <div className="mt-4 space-y-3">
    <a
      href={`/build/${post.id}/edit`}
      className="block text-center border border-white/20 text-white font-black uppercase py-4 rounded-2xl hover:bg-white hover:text-black transition text-sm md:text-base"
    >
      Edit Build
    </a>

    <button
      onClick={async () => {
        const confirmDelete = confirm("Delete this build? This cannot be undone.");
        if (!confirmDelete) return;

        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", post.id)
          .eq("user_id", user.id);

        if (error) {
          alert(error.message);
          return;
        }

        alert("Build deleted.");
        window.location.href = "/";
      }}
      className="w-full border border-red-500 text-red-400 font-black uppercase py-4 rounded-2xl hover:bg-red-500 hover:text-white transition text-sm md:text-base"
    >
      Delete Build
    </button>
  </div>
)}
          </Panel>

          <Panel>
            <h2 className="text-2xl md:text-3xl font-black mb-6">Build Stats</h2>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
              <Stat label="Views" value={views} />
              <Stat label="Likes" value={likes} />
            </div>

            <button onClick={handleLike} className="w-full bg-orange-500 text-black font-black uppercase py-4 rounded-2xl hover:bg-white transition text-sm md:text-base">
              {liked ? "💔 Remove Like" : "❤️ Like This Build"}
            </button>

            <button onClick={toggleFavorite} className="mt-4 w-full border border-white/20 text-white font-black uppercase py-4 rounded-2xl hover:bg-white hover:text-black transition text-sm md:text-base">
              {favorited ? "★ Favorited" : "☆ Add Favorite"}
            </button>
          </Panel>

          <Panel>
            <h2 className="text-2xl md:text-3xl font-black mb-5">Rate This Build</h2>

            <p className="text-5xl font-black text-orange-500">
              {Number(averageRating).toFixed(1)}
            </p>

            <p className="text-gray-500 uppercase text-sm mb-5">
              {ratingCount} ratings
            </p>

            <div className="flex gap-2 text-3xl md:text-4xl mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  disabled={!!userRating}
                  className={`transition ${
                    star <= (selectedRating || userRating || 0)
                      ? "text-orange-500"
                      : "text-gray-600 hover:text-orange-500"
                  } ${userRating ? "cursor-not-allowed" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>

            {userRating ? (
              <p className="text-orange-500 text-sm">You rated this build {userRating}/5.</p>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-4">
                  Select 1–5 stars, then submit your rating.
                </p>

                <button
                  onClick={() => submitRating(selectedRating)}
                  disabled={!selectedRating}
                  className="w-full bg-orange-500 text-black font-black uppercase py-4 rounded-2xl hover:bg-white transition disabled:opacity-40"
                >
                  Submit Rating
                </button>
              </>
            )}
          </Panel>
        </aside>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-10 md:pb-12">
        <Card title="Comments">
          {!user ? (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 md:p-6 mb-8">
              <h3 className="text-xl md:text-2xl font-black text-orange-400 mb-2">
                Want to comment?
              </h3>

              <p className="text-gray-300 mb-5 text-sm md:text-base">
                You need an account to post comments or reply to builds.
              </p>

              <a href="/login" className="inline-block bg-orange-500 text-black px-6 md:px-8 py-4 rounded-xl uppercase font-black hover:bg-white transition text-sm md:text-base">
                Login / Create Account
              </a>
            </div>
          ) : (
            <form onSubmit={submitComment} className="space-y-4 mb-8">
              <textarea
                placeholder="Leave a comment..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-28 md:h-32 bg-black border border-white/10 rounded-2xl px-5 md:px-6 py-4 resize-none outline-none focus:border-orange-500"
              />

              <button type="submit" className="w-full sm:w-auto bg-orange-500 text-black px-8 py-4 rounded-xl uppercase font-black hover:bg-white transition">
                Post Comment
              </button>
            </form>
          )}

          <div className="space-y-4">
            {mainComments.length === 0 && (
              <p className="text-gray-500">No comments yet. Be the first.</p>
            )}

            {mainComments.map((comment) => {
              const replies = comments.filter((reply) => reply.parent_id === comment.id);

              return (
                <div key={comment.id} className="bg-black border border-white/10 rounded-2xl p-5 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 mb-2">
                    <div className="font-bold text-orange-500 break-all">{comment.author}</div>
                    <div className="text-gray-500 text-sm">{formatDate(comment.created_at)}</div>
                  </div>

                  <p className="text-gray-300 mb-4 text-sm md:text-base break-words">
                    {comment.content}
                  </p>

                  {user && (
                    <button onClick={() => setReplyTo(comment.id)} className="text-sm uppercase text-orange-500 hover:text-white">
                      Reply
                    </button>
                  )}

                  {replyTo === comment.id && (
                    <div className="mt-4 space-y-3">
                      <textarea
                        placeholder="Write a reply..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        className="w-full h-24 bg-zinc-950 border border-white/10 rounded-2xl px-5 py-4 resize-none"
                      />

                      <button onClick={() => submitReply(comment.id)} className="w-full sm:w-auto bg-orange-500 text-black px-6 py-3 rounded-xl uppercase font-black">
                        Post Reply
                      </button>
                    </div>
                  )}

                  {replies.length > 0 && (
                    <div className="mt-6 pl-4 md:pl-5 border-l border-white/10 space-y-4">
                      {replies.map((reply) => (
                        <div key={reply.id} className="bg-zinc-950 border border-white/10 rounded-2xl p-4 md:p-5">
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 mb-2">
                            <div className="font-bold text-orange-500 break-all">{reply.author}</div>
                            <div className="text-gray-500 text-sm">{formatDate(reply.created_at)}</div>
                          </div>

                          <p className="text-gray-300 break-words">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
        <Card title="Report This Build">
          <form onSubmit={submitReport} className="space-y-4">
            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl px-5 md:px-6 py-4">
              <option value="">Select reason</option>
              <option value="spam">Spam</option>
              <option value="stolen_photos">Stolen photos</option>
              <option value="nsfw">NSFW content</option>
              <option value="wrong_info">Wrong information</option>
              <option value="other">Other</option>
            </select>

            <textarea
              placeholder="Add details..."
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              className="w-full h-28 bg-black border border-white/10 rounded-2xl px-5 md:px-6 py-4 resize-none"
            />

            <button type="submit" className="w-full sm:w-auto border border-red-500 text-red-400 px-8 py-4 rounded-xl uppercase font-black hover:bg-red-500 hover:text-white transition">
              Submit Report
            </button>
          </form>
        </Card>
      </section>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Selected build" className="max-w-full max-h-full rounded-2xl md:rounded-3xl object-contain" />
        </div>
      )}
    </main>
  );
}

function Panel({ children }) {
  return (
    <div className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8">
      {children}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8">
      <h2 className="text-2xl md:text-3xl font-black mb-5 md:mb-6">{title}</h2>
      {children}
    </div>
  );
}

function SpecCard({ label, value }) {
  return (
    <div className="bg-zinc-950 border border-orange-500/30 rounded-3xl p-5 md:p-6">
      <p className="text-orange-500 uppercase text-xs md:text-sm font-bold mb-3">
        {label}
      </p>

      <h3 className="text-xl md:text-2xl font-black break-words">
        {value || "Not added yet"}
      </h3>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-black border border-white/10 rounded-2xl p-4 md:p-5">
      <p className="text-gray-500 uppercase text-xs md:text-sm mb-2">{label}</p>
      <p className="text-2xl md:text-3xl font-black">{value}</p>
    </div>
  );
}