import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ProfileSettingsForm } from "@/components/profile-settings-form";

interface ProfileView {
  handle: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  totpEnabled: boolean;
  memberSince: string;
}

export function SettingsPage() {
  const { data, isLoading } = useQuery<ProfileView>({
    queryKey: ["views", "settings"],
    queryFn: () => api("/api/views/settings"),
  });

  if (isLoading || !data) {
    return <p className="py-8 text-center text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">Loading profile...</p>;
  }

  return <ProfileSettingsForm profile={data} />;
}
