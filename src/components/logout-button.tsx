"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      toast.error("Unable to sign out");
      return;
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <Button variant="outline" size="sm" onClick={logout}>
      Log out
    </Button>
  );
}
