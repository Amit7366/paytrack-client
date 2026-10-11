"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const dark = ready && resolvedTheme === "dark";

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? "Light" : "Dark"}
    </Button>
  );
}
