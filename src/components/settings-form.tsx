"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export function SettingsForm({ user }: { user: CurrentUser }) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    const body: { name?: string; currentPassword?: string; newPassword?: string } = {};
    if (name.trim() && name.trim() !== user.name) body.name = name.trim();
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }
    if (!body.name && !body.newPassword) {
      toast.error("Change your name or password");
      setPending(false);
      return;
    }
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      toast.error(payload?.error || "Profile could not be updated");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Profile updated");
  };

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update the name and password on your PayTrack account.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{user.email}</CardTitle>
          <CardDescription>{ROLE_LABELS[user.role]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1 text-sm">
              Name
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Current password
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              New password
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
