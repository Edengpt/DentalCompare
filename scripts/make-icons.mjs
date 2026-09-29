// Renders src/app/icon.svg into the raster icons browsers and phones ask for.
// Edit the SVG, then run from the app folder: node scripts/make-icons.mjs
import fs from "node:fs";
import sharp from "sharp";

const svg = fs.readFileSync("src/app/icon.svg");
const render = (size) =>
  sharp(svg, { density: 72 * (size / 32) * 2 })
    .resize(size, size)
    .png()
    .toBuffer();

// iOS draws its own rounded mask and shows transparency as black, so the
// home-screen icon is a full-bleed navy square with the tooth inset.
const fullBleed = (size) => {
  const s = fs.readFileSync("src/app/icon.svg", "utf8").replace('rx="7"', 'rx="0"');
  return sharp(Buffer.from(s), { density: 72 * (size / 32) * 2 })
    .resize(size, size)
    .png()
    .toBuffer();
};

// ICO with embedded PNGs (supported by every current browser).
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

await (async () => {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(async (size) => ({ size, buf: await render(size) })));
  fs.writeFileSync("src/app/favicon.ico", ico(pngs));
  fs.writeFileSync("src/app/apple-icon.png", await fullBleed(180));
  fs.mkdirSync("public/icons", { recursive: true });
  fs.writeFileSync("public/icons/icon-192.png", await render(192));
  fs.writeFileSync("public/icons/icon-512.png", await render(512));
  fs.writeFileSync("public/icons/icon-maskable-512.png", await fullBleed(512));
  console.log("ok");
})();
