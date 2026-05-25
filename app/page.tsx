"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const truckCategories = ["Prerunner", "Lifted", "Work/Tow", "Street", "Drag", "OEM+"];
  const carCategories = ["Drift", "Static", "Track", "Drag", "OEM+", "Offroad"];

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
  }

  async function loadPosts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      setLoading(false);
      return;
    }

    setPosts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    checkUser();
    loadPosts();

    const handlePageShow = () => {
      checkUser();
      loadPosts();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (posts.length === 0) return;

    const interval = setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % posts.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [posts]);

  const featuredPost = posts[featuredIndex];

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesCategory =
        selectedCategory === "All" ||
        post.category?.trim().toLowerCase() === selectedCategory.trim().toLowerCase();

      const search = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !search ||
        post.title?.toLowerCase().includes(search) ||
        post.owner?.toLowerCase().includes(search) ||
        post.vehicle?.toLowerCase().includes(search) ||
        post.category?.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [posts, selectedCategory, searchTerm]);

  const topRatedPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0))
      .slice(0, 6);
  }, [posts]);

  function resetFilters() {
    setSelectedCategory("All");
    setSearchTerm("");
  }

  return (
    <div className="bg-black text-white min-h-screen font-sans overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <a href="/" aria-label="DGD Home">
            <img
              src="/DGD 2 transparent.png"
              alt="DGD Logo"
              className="h-7 w-auto hover:opacity-70 transition"
            />
          </a>

          <div className="hidden md:flex gap-8 text-sm uppercase tracking-wider">
            <NavLinks user={user} />
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden border border-white/20 rounded-xl px-4 py-2 text-xl"
          >
            {menuOpen ? "×" : "☰"}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-black border-t border-white/10 px-4 py-6 space-y-5 uppercase text-sm tracking-wider">
            <MobileNavLinks user={user} setMenuOpen={setMenuOpen} />
          </div>
        )}
      </nav>

      <section
        className="relative min-h-screen bg-cover bg-center flex items-center pt-24 pb-12"
        style={{
       backgroundImage: "url('/dgd-hero.png')",
        }}
      >
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full">
          <div className="max-w-3xl">
            <div className="uppercase tracking-[0.25em] md:tracking-[0.4em] text-xs md:text-sm text-orange-500 mb-4">
              Underground Builds. Community Rated.
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-8xl font-black leading-none mb-6">
              DROP GEAR <br /> DISAPPEAR
            </h1>

            <p className="text-gray-300 text-base md:text-xl max-w-2xl mb-8">
              A midnight garage community where the hardest trucks and cars get featured,
              rated, and remembered.
            </p>

            {featuredPost && (
              <div className="border border-white/10 bg-black/60 backdrop-blur rounded-3xl p-5 md:p-6 mb-8 max-w-xl">
                <p className="uppercase text-gray-500 text-xs md:text-sm mb-2">
                  Featured Build Rotation
                </p>

                <h2 className="text-2xl md:text-3xl font-black mb-1">
                  {featuredPost.title}
                </h2>

                <p className="text-gray-400 mb-3 text-sm md:text-base">
                  {featuredPost.vehicle} • {featuredPost.category}
                </p>

                <p className="text-orange-500 mb-5">
                  ★ {Number(featuredPost.average_rating || 0).toFixed(1)}{" "}
                  <span className="text-gray-500">
                    ({featuredPost.rating_count || 0} ratings)
                  </span>
                </p>

                <a
                  href={`/build/${featuredPost.id}`}
                  className="inline-block bg-orange-500 text-black px-6 py-3 rounded-xl uppercase font-black hover:bg-white transition"
                >
                  View Build
                </a>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#trending" className="bg-white text-black px-8 py-4 font-bold uppercase rounded-xl hover:scale-105 transition text-center">
                Browse Builds
              </a>

              <a href="/submit" className="border border-white px-8 py-4 font-bold uppercase rounded-xl hover:bg-white hover:text-black transition text-center">
                Submit Your Build
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="culture" className="border-t border-b border-white/10 bg-zinc-950 py-14 md:py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <h2 className="text-4xl md:text-5xl font-black uppercase mb-2">
            Browse By Culture
          </h2>

          <p className="text-gray-400 mb-8 md:mb-10">
            Search by username, build name, vehicle, or category.
          </p>

          <div className="grid md:grid-cols-[1fr_auto] gap-4 mb-8 md:mb-10">
            <input
              type="text"
              placeholder="Search @username, E36, Silverado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-2xl px-5 md:px-6 py-4 md:py-5 outline-none focus:border-orange-500"
            />

            <button
              onClick={resetFilters}
              className="bg-white text-black font-black px-8 py-4 md:py-5 rounded-2xl hover:bg-orange-500 transition"
            >
              RESET
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
            <CategoryBox
              title="TRUCKS"
              subtitle="Truck Culture"
              categories={truckCategories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />

            <CategoryBox
              title="CARS"
              subtitle="Street Culture"
              categories={carCategories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
            />
          </div>
        </div>
      </section>

      <section id="trending" className="py-14 md:py-24 bg-gradient-to-b from-black to-zinc-950">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <SectionHeader
            eyebrow="Featured Community Builds"
            title="Trending Builds"
            text={`Showing: ${selectedCategory}${searchTerm ? ` • Search: ${searchTerm}` : ""}`}
          />

          {loading ? (
            <EmptyBox title="Loading builds..." text="Pulling approved builds from the garage." />
          ) : filteredPosts.length === 0 ? (
            <EmptyBox title="No builds found." text="Try another search/category or be the first to submit one." button />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredPosts.map((post) => (
                <BuildCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="top-rated" className="py-14 md:py-24 bg-black border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <SectionHeader
            eyebrow="Leaderboard"
            title="Top Rated Builds"
            text="The highest-rated builds in the DGD garage."
          />

          {topRatedPosts.length === 0 ? (
            <EmptyBox title="No top rated builds yet." text="Ratings will appear once users start voting." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {topRatedPosts.map((post, index) => (
                <TopRatedCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-20 md:py-32 bg-black border-t border-white/10 text-center">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="uppercase tracking-[0.25em] md:tracking-[0.3em] text-gray-500 mb-4">
            Submit Your Build
          </div>

          <h2 className="text-4xl md:text-6xl font-black mb-6">
            THINK YOUR BUILD BELONGS HERE?
          </h2>

          <p className="text-gray-400 text-base md:text-lg mb-10">
            Submit your car or truck for review and get featured in the underground garage.
          </p>

          <a
            href="/submit"
            className="bg-white text-black px-8 md:px-10 py-5 rounded-2xl uppercase font-black tracking-wide inline-block hover:bg-orange-500 transition"
          >
            Submit Build
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between gap-10">
          <div>
            <a href="/">
              <img src="/DGD 2 transparent.png" alt="DGD Logo" className="h-9 w-auto mb-4" />
            </a>

            <p className="text-gray-500 max-w-md">
              Built After Dark. Underground culture for trucks, drift cars,
              street builds, and real enthusiasts.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm uppercase tracking-wide text-gray-400">
            <FooterLinks user={user} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLinks({ user }: any) {
  return (
    <>
      <a href="#culture" className="hover:text-orange-500 transition">Browse</a>
      <a href="#trending" className="hover:text-orange-500 transition">Builds</a>
      <a href="#top-rated" className="hover:text-orange-500 transition">Top Rated</a>
      <a href="/submit" className="hover:text-orange-500 transition">Submit Build</a>
      {user && <a href="/notifications" className="hover:text-orange-500 transition">Notifications</a>}
      {user ? (
  <a href={`/garage/${user?.user_metadata?.username || "victormgarcia8157"}`} className="text-orange-500 hover:text-white transition">
  Garage
</a>
      ) : (
        <a href="/login" className="hover:text-orange-500 transition">Login</a>
      )}
    </>
  );
}

function MobileNavLinks({ user, setMenuOpen }: any) {
  const close = () => setMenuOpen(false);

  return (
    <>
      <a onClick={close} href="#culture" className="block">Browse</a>
      <a onClick={close} href="#trending" className="block">Builds</a>
      <a onClick={close} href="#top-rated" className="block">Top Rated</a>
      <a onClick={close} href="/submit" className="block">Submit Build</a>
      {user && <a onClick={close} href="/notifications" className="block">Notifications</a>}
      {user ? (
        <a onClick={close} href="/account" className="block text-orange-500">Account</a>
      ) : (
        <a onClick={close} href="/login" className="block">Login</a>
      )}
    </>
  );
}

function SectionHeader({ eyebrow, title, text }: any) {
  return (
    <div className="mb-8 md:mb-10">
      <div className="uppercase text-xs md:text-sm tracking-[0.3em] text-gray-500 mb-2">
        {eyebrow}
      </div>

      <h2 className="text-4xl md:text-5xl font-black uppercase">{title}</h2>

      <p className="text-orange-500 uppercase tracking-[0.2em] mt-4 text-xs md:text-sm">
        {text}
      </p>
    </div>
  );
}

function CategoryBox({ title, subtitle, categories, selectedCategory, setSelectedCategory }: any) {
  return (
    <div className="bg-black border border-white/10 rounded-3xl p-5 md:p-6">
      <div className="text-xs md:text-sm uppercase tracking-[0.3em] text-gray-500 mb-3">
        {subtitle}
      </div>

      <h3 className="text-4xl md:text-5xl font-black mb-6">{title}</h3>

      <div className="flex flex-wrap gap-3">
        {categories.map((item: string) => (
          <button
            key={item}
            onClick={() => setSelectedCategory(item)}
            className={`px-4 md:px-5 py-3 rounded-xl border uppercase text-xs md:text-sm transition ${
              selectedCategory === item
                ? "bg-orange-500 text-black border-orange-500"
                : "border-white/20 bg-zinc-900 hover:bg-white hover:text-black"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function BuildCard({ post }: any) {
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden hover:-translate-y-2 transition duration-300">
      <div
        className="h-56 sm:h-64 md:h-72 bg-cover bg-center"
        style={{ backgroundImage: `url(${post.image_url})` }}
      />

      <div className="p-5 md:p-6">
        <p className="text-orange-500 text-xs uppercase tracking-[0.25em] mb-3">
          {post.category}
        </p>

        <h3 className="text-xl md:text-2xl font-black mb-2 line-clamp-2">
          {post.title}
        </h3>

        <p className="text-gray-400 mb-4 line-clamp-1">
          {post.vehicle}
        </p>

        <div className="flex items-center gap-2 mb-5">
          <span className="text-orange-500">★</span>
          <span className="text-white font-bold">
            {Number(post.average_rating || 0).toFixed(1)}
          </span>
          <span className="text-gray-500 text-sm">
            ({post.rating_count || 0})
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-white/70 truncate">
            {post.owner}
          </span>

          <a
            href={`/build/${post.id}`}
            className="shrink-0 uppercase text-xs md:text-sm border border-white/20 px-4 py-2 rounded-xl hover:bg-white hover:text-black transition"
          >
            View
          </a>
        </div>
      </div>
    </div>
  );
}

function TopRatedCard({ post, index }: any) {
  return (
    <a
      href={`/build/${post.id}`}
      className="group bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden hover:border-orange-500 hover:-translate-y-2 transition block"
    >
      <div
        className="h-48 sm:h-56 bg-cover bg-center group-hover:scale-105 transition duration-300"
        style={{ backgroundImage: `url(${post.image_url})` }}
      />

      <div className="p-5 md:p-6">
        <p className="text-orange-500 text-4xl md:text-5xl font-black mb-4">
          #{index + 1}
        </p>

        <h3 className="text-xl md:text-2xl font-black mb-2 line-clamp-2">
          {post.title}
        </h3>

        <p className="text-gray-400 line-clamp-1">
          {post.vehicle}
        </p>

        <div className="flex justify-between gap-4 mt-5 text-xs md:text-sm text-gray-500 uppercase">
          <span className="truncate">{post.category}</span>
          <span className="shrink-0">
            ★ {Number(post.average_rating || 0).toFixed(1)} ({post.rating_count || 0})
          </span>
        </div>
      </div>
    </a>
  );
}

function EmptyBox({ title, text, button }: any) {
  return (
    <div className="border border-white/10 rounded-3xl p-6 md:p-10 bg-zinc-950">
      <h3 className="text-2xl md:text-3xl font-black mb-3">{title}</h3>

      <p className="text-gray-400 mb-6">{text}</p>

      {button && (
        <a
          href="/submit"
          className="inline-block bg-orange-500 text-black px-6 py-3 rounded-xl uppercase font-black hover:bg-white transition"
        >
          Submit Build
        </a>
      )}
    </div>
  );
}

function FooterLinks({ user }: any) {
  return (
    <>
      <div className="space-y-3">
        <a href="#culture" className="block hover:text-white">Browse</a>
        <a href="#trending" className="block hover:text-white">Builds</a>
        <a href="#top-rated" className="block hover:text-white">Top Rated</a>
      </div>

      <div className="space-y-3">
        <a href="/submit" className="block hover:text-white">Submit Build</a>
        {user ? (
          <a href="/account" className="block hover:text-white">Account</a>
        ) : (
          <a href="/login" className="block hover:text-white">Login</a>
        )}
        {user && <a href="/notifications" className="block hover:text-white">Notifications</a>}
      </div>

      <div className="space-y-3">
        <div>Instagram</div>
        <div>TikTok</div>
        <div>YouTube</div>
      </div>
    </>
  );
}