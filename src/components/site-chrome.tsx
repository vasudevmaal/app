"use client";

import { usePathname } from "next/navigation";
import { DesignChrome } from "./design-chrome";
import { BackToTop, Footer, Header } from "./shell";

export function SiteChrome({ position }: { position: "header" | "footer" }) {
  const pathname = usePathname();
  const isVisualEditor =
    pathname.startsWith("/visual/") && pathname.endsWith("/edit");
  if (isVisualEditor) return null;
  return (
    <DesignChrome>
      {position === "header" ? <Header /> : <><Footer /><BackToTop /></>}
    </DesignChrome>
  );
}
