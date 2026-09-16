"use client";
import Image from "next/image";
import VehicleFields from "./VehicleFields";
import { useState } from "react";
import {
  Car,
  Truck,
  Bike,
  Search,
  MapPin,
  ArrowUpRight,
  Wrench,
  SlidersHorizontal,
  LocateFixed,
} from "lucide-react";

import { categories, vehicles } from "@/lib/shop-finder/catalog";
export function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="field">
      {label}
      <select
        className="picker"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Header() {
  return (
    <header className="header">
      <a href="/" className="brand">
        <Image
          unoptimized
          width={140}
          height={55}
          className="dgd-logo"
          src="/DGD 2 transparent.png"
          alt="DGD"
        />
        <b>SHOP FINDER</b>
      </a>
      <nav>
        <a href="/shop-finder">Find a Shop</a>
        <a href="/shop-finder/dashboard">My Shops</a>
        <a className="nav-cta" href="/shop-finder/list-your-shop">
          List Your Shop <ArrowUpRight size={17} />
        </a>
      </nav>
    </header>
  );
}
export default function Home() {
  const [vehicle, V] = useState("Car"),
    [year, Y] = useState(""),
    [make, M] = useState(""),
    [model, MO] = useState(""),
    [need, N] = useState(""),
    [location, L] = useState(""),
    [tag, T] = useState(""),
    [message, S] = useState(""),
    [results, R] = useState<any[]>([]),
    [busy, B] = useState(false),
    [coords, C] = useState<any>(null),
    [county, CO] = useState(""),
    [state, ST] = useState(""),
    [radius, RA] = useState("25");
  const [mobileOnly,SM]=useState(false),[openOnly,SO]=useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<{question:string;answer:string}[]>([]);
  const context = JSON.stringify({vehicle, year, make, model, need, location, tag, coords, county, state, radius, mobileOnly, openOnly});
  const [searchedContext, setSearchedContext] = useState("");
  async function search(e: any, followup = false) {
    e.preventDefault();
    const nextHistory = followup ? [...history, {question, answer: answer.trim()}] : [];
    if (followup && (!answer.trim() || nextHistory.length > 3 || context !== searchedContext)) return;
    B(true);
    S("");
    try {
      const r = await fetch("/api/shop-finder/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileOnly, openOnly,
          vehicle,
          year,
          make,
          model,
          need,
          conversation: nextHistory,
          location,
          tag,
          coords,
          county,
          state,
          radius,
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      R(d.shops);
      setSearchedContext(context);
      setHistory(nextHistory); setAnswer(""); setQuestion(d.question || "");
      S(
        d.message +
          (d.matching === "ai"
            ? " AI matched your request."
            : d.matching === "unavailable"
              ? " AI is temporarily unavailable; showing service-tag matches."
              : " Matches use service tags."),
      );
    } catch (e: any) {
      S(e.message || "Search is unavailable. Please try again.");
    } finally {
      B(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      S("Location sharing is unavailable. Enter your city or ZIP code.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        C({ lat: p.coords.latitude, lon: p.coords.longitude });
        L("Current location");
      },
      () => S("Location was not shared. Enter your city or ZIP code instead."),
    );
  }
  return (
    <>
      <Header />
      <main className="shell">
        <div className="intro">
          <span className="eyebrow">LOCAL SHOPS. THE RIGHT KNOW-HOW.</span>
          <h1>
            Your ride.
            <br />
            <span>The right shop.</span>
          </h1>
          <p>
            From everyday repairs to your next big build.
            <br />
            Find specialists who know what you drive.
          </p>
        </div>
        <div className="workspace">
          <form className="search-panel" onSubmit={e => search(e)}>
            <div className="section-title">
              <span className="step">01</span>
              <h2>What do you drive?</h2>
            </div>
            <div className="vehicle-options">
              {vehicles.map((v, i) => {
                const Icon = [Car, Truck, Bike][i];
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={vehicle === v}
                    className={vehicle === v ? "vehicle active" : "vehicle"}
                    onClick={() => { V(v); M(""); MO(""); setQuestion(""); setHistory([]); }}
                  >
                    <Icon size={29} />
                    {v}
                  </button>
                );
              })}
            </div>
            <VehicleFields vehicle={vehicle} year={year} make={make} model={model} onYear={Y} onMake={M} onModel={MO}/>
            <div className="section-title">
              <span className="step">02</span>
              <h2>What does your ride need?</h2>
            </div>
            <textarea
              aria-label="Describe the work you need"
              placeholder="Tell us what you have in mind. For example, ‘I need a lift kit installed on my truck.’"
              value={need}
              maxLength={3000}
              onChange={(e) => { N(e.target.value); setQuestion(""); setHistory([]); }}
            />
            <div className="chips">
              {[
                "Mechanic & Repair",
                "Bodywork & Collision",
                "Suspension & Steering",
                "Motorcycle Shop",
              ].map((t) => (
                <button
                  type="button"
                  className={tag === t ? "chip selected" : "chip"}
                  aria-pressed={tag === t}
                  key={t}
                  onClick={() => T(tag === t ? "" : t)}
                >
                  {t.split(" & ")[0]}
                </button>
              ))}
            </div>
            <div className="section-title">
              <span className="step">03</span>
              <h2>Find your local shops</h2>
            </div>
            <div className="location-row">
              <label className="location-input">
                <MapPin size={20} />
                <input
                  aria-label="City or ZIP code"
                  required={!coords}
                  placeholder="City or ZIP code"
                  value={location}
                  onChange={(e) => {
                    L(e.target.value);
                    C(null);
                  }}
                />
              </label>
              <button
                className="locate"
                type="button"
                onClick={locate}
                aria-label="Use my location"
              >
                <LocateFixed size={21} />
              </button>
            </div>
            <details>
              <summary>
                <SlidersHorizontal size={16} /> More filters
              </summary>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  SM(false);SO(false);
                  T("");
                  CO("");
                  ST("");
                  RA("25");
                }}
              >
                Clear filters
              </button>
              <label><input type="checkbox" checked={mobileOnly} onChange={e=>SM(e.target.checked)}/> Mobile service only</label><label><input type="checkbox" checked={openOnly} onChange={e=>SO(e.target.checked)}/> Open now (listed hours)</label>
              <div className="grid3">
                <label className="field">
                  County
                  <input
                    value={county}
                    onChange={(e) => CO(e.target.value)}
                    placeholder="Any county"
                  />
                </label>
                <label className="field">
                  State
                  <input
                    value={state}
                    onChange={(e) => ST(e.target.value)}
                    placeholder="e.g. FL"
                  />
                </label>
                <Picker
                  label="Distance"
                  value={radius}
                  onChange={RA}
                  options={["10", "25", "50", "100", "250"]}
                />
              </div>
              <Picker
                label="Service"
                value={tag}
                onChange={T}
                options={Object.keys(categories)}
              />
            </details>
            <button className="primary search-button" disabled={busy}>
              <Search size={20} />
              {busy ? "Finding shops…" : "Find My Shop"}
              <ArrowUpRight size={20} />
            </button>
            <p className="small center">Free to search. No account needed.</p>
          </form>
          <aside className="side-panel">
            <div className="side-top">
              <Wrench size={30} />
              <span>
                BUILT AROUND
                <br />
                YOUR RIDE
              </span>
            </div>
            <h2>
              Good work starts
              <br />
              with the right people.
            </h2>
            <div className="benefit">
              <b>Specialists, not guesswork</b>
              <p>
                Find shops by the services they offer and the vehicles they work
                on.
              </p>
            </div>
            <div className="benefit">
              <b>Close to home</b>
              <p>
                Search your city or share your location to find nearby options.
              </p>
            </div>
            <div className="benefit">
              <b>Connect directly</b>
              <p>
                Call the shop, check out their work, and get your project
                moving.
              </p>
            </div>
            <a className="owner-card" href="/shop-finder/list-your-shop">
              <span>OWN A SHOP?</span>
              <strong>
                Your next customer
                <br />
                could be right here.
              </strong>
              <span>
                List your shop for free <ArrowUpRight size={17} />
              </span>
            </a>
          </aside>
        </div>
        <section className="results" aria-live="polite">
          {message && <div className="notice">{message}</div>}
          {context === searchedContext && history.length > 0 && <details className="notice"><summary>Your search details</summary>{history.map((turn, i) => <div key={i}><p><b>DGD:</b> {turn.question}</p><p><b>You:</b> {turn.answer}</p></div>)}</details>}
          {context === searchedContext && question && history.length < 3 && <form className="notice followup-form" onSubmit={e => search(e, true)}>
            <label className="field" htmlFor="search-answer"><b>Let’s narrow it down</b><span>{question}</span></label>
            <textarea id="search-answer" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={1000} required placeholder="Add a little more detail…"/>
            <button className="primary" disabled={busy || !answer.trim()}>{busy ? "Updating matches…" : "Update my matches"}</button>
          </form>}
          {results.map((s) => (
            <article className="shop-card" key={s.id}>
              <img src={s.logo} alt="" />
              <div>
                <h2><a href={`/shop-finder/shops/${s.id}`}>{s.name}</a></h2>
                <p>
                  {s.city}, {s.state}{" "}
                  {s.distance != null && `· ${s.distance} miles away`}
                </p>
                {s.verified && <span className="chip">✓ DGD verified business details</span>}<p>{s.description}</p>
                <div className="chips">
                  {s.tags.slice(0, 5).map((t: string) => (
                    <span className="chip" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                {s.matchReasons?.length > 0 && <div className="match-reasons">
                  <h3>Why this shop matches</h3>
                  <ul>{s.matchReasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>
                  <p>Based on the shop’s listing. Confirm your exact year, make, model, and job with the shop.</p>
                </div>}
                <div className="links">
                  <a href={`/shop-finder/shops/${s.id}`}>View shop →</a>
                  {["website", "instagram", "facebook"].map(
                    (k) =>
                      /^https?:\/\//i.test(s[k] || "") && (
                        <a key={k} href={s[k]} target="_blank" rel="noreferrer">
                          {k} ↗
                        </a>
                      ),
                  )}
                  {s.phone && <a href={"tel:" + s.phone}>Call shop</a>}
                  <a
                    href={
                      "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(`${s.address} ${s.city} ${s.state}`)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions ↗
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
        <section className="browse">
          <div>
            <span className="eyebrow">FIND YOUR SPECIALIST</span>
            <h2>A shop for every kind of project.</h2>
          </div>
          <div className="category-grid">
            {Object.entries(categories).map(([c, services]) => (
              <button
                key={c}
                onClick={() => {
                  T(c);
                  document.querySelector("textarea")?.focus();
                }}
              >
                <Wrench size={21} />
                <strong>{c}</strong>
                <span>{services.slice(0, 3).join(" · ")}</span>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <a className="brand" href="/">
          <Image
            unoptimized
            width={140}
            height={55}
            className="dgd-logo"
            src="/DGD 2 transparent.png"
            alt="DGD"
          />
          <b>SHOP FINDER</b>
        </a>
        <span>
          Cars. Trucks. Motorcycles. Your local connection.{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            Location data © OpenStreetMap contributors
          </a>
        </span>
      </footer>
    </>
  );
}
