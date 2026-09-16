/** Only allow the approved Shop Finder destinations; never redirect to an external URL. */
export function shopFinderReturnPath(search) {
  const requested = new URLSearchParams(search).get('next');
  if (isShopProfilePath(requested)) return requested;
  return ['/shop-finder/list-your-shop', '/shop-finder/review', '/shop-finder/dashboard'].includes(requested)
    ? requested
    : '/account';
}

export function isShopProfilePath(path) {
  return typeof path === "string" && /^\/shop-finder\/shops\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
}
