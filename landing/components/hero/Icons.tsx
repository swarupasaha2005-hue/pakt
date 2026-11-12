import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

export function ArrowRight(props: Props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

export function MenuIcon({ open, ...props }: Props & { open: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" {...props}>{open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>;
}

export function GithubIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.924c.563.104.769-.244.769-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.79-1.51-3.79-1.51-.512-1.3-1.25-1.646-1.25-1.646-1.023-.7.078-.686.078-.686 1.132.08 1.728 1.162 1.728 1.162 1.006 1.724 2.64 1.226 3.283.937.102-.728.393-1.226.715-1.508-2.499-.284-5.126-1.25-5.126-5.565 0-1.23.44-2.233 1.16-3.02-.116-.284-.503-1.43.11-2.98 0 0 .944-.302 3.094 1.154A10.8 10.8 0 0 1 12 6.177c.956.005 1.919.13 2.817.38 2.148-1.456 3.09-1.154 3.09-1.154.615 1.55.228 2.696.112 2.98.722.787 1.159 1.79 1.159 3.02 0 4.326-2.63 5.278-5.137 5.557.404.35.765 1.04.765 2.096 0 1.514-.014 2.736-.014 3.107 0 .3.203.65.774.54A11.251 11.251 0 0 0 12 .75Z" /></svg>;
}

export function XIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-7.42L5.58 22H2.45l8.16-9.32L2.8 2h6.4l4.43 6.77L18.9 2Zm-1.1 18h1.73L8.26 3.88H6.4L17.8 20Z" /></svg>;
}

export function DiscordIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52l-.6 1.23a18.28 18.28 0 0 0-5.66 0l-.6-1.23a19.8 19.8 0 0 0-4.89 1.52C.59 8.94-.25 13.4.17 17.8a19.9 19.9 0 0 0 6 3.05l1.23-2a12.7 12.7 0 0 1-1.94-.93l.48-.38c3.76 1.72 8.36 1.72 12.12 0l.48.38c-.62.36-1.27.67-1.94.93l1.23 2a19.9 19.9 0 0 0 6-3.05c.5-5.1-.86-9.53-3.51-13.43ZM8.02 15.16c-1.13 0-2.06-1.03-2.06-2.3 0-1.27.91-2.3 2.06-2.3 1.15 0 2.08 1.04 2.06 2.3 0 1.27-.91 2.3-2.06 2.3Zm7.96 0c-1.13 0-2.06-1.03-2.06-2.3 0-1.27.91-2.3 2.06-2.3 1.15 0 2.08 1.04 2.06 2.3 0 1.27-.91 2.3-2.06 2.3Z" /></svg>;
}
