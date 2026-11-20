import type { NextConfig } from "next";
import { BUCKET_IMAGEN_PRODUCTO } from "./src/lib/product-image";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl ? [new URL(`/storage/v1/object/public/${BUCKET_IMAGEN_PRODUCTO}/**`, supabaseUrl)] : [],
    qualities: [75, 85],
  },
};

export default nextConfig;
