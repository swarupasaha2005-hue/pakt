const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const appRoute = (path: string) => new URL(path, appOrigin).href;

export const launchAppHref = appRoute("/");
export type LandingNavigationItem = { label: string; href: string };
export const landingNavigation: LandingNavigationItem[] = [
  { label: "How It Works", href: "#editorial" },
  { label: "Pools", href: "#pools" },
  { label: "Governance", href: "#governance" },
];

export const heroLinks = [
  { label: "Open the demo", href: launchAppHref },
  { label: "Trade solo", href: appRoute("/token/NEAR") },
];
