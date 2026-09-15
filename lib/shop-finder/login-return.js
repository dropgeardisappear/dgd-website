/** Only allow the two Shop Finder destinations; never redirect to an external URL. */
export function shopFinderReturnPath(search) {
  const requested = new URLSearchParams(search).get('next');
  return ['/shop-finder/list-your-shop', '/shop-finder/review'].includes(requested)
    ? requested
    : '/account';
}
