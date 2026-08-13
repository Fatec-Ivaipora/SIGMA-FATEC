import { Logo } from "@/components/Logo";

export function LogoLockup({
  logoClassName = "h-12 w-auto",
  wordmarkClassName = "text-xl",
}: {
  logoClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Logo className={logoClassName} />
      <span aria-hidden className="h-8 w-px bg-white/20" />
      <span
        className={`font-bold tracking-[-0.01em] text-white ${wordmarkClassName}`}
      >
        FatecLab
      </span>
    </div>
  );
}
