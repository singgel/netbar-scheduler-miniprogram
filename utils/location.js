function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(from, to) {
  const earthRadius = 6371000;
  const lat1 = toRadians(Number(from.latitude));
  const lat2 = toRadians(Number(to.latitude));
  const deltaLat = toRadians(Number(to.latitude) - Number(from.latitude));
  const deltaLng = toRadians(Number(to.longitude) - Number(from.longitude));
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

function matchNearestStore(location, stores) {
  const activeStores = stores.filter((store) => store.status !== 'disabled');
  if (!location || !activeStores.length) return null;
  return activeStores
    .map((store) => ({
      ...store,
      distance: distanceMeters(location, store),
      inRange: distanceMeters(location, store) <= Number(store.checkinRadius || 200)
    }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

module.exports = {
  distanceMeters,
  matchNearestStore
};
