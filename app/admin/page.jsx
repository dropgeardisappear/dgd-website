"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

}

  async function loadPosts() {
const { data, error } = await supabase
  .from("posts")
  .select("*")
  .eq("status", "pending");

    if (error) {
      console.log(error);
    } else {
      setPosts(data || []);
    }
  }

  async function approvePost(id) {
    const { error } = await supabase
      .from("posts")
      .update({ status: "approved" })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error approving post");
    } else {
      alert("Post approved");
      loadPosts();
    }
  }

  async function rejectPost(id) {
    const reason = prompt("Why are you rejecting this post?");

    const { error } = await supabase
      .from("posts")
      .update({
        status: "rejected",
        rejection_reason: reason || "No reason provided",
      })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error rejecting post");
    } else {
      alert("Post rejected");
      loadPosts();
    }
  }

  async function deletePost(id) {
    const confirmDelete = confirm("Are you sure you want to delete this post?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error deleting post");
    } else {
      alert("Post deleted");
      loadPosts();
    }
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

    setUser(session.user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();

    if (!profile?.is_admin) {
      alert("Admin access only.");
      window.location.href = "/";
      return;
    }

    setIsAdmin(true);
    loadPendingPosts();
  }

  checkAdmin();
}, []);

if (!isAdmin) {
  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center">
      Checking admin access...
    </div>
  );
}

  if (loading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen p-10">
      <h1 className="text-5xl font-black mb-10">ADMIN APPROVAL</h1>
      <p className="text-gray-500 mb-6">
  Pending posts found: {posts.length}
</p>

      <div className="space-y-6">
        {posts.map((post) => (
          <div
            key={post.id}
            className="border border-white/10 rounded-2xl p-6 bg-zinc-950"
          >
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full h-64 object-cover rounded-2xl mb-4"
            />

            <h2 className="text-2xl font-black mb-2">{post.title}</h2>

            <p className="text-gray-400">{post.owner}</p>
            <p className="text-gray-400">{post.vehicle}</p>
            <p className="text-gray-400">{post.category}</p>

            <p className="text-gray-400 mt-4">Engine: {post.engine}</p>
            <p className="text-gray-400">Suspension: {post.suspension}</p>
            <p className="text-gray-400">Wheels: {post.wheels}</p>
            <p className="text-gray-400">Description: {post.description}</p>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => approvePost(post.id)}
                className="bg-white text-black px-6 py-3 rounded-xl font-black"
              >
                Approve
              </button>

              <button
                onClick={() => rejectPost(post.id)}
                className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-black"
              >
                Reject
              </button>

              <button
                onClick={() => deletePost(post.id)}
                className="bg-red-600 text-white px-6 py-3 rounded-xl uppercase font-black"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}