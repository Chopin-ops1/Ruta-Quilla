const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

async function test(query) {
  const params = new URLSearchParams({
    q: `${query}, Barranquilla, Colombia`,
    format: 'json',
    addressdetails: '1',
    limit: '1',
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { 'Accept-Language': 'es', 'User-Agent': 'RutaQuilla/1.0' },
  });

  const data = await res.json();
  console.log(`Query: ${query} =>`, data.length > 0 ? data[0].display_name : 'NOT FOUND');
}

async function run() {
  await test('calle 63b #38-15');
  await test('calle 63b 38-15');
  await test('calle 63b 38 15');
  await test('calle 63b con carrera 38');
}
run();
