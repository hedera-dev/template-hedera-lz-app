import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/bridge" className="btn btn-primary">
        Go to bridge
      </Link>
    </div>
  );
}
