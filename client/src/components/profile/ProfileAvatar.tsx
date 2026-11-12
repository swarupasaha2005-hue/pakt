import { Avatar } from "@/components/ui/Avatar";

/** uploaded photo if set, else the default gradient avatar */
export function ProfileAvatar({ account, src, size }: { account: string; src: string; size: number }) {
  if (!src) return <Avatar name={account} size={size} />;
  return (
    <span
      role="img"
      aria-label={account}
      className="inline-block shrink-0 rounded-full bg-cover bg-center"
      style={{ width: size, height: size, backgroundImage: `url(${src})` }}
    />
  );
}
