"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [posts, setPosts] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load pending posts:", error);
      alert(`Could not load pending builds: ${error.message}`);
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    setPosts(data || []);
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      setCheckingAccess(true);
      setAccessError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        window.location.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setAccessError(`Could not verify admin access: ${profileError.message}`);
        setCheckingAccess(false);
        return;
      }

      if (!profile) {
        setAccessError("Your account does not have a matching profile row.");
        setCheckingAccess(false);
        return;
      }

      if (profile.is_admin !== true) {
        setAccessError(`Admin access only. Signed in as ${user.email || "unknown account"}.`);
        setCheckingAccess(false);
        return;
      }

      setIsAdmin(true);
      setCheckingAccess(false);
      await loadPosts();
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [loadPosts]);

  async function readResponse(response) {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server returned an invalid response. Status: ${response.status}`);
    }
  }

  async function approvePost(post) {
    if (approvingId || rejectingId) return;
    setApprovingId(post.id);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your login session is invalid or expired.");
      }

      const response = await fetch("/api/admin/approve-build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "The build could not be approved.");
      }

      setPosts((items) => items.filter((item) => item.id !== post.id));

      alert(
        data.smsSent
          ? "Build approved and SMS accepted."
          : data.smsReason
            ? `Build approved. SMS was not sent: ${data.smsReason}`
            : "Build approved successfully."
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "The build could not be approved.");
    } finally {
      setApprovingId(null);
    }
  }

  async function rejectPost(post) {
    if (approvingId || rejectingId) return;

    const confirmed = window.confirm(
      `Reject and permanently delete "${post.title || "this build"}"?`
    );

    if (!confirmed) return;
    setRejectingId(post.id);

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      setPosts((items) => items.filter((item) => item.id !== post.id));
      alert("Build rejected and deleted.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "The build could not be rejected.");
    } finally {
      setRejectingId(null);
    }
  }

  if (checkingAccess) {
    return <PageMessage title="Checking admin access..." text="Verifying your account with Supabase." />;
  }

  if (accessError) {
    return (
      <main className="min-h-screen bg-black text-white px-6 flex items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-red-500/30 bg-zinc-950 p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-red-400">Access Error</p>
          <h1 className="mt-3 text-3xl font-black">Admin verification failed</h1>
          <p className="mt-4 text-zinc-400">{accessError}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-orange-500 px-6 py-3 font-black text-black hover:bg-white"
            >
              Try Again
            </button>
            <a
              href="/"
              className="rounded-xl border border-white/20 px-6 py-3 text-center font-black hover:bg-white hover:text-black"
            >
              Go Home
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return <PageMessage title="Admin access required" text="Your account could not be verified." />;
  }

  if (loadingPosts) {
    return <PageMessage title="Loading pending builds..." text="Pulling submissions from the queue." />;
  }

  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white md:px-6 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <a href="/" className="text-sm text-zinc-500 hover:text-white">← Back Home</a>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.35em] text-orange-500">DGD Moderation</p>
            <h1 className="mt-3 text-5xl font-black md:text-7xl">ADMIN APPROVAL</h1>
            <p className="mt-4 text-zinc-400">
              Pending builds: <span className="font-bold text-white">{posts.length}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={loadPosts}
            disabled={loadingPosts || Boolean(approvingId) || Boolean(rejectingId)}
            className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black uppercase hover:bg-white hover:text-black disabled:opacity-50"
          >
            Refresh Queue
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-zinc-950 p-10">
            <h2 className="text-2xl font-black">No pending builds</h2>
            <p className="mt-3 text-zinc-500">New submissions will appear here.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {posts.map((post) => {
              const actionsDisabled = Boolean(approvingId) || Boolean(rejectingId);

              return (
                <article key={post.id} className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
                  <img
                    src={post.image_url || "/dgd-hero.png"}
                    alt={post.title || "Pending build"}
                    className="h-72 w-full object-cover"
                  />

                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black uppercase text-black">
                        {post.vehicle_type || "Build"}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-orange-500">
                        {post.category || "Uncategorized"}
                      </span>
                    </div>

                    <h2 className="mt-4 text-3xl font-black">{post.title || "Untitled Build"}</h2>
                    <p className="mt-2 text-zinc-400">{post.vehicle || "Vehicle details not provided"}</p>
                    <p className="mt-2 text-sm text-zinc-500">Submitted by {post.owner || "@unknown"}</p>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-black p-4">
                      <p className="whitespace-pre-wrap text-zinc-300">
                        {post.description || "No description provided."}
                      </p>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => approvePost(post)}
                        disabled={actionsDisabled}
                        className="rounded-xl bg-orange-500 py-4 font-black uppercase text-black hover:bg-white disabled:opacity-50"
                      >
                        {approvingId === post.id ? "Approving..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectPost(post)}
                        disabled={actionsDisabled}
                        className="rounded-xl border border-red-500 py-4 font-black uppercase text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        {rejectingId === post.id ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function PageMessage({ title, text }) {
  return (
    <main className="min-h-screen bg-black px-6 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-3 text-zinc-500">{text}</p>
      </div>
    </main>
  );
}