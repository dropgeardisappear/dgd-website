"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function EditBuildPage() {
  const { id } = useParams();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [engine, setEngine] = useState("");
  const [suspension, setSuspension] = useState("");
  const [wheels, setWheels] = useState("");

  async function loadBuild() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    setUser(session.user);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      alert("Build not found.");
      window.location.href = "/";
      return;
    }

    if (data.user_id !== session.user.id) {
      alert("You can only edit your own builds.");
      window.location.href = `/build/${id}`;
      return;
    }

    setTitle(data.title || "");
    setVehicle(data.vehicle || "");
    setVehicleType(data.vehicle_type || "");
    setCategory(data.category || "");
    setDescription(data.description || "");
    setEngine(data.engine || "");
    setSuspension(data.suspension || "");
    setWheels(data.wheels || "");
    setLoading(false);
  }

  async function saveBuild(e) {
    e.preventDefault();

    if (!title || !vehicle || !vehicleType || !category || !description) {
      alert("Please fill out all required fields.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("posts")
      .update({
        title,
        vehicle,
        vehicle_type: vehicleType,
        category,
        description,
        engine,
        suspension,
        wheels,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Build updated.");
    window.location.href = `/build/${id}`;
  }

  useEffect(() => {
    if (id) loadBuild();
  }, [id]);

  if (loading) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-4">
        Loading editor...
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen py-20 md:py-24 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        <a href={`/build/${id}`} className="text-gray-400 hover:text-white">
          ← Back To Build
        </a>

        <div className="mt-8 mb-8">
          <p className="uppercase tracking-[0.25em] text-orange-500 text-xs md:text-sm mb-3">
            Owner Tools
          </p>

          <h1 className="text-4xl md:text-6xl font-black leading-none">
            EDIT BUILD
          </h1>
        </div>

        <form
          onSubmit={saveBuild}
          className="bg-zinc-950 border border-white/10 rounded-3xl p-5 md:p-8 space-y-5"
        >
          <input
            className="field"
            placeholder="Build Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <input
            className="field"
            placeholder="Vehicle"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          />

          <div className="grid md:grid-cols-2 gap-4">
            <select
              className="field"
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
              className="field"
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
            className="field h-40 resize-none"
            placeholder="Build Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <input
            className="field"
            placeholder="Engine Setup"
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
          />

          <input
            className="field"
            placeholder="Suspension"
            value={suspension}
            onChange={(e) => setSuspension(e.target.value)}
          />

          <input
            className="field"
            placeholder="Wheels/Tires"
            value={wheels}
            onChange={(e) => setWheels(e.target.value)}
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-orange-500 text-black px-10 py-5 rounded-2xl uppercase font-black hover:bg-white transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Build"}
          </button>
        </form>
      </div>

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