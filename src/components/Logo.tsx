export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  // Plain <img>: the source asset is an oversized 8001x3639 canvas with a lot
  // of transparent padding — letting the browser read its real intrinsic
  // ratio (via object-contain) avoids the distortion a guessed width/height
  // pair on next/image produced.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logo-fatec-branca.png"
      alt="Fatec Ivaiporã"
      className={`${className} object-contain`}
    />
  );
}
