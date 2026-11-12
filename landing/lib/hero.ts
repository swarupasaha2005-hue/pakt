const repository = "https://github.com/swarupasaha2005-hue/pakt";
const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const heroLinks = [
  { label: "Open the demo", href: new URL("/", appOrigin).href },
  { label: "Trade solo", href: new URL("/token/NEAR", appOrigin).href },
  { label: "View the code", href: repository },
];

export const navigation = [
  { label: "About", href: `${repository}#readme` },
  { label: "Ecosystem", href: new URL("/", appOrigin).href },
  { label: "Build", href: `${repository}/tree/staging/p2/contracts` },
  { label: "Governance", href: `${repository}/issues/25` },
];
