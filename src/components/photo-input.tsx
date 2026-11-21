"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

const MAX = 1200;

// Escolhe uma foto, reduz no navegador (máx. 1200 px, JPEG) e a envia junto com o formulário.
// Fotos de celular têm vários MB; reduzir antes deixa o envio rápido e barato.
export function PhotoInput({ currentUrl, shape = "square", label = "Foto" }: { currentUrl?: string | null; shape?: "round" | "square"; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
      if (!blob) throw new Error("x");
      const out = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer(); dt.items.add(out);
      if (input.current) input.current.files = dt.files;
      setPreview(URL.createObjectURL(out)); setRemoved(false);
    } catch {
      setErr("Não consegui ler essa imagem. Use JPG, PNG ou WebP.");
      if (input.current) input.current.value = "";
    }
  }

  const rounded = shape === "round" ? "rounded-full" : "rounded-xl";
  return (
    <div>
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <div className="flex items-center gap-4">
        <div className={`flex size-24 shrink-0 items-center justify-center overflow-hidden border border-line-strong bg-surface-2 text-muted ${rounded}`}>
          {preview && !removed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : <ImagePlus size={28} aria-hidden />}
        </div>
        <div className="space-y-2">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong px-3.5 text-sm font-medium hover:bg-surface-2">
            <ImagePlus size={16} aria-hidden />{preview && !removed ? "Trocar foto" : "Escolher foto"}
          </button>
          {preview && !removed ? (
            <button type="button" onClick={() => { setRemoved(true); if (input.current) input.current.value = ""; }} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-danger hover:bg-danger-bg">
              <Trash2 size={15} aria-hidden />Remover foto
            </button>
          ) : null}
        </div>
      </div>
      <input ref={input} type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="sr-only" tabIndex={-1} />
      {removed ? <input type="hidden" name="remove_photo" value="1" /> : null}
      {err ? <p role="alert" className="mt-2 text-sm text-danger">{err}</p> : null}
    </div>
  );
}
