// URL pública de uma imagem do bucket "shop-media" (fotos da equipe e dos produtos).
export const mediaUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop-media/${path}` : null;
