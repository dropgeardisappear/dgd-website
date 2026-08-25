"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

const inputClass =
  "w-full bg-black border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-orange-500 transition placeholder:text-zinc-600";

const vehicleCategories = {
  Car: ["Drift", "Stanced", "Track", "Drag", "OEM+", "Offroad"],
  Truck: ["Prerunner", "Lifted", "Dropped", "Street", "Work/Tow", "Drag", "OEM+"],
  Motorcycle: ["Dirt Bike", "Street Bike", "Custom"],
};

export default function SubmitPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
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

  const [bikeStory, setBikeStory] = useState("");
  const [bikeMods, setBikeMods] = useState("");

  const [whyBuilt, setWhyBuilt] = useState("");
  const [favoriteMod, setFavoriteMod] = useState("");
  const [futurePlans, setFuturePlans] = useState("");

  const isMotorcycle = vehicleType === "Motorcycle";
  const owner = profile?.username
    ? `@${profile.username}`
    : user?.email || "";

  const imagePreviews = useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles]
  );

  const videoPreviews = useMemo(
    () => videoFiles.map((file) => URL.createObjectURL(file)),
    [videoFiles]
  );

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !currentUser) {
        setUser(null);
        setCheckingUser(false);
        return;
      }

      setUser(currentUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      setProfile(profileData || null);
      setCheckingUser(false);
    }

    checkUser();
  }, []);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      videoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews, videoPreviews]);

  function handleVehicleTypeChange(event) {
    setVehicleType(event.target.value);
    setCategory("");
  }

  function handleImageChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length > 10) {
      alert("You can upload up to 10 photos.");
      event.target.value = "";
      return;
    }

    setImageFiles(files);
  }

  async function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);

      video.preload = "metadata";

      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(url);
        resolve(duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not read ${file.name}.`));
      };

      video.src = url;
    });
  }

  async function handleVideoChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length > 2) {
      alert("You can upload up to 2 videos.");
      event.target.value = "";
      return;
    }

    try {
      for (const file of files) {
        const duration = await getVideoDuration(file);

        if (duration > 30.5) {
          alert(`${file.name} is longer than 30 seconds.`);
          event.target.value = "";
          setVideoFiles([]);
          return;
        }
      }

      setVideoFiles(files);
    } catch (error) {
      alert(error.message || "Could not check the selected video.");
      event.target.value = "";
    }
  }

async function uploadFiles(files, bucket) {
  if (!files || files.length === 0) {
    return [];
  }

  const compressImage = async (file) => {
    // Only attempt compression on images
    if (!file.type.startsWith("image/")) {
      return file;
    }

    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              URL.revokeObjectURL(objectUrl);
              reject(new Error("Canvas unavailable"));
              return;
            }

            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1920;

            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                URL.revokeObjectURL(objectUrl);

                if (!blob) {
                  reject(new Error("Compression failed"));
                  return;
                }

                const originalName =
                  file.name.replace(/\.[^/.]+$/, "") || "image";

                const compressedFile = new File(
                  [blob],
                  `${originalName}.jpg`,
                  {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  }
                );

                resolve(compressedFile);
              },
              "image/jpeg",
              0.82
            );
          } catch (error) {
            URL.revokeObjectURL(objectUrl);
            reject(error);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Browser could not compress image"));
        };

        img.src = objectUrl;
      });
    } catch (error) {
      // IMPORTANT:
      // Compression failing will NOT stop the submission.
      // It silently uses the original image instead.
      console.warn(
        `Could not compress ${file.name}. Uploading original instead.`,
        error
      );

      return file;
    }
  };

  const uploads = files.map(async (file, index) => {
    const uploadFile =
      bucket === "build-images"
        ? await compressImage(file)
        : file;

    // Use the compressed file's name because it may now be a JPG.
    const cleanName = uploadFile.name
      .replace(/[^a-zA-Z0-9.-]/g, "-")
      .toLowerCase();

    const fileName =
      `${user.id}/${Date.now()}-${index}-${crypto.randomUUID()}-${cleanName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, uploadFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: uploadFile.type,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  });

  return Promise.all(uploads);
}

  function validateForm() {
    if (!title.trim()) return "Enter a build or bike name.";
    if (!vehicle.trim()) return "Enter the year, make, and model.";
    if (!vehicleType) return "Select a vehicle type.";
    if (!category) return "Select a category.";
    if (!description.trim()) return "Add a description.";
    if (imageFiles.length === 0) return "Upload at least one photo.";

    if (isMotorcycle) {
      if (!bikeStory.trim()) return "Add the bike story.";
      if (!tires.trim()) return "Add the bike tires.";
      if (!bikeMods.trim()) return "Add the bike modifications.";
    }

    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setIsSubmitting(true);

     const [uploadedImageUrls, uploadedVideoUrls] = await Promise.all([
  uploadFiles(imageFiles, "build-images"),
  uploadFiles(videoFiles, "build-videos"),
]);

      const postPayload = {
        user_id: user.id,
        title: title.trim(),
        owner,
        vehicle: vehicle.trim(),
        vehicle_type: vehicleType,
        category,
        description: description.trim(),

        image_url: uploadedImageUrls[0],
        gallery_images: uploadedImageUrls,
        gallery: uploadedImageUrls,

        video_url: uploadedVideoUrls[0] || null,
        videos: uploadedVideoUrls,

        engine: isMotorcycle ? null : engine.trim() || null,
        suspension: isMotorcycle ? null : suspension.trim() || null,
        wheels: isMotorcycle ? null : wheels.trim() || null,
        tires: tires.trim() || null,
        interior: isMotorcycle ? null : interior.trim() || null,
        exterior: isMotorcycle ? null : exterior.trim() || null,
        performance: isMotorcycle ? null : performance.trim() || null,

        bike_story: isMotorcycle ? bikeStory.trim() : null,
        modifications: isMotorcycle ? bikeMods.trim() : null,

        why_built: whyBuilt.trim() || null,
        favorite_mod: favoriteMod.trim() || null,
        future_plans: futurePlans.trim() || null,

        status: "pending",
        likes: 0,
        views: 0,
        average_rating: 0,
        rating_count: 0,
      };

      const { error } = await supabase
        .from("posts")
        .insert(postPayload);

      if (error) throw error;

      alert(
        isMotorcycle
          ? "Bike submitted for review."
          : "Build submitted for review."
      );

      window.location.href = "/";
    } catch (error) {
      console.error(error);
      alert(error.message || "Something went wrong while submitting.");
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
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-8">
          <p className="text-orange-500 uppercase tracking-[0.3em] text-xs font-black">
            DGD Submission
          </p>

          <h1 className="text-4xl font-black mt-3">LOGIN REQUIRED</h1>

          <p className="text-zinc-400 mt-4 mb-8">
            Create an account or sign in before submitting a build.
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
    <main className="min-h-screen bg-black text-white px-4 md:px-6 py-12 md:py-20">
      <div className="max-w-6xl mx-auto">
        <a
          href="/"
          className="inline-flex text-zinc-500 hover:text-white text-sm"
        >
          ← Back Home
        </a>

        <header className="mt-8 mb-10">
          <p className="uppercase tracking-[0.35em] text-orange-500 text-xs font-black">
            DGD Submission
          </p>

          <h1 className="text-5xl md:text-7xl font-black leading-none mt-3">
            SUBMIT YOUR BUILD
          </h1>

          <p className="text-zinc-400 mt-4">
            Logged in as{" "}
            <span className="text-orange-500 font-bold">{owner}</span>
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection
            title={isMotorcycle ? "Bike Basics" : "Build Basics"}
            subtitle="Start with the main information people will see."
          >
            <div className="grid md:grid-cols-2 gap-4">
              <Field
                placeholder={isMotorcycle ? "Bike Name" : "Build Name"}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />

              <Field
                value={owner}
                disabled
                className="opacity-60 cursor-not-allowed"
                aria-label="Account username"
              />
            </div>

            <Field
              placeholder={
                isMotorcycle
                  ? "Year, make, and model — ex: 2021 Yamaha R6"
                  : "Year, make, and model — ex: 1999 BMW E36"
              }
              value={vehicle}
              onChange={(event) => setVehicle(event.target.value)}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <select
                className={inputClass}
                value={vehicleType}
                onChange={handleVehicleTypeChange}
              >
                <option value="">Select Vehicle Type</option>
                <option value="Car">Car</option>
                <option value="Truck">Truck</option>
                <option value="Motorcycle">Motorcycle</option>
              </select>

              <select
                className={inputClass}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={!vehicleType}
              >
                <option value="">
                  {vehicleType
                    ? "Select Category"
                    : "Choose Vehicle Type First"}
                </option>

                {(vehicleCategories[vehicleType] || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              className={`${inputClass} min-h-40 resize-y`}
              placeholder={
                isMotorcycle
                  ? "Give everyone a quick overview of the bike..."
                  : "Give everyone a quick overview of the build..."
              }
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormSection>

          {isMotorcycle ? (
            <FormSection
              title="Bike Details"
              subtitle="Motorcycle-specific story and specifications."
            >
              <textarea
                className={`${inputClass} min-h-44 resize-y`}
                placeholder="Bike Story — why you chose it, how the build started, and what makes it special"
                value={bikeStory}
                onChange={(event) => setBikeStory(event.target.value)}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <Field
                  placeholder="Tires"
                  value={tires}
                  onChange={(event) => setTires(event.target.value)}
                />

                <textarea
                  className={`${inputClass} min-h-32 resize-y`}
                  placeholder="Modifications"
                  value={bikeMods}
                  onChange={(event) => setBikeMods(event.target.value)}
                />
              </div>
            </FormSection>
          ) : (
            <FormSection
              title="Build Specs"
              subtitle="Add the important parts of the setup."
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field
                  placeholder="Engine Setup"
                  value={engine}
                  onChange={(event) => setEngine(event.target.value)}
                />

                <Field
                  placeholder="Suspension"
                  value={suspension}
                  onChange={(event) => setSuspension(event.target.value)}
                />

                <Field
                  placeholder="Wheels"
                  value={wheels}
                  onChange={(event) => setWheels(event.target.value)}
                />

                <Field
                  placeholder="Tires"
                  value={tires}
                  onChange={(event) => setTires(event.target.value)}
                />

                <Field
                  placeholder="Interior"
                  value={interior}
                  onChange={(event) => setInterior(event.target.value)}
                />

                <Field
                  placeholder="Exterior"
                  value={exterior}
                  onChange={(event) => setExterior(event.target.value)}
                />

                <Field
                  placeholder="Performance"
                  value={performance}
                  onChange={(event) => setPerformance(event.target.value)}
                />
              </div>
            </FormSection>
          )}

          <FormSection
            title="Photos"
            subtitle="Upload up to 10 photos. The first photo becomes the cover."
          >
            <UploadBox
              title="Choose Build Photos"
              subtitle={`${imageFiles.length}/10 photos selected`}
              accept="image/*"
              multiple
              onChange={handleImageChange}
              buttonText="Choose Photos"
            />

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {imagePreviews.map((src, index) => (
                  <div
                    key={src}
                    className="rounded-2xl overflow-hidden border border-white/10 bg-black"
                  >
                    <img
                      src={src}
                      alt={`Selected photo ${index + 1}`}
                      className="w-full h-40 object-cover"
                    />

                    <p className="text-xs text-zinc-500 p-3">
                      {index === 0 ? "Cover photo" : `Photo ${index + 1}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection
            title="Videos"
            subtitle="Upload up to 2 videos. Each video must be 30 seconds or shorter."
          >
            <UploadBox
              title="Choose Build Videos"
              subtitle={`${videoFiles.length}/2 videos selected`}
              accept="video/mp4,video/webm,video/quicktime,video/*"
              multiple
              onChange={handleVideoChange}
              buttonText="Choose Videos"
            />

            {videoPreviews.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {videoPreviews.map((src, index) => (
                  <div
                    key={src}
                    className="rounded-2xl overflow-hidden border border-orange-500/40 bg-black"
                  >
                    <video
                      src={src}
                      controls
                      className="w-full h-64 object-contain bg-black"
                    />

                    <p className="text-xs text-orange-500 p-3">
                      Video {index + 1}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection
            title={isMotorcycle ? "More About The Bike" : "Build Story"}
            subtitle="Give the community more context about the project."
          >
            <div className="grid md:grid-cols-3 gap-4">
              <Field
                placeholder={
                  isMotorcycle ? "Why you chose this bike" : "Why you built it"
                }
                value={whyBuilt}
                onChange={(event) => setWhyBuilt(event.target.value)}
              />

              <Field
                placeholder="Favorite modification"
                value={favoriteMod}
                onChange={(event) => setFavoriteMod(event.target.value)}
              />

              <Field
                placeholder="Future plans"
                value={futurePlans}
                onChange={(event) => setFuturePlans(event.target.value)}
              />
            </div>
          </FormSection>

          <div className="sticky bottom-3 z-20 bg-black/90 backdrop-blur border border-white/10 rounded-3xl p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <a
                href="/"
                className="w-full sm:w-auto text-center border border-white/20 px-8 py-4 rounded-2xl uppercase font-black hover:bg-white hover:text-black transition"
              >
                Cancel
              </a>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-orange-500 text-black px-10 py-4 rounded-2xl uppercase font-black hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "Uploading..."
                  : isMotorcycle
                    ? "Submit Bike"
                    : "Submit Build"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ className = "", ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

function FormSection({ title, subtitle, children }) {
  return (
    <section className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8">
      <div className="mb-6">
        <p className="uppercase tracking-[0.35em] text-orange-500 text-xs md:text-sm font-black">
          {title}
        </p>

        {subtitle && (
          <p className="text-zinc-500 text-sm mt-2">{subtitle}</p>
        )}
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function UploadBox({
  title,
  subtitle,
  accept,
  multiple,
  onChange,
  buttonText,
}) {
  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 hover:border-orange-500/50 transition">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="text-zinc-500 text-sm mt-2">{subtitle}</p>
        </div>

        <label className="cursor-pointer bg-zinc-900 border border-white/10 hover:border-orange-500 rounded-2xl px-6 py-4 text-sm font-black uppercase transition text-center">
          {buttonText}

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