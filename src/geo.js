const R = 6378137; // jari-jari bumi (m)
const rad = (d) => (d * Math.PI) / 180;

function ringAreaM2(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    s += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs((s * R * R) / 2);
}

// Luas poligon GeoJSON (cincin luar dikurangi lubang) dalam hektare.
export function areaHa(geometry) {
  const [outer, ...holes] = geometry.coordinates;
  const m2 = ringAreaM2(outer) - holes.reduce((a, h) => a + ringAreaM2(h), 0);
  return Math.max(0, m2) / 10000;
}

// Titik tengah sederhana [lon, lat] dari cincin luar.
export function centroid(geometry) {
  const r = geometry.coordinates[0].slice(0, -1);
  return [
    r.reduce((a, p) => a + p[0], 0) / r.length,
    r.reduce((a, p) => a + p[1], 0) / r.length,
  ];
}
