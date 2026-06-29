import { Iframe } from 'nabatable-platform';

const confirmationHtml = `
<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#ffffff;color:#0a0a0a}
  .wrap{padding:20px}
  .badge{display:inline-block;background:#1447E6;color:#fff;font-size:11px;font-weight:600;
    padding:3px 10px;border-radius:999px;letter-spacing:.02em}
  h1{font-size:18px;margin:12px 0 4px}
  .muted{color:#6b7280;font-size:13px;margin:0}
  .row{display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0}
  .row b{font-variant-numeric:tabular-nums}
</style></head><body><div class="wrap">
  <span class="badge">CONFIRMED</span>
  <h1>The Crown · Saturday booking</h1>
  <p class="muted">Reference NBT-4827-PH</p>
  <div style="margin-top:14px">
    <div class="row"><span>Guest</span><b>Priya Nair</b></div>
    <div class="row"><span>Party size</span><b>4 covers</b></div>
    <div class="row"><span>Time</span><b>Sat 8:00 PM</b></div>
    <div class="row"><span>Table</span><b>Table 12 · Window</b></div>
  </div>
</div></body></html>`;

const menuHtml = `
<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#fafafa;color:#0a0a0a;padding:18px}
  h2{font-size:15px;margin:0 0 10px;color:#1447E6}
  .item{display:flex;justify-content:space-between;font-size:13px;padding:6px 0}
  .item span:last-child{font-variant-numeric:tabular-nums;color:#374151}
</style></head><body>
  <h2>Sunday Roast · Set Menu</h2>
  <div class="item"><span>Roast sirloin of beef</span><span>£21</span></div>
  <div class="item"><span>Slow-cooked pork belly</span><span>£19</span></div>
  <div class="item"><span>Wild mushroom wellington</span><span>£17</span></div>
  <div class="item"><span>Sticky toffee pudding</span><span>£8</span></div>
</body></html>`;

export const ConfirmationEmbed = () => (
  <Iframe
    title="Booking confirmation — The Crown"
    srcDoc={confirmationHtml}
    className="w-80 h-72 rounded-lg border"
  />
);

export const MenuEmbed = () => (
  <Iframe
    title="Sunday roast set menu"
    srcDoc={menuHtml}
    className="w-72 h-60 rounded-lg border"
  />
);

export const TitledFrame = () => (
  <div className="w-80 flex flex-col gap-2">
    <span className="text-sm font-medium">Live floor-plan preview</span>
    <Iframe
      title="Floor plan live preview"
      srcDoc='<!doctype html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100%;font-family:system-ui,sans-serif;color:#6b7280;font-size:13px;background:#f5f5f5">Connecting to The Crown live service…</body>'
      className="w-full h-40 rounded-lg border"
    />
  </div>
);
