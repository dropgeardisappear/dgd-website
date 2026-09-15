import type { Metadata } from "next";
import "./finder.css";
export const metadata: Metadata = {
  title: "Shop Finder | Drop Gear Disappear",
  description:
    "Find local shops for your car, truck, or motorcycle. Search services, locations, and specialties.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="finder-surface">{children}</div>;
}
