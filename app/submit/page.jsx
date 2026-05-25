"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

const inputClass =
  "w-full bg-black border border-white/10 rounded-2xl px-5 py-4 md:px-6 md:py-5 text-white outline-none focus:border-orange-500";

export default function SubmitPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [category, setCategory] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [description, setDescription] = useState("");
  const [engine, setEngine] = useState("");
  const [suspension, setSuspension] = useState("");
  const [wheels, setWheels] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setUser(null);
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
        setOwner(`@${data.username}`);
      } else {
        setOwner(session.user.email);
      }
    }

    checkUser();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!title || !owner || !vehicle || !vehicleType || !category || !description) {
      alert("Please fill out all required fields.");
      return;
    }

    if (imageFiles.length === 0) {
      alert("Please choose at least one image.");
      return;
    }

    setIsSubmitting(true);

    const uploadedUrls = [];

    for (const file of imageFiles) {
      const cleanName = file.name.replace(/\s+/g, "-").toLowerCase();
      const fileName = `${user.id}/${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from("build-images")
        .upload(fileName, file);

      if (uploadError) {
        console.log(uploadError);
        alert(uploadError.message);
        setIsSubmitting(false);
        return;
      }

      const { data } = supabase.storage
        .from("build-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    const { error } = await supabase.from("posts").insert([
      {
        user_id: user.id,
        title,
        owner,
        vehicle,
        vehicle_type: vehicleType,
        image_url: uploadedUrls[0],
        gallery_images: uploadedUrls,
        category,
        description,
        engine,
        suspension,
        wheels,
        status: "pending",
        likes: 0,
        views: 0,
        average_rating: 0,
        rating_count: 0,
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Build submitted for review.");
    window.location.href = "/";
  }

  if (!user) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-3xl p-6 md:p-8">
          <h1 className="text-4xl font-black mb-4">LOGIN REQUIRED</h1>
          <p className="text-gray-400 mb-8">
            You need an account before submitting a build.
          </p>

          <a
            href="/login"
            className="block text-center bg-orange-500 text-black px-8 py-4 rounded-xl uppercase font-black hover:bg-white transition"
          >
            Login / Create Account
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen px-4 md:px-6 py-20 md:py-24">
      <div className="max-w-5xl mx-auto">
        <a href="/" className="text-gray-400 hover:text-white text-sm">
          ← Back Home
        </a>

        <header className="mt-8 mb-8 md:mb-10">
          <p className="uppercase tracking-[0.3em] text-orange-500 text-xs md:text-sm mb-3">
            DGD Submission
          </p>

          <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
            SUBMIT BUILD
          </h1>

          <p className="text-gray-400">
            Logged in as{" "}
            <span className="text-orange-500">
              {profile?.username ? `@${profile.username}` : user.email}
            </span>
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8 space-y-8"
        >
          <FormSection title="Build Basics">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                className={inputClass}
                placeholder="Build Name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="@Username"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>

            <input
              className={inputClass}
              placeholder="Vehicle, ex: 1999 BMW E36 / 2008 Silverado"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <select
                className={inputClass}
                value={vehicleType}
                onChange={(e) => {
                  setVehicleType(e.target.value);
                  setCategory("");
                }}
              >
                <option value="">Select Vehicle Type</option>
                <option value="Car">Car</option>
                <option value="Truck">Truck</option>
              </select>

              <select
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>

                {vehicleType === "Car" && (
                  <>
                    <option value="Drift">Drift</option>
                    <option value="Static">Static</option>
                    <option value="Track">Track</option>
                    <option value="Drag">Drag</option>
                    <option value="OEM+">OEM+</option>
                    <option value="Offroad">Offroad</option>
                  </>
                )}

                {vehicleType === "Truck" && (
                  <>
                    <option value="Prerunner">Prerunner</option>
                    <option value="Lifted">Lifted</option>
                    <option value="Work/Tow">Work/Tow</option>
                    <option value="Street">Street</option>
                    <option value="Drag">Drag</option>
                    <option value="OEM+">OEM+</option>
                  </>
                )}
              </select>
            </div>

            <textarea
              className={`${inputClass} h-40 resize-none`}
              placeholder="Full Build Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormSection>

          <FormSection title="Photos">
            <div className="bg-black border border-white/10 rounded-2xl p-5 md:p-6">
              <p className="text-gray-400 text-sm mb-4">
                Upload one or more photos. The first photo becomes the main image.
              </p>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                className="w-full text-gray-400 text-sm"
              />

              {imageFiles.length > 0 && (
                <p className="text-orange-500 text-sm mt-4">
                  {imageFiles.length} image{imageFiles.length > 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </FormSection>

          <FormSection title="Build Specs">
            <div className="grid md:grid-cols-3 gap-4">
              <input
                className={inputClass}
                placeholder="Engine Setup"
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="Suspension"
                value={suspension}
                onChange={(e) => setSuspension(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="Wheels/Tires"
                value={wheels}
                onChange={(e) => setWheels(e.target.value)}
              />
            </div>
          </FormSection>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-orange-500 text-black px-10 py-5 rounded-2xl uppercase font-black hover:bg-white transition disabled:opacity-50"
            >
              {isSubmitting ? "Uploading Build..." : "Submit Build"}
            </button>

            <a
              href="/"
              className="w-full sm:w-auto text-center border border-white/20 px-10 py-5 rounded-2xl uppercase font-black hover:bg-white hover:text-black transition"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}

function FormSection({ title, children }) {
  return (
    <section>
      <p className="uppercase tracking-[0.3em] text-orange-500 text-xs md:text-sm font-black mb-5">
        {title}
      </p>

      <div className="space-y-4">{children}</div>
    </section>
  );
}