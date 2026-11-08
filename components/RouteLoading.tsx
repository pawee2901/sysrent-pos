/** Shown immediately while the next page loads, so a tap always gets a response */
export function RouteLoading() {
  return <div className="route-loading" role="status" aria-label="Loading"><div className="pl-spin" /></div>;
}
