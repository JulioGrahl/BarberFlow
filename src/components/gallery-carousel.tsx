"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Img = { id: string; url: string; caption: string | null };

// Carrossel simples: rolagem horizontal com encaixe (funciona com o dedo) e setas no computador.
export function GalleryCarousel({ images }: { images: Img[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(280, ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative">
      <ul ref={ref} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Galeria de trabalhos">
        {images.map((im) => (
          <li key={im.id} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[30%]">
            <figure>
              <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-night-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={im.caption ?? "Trabalho da barbearia"} loading="lazy" className="size-full object-cover" />
              </div>
              {im.caption ? <figcaption className="mt-2 text-sm text-muted">{im.caption}</figcaption> : null}
            </figure>
          </li>
        ))}
      </ul>
      {images.length > 1 ? (
        <div className="mt-3 hidden justify-end gap-2 md:flex">
          <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="flex size-11 items-center justify-center rounded-full border border-line-strong hover:bg-surface"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => go(1)} aria-label="Próxima" className="flex size-11 items-center justify-center rounded-full border border-line-strong hover:bg-surface"><ChevronRight size={20} /></button>
        </div>
      ) : null}
    </div>
  );
}
