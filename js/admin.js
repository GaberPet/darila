// ===== Urejanje seznama (samo zame) =====
//
// Kako deluje:
// Stran je na GitHub Pages, zato nima svojega strežnika. Ko dodam darilo,
// ga stran shrani naravnost v moj GitHub repozitorij (datoteka podatki/darila.json).
// Za to potrebuje GitHub ključ (token). Ključ je v nastavitve.json shranjen
// ZAKLENJEN z mojim geslom (AES-GCM), zato ga brez gesla nihče ne more uporabiti.

let ghKljuc = null;          // odklenjen GitHub ključ (samo v tem zavihku)
let glavnaVeja = 'main';

const okno = () => $('okno-admin');
const vsebinaOkna = () => $('vsebina-admin');


// ===== šifriranje ključa z geslom =====

function vBase64(bajti) {
  let s = '';
  new Uint8Array(bajti).forEach(b => s += String.fromCharCode(b));
  return btoa(s);
}

function izBase64(niz) {
  return Uint8Array.from(atob(niz), c => c.charCodeAt(0));
}

async function kljucIzGesla(geslo, sol) {
  const osnova = await crypto.subtle.importKey('raw', new TextEncoder().encode(geslo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sol, iterations: 300000, hash: 'SHA-256' },
    osnova, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function zakleni(besedilo, geslo) {
  const sol = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kljuc = await kljucIzGesla(geslo, sol);
  const sifrirano = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kljuc, new TextEncoder().encode(besedilo));
  return { sol: vBase64(sol), iv: vBase64(iv), podatki: vBase64(sifrirano) };
}

// če je geslo napačno, vrže napako
async function odkleni(zaklenjeno, geslo) {
  const kljuc = await kljucIzGesla(geslo, izBase64(zaklenjeno.sol));
  const odsifrirano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: izBase64(zaklenjeno.iv) }, kljuc, izBase64(zaklenjeno.podatki));
  return new TextDecoder().decode(odsifrirano);
}


// ===== GitHub =====

function repo() {
  const gh = nastavitve.github || {};
  return gh.uporabnik + '/' + gh.repozitorij;
}

