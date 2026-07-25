export function requestedLocation(location: Pick<Location, 'pathname' | 'search' | 'hash'>) {
  return `${location.pathname}${location.search}${location.hash}`;
}
