"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const audienceSections = [
  { slug: "turnos", label: "Turno a turno" },
  { slug: "argumentacao", label: "Tipo de argumentação" },
] as const;

export function AudienceNav({ id }: { id: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Análises da audiência" className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-5 backdrop-blur lg:px-8">
      <div className="mx-auto max-w-[1200px] overflow-x-auto">
        <div className="flex min-w-max gap-1">
          {audienceSections.map((section) => {
            const href = `/audiencias/${id}/${section.slug}`;
            const active = pathname === href;
            return (
              <Link key={section.slug} href={href} aria-current={active ? "page" : undefined} className={`relative px-4 py-3 text-sm font-medium transition ${active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800"}`}>
                {section.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-orange-500"/>}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
