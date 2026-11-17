import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import useGetConfig from "@/hooks/queries/config/use-get-config";

// Pegasus fork (PEGA-80): the Pegasus Hub mails card notifications and owns
// each user's notification settings, so this page only hands over to the Hub
// (`PEGASUS_NOTIFICATION_SETTINGS_URL`). `components/settings/notifications`
// stays as upstream ships it; nothing reaches it anymore.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/notifications",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: config, isPending } = useGetConfig();
  const hubUrl = config?.notificationSettingsUrl ?? null;

  useEffect(() => {
    if (hubUrl) window.location.replace(hubUrl);
  }, [hubUrl]);

  if (isPending || hubUrl) return null;
  return <Navigate to="/dashboard/settings/account/information" replace />;
}
