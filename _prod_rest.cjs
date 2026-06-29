// TEMP: prod PostgREST access via service-role key (reads/writes data; cannot do DDL).
const fs = require('node:fs');
const ENV_FILE = '.env.vercel-production.live';
const MODE = process.argv[2] || 'read';

const MAPPING = {
  'the-old-crown-girton': 'Sub',
  'the-queen-elizabeth-kings-lynn': 'Diwakar',
  'the-bell': 'Purna',
  'the-corner-house-pub-cambridge': 'Sub',
  'the-old-school-house': 'San',
  'the-railway-pub': 'Ravi',
  'white-horse-pub-waterbeach': 'Sub',
};

function get(k) {
  for (const l of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const i = l.indexOf('=');
    if (i > -1 && l.slice(0, i).trim() === k) {
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return v;
    }
  }
  return null;
}

(async () => {
  const base = get('NEXT_PUBLIC_SUPABASE_URL');
  const key = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) throw new Error('missing supabase url/service key');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  if (MODE === 'check') {
    const res = await fetch(`${base}/rest/v1/restaurants?select=slug,manager_name&limit=1`, { headers });
    console.log('GET manager_name status:', res.status);
    console.log('body:', (await res.text()).slice(0, 600));
    return;
  }

  if (MODE === 'read') {
    const res = await fetch(`${base}/rest/v1/restaurants?select=slug,name&order=name`, { headers });
    console.log('status', res.status);
    const rows = await res.json();
    if (!Array.isArray(rows)) { console.log(JSON.stringify(rows)); return; }
    console.log(`${rows.length} restaurants:`);
    for (const r of rows) console.log(`  ${r.slug}  ::  ${r.name}`);
    console.log('\nMapping check:');
    for (const slug of Object.keys(MAPPING)) {
      const hit = rows.find((r) => r.slug === slug);
      console.log(`  ${hit ? 'OK  ' : 'MISS'} ${slug} -> ${MAPPING[slug]}${hit ? ` (${hit.name})` : ''}`);
    }
    return;
  }

  if (MODE === 'apply') {
    // Sets manager_name per slug via PostgREST PATCH. Requires the column to already exist.
    for (const [slug, name] of Object.entries(MAPPING)) {
      const res = await fetch(
        `${base}/rest/v1/restaurants?slug=eq.${encodeURIComponent(slug)}`,
        { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ manager_name: name }) },
      );
      const body = await res.json().catch(() => null);
      const n = Array.isArray(body) ? body.length : 0;
      console.log(`  ${res.status} ${n === 0 ? 'MISS' : 'OK'} ${slug} -> ${name} (rows=${n})`);
    }
    const verify = await fetch(`${base}/rest/v1/restaurants?select=slug,name,manager_name&order=name`, { headers });
    console.log('\nVerification:');
    for (const r of await verify.json()) console.log(`  ${r.manager_name ?? '(none)'}  <-  ${r.slug}  ::  ${r.name}`);
    return;
  }

  throw new Error(`unknown mode ${MODE}`);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
