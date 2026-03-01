"use client";

import dynamic from "next/dynamic";

const ShaderCanvas = dynamic(() => import("./ShaderCanvas"), { ssr: false });

export default function ClientScene() {
  return <ShaderCanvas />;
}