async function github(pot, moznosti = {}, kljuc = ghKljuc, repozitorij = repo()) {
  const odgovor = await fetch('https://api.github.com/repos/' + repozitorij + pot, {
    ...moznosti,
    cache: 'no-store',
    headers: {
      'Authorization': 'Bearer ' + kljuc,
      'Accept': 'application/vnd.github+json',
      ...(moznosti.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (!odgovor.ok) {
    const napaka = new Error('GitHub napaka ' + odgovor.status);
    napaka.status = odgovor.status;
    throw napaka;
  }
  return odgovor.status === 204 ? null : odgovor.json();
}

function besediloVBase64(besedilo) {
  return vBase64(new TextEncoder().encode(besedilo));
}

async function preberiDatoteko(pot) {
  const podatki = await github('/contents/' + pot + '?ref=' + glavnaVeja);
  const besedilo = new TextDecoder().decode(izBase64(podatki.content.replace(/\n/g, '')));
  return { besedilo, sha: podatki.sha };
}

async function shraniDatoteko(pot, vsebinaBase64, sporocilo, sha) {
  return github('/contents/' + pot, {
    method: 'PUT',
    body: JSON.stringify({ message: sporocilo, content: vsebinaBase64, branch: glavnaVeja, ...(sha ? { sha } : {}) })
  });
}

// prebere najnovejšo datoteko, jo spremeni in shrani nazaj
async function spremeniJson(pot, spremeni, sporocilo) {
  const { besedilo, sha } = await preberiDatoteko(pot);
  const podatki = JSON.parse(besedilo);
  const novo = spremeni(podatki);
  await shraniDatoteko(pot, besediloVBase64(JSON.stringify(novo, null, 2) + '\n'), sporocilo, sha);
  return novo;
}

function sporociloNapake(e) {
  if (e.status === 401) return 'GitHub ključ ne deluje več (morda je potekel). Nastavi novega.';
  if (e.status === 403) return 'GitHub ključ nima dovoljenja za to. Preveri nastavitve ključa.';
  if (e.status === 404) return 'Ne najdem repozitorija. Preveri uporabniško ime in ime repozitorija.';
  if (e.status === 409) return 'Nekaj se je ravno spremenilo. Poskusi še enkrat.';
  return 'Ni šlo: ' + e.message;
}


// ===== prijava =====

function preveriPrijavo() {
  try {
    const shranjen = sessionStorage.getItem('ghKljuc');
    if (shranjen) prijavljen(shranjen);
  } catch (e) { /* nič */ }
}

function prijavljen(kljuc) {
  ghKljuc = kljuc;
  jeAdmin = true;
  try { sessionStorage.setItem('ghKljuc', kljuc); } catch (e) { /* nič */ }
  $('admin-vrstica').hidden = false;
  $('gumb-dodaj').textContent = '➕ Dodaj darilo';
  narisiVse();
  // katera je glavna veja (main ali master)
  github('').then(r => glavnaVeja = r.default_branch).catch(() => {});
}

function odjava() {
  ghKljuc = null;
  jeAdmin = false;
  try { sessionStorage.removeItem('ghKljuc'); } catch (e) { /* nič */ }
  $('admin-vrstica').hidden = true;
  $('gumb-dodaj').textContent = '🔒 Dodaj darilo';
  narisiVse();
  pokaziObvestilo('Odjavljen/a si. 👋');
}

function glavaOkna(naslov) {
  return `<div class="okno-glava"><h2>${naslov}</h2><button class="zapri-x" data-akcija="zapri">✖ Zapri</button></div>`;
}

function pokaziPrijavo() {
  if (!nastavitve.zaklenjenKljuc) return pokaziPrvoNastavitev();

  vsebinaOkna().innerHTML = glavaOkna('🔒 Samo za lastnika seznama') + `
    <form class="okno-telo" id="obrazec-prijava">
      <p>Vpiši geslo, da lahko dodajaš in urejaš darila.</p>
      <div class="polje">
        <label for="geslo">Geslo</label>
        <input type="password" id="geslo" autocomplete="current-password" required>
      </div>
      <p id="napaka-prijava" class="napaka"></p>
      <div class="okno-gumbi">
        <button class="gumb gumb-kupi" type="submit">Vstopi</button>
      </div>
      <p class="namig" style="margin-top:16px"><a href="#" id="nov-kljuc">Nastavi nov GitHub ključ</a> (če je star potekel)</p>
    </form>`;
  okno().showModal();
  $('geslo').focus();

  $('nov-kljuc').addEventListener('click', e => { e.preventDefault(); pokaziPrvoNastavitev(); });
  $('obrazec-prijava').addEventListener('submit', async e => {
    e.preventDefault();
    $('napaka-prijava').textContent = 'Preverjam ... ⏳';
    try {
      const kljuc = await odkleni(nastavitve.zaklenjenKljuc, $('geslo').value);
      okno().close();
      prijavljen(kljuc);
      pokaziObvestilo('Živjo! Zdaj lahko urejaš seznam. ✏️');
    } catch (napaka) {
      $('napaka-prijava').textContent = 'Napačno geslo. Poskusi znova.';
    }
  });
}

// iz naslova strani poskusim uganiti GitHub ime (npr. janez.github.io/darila)
function uganiRepo() {
  const gh = nastavitve.github || {};
  if (gh.uporabnik) return gh;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (!m) return { uporabnik: '', repozitorij: '' };
  const mapa = location.pathname.split('/')[1];
  return { uporabnik: m[1], repozitorij: mapa || m[1] + '.github.io' };
}

function pokaziPrvoNastavitev() {
  const ugib = uganiRepo();
  vsebinaOkna().innerHTML = glavaOkna('⚙️ Nastavitev urejanja') + `
    <form class="okno-telo" id="obrazec-nastavitev">
      <p>To narediš samo enkrat. Potrebuješ GitHub ključ (navodila so v datoteki <b>README.md</b>).</p>
      <div class="polje">
        <label for="n-uporabnik">GitHub uporabniško ime</label>
        <input type="text" id="n-uporabnik" value="${varno(ugib.uporabnik)}" required>
      </div>
      <div class="polje">
        <label for="n-repo">Ime repozitorija</label>
        <input type="text" id="n-repo" value="${varno(ugib.repozitorij)}" required>
      </div>
      <div class="polje">
        <label for="n-kljuc">GitHub ključ (token)</label>
        <input type="password" id="n-kljuc" placeholder="github_pat_..." autocomplete="off" required>
      </div>
      <div class="polje">
        <label for="n-geslo">Geslo za to stran (vsaj 10 znakov)</label>
        <input type="password" id="n-geslo" autocomplete="new-password" minlength="10" required>
        <p class="namig">Izberi dolgo geslo, ki ga ne uporabljaš nikjer drugje.</p>
      </div>
      <div class="polje">
        <label for="n-geslo2">Ponovi geslo</label>
        <input type="password" id="n-geslo2" autocomplete="new-password" required>
      </div>
      <p id="napaka-nastavitev" class="napaka"></p>
      <div class="okno-gumbi">
        <button class="gumb gumb-kupi" type="submit">💾 Shrani in vstopi</button>
      </div>
    </form>`;
  if (!okno().open) okno().showModal();

  $('obrazec-nastavitev').addEventListener('submit', async e => {
    e.preventDefault();
    const napaka = $('napaka-nastavitev');
    const geslo = $('n-geslo').value;
    if (geslo.length < 10) return napaka.textContent = 'Geslo mora imeti vsaj 10 znakov.';
    if (geslo !== $('n-geslo2').value) return napaka.textContent = 'Gesli se ne ujemata.';

    const kljuc = $('n-kljuc').value.trim();
    const github_ = { uporabnik: $('n-uporabnik').value.trim(), repozitorij: $('n-repo').value.trim() };
    napaka.textContent = 'Preverjam ključ ... ⏳';

    try {
      const info = await github('', {}, kljuc, github_.uporabnik + '/' + github_.repozitorij);
      if (!info.permissions || !info.permissions.push) throw Object.assign(new Error('brez pravic'), { status: 403 });
      glavnaVeja = info.default_branch;
      ghKljuc = kljuc;
      nastavitve.github = github_;

      const zaklenjen = await zakleni(kljuc, geslo);
      nastavitve = await spremeniJson('podatki/nastavitve.json', n => ({ ...n, github: github_, zaklenjenKljuc: zaklenjen }), 'Nastavitev urejanja');
      okno().close();
      prijavljen(kljuc);
      pokaziObvestilo('Urejanje je nastavljeno! ✅');
    } catch (err) {
      ghKljuc = null;
      napaka.textContent = sporociloNapake(err);
    }
  });
}


// ===== dodajanje in urejanje daril =====

function obrazecDarila(d) {
  const novo = !d;
  d = d || { zelja: 2, kategorija: 'ostalo', trgovine: [] };
  const moznostiKat = Object.entries(KATEGORIJE).map(([id, k]) =>
    `<option value="${id}" ${id === d.kategorija ? 'selected' : ''}>${k.ikona} ${k.ime}</option>`).join('');
  const moznostiZelje = [3, 2, 1].map(z =>
    `<option value="${z}" ${z == d.zelja ? 'selected' : ''}>${ZELJE[z]}</option>`).join('');
  const slikaJeSplet = /^https?:/.test(d.slika || '');

  vsebinaOkna().innerHTML = glavaOkna(novo ? '➕ Novo darilo' : '✏️ Uredi darilo') + `
    <form class="okno-telo" id="obrazec-darilo">
      <div class="polje">
        <label for="f-ime">Ime darila *</label>
        <input type="text" id="f-ime" value="${varno(d.ime)}" required maxlength="120">
      </div>

      <div class="polje">
        <label for="f-datoteka">Slika</label>
        <input type="file" id="f-datoteka" accept="image/*">
        <p class="namig">Naloži sliko z naprave ali pa spodaj prilepi povezavo do slike.</p>
        <input type="url" id="f-slika-url" placeholder="https://..." value="${slikaJeSplet ? varno(d.slika) : ''}" style="margin-top:6px">
        ${d.slika ? `<img id="f-predogled" class="predogled-slike" src="${varno(zacasneSlike[d.slika] || d.slika)}" alt="">` : '<img id="f-predogled" class="predogled-slike" hidden alt="">'}
      </div>

      <div class="polje">
        <label for="f-cena">Približna cena (€) *</label>
        <input type="number" id="f-cena" min="0" step="0.01" inputmode="decimal" value="${d.cena ?? ''}" required>
      </div>

      <div class="polje">
        <label for="f-kategorija">Vrsta darila</label>
        <select id="f-kategorija">${moznostiKat}</select>
      </div>

      <div class="polje">
        <label for="f-zelja">Kako zelo si ga želim?</label>
        <select id="f-zelja">${moznostiZelje}</select>
      </div>

      <div class="polje">
        <label for="f-povezava">Povezava do spletne trgovine</label>
        <input type="url" id="f-povezava" placeholder="https://..." value="${varno(d.povezava)}">
      </div>

      <div class="polje">
        <label for="f-trgovina">Ime spletne trgovine</label>
        <input type="text" id="f-trgovina" placeholder="npr. Mimovrste, Big Bang" value="${varno(d.trgovina)}">
      </div>

      <div class="polje">
        <label for="f-trgovine">Trgovine v živo (vsaka v svojo vrstico)</label>
        <textarea id="f-trgovine" placeholder="Big Bang, BTC Ljubljana&#10;Hervis, Citypark Ljubljana">${varno((d.trgovine || []).join('\n'))}</textarea>
      </div>

      <div class="polje">
        <label for="f-opis">Opis (velikost, barva, podrobnosti ...)</label>
        <textarea id="f-opis" maxlength="2000">${varno(d.opis)}</textarea>
      </div>

      <p id="napaka-darilo" class="napaka"></p>
      <div class="okno-gumbi">
        <button class="gumb gumb-kupi" type="submit" id="f-shrani">💾 Shrani</button>
        <button class="gumb gumb-siv" type="button" data-akcija="zapri">Prekliči</button>
      </div>
    </form>`;
  if (!okno().open) okno().showModal();

  // predogled slike
  $('f-datoteka').addEventListener('change', e => {
    const datoteka = e.target.files[0];
    if (!datoteka) return;
    $('f-predogled').src = URL.createObjectURL(datoteka);
    $('f-predogled').hidden = false;
    $('f-slika-url').value = '';
  });
  $('f-slika-url').addEventListener('input', e => {
    if (varnaPovezava(e.target.value)) { $('f-predogled').src = e.target.value; $('f-predogled').hidden = false; }
  });

  $('obrazec-darilo').addEventListener('submit', async e => {
    e.preventDefault();
    const gumb = $('f-shrani');
    gumb.disabled = true;
    $('napaka-darilo').textContent = 'Shranjujem ... ⏳';

    let povezava = $('f-povezava').value.trim();
    if (povezava && !/^https?:\/\//i.test(povezava)) povezava = 'https://' + povezava;

    const darilo = {
      id: d.id || narediId($('f-ime').value),
      ime: $('f-ime').value.trim(),
      slika: d.slika || '',
      cena: Math.round(parseFloat($('f-cena').value) * 100) / 100,
      kategorija: $('f-kategorija').value,
      zelja: Number($('f-zelja').value),
      povezava,
      trgovina: $('f-trgovina').value.trim(),
      trgovine: $('f-trgovine').value.split('\n').map(t => t.trim()).filter(Boolean),
      opis: $('f-opis').value.trim(),
      dodano: d.dodano || new Date().toISOString().slice(0, 10)
    };

    try {
      const datoteka = $('f-datoteka').files[0];
      const urlSlike = $('f-slika-url').value.trim();
      if (datoteka) {
        const b64 = await zmanjsajSliko(datoteka);
        const pot = 'slike/' + darilo.id + '-' + Date.now().toString(36) + '.jpg';
        await shraniDatoteko(pot, b64, 'Slika: ' + darilo.ime);
        zacasneSlike[pot] = 'data:image/jpeg;base64,' + b64;
        darilo.slika = pot;
      } else if (varnaPovezava(urlSlike)) {
        darilo.slika = urlSlike;
      }

      darila = await spremeniJson('podatki/darila.json', seznam => {
        const i = seznam.findIndex(x => x.id === darilo.id);
        if (i >= 0) seznam[i] = darilo; else seznam.unshift(darilo);
        return seznam;
      }, (d.id ? 'Urejeno darilo: ' : 'Novo darilo: ') + darilo.ime);

      okno().close();
      narisiVse();
      pokaziObvestilo('Shranjeno! ✅ Za vse bo vidno v 1–2 minutah.');
    } catch (err) {
      gumb.disabled = false;
      $('napaka-darilo').textContent = sporociloNapake(err);
    }
  });
}

function narediId(ime) {
  const osnova = brezSumnikov(ime).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'darilo';
  return osnova + '-' + Date.now().toString(36);
}

// zmanjša sliko na največ 900 px, da je stran hitra
function zmanjsajSliko(datoteka) {
  return new Promise((koncano, napaka) => {
    const slika = new Image();
    slika.onload = () => {
      const najvec = 900;
      let sirina = slika.width, visina = slika.height;
      if (sirina > najvec || visina > najvec) {
        const razmerje = najvec / Math.max(sirina, visina);
        sirina = Math.round(sirina * razmerje);
        visina = Math.round(visina * razmerje);
      }
      const platno = document.createElement('canvas');
      platno.width = sirina;
      platno.height = visina;
      const ctx = platno.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, sirina, visina);
      ctx.drawImage(slika, 0, 0, sirina, visina);
      koncano(platno.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    slika.onerror = () => napaka(new Error('Te slike ne morem prebrati.'));
    slika.src = URL.createObjectURL(datoteka);
  });
}

function urediDarilo(id) {
  const d = darila.find(x => x.id === id);
  if (d) obrazecDarila(d);
}

async function izbrisiDarilo(id) {
  const d = darila.find(x => x.id === id);
  if (!d || !confirm(`Res želiš izbrisati »${d.ime}«?`)) return;
  pokaziObvestilo('Brišem ... ⏳');
  try {
    darila = await spremeniJson('podatki/darila.json', seznam => seznam.filter(x => x.id !== id), 'Izbrisano darilo: ' + d.ime);
    narisiVse();
    pokaziObvestilo('Izbrisano. 🗑️');
  } catch (err) {
    pokaziObvestilo(sporociloNapake(err), true);
  }
}


// ===== nastavitve strani =====

function pokaziNastavitve() {
  vsebinaOkna().innerHTML = glavaOkna('⚙️ Nastavitve') + `
    <form class="okno-telo" id="obrazec-nast">
      <div class="polje">
        <label for="s-ime">Moje ime (pokaže se v naslovu)</label>
        <input type="text" id="s-ime" value="${varno(nastavitve.ime)}" maxlength="40">
      </div>
      <div class="polje">
        <label for="s-steam">Povezava do mojega Steam profila</label>
        <input type="url" id="s-steam" placeholder="https://steamcommunity.com/id/..." value="${varno(nastavitve.steamProfil)}">
        <p class="namig">Seznam želja na Steamu mora biti javen (Profil → Uredi profil → Zasebnost → Podrobnosti o igrah: Javno).</p>
      </div>
      <p id="napaka-nast" class="napaka"></p>
      <div class="okno-gumbi">
        <button class="gumb gumb-kupi" type="submit">💾 Shrani</button>
        <button class="gumb gumb-siv" type="button" data-akcija="zapri">Prekliči</button>
      </div>
    </form>`;
  okno().showModal();

  $('obrazec-nast').addEventListener('submit', async e => {
    e.preventDefault();
    $('napaka-nast').textContent = 'Shranjujem ... ⏳';
    const ime = $('s-ime').value.trim();
    const steamProfil = $('s-steam').value.trim();
    try {
      nastavitve = await spremeniJson('podatki/nastavitve.json', n => ({ ...n, ime, steamProfil }), 'Spremenjene nastavitve');
      okno().close();
      nastaviNaslov();
      narisiVse();
      pokaziObvestilo('Nastavitve shranjene! ✅ Steam igre se bodo naložile v nekaj minutah.');
    } catch (err) {
      $('napaka-nast').textContent = sporociloNapake(err);
    }
  });
}

async function osveziSteam() {
  pokaziObvestilo('Prosim GitHub, naj prebere Steam ... ⏳');
  try {
    await github('/actions/workflows/objavi.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: glavnaVeja }) });
    pokaziObvestilo('Začelo se je! 🎮 Igre bodo posodobljene v 2–5 minutah.');
  } catch (err) {
    pokaziObvestilo(err.status === 403
      ? 'Ključ nima dovoljenja »Actions: Read and write«. Glej README.'
      : sporociloNapake(err), true);
  }
}


// ===== gumbi =====

$('gumb-dodaj').addEventListener('click', () => {
  if (jeAdmin) obrazecDarila(null);
  else pokaziPrijavo();
});

$('admin-vrstica').addEventListener('click', e => {
  const gumb = e.target.closest('[data-admin]');
  if (!gumb) return;
  const kaj = gumb.dataset.admin;
  if (kaj === 'dodaj') obrazecDarila(null);
  if (kaj === 'nastavitve') pokaziNastavitve();
  if (kaj === 'steam') osveziSteam();
  if (kaj === 'odjava') odjava();
});
