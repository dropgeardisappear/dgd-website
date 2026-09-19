"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Range = "24h" | "7d" | "30d" | "all";

type Stats = {
  builds: number;
  approvedBuilds: number;
  pendingBuilds: number;

  shops: number;
  freeShops: number;
  plusShops: number;
  exclusiveShops: number;

  users: number;
};

type RecentBuild = {
  id: string;
  name?: string | null;
  owner?: string | null;
  vehicle?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type RecentShop = {
  id: string;
  name?: string | null;
  status?: string | null;
  plan?: string | null;
  created_at?: string | null;
};

const emptyStats: Stats = {
  builds: 0,
  approvedBuilds: 0,
  pendingBuilds: 0,

  shops: 0,
  freeShops: 0,
  plusShops: 0,
  exclusiveShops: 0,

  users: 0,
};

function getStartDate(range: Range) {
  if (range === "all") {
    return null;
  }

  const date = new Date();

  if (range === "24h") {
    date.setHours(date.getHours() - 24);
  }

  if (range === "7d") {
    date.setDate(date.getDate() - 7);
  }

  if (range === "30d") {
    date.setDate(date.getDate() - 30);
  }

  return date.toISOString();
}

function formatDate(date?: string | null) {
  if (!date) return "Unknown";

  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DGDLiveDashboard() {
  const [range, setRange] = useState<Range>("24h");

  const [stats, setStats] =
    useState<Stats>(emptyStats);

  const [loading, setLoading] =
    useState(true);

  const [onlineNow, setOnlineNow] =
    useState(0);

  const [recentBuilds, setRecentBuilds] =
    useState<RecentBuild[]>([]);

  const [recentShops, setRecentShops] =
    useState<RecentShop[]>([]);

  /*
  --------------------------------
  LOAD DATABASE STATS
  --------------------------------
  */

  const loadStats = useCallback(async () => {
    setLoading(true);

    try {
      const startDate =
        getStartDate(range);

      let buildsQuery = supabase
        .from("posts")
        .select("*");

      let shopsQuery = supabase
        .from("directory_shops")
        .select("*");

      let usersQuery = supabase
        .from("profiles")
        .select("id,created_at");

      if (startDate) {
        buildsQuery =
          buildsQuery.gte(
            "created_at",
            startDate
          );

        shopsQuery =
          shopsQuery.gte(
            "created_at",
            startDate
          );

        usersQuery =
          usersQuery.gte(
            "created_at",
            startDate
          );
      }

      const [
        buildsResult,
        shopsResult,
        usersResult,
      ] = await Promise.all([
        buildsQuery,
        shopsQuery,
        usersQuery,
      ]);

      /*
      -----------------------------
      BUILDS
      -----------------------------
      */

      const builds =
        buildsResult.error
          ? []
          : buildsResult.data ?? [];

      if (buildsResult.error) {
        console.error(
          "POSTS ERROR:",
          JSON.stringify(
            buildsResult.error,
            null,
            2
          )
        );
      }

      /*
      -----------------------------
      SHOPS
      -----------------------------
      */

      const shops =
        shopsResult.error
          ? []
          : shopsResult.data ?? [];

      if (shopsResult.error) {
        console.error(
          "SHOPS ERROR:",
          JSON.stringify(
            shopsResult.error,
            null,
            2
          )
        );
      }

      /*
      -----------------------------
      USERS
      -----------------------------
      */

      const users =
        usersResult.error
          ? []
          : usersResult.data ?? [];

      if (usersResult.error) {
        console.error(
          "USERS ERROR:",
          JSON.stringify(
            usersResult.error,
            null,
            2
          )
        );
      }

      /*
      -----------------------------
      UPDATE STATS
      -----------------------------
      */

      setStats({
        builds: builds.length,

        approvedBuilds:
          builds.filter(
            (build: any) =>
              build.status
                ?.toLowerCase() ===
              "approved"
          ).length,

        pendingBuilds:
          builds.filter(
            (build: any) =>
              build.status
                ?.toLowerCase() ===
              "pending"
          ).length,

        shops: shops.length,

        freeShops:
          shops.filter(
            (shop: any) =>
              shop.plan
                ?.toLowerCase() ===
              "free"
          ).length,

        plusShops:
          shops.filter(
            (shop: any) =>
              shop.plan
                ?.toLowerCase() ===
              "plus"
          ).length,

        exclusiveShops:
          shops.filter(
            (shop: any) =>
              shop.plan
                ?.toLowerCase() ===
              "exclusive"
          ).length,

        users: users.length,
      });

      /*
      -----------------------------
      RECENT BUILDS
      -----------------------------
      */

      const latestBuildsResult =
        await supabase
          .from("posts")
          .select("*")
          .order("created_at", {
            ascending: false,
          })
          .limit(8);

      if (
        !latestBuildsResult.error
      ) {
        setRecentBuilds(
          (latestBuildsResult.data ??
            []) as RecentBuild[]
        );
      } else {
        console.error(
          "RECENT BUILDS ERROR:",
          JSON.stringify(
            latestBuildsResult.error,
            null,
            2
          )
        );

        setRecentBuilds([]);
      }

      /*
      -----------------------------
      RECENT SHOPS
      -----------------------------
      */

      const latestShopsResult =
        await supabase
          .from("directory_shops")
          .select("*")
          .order("created_at", {
            ascending: false,
          })
          .limit(8);

      if (
        !latestShopsResult.error
      ) {
        setRecentShops(
          (latestShopsResult.data ??
            []) as RecentShop[]
        );
      } else {
        console.error(
          "RECENT SHOPS ERROR:",
          JSON.stringify(
            latestShopsResult.error,
            null,
            2
          )
        );

        setRecentShops([]);
      }
    } catch (error) {
      console.error(
        "DGD DASHBOARD ERROR:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  /*
  --------------------------------
  LOAD WHEN RANGE CHANGES
  --------------------------------
  */

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /*
  --------------------------------
  LIVE VISITOR COUNT
  --------------------------------
  */

  useEffect(() => {
    const channel =
      supabase.channel(
        "dgd-live-visitors"
      );

    function updateCount() {
      const presence =
        channel.presenceState();

      const count =
        Object.values(
          presence
        ).reduce(
          (
            total,
            visitors
          ) =>
            total +
            visitors.length,
          0
        );

      setOnlineNow(count);
    }

    channel
      .on(
        "presence",
        {
          event: "sync",
        },
        updateCount
      )

      .on(
        "presence",
        {
          event: "join",
        },
        updateCount
      )

      .on(
        "presence",
        {
          event: "leave",
        },
        updateCount
      )

      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  /*
  --------------------------------
  AUTO REFRESH DATABASE
  --------------------------------
  */

  useEffect(() => {
    const timer =
      setInterval(() => {
        loadStats();
      }, 30000);

    return () =>
      clearInterval(timer);
  }, [loadStats]);

  const ranges: {
    value: Range;
    label: string;
  }[] = [
    {
      value: "24h",
      label: "24 HOURS",
    },
    {
      value: "7d",
      label: "7 DAYS",
    },
    {
      value: "30d",
      label: "30 DAYS",
    },
    {
      value: "all",
      label: "ALL TIME",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #050505 0%, #090909 100%)",
        color: "#fff",
        padding:
          "28px 16px 80px",
      }}
    >
      <div
        style={{
          maxWidth: "1250px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              color: "#ff5a00",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "3px",
              marginBottom: "8px",
            }}
          >
            DROP GEAR DISAPPEAR
          </div>

          <h1
            style={{
              margin: 0,
              fontSize:
                "clamp(36px, 7vw, 72px)",
              lineHeight: 0.95,
              fontWeight: 950,
              letterSpacing: "-3px",
            }}
          >
            COMMAND CENTER
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "14px",
              color: "#888",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius:
                  "999px",
                background:
                  "#32d583",
                display:
                  "inline-block",
              }}
            />

            Dashboard Live
          </div>
        </div>

        {/* RANGE */}

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "25px",
          }}
        >
          {ranges.map(
            (item) => (
              <button
                key={
                  item.value
                }
                onClick={() =>
                  setRange(
                    item.value
                  )
                }
                style={{
                  border:
                    range ===
                    item.value
                      ? "1px solid #ff5a00"
                      : "1px solid #252525",

                  background:
                    range ===
                    item.value
                      ? "#ff5a00"
                      : "#0d0d0d",

                  color: "#fff",

                  borderRadius:
                    "9px",

                  padding:
                    "11px 17px",

                  fontWeight: 900,

                  cursor:
                    "pointer",

                  fontSize:
                    "12px",
                }}
              >
                {item.label}
              </button>
            )
          )}

          <button
            onClick={loadStats}
            style={{
              border:
                "1px solid #252525",
              background:
                "#0d0d0d",
              color: "#aaa",
              borderRadius: "9px",
              padding:
                "11px 17px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            REFRESH
          </button>
        </div>

        {loading ? (
          <div
            style={{
              padding:
                "60px 0",
              color: "#777",
            }}
          >
            Loading DGD
            analytics...
          </div>
        ) : (
          <>
            {/* MAIN STATS */}

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",

                gap: "14px",

                marginBottom:
                  "14px",
              }}
            >
              <Section title="LIVE TRAFFIC">
                <Stat
                  label="Online Now"
                  value={
                    onlineNow
                  }
                  big
                  accent
                />

                <Stat
                  label="Unique Visitors"
                  value="CONNECT NEXT"
                />

                <Stat
                  label="Page Views"
                  value="CONNECT NEXT"
                />
              </Section>

              <Section title="DGD GARAGE">
                <Stat
                  label="Builds Added"
                  value={
                    stats.builds
                  }
                  big
                />

                <Stat
                  label="Approved"
                  value={
                    stats.approvedBuilds
                  }
                />

                <Stat
                  label="Pending"
                  value={
                    stats.pendingBuilds
                  }
                />
              </Section>

              <Section title="SHOP FINDER">
                <Stat
                  label="Shops Added"
                  value={
                    stats.shops
                  }
                  big
                />

                <Stat
                  label="Free"
                  value={
                    stats.freeShops
                  }
                />

                <Stat
                  label="Plus"
                  value={
                    stats.plusShops
                  }
                />

                <Stat
                  label="Exclusive"
                  value={
                    stats.exclusiveShops
                  }
                />
              </Section>

              <Section title="COMMUNITY">
                <Stat
                  label="New Users"
                  value={
                    stats.users
                  }
                  big
                />
              </Section>

              <Section title="DGD STORE">
                <Stat
                  label="Orders"
                  value="SECURE API NEXT"
                />

                <Stat
                  label="Revenue"
                  value="SECURE API NEXT"
                />
              </Section>
            </div>

            {/* ACTIVITY */}

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",

                gap: "14px",
              }}
            >
              <ActivitySection title="RECENT BUILDS">
                {recentBuilds.length ===
                0 ? (
                  <EmptyActivity text="No builds found." />
                ) : (
                  recentBuilds.map(
                    (build) => (
                      <Activity
                        key={
                          build.id
                        }
                        title={
                          build.name ||
                          build.vehicle ||
                          "Untitled Build"
                        }
                        subtitle={
                          build.owner
                            ? `@${build.owner}`
                            : build.vehicle ||
                              "DGD Build"
                        }
                        status={
                          build.status ||
                          "unknown"
                        }
                        date={formatDate(
                          build.created_at
                        )}
                      />
                    )
                  )
                )}
              </ActivitySection>

              <ActivitySection title="RECENT SHOPS">
                {recentShops.length ===
                0 ? (
                  <EmptyActivity text="No shops found." />
                ) : (
                  recentShops.map(
                    (shop) => (
                      <Activity
                        key={
                          shop.id
                        }
                        title={
                          shop.name ||
                          "Unnamed Shop"
                        }
                        subtitle={`${
                          shop.plan ||
                          "free"
                        } plan`}
                        status={
                          shop.status ||
                          "unknown"
                        }
                        date={formatDate(
                          shop.created_at
                        )}
                      />
                    )
                  )
                )}
              </ActivitySection>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/*
================================
SECTION
================================
*/

function Section({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        background:
          "rgba(13,13,13,.92)",

        border:
          "1px solid #222",

        borderRadius:
          "16px",

        padding: "21px",

        boxShadow:
          "0 15px 40px rgba(0,0,0,.20)",
      }}
    >
      <div
        style={{
          color: "#ff5a00",
          fontSize: "11px",
          letterSpacing:
            "2.5px",
          fontWeight: 950,
          marginBottom:
            "17px",
        }}
      >
        {title}
      </div>

      {children}
    </section>
  );
}

/*
================================
STAT
================================
*/

function Stat({
  label,
  value,
  big = false,
  accent = false,
}: {
  label: string;
  value:
    | string
    | number;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems:
          "center",
        gap: "15px",

        borderBottom:
          "1px solid #1d1d1d",

        padding:
          "13px 0",
      }}
    >
      <span
        style={{
          color: "#777",
          fontSize: "14px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: accent
            ? "#32d583"
            : "#fff",

          fontSize: big
            ? "29px"
            : "16px",

          fontWeight: 950,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/*
================================
ACTIVITY SECTION
================================
*/

function ActivitySection({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        background:
          "#0d0d0d",

        border:
          "1px solid #222",

        borderRadius:
          "16px",

        padding: "21px",
      }}
    >
      <div
        style={{
          color: "#ff5a00",

          fontSize: "11px",

          letterSpacing:
            "2.5px",

          fontWeight: 950,

          marginBottom:
            "10px",
        }}
      >
        {title}
      </div>

      {children}
    </section>
  );
}

/*
================================
ACTIVITY ROW
================================
*/

function Activity({
  title,
  subtitle,
  status,
  date,
}: {
  title: string;
  subtitle: string;
  status: string;
  date: string;
}) {
  return (
    <div
      style={{
        padding:
          "15px 0",

        borderBottom:
          "1px solid #1c1c1c",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "15px",
        }}
      >
        <strong>
          {title}
        </strong>

        <span
          style={{
            color:
              status.toLowerCase() ===
              "approved"
                ? "#32d583"
                : "#ff8a3d",

            fontSize:
              "11px",

            fontWeight:
              900,

            textTransform:
              "uppercase",
          }}
        >
          {status}
        </span>
      </div>

      <div
        style={{
          color: "#777",
          fontSize: "13px",
          marginTop: "5px",
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          color: "#555",
          fontSize: "11px",
          marginTop: "5px",
        }}
      >
        {date}
      </div>
    </div>
  );
}

function EmptyActivity({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        color: "#666",
        padding:
          "20px 0",
      }}
    >
      {text}
    </div>
  );
}