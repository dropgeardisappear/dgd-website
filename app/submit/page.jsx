"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

const inputClass =
  "w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-orange-500 transition placeholder:text-zinc-600";

export default function SubmitPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const [imageFiles, setImageFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);

  const [engine, setEngine] = useState("");
  const [suspension, setSuspension] = useState("");
  const [wheels, setWheels] = useState("");
  const [tires, setTires] = useState("");
  const [interior, setInterior] = useState("");
  const [exterior, setExterior] = useState("");
  const [performance, setPerformance] = useState("");
  const [futurePlans, setFuturePlans] = useState("");

  const [whyBuilt, setWhyBuilt] = useState("");
  const [favoriteMod, setFavoriteMod] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const imagePreviews = useMemo(() => {
    return imageFiles.map((file) => URL.createObjectURL(file));
  }, [imageFiles]);

  const videoPreviews = useMemo(() => {
    return videoFiles.map((file) => URL.createObjectURL(file));
  }, [videoFiles]);

  useEffect(() => {
    async function checkUser() {
  const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (error || !user) {
  await supabase.auth.signOut();
  setUser(null);
  setCheckingUser(false);
  return;
}

setUser(user);

  const { data } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .single();

      if (data) {
        setProfile(data);
        setOwner(`@${data.username}`);
      } else {
        setOwner(user.email);
      }

      setCheckingUser(false);
    }

    checkUser();
  }, []);

  function handleImageChange(e) {
    setImageFiles(Array.from(e.target.files || []));
  }

  function handleVideoChange(e) {
    setVideoFiles(Array.from(e.target.files || []));
  }

  async function uploadFiles(files, bucket) {
    const urls = [];

    for (const file of files) {
      const cleanName = file.name.replace(/\s+/g, "-").toLowerCase();
      const fileName = `${user.id}/${Date.now()}-${cleanName}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!title || !vehicle || !vehicleType || !category || !description) {
      alert("Fill out the required build basics first.");
      return;
    }

    if (imageFiles.length === 0) {
      alert("Upload at least one photo.");
      return;
    }

    try {
      setIsSubmitting(true);

      const uploadedImageUrls = await uploadFiles(imageFiles, "build-images");
      const uploadedVideoUrls = await uploadFiles(videoFiles, "build-videos");

      const { data: post, error } = await supabase
        .from("posts")
        .insert([
          {
            user_id: user.id,

title,

            title,
        

            owner: profile?.username ? `@${profile.username}` : user.email,
            vehicle,
            vehicle_type: vehicleType,
            category,
            description,

            image_url: uploadedImageUrls[0],
            gallery_images: uploadedImageUrls,
            gallery: uploadedImageUrls,

            video_url: uploadedVideoUrls[0] || null,
            videos: uploadedVideoUrls,

            engine,
            suspension,
            wheels,
            tires,
            interior,
            exterior,
            performance,
            future_plans: futurePlans,
            why_built: whyBuilt,
            favorite_mod: favoriteMod,

            status: "pending",
            likes: 0,
            views: 0,
            average_rating: 0,
            rating_count: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (uploadedVideoUrls.length > 0 && post) {
        const videoRows = uploadedVideoUrls.map((url) => ({
          post_id: post.id,
          type: "video",
          url,
        }));

        await supabase.from("media").insert(videoRows);
      }

      alert("Build submitted for review.");
      window.location.href = "/";
    } catch (err) {
      console.log(err);
      alert(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">Checking account...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-3xl p-8">
          <h1 className="text-4xl font-black mb-4">LOGIN REQUIRED</h1>
          <p className="text-zinc-400 mb-8">
            You need an account before submitting a build.
          </p>

          <a
            href="/login"
            className="block text-center bg-orange-500 text-black px-8 py-4 rounded-2xl uppercase font-black hover:bg-white transition"
          >
            Login / Create Account
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen px-4 md:px-6 py-16 md:py-24">
      <div className="max-w-6xl mx-auto">
        <a href="/" className="text-zinc-500 hover:text-white text-sm">
          ← Back Home
        </a>

        <header className="mt-8 mb-10">
          <p className="uppercase tracking-[0.35em] text-orange-500 text-xs font-black mb-3">
            DGD Submission
          </p>

          <h1 className="text-5xl md:text-7xl font-black leading-none mb-4">
            SUBMIT BUILD
          </h1>

          <p className="text-zinc-400">
            Logged in as{" "}
            <span className="text-orange-500 font-bold">
              {profile?.username ? `@${profile.username}` : user.email}
            </span>
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8 space-y-10 shadow-2xl"
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
                className={`${inputClass} opacity-60 cursor-not-allowed`}
                placeholder="@Username"
                value={owner}
                disabled
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
                    <option value="Stanced">Stanced</option>
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
                    <option value="Dropped">Dropped</option>
                    <option value="Street">Street</option>
                    <option value="Work/Tow">Work/Tow</option>
                    <option value="Drag">Drag</option>
                    <option value="OEM+">OEM+</option>
                  </>
                )}
              </select>
            </div>

            <textarea
              className={`${inputClass} h-40 resize-none`}
              placeholder="Full Build Description / Story"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormSection>

          <FormSection title="Photos">
            <UploadBox
              title="Upload Build Photos"
              subtitle="Upload one or more photos. The first photo becomes the main image."
              type="image"
              accept="image/*"
              multiple
              onChange={handleImageChange}
            />

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                {imagePreviews.map((src, index) => (
                  <div
                    key={src}
                    className="rounded-2xl overflow-hidden border border-white/10 bg-black"
                  >
                    <img src={src} alt="" className="w-full h-40 object-cover" />
                    <p className="text-xs text-zinc-500 p-3">
                      {index === 0 ? "Main image" : `Photo ${index + 1}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title="Videos">
            <UploadBox
              title="Upload Build Videos"
              subtitle="Walkaround, exhaust clip, rolling shot, or feature video."
              type="video"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              multiple
              onChange={handleVideoChange}
            />

            {videoPreviews.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4 mt-5">
                {videoPreviews.map((src, index) => (
                  <div
                    key={src}
                    className="rounded-2xl overflow-hidden border border-orange-500/40 bg-black"
                  >
                    <video src={src} controls className="w-full h-64 object-contain bg-black" />
                    <p className="text-xs text-orange-500 p-3">
                      Video {index + 1} selected
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title="Build Story">
            <div className="grid md:grid-cols-3 gap-4">
              <input
                className={inputClass}
                placeholder="Why they built it"
                value={whyBuilt}
                onChange={(e) => setWhyBuilt(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="Favorite mod"
                value={favoriteMod}
                onChange={(e) => setFavoriteMod(e.target.value)}
              />

              <input
                className={inputClass}
                placeholder="Future plans"
                value={futurePlans}
                onChange={(e) => setFuturePlans(e.target.value)}
              />
            </div>
          </FormSection>

          <FormSection title="Build Specs">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input className={inputClass} placeholder="Engine Setup" value={engine} onChange={(e) => setEngine(e.target.value)} />
              <input className={inputClass} placeholder="Suspension" value={suspension} onChange={(e) => setSuspension(e.target.value)} />
              <input className={inputClass} placeholder="Wheels" value={wheels} onChange={(e) => setWheels(e.target.value)} />
              <input className={inputClass} placeholder="Tires" value={tires} onChange={(e) => setTires(e.target.value)} />
              <input className={inputClass} placeholder="Interior" value={interior} onChange={(e) => setInterior(e.target.value)} />
              <input className={inputClass} placeholder="Exterior" value={exterior} onChange={(e) => setExterior(e.target.value)} />
              <input className={inputClass} placeholder="Performance" value={performance} onChange={(e) => setPerformance(e.target.value)} />
            </div>
          </FormSection>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
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
      <p className="uppercase tracking-[0.35em] text-orange-500 text-xs md:text-sm font-black mb-5">
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function UploadBox({ title, subtitle, type, accept, multiple, onChange }) {
  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 hover:border-orange-500/50 transition">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="text-zinc-500 text-sm mt-2">{subtitle}</p>
        </div>

        <label className="cursor-pointer bg-zinc-900 border border-white/10 hover:border-orange-500 rounded-2xl px-6 py-4 text-sm font-black uppercase transition text-center">
          {type === "video" ? "Choose Videos" : "Choose Photos"}
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={onChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}