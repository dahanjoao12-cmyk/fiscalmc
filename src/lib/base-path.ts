/**
 * Single source of truth for the app's basePath. next.config.ts reads this
 * for the framework-level setting; anything that references a public/
 * static asset by absolute path (metadata icons, manifest, next/image src,
 * service worker registration) must prefix it manually — Next.js only
 * applies basePath automatically to next/link and next/navigation routing.
 */
export const BASE_PATH = "/emissor";
