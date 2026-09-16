/** Only allow the approved Shop Finder destinations; never redirect to an external URL. */
export function shopFinderReturnPath(search) {
  const requested = new URLSearchParams(search).get('next');
  return ['/shop-finder/list-your-shop', '/shop-finder/review', '/shop-finder/dashboard'].includes(requested)
    ? requested
    : '/account';
}
