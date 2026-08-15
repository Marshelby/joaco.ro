export function getGoogleMapsLocationUrl(latitude: number | null, longitude: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
