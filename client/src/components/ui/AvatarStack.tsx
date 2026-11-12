import { Avatar } from "./Avatar";

/** overlapping 16px avatars, first 3 names */
export function AvatarStack({ names }: { names: string[] }) {
  return (
    <span className="flex -space-x-2">
      {names.slice(0, 3).map((n) => (
        <span key={n} className="flex rounded-full ring-2 ring-panel">
          <Avatar name={n} size={16} />
        </span>
      ))}
    </span>
  );
}
