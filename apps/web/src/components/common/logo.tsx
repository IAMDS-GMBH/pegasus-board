import { Link } from "@tanstack/react-router";
import { brand } from "@/brand";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  const { setProject } = useProjectStore();

  return (
    <Link
      onClick={() => {
        setProject(undefined);
      }}
      to="/dashboard"
      className={`w-auto ${className}`}
    >
      <img
        src={brand.logo.onLight}
        alt={brand.name}
        className={`${brand.logo.heightClassName} w-auto dark:hidden`}
      />
      <img
        src={brand.logo.onDark}
        alt={brand.name}
        className={`hidden ${brand.logo.heightClassName} w-auto dark:block`}
      />
    </Link>
  );
}
