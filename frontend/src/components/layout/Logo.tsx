/* eslint-disable @next/next/no-img-element -- two tiny static images swapped by theme via CSS */

/** MiLife wordmark. The light/dark versions swap with the theme using CSS only. */
export default function Logo({ className = "h-12" }: { className?: string }) {
  return (
    <>
      <img src="/logo-light.png" alt="miLife Insurance" className={`${className} w-auto dark:hidden`} />
      <img src="/logo-dark.png" alt="miLife Insurance" className={`${className} hidden w-auto dark:block`} />
    </>
  );
}
