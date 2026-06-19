// build.js — Genera le pagine personalizzate dei dipendenti.
// Zero dipendenze esterne, usa solo Node std lib.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');

// ───── Helpers ─────

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function monogramFrom(fullName) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function render(template, data) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = data[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function photoExists(slug) {
  const p = path.join(PUBLIC_DIR, 'photos', `${slug}.jpg`);
  return fs.existsSync(p) ? p : null;
}

function photoAsBase64(filepath) {
  const buf = fs.readFileSync(filepath);
  return buf.toString('base64');
}

// vCard PHOTO field requires line folding at 75 chars (RFC 6350)
function foldVCardLine(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75));
    i += 75;
  }
  return chunks.join('\r\n ');
}

// ───── Build pieces per-employee ─────

function buildCenterBlock(employee, photoFile) {
  if (photoFile) {
    return [
      `<defs><clipPath id="centerClip"><circle cx="140" cy="140" r="50"/></clipPath></defs>`,
      `<image href="../photos/${employee.slug}.jpg" x="90" y="90" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#centerClip)"/>`,
      `<circle cx="140" cy="140" r="50" fill="none" stroke="var(--ink)" stroke-opacity="0.15" stroke-width="1"/>`
    ].join('\n        ');
  }
  const mono = employee.monogram || monogramFrom(employee.name);
  return [
    `<circle class="med-core" cx="140" cy="140" r="50"/>`,
    `<text class="med-mono" x="140" y="140" text-anchor="middle" dominant-baseline="central">${mono}</text>`
  ].join('\n        ');
}

function buildContactRows(employee) {
  const rows = [];
  const arrow = `<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  function row(key, label, href, display) {
    return `      <a class="row" href="${href}"${key === 'tel' || key === 'email' ? '' : ' target="_blank" rel="noopener"'}>
        <span class="key">${label}</span>
        <span class="val">${display}</span>
        ${arrow}
      </a>`;
  }

  if (employee.phone) {
    const formatted = employee.phone.replace(/^(\+\d{2})(\d{3})(\d{3})(\d{4,})$/, '$1 $2 $3 $4');
    rows.push(row('tel', 'Tel', `tel:${employee.phone}`, formatted));
  }
  if (employee.email) {
    rows.push(row('email', 'Email', `mailto:${employee.email}`, employee.email));
  }
  if (employee.site) {
    const display = employee.site.replace(/^https?:\/\/(www\.)?/, '');
    rows.push(row('web', 'Web', employee.site, display));
  }
  if (employee.linkedin) {
    const handle = employee.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com/, '');
    rows.push(row('linkedin', 'LinkedIn', employee.linkedin, handle));
  }
  if (employee.instagram) {
    const handle = employee.instagram.replace(/^https?:\/\/(www\.)?instagram\.com/, '');
    rows.push(row('instagram', 'Instagram', employee.instagram, handle));
  }
  return rows.join('\n');
}

function buildExtraFields(employee, photoFile) {
  const lines = [];
  if (employee.linkedin) lines.push(`URL;TYPE=LinkedIn:${employee.linkedin}`);
  if (employee.instagram) lines.push(`URL;TYPE=Instagram:${employee.instagram}`);
  if (employee.address) lines.push(`ADR;TYPE=WORK:;;${employee.address.street || ''};${employee.address.city || ''};;${employee.address.zip || ''};${employee.address.country || 'Italia'}`);
  if (photoFile) {
    const b64 = photoAsBase64(photoFile);
    lines.push(foldVCardLine(`PHOTO;ENCODING=b;TYPE=JPEG:${b64}`));
  }
  return lines.join('\r\n');
}

// ───── Main build ─────

function main() {
  console.log('▸ Reading sources…');
  const brand = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'brand.json'), 'utf-8'));
  const employees = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'employees.json'), 'utf-8'));
  const htmlTpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf-8');
  const vcfTpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'card.vcf'), 'utf-8');

  if (fs.existsSync(DIST_DIR)) fs.rmSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  console.log('▸ Copying public assets…');
  copyDir(PUBLIC_DIR, DIST_DIR);

  console.log(`▸ Building ${employees.length} contact pages…`);
  let withPhoto = 0;
  for (const emp of employees) {
    const slug = emp.slug || slugify(emp.name);
    const parts = emp.name.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const photoFile = photoExists(slug);
    if (photoFile) withPhoto++;

    const data = {
      // brand
      brandName: brand.brandName,
      brandSite: brand.brandSite,
      brandAccent: brand.brandAccent,
      brandAccentDark: brand.brandAccentDark || brand.brandAccent,

      // person
      slug,
      name: emp.name,
      firstName,
      lastName,
      role: emp.role || '',
      org: emp.org || brand.defaultOrg || brand.brandName,
      phone: emp.phone || '',
      email: emp.email || '',
      site: emp.site || brand.brandSite,

      // derived
      centerBlock: buildCenterBlock({ ...emp, slug }, photoFile),
      contactRows: buildContactRows(emp),
      extraFields: buildExtraFields(emp, photoFile)
    };

    const empDir = path.join(DIST_DIR, slug);
    fs.mkdirSync(empDir, { recursive: true });
    fs.writeFileSync(path.join(empDir, 'index.html'), render(htmlTpl, data));
    // vCard uses CRLF line endings (RFC 6350)
    const vcfOut = render(vcfTpl, data).replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(path.join(empDir, 'card.vcf'), vcfOut);
  }

  // Root index: neutral landing (no employee enumeration)
  const rootIndex = `<!doctype html><meta charset="utf-8"><title>${brand.brandName}</title><meta http-equiv="refresh" content="0;url=${brand.brandSite}"><p>Redirecting to <a href="${brand.brandSite}">${brand.brandSite}</a>…</p>`;
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), rootIndex);

  // robots.txt
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

  console.log(`✓ Built ${employees.length} pages (${withPhoto} with photo) → dist/`);
}

main();
