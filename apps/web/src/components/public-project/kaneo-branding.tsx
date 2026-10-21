import { useTranslation } from "react-i18next";
import { brand } from "@/brand";

export function KaneoBranding() {
  const { t } = useTranslation();

  if (!brand.upstreamLinks) return null;

  return (
    <a
      href="https://kaneo.app"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-foreground transition-colors"
    >
      {t("publicProject:branding.poweredBy")}{" "}
      <span className="font-medium">{t("common:appName")}</span>
    </a>
  );
}
