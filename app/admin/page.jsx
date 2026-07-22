"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);

  async function loadPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setPosts(data || []);
    setLoading(false);
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

  async function approvePost(post) {
    if (approvingId) return;

    setApprovingId(post.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          "Your login session is invalid or expired."
        );
      }

      const response = await fetch(
        "/api/admin/approve-build",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            postId: post.id,
          }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || "The build could not be approved."
        );
      }

      setPosts((items) =>
        items.filter((item) => item.id !== post.id)
      );

      if (data.smsSent) {
        alert("Build approved and SMS sent successfully.");
      } else {
        alert(
          `Build approved and notification created. SMS was not sent: ${
            data.smsReason || "SMS is unavailable."
          }`
        );
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The build could not be approved."
      );
    } finally {
      setApprovingId(null);
    }
  }

  async function rejectPost(id) {
    const confirmDelete = confirm(
      "Reject and delete this build?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setPosts((items) =>
      items.filter((item) => item.id !== id)
    );
  }

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();

      if (error || !profile?.is_admin) {
        alert("Admin access only.");
        window.location.href = "/";
        return;
      }

      setIsAdmin(true);
      loadPosts();
    }

    checkAdmin();
  }, []);

  if (!isAdmin) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center">
        Checking admin access...
      </main>
    );
  }

  if (loading) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <a
          href="/"
          className="text-gray-400 hover:text-white"
        >
          ← Back Home
        </a>

        <h1 className="text-5xl md:text-7xl font-black mt-8 mb-6">
          ADMIN APPROVAL
        </h1>

        <p className="text-gray-400 mb-10">
          Pending posts found: {posts.length}
        </p>

        {posts.length === 0 ? (
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-10 text-gray-400">
            No pending builds.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden"
              >
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="w-full h-72 object-cover"
                />

                <div className="p-6">
                  <p className="text-orange-500 uppercase text-sm mb-2">
                    {post.category}
                  </p>

                  <h2 className="text-3xl font-black mb-2">
                    {post.title}
                  </h2>

                  <p className="text-gray-400 mb-2">
                    {post.vehicle}
                  </p>

                  <p className="text-gray-500 mb-6">
                    {post.owner}
                  </p>

                  <p className="text-gray-300 mb-6">
                    {post.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => approvePost(post)}
                      disabled={approvingId === post.id}
                      className="bg-orange-500 text-black font-black uppercase py-4 rounded-xl hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approvingId === post.id
                        ? "Approving..."
                        : "Approve"}
                    </button>

                    <button
                      type="button"
                      onClick={() => rejectPost(post.id)}
                      disabled={Boolean(approvingId)}
                      className="border border-red-500 text-red-400 font-black uppercase py-4 rounded-xl hover:bg-red-500 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}