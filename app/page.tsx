"use client";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gfufidjjiyroagmsreeg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWZpZGpqaXlyb2FnbXNyZWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTE2MzQsImV4cCI6MjA5NDI4NzYzNH0.PlczG3eNWaajNqFykoeijDAB_k_kPxTk1gjxR7DGAOE"
);

type Post = {
  id: string;
  created_at?: string;
  title?: string;
  owner?: string;
  vehicle?: string;
  vehicle_type?: string;
  category?: string;
  description?: string;
  image_url?: string;
  average_rating?: number | string;
  rating_count?: number;
  views?: number;
  likes?: number;
};

type Profile = {
  id: string;
  username?: string;
};

const VEHICLE_FILTERS = ["All", "Car", "Truck", "Motorcycle"];

const TRUCK_CATEGORIES = [
  "Prerunner",
  "Lifted",
  "Dropped",
  "Work/Tow",
  "Street",
  "Drag",
  "OEM+",
];

const CAR_CATEGORIES = [
  "Drift",
  "Stanced",
  "Track",
  "Drag",
  "OEM+",
  "Offroad",
];

const MOTORCYCLE_CATEGORIES = ["Dirt Bike", "Street Bike", "Custom"];
function getFilterLabel(
  vehicleFilter: string,
  selectedCategory: string,
  searchTerm: string
) {
  const parts: string[] = [];

  if (vehicleFilter !== "All") {
    parts.push(
      vehicleFilter === "Motorcycle"
        ? "Motorcycles"
        : `${vehicleFilter}s`
    );
  }

  if (selectedCategory !== "All") {
    parts.push(selectedCategory);
  }

  if (searchTerm.trim()) {
    parts.push(`Search: ${searchTerm.trim()}`);
  }

  return parts.length > 0
    ? `Showing: ${parts.join(" • ")}`
    : "Showing all approved builds";
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [vehicleFilter, setVehicleFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUser = session?.user || null;
    setUser(currentUser);

    if (!currentUser) {
      setProfile(null);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", currentUser.id)
      .maybeSingle();

    setProfile(profileData || null);
  }

  async function loadPosts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load posts:", error);
      setPosts([]);
      setLoading(false);
      return;
    }

    setPosts((data || []) as Post[]);
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
    if (posts.length === 0) {
      setFeaturedIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % posts.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [posts]);

  const featuredPost = posts[featuredIndex];

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      const normalizedVehicleType = post.vehicle_type?.trim().toLowerCase();
      const matchesVehicle =
        vehicleFilter === "All" ||
        normalizedVehicleType === vehicleFilter.toLowerCase();

      const matchesCategory =
        selectedCategory === "All" ||
        post.category?.trim().toLowerCase() ===
          selectedCategory.trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        post.title?.toLowerCase().includes(normalizedSearch) ||
        post.owner?.toLowerCase().includes(normalizedSearch) ||
        post.vehicle?.toLowerCase().includes(normalizedSearch) ||
        post.category?.toLowerCase().includes(normalizedSearch) ||
        post.vehicle_type?.toLowerCase().includes(normalizedSearch);

      return matchesVehicle && matchesCategory && matchesSearch;
    });
  }, [posts, vehicleFilter, selectedCategory, searchTerm]);

  const topRatedPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => {
        const ratingDifference =
          Number(b.average_rating || 0) - Number(a.average_rating || 0);
        if (ratingDifference !== 0) return ratingDifference;
        return Number(b.rating_count || 0) - Number(a.rating_count || 0);
      })
      .slice(0, 6);
  }, [posts]);

  function handleVehicleFilter(type: string) {
    setVehicleFilter(type);
    setSelectedCategory("All");
  }

  function handleCategory(category: string, type: string) {
    setVehicleFilter(type);
    setSelectedCategory(category);
  }

  function resetFilters() {
    setVehicleFilter("All");
    setSelectedCategory("All");
    setSearchTerm("");
  }

  const garageUsername = profile?.username?.trim().replace(/^@/, "") || "";

  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-sans text-white">
      <Navbar
        user={user}
        garageUsername={garageUsername}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <Hero featuredPost={featuredPost} />

      <section id="culture" className="border-y border-white/10 bg-zinc-950 py-14 md:py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Find Your Scene"
            title="Browse The Garage"
            text="Filter by vehicle type, category, username, build name, or vehicle."
          />

          <div className="mb-6 flex flex-wrap gap-3">
            {VEHICLE_FILTERS.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleVehicleFilter(type)}
                className={`rounded-full border px-5 py-3 text-xs font-black uppercase tracking-wide transition md:text-sm ${
                  vehicleFilter === type
                    ? "border-orange-500 bg-orange-500 text-black"
                    : "border-white/10 bg-black text-zinc-400 hover:border-orange-500 hover:text-white"
                }`}
              >
                {type === "Motorcycle" ? "🏍 Motorcycles" : type}
              </button>
            ))}
          </div>

          <div className="mb-8 grid gap-4 md:mb-10 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              placeholder="Search @username, R6, Silverado, drift..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black px-5 py-4 outline-none transition placeholder:text-zinc-600 focus:border-orange-500 md:px-6 md:py-5"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl bg-white px-8 py-4 font-black text-black transition hover:bg-orange-500 md:py-5"
            >
              RESET
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <CategoryBox
              title="TRUCKS"
              subtitle="Truck Culture"
              icon="🛻"
              categories={TRUCK_CATEGORIES}
              selectedCategory={selectedCategory}
              vehicleFilter={vehicleFilter}
              onSelect={(category: string) => handleCategory(category, "Truck")}
            />
            <CategoryBox
              title="CARS"
              subtitle="Street Culture"
              icon="🚗"
              categories={CAR_CATEGORIES}
              selectedCategory={selectedCategory}
              vehicleFilter={vehicleFilter}
              onSelect={(category: string) => handleCategory(category, "Car")}
            />
            <CategoryBox
              title="BIKES"
              subtitle="Motorcycle Culture"
              icon="🏍"
              categories={MOTORCYCLE_CATEGORIES}
              selectedCategory={selectedCategory}
              vehicleFilter={vehicleFilter}
              onSelect={(category: string) => handleCategory(category, "Motorcycle")}
            />
          </div>
        </div>
      </section>

      <section id="trending" className="bg-gradient-to-b from-black to-zinc-950 py-14 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Featured Community Builds"
            title="Trending Builds"
            text={getFilterLabel(vehicleFilter, selectedCategory, searchTerm)}
          />

          {loading ? (
            <EmptyBox title="Loading builds..." text="Pulling approved builds from the garage." />
          ) : filteredPosts.length === 0 ? (
            <EmptyBox
              title="No builds found."
              text="Try a different filter or submit the first build in this section."
              button
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPosts.map((post) => (
                <BuildCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="top-rated" className="border-t border-white/10 bg-black py-14 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <SectionHeader
            eyebrow="Leaderboard"
            title="Top Rated Builds"
            text="The highest-rated cars, trucks, and motorcycles in the DGD garage."
          />

          {topRatedPosts.length === 0 ? (
            <EmptyBox
              title="No top-rated builds yet."
              text="Ratings will appear once the community starts voting."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {topRatedPosts.map((post, index) => (
                <TopRatedCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 bg-black py-20 text-center md:py-32">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <p className="mb-4 uppercase tracking-[0.25em] text-zinc-500 md:tracking-[0.3em]">
            The Online Car & Bike Meet
          </p>
          <h2 className="mb-6 text-4xl font-black md:text-6xl">
            THINK YOUR BUILD BELONGS HERE?
          </h2>
          <p className="mb-10 text-base text-zinc-400 md:text-lg">
            Submit your car, truck, or motorcycle. Let the community rate it,
            comment on it, and discover your garage.
          </p>
          <a
            href="/submit"
            className="inline-block rounded-2xl bg-white px-8 py-5 font-black uppercase tracking-wide text-black transition hover:bg-orange-500 md:px-10"
          >
            Submit Your Build
          </a>
        </div>
      </section>

      <Footer user={user} />
    </div>
  );
}

function Navbar({ user, garageUsername, menuOpen, setMenuOpen }: any) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <a href="/" aria-label="DGD Home">
          <img
            src="/DGD 2 transparent.png"
            alt="DGD Logo"
            className="h-7 w-auto transition hover:opacity-70"
          />
        </a>

        <div className="hidden gap-8 text-sm uppercase tracking-wider md:flex">
          <NavLinks user={user} garageUsername={garageUsername} />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
          className="rounded-xl border border-white/20 px-4 py-2 text-xl md:hidden"
        >
          {menuOpen ? "×" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <div className="space-y-5 border-t border-white/10 bg-black px-4 py-6 text-sm uppercase tracking-wider md:hidden">
          <MobileNavLinks
            user={user}
            garageUsername={garageUsername}
            closeMenu={() => setMenuOpen(false)}
          />
        </div>
      )}
    </nav>
  );
}

function Hero({ featuredPost }: { featuredPost?: Post }) {
  return (
    <section
      className="relative flex min-h-screen items-center bg-cover bg-center pb-12 pt-24"
      style={{
        backgroundImage: `url('${featuredPost?.image_url || "/dgd-hero.png"}')`,
      }}
    >
      <div className="absolute inset-0 bg-black/75" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs uppercase tracking-[0.25em] text-orange-500 md:text-sm md:tracking-[0.4em]">
            Underground Builds. Community Rated.
          </p>
          <h1 className="mb-6 text-5xl font-black leading-none sm:text-6xl md:text-8xl">
            DROP GEAR <br /> DISAPPEAR
          </h1>
          <p className="mb-8 max-w-2xl text-base text-zinc-300 md:text-xl">
            An online meet where cars, trucks, and motorcycles get showcased,
            rated, and remembered.
          </p>

          {featuredPost && (
            <div className="mb-8 max-w-xl rounded-3xl border border-white/10 bg-black/60 p-5 backdrop-blur md:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <VehicleBadge post={featuredPost} />
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  Featured Build Rotation
                </span>
              </div>
              <h2 className="mb-1 text-2xl font-black md:text-3xl">
                {featuredPost.title}
              </h2>
              <p className="mb-4 text-sm text-zinc-400 md:text-base">
                {featuredPost.vehicle} • {featuredPost.category}
              </p>
              <BuildMetrics post={featuredPost} compact />
              <a
                href={`/build/${featuredPost.id}`}
                className="mt-5 inline-block rounded-xl bg-orange-500 px-6 py-3 font-black uppercase text-black transition hover:bg-white"
              >
                View Build
              </a>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row">
            <a
              href="#trending"
              className="rounded-xl bg-white px-8 py-4 text-center font-bold uppercase text-black transition hover:scale-105"
            >
              Browse Builds
            </a>
            <a
              href="/submit"
              className="rounded-xl border border-white px-8 py-4 text-center font-bold uppercase transition hover:bg-white hover:text-black"
            >
              Submit Your Build
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function NavLinks({ user, garageUsername }: any) {
  return (
    <>
      {user && (
        <div className="mr-8 flex items-center">
          <NotificationBell />
        </div>
      )}

      <a
        href="#culture"
        className="transition hover:text-orange-500"
      >
        Browse
      </a>

      <a
        href="#trending"
        className="transition hover:text-orange-500"
      >
        Builds
      </a>

      <a
        href="#top-rated"
        className="transition hover:text-orange-500"
      >
        Top Rated
      </a>

      <a
        href="/submit"
        className="transition hover:text-orange-500"
      >
        Submit Build
      </a>

      {user ? (
        <a
          href={garageUsername ? `/garage/${garageUsername}` : "/account"}
          className="text-orange-500 transition hover:text-white"
        >
          Garage
        </a>
      ) : (
        <a
          href="/login"
          className="transition hover:text-orange-500"
        >
          Login
        </a>
      )}
    </>
  );
}

function MobileNavLinks({ user, garageUsername, closeMenu }: any) {
  return (
    <>
      <a onClick={closeMenu} href="#culture" className="block">Browse</a>
      <a onClick={closeMenu} href="#trending" className="block">Builds</a>
      <a onClick={closeMenu} href="#top-rated" className="block">Top Rated</a>
      <a onClick={closeMenu} href="/submit" className="block">Submit Build</a>
{user && (
  <div
    onClick={closeMenu}
    className="py-2"
  >
    <NotificationBell />
  </div>
)}      {user ? (
        <a
          onClick={closeMenu}
          href={garageUsername ? `/garage/${garageUsername}` : "/account"}
          className="block text-orange-500"
        >
          Garage
        </a>
      ) : (
        <a onClick={closeMenu} href="/login" className="block">Login</a>
      )}
    </>
  );
}

function SectionHeader({ eyebrow, title, text }: any) {
  return (
    <div className="mb-8 md:mb-10">
      <p className="mb-2 text-xs uppercase tracking-[0.3em] text-zinc-500 md:text-sm">{eyebrow}</p>
      <h2 className="text-4xl font-black uppercase md:text-5xl">{title}</h2>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-orange-500 md:text-sm">{text}</p>
    </div>
  );
}

function CategoryBox({
  title,
  subtitle,
  icon,
  categories,
  selectedCategory,
  vehicleFilter,
  onSelect,
}: any) {
  const expectedType = title === "TRUCKS" ? "Truck" : title === "CARS" ? "Car" : "Motorcycle";
  const isActiveVehicle = vehicleFilter === expectedType;

  return (
    <div className={`rounded-3xl border bg-black p-5 transition md:p-6 ${isActiveVehicle ? "border-orange-500/60" : "border-white/10"}`}>
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500 md:text-sm">{subtitle}</p>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <h3 className="text-4xl font-black md:text-5xl">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-3">
        {categories.map((item: string) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={`rounded-xl border px-4 py-3 text-xs uppercase transition md:px-5 md:text-sm ${
              selectedCategory === item && isActiveVehicle
                ? "border-orange-500 bg-orange-500 text-black"
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

function BuildCard({ post }: { post: Post }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 transition duration-300 hover:-translate-y-2 hover:border-orange-500/50">
      <a href={`/build/${post.id}`} className="block">
        <div
          className="h-56 bg-cover bg-center sm:h-64"
          style={{ backgroundImage: `url(${post.image_url || "/dgd-hero.png"})` }}
        />
      </a>

      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <VehicleBadge post={post} />
          <p className="text-xs uppercase tracking-[0.2em] text-orange-500">
            {post.category || "Build"}
          </p>
        </div>

        <h3 className="line-clamp-2 text-xl font-black md:text-2xl">
          {post.title || "Untitled Build"}
        </h3>
        <p className="mt-2 line-clamp-1 text-sm text-zinc-400">
          {post.vehicle || "Vehicle details not added"}
        </p>

        <div className="mt-5 border-y border-white/10 py-4">
          <BuildMetrics post={post} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="truncate text-sm text-white/70">{post.owner || "@unknown"}</span>
          <a
            href={`/build/${post.id}`}
            className="shrink-0 rounded-xl border border-white/20 px-4 py-2 text-xs uppercase transition hover:bg-white hover:text-black md:text-sm"
          >
            View
          </a>
        </div>
      </div>
    </article>
  );
}

function TopRatedCard({ post, index }: { post: Post; index: number }) {
  return (
    <a
      href={`/build/${post.id}`}
      className="group block overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 transition hover:-translate-y-2 hover:border-orange-500"
    >
      <div
        className="h-48 bg-cover bg-center transition duration-300 group-hover:scale-105 sm:h-56"
        style={{ backgroundImage: `url(${post.image_url || "/dgd-hero.png"})` }}
      />
      <div className="p-5 md:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="text-4xl font-black text-orange-500 md:text-5xl">#{index + 1}</p>
          <VehicleBadge post={post} />
        </div>
        <h3 className="line-clamp-2 text-xl font-black md:text-2xl">{post.title || "Untitled Build"}</h3>
        <p className="mt-2 line-clamp-1 text-zinc-400">{post.vehicle || "Vehicle details not added"}</p>
        <div className="mt-5"><BuildMetrics post={post} /></div>
      </div>
    </a>
  );
}

function VehicleBadge({ post }: { post: Post }) {
  const type = post.vehicle_type?.trim() || "Build";
  const icon = type === "Motorcycle" ? "🏍" : type === "Truck" ? "🛻" : type === "Car" ? "🚗" : "🔥";

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] font-black uppercase text-zinc-300">
      <span>{icon}</span>
      {type}
    </span>
  );
}

function BuildMetrics({ post, compact = false }: { post: Post; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-4" : "justify-between gap-3"} text-sm`}>
      <span className="inline-flex items-center gap-1">
        <span className="text-orange-500">★</span>
        <span className="font-bold text-white">{Number(post.average_rating || 0).toFixed(1)}</span>
        <span className="text-zinc-500">({post.rating_count || 0})</span>
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-400" title="Views">
        <span aria-hidden="true">👁</span>
        <span>{post.views || 0}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-400" title="Likes">
        <span aria-hidden="true">♥</span>
        <span>{post.likes || 0}</span>
      </span>
    </div>
  );
}

function EmptyBox({ title, text, button }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 md:p-10">
      <h3 className="mb-3 text-2xl font-black md:text-3xl">{title}</h3>
      <p className="mb-6 text-zinc-400">{text}</p>
      {button && (
        <a
          href="/submit"
          className="inline-block rounded-xl bg-orange-500 px-6 py-3 font-black uppercase text-black transition hover:bg-white"
        >
          Submit Build
        </a>
      )}
    </div>
  );
}

function Footer({ user }: any) {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 py-12">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 px-4 md:flex-row md:px-6">

        <div>
          <a href="/">
            <img
              src="/DGD 2 transparent.png"
              alt="DGD Logo"
              className="mb-4 h-9 w-auto"
            />
          </a>

          <p className="max-w-md text-zinc-500">
            Built After Dark. An online meet for cars, trucks, motorcycles, and
            the people who build them.
          </p>
        </div>

        <div className="space-y-3">
          <a href="/submit" className="block hover:text-white">
            Submit Build
          </a>

          {user ? (
            <a href="/account" className="block hover:text-white">
              Account
            </a>
          ) : (
            <a href="/login" className="block hover:text-white">
              Login
            </a>
          )}

          {user && (
            <a href="/notifications" className="block hover:text-white">
              Notifications
            </a>
          )}

          <a href="/privacy" className="block hover:text-white">
            Privacy Policy
          </a>

          <a href="/terms" className="block hover:text-white">
            Terms of Service
          </a>
        </div>

        <div className="space-y-3">
          <a
            href="https://instagram.com/dropgeardisappear.us"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-white"
          >
            Instagram ↗
          </a>

          <a
            href="https://tiktok.com/@dropgeardisappear.us"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-white"
          >
            TikTok ↗
          </a>

          <a
            href="https://www.youtube.com/@vkspeedzzz"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-white"
          >
            YouTube ↗
          </a>
        </div>

      </div>
    </footer>
  );
}