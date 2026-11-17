// ===== Moj seznam želja =====
// Glavna koda: naloži darila in igre, nariše kartice, filtri, priljubljene.

const KATEGORIJE = {
  'elektronika':   { ime: 'Elektronika',    ikona: '🎧' },
  'druzabne-igre': { ime: 'Družabne igre',  ikona: '🎲' },
  'knjige':        { ime: 'Knjige',         ikona: '📚' },
  'oblacila':      { ime: 'Oblačila',       ikona: '👕' },
  'sport':         { ime: 'Šport',          ikona: '⚽' },
  'igrace':        { ime: 'Igrače in LEGO', ikona: '🧸' },
  'glasba':        { ime: 'Glasba',         ikona: '🎸' },
  'soba':          { ime: 'Za sobo',        ikona: '🛋️' },
  'ostalo':        { ime: 'Drugo',          ikona: '🎁' }
};

const ZELJE = {
  1: '⭐ Bilo bi lepo',
  2: '⭐⭐ Zelo si želim',
  3: '⭐⭐⭐ Najbolj si želim!'
};

const CENE_DARIL = [
  { id: 'vse',    ime: 'Vse cene' },
  { id: 'do20',   ime: 'do 20 €',    od: 0,   do: 20 },
  { id: '20-50',  ime: '20 – 50 €',  od: 20,  do: 50 },
  { id: '50-100', ime: '50 – 100 €', od: 50,  do: 100 },
  { id: 'nad100', ime: 'nad 100 €',  od: 100, do: Infinity }
];

const CENE_IGER = [
  { id: 'vse',   ime: 'Vse cene' },
  { id: 'do10',  ime: 'do 10 €',   od: 0,  do: 10 },
  { id: '10-30', ime: '10 – 30 €', od: 10, do: 30 },
  { id: 'nad30', ime: 'nad 30 €',  od: 30, do: Infinity }
];

// podatki
let darila = [];
let igre = [];
let podatkiIger = {};
let nastavitve = {};
let jeAdmin = false;         // nastavi se v admin.js
let zacasneSlike = {};       // slike, ki sem jih ravno naložil (GitHub jih še objavlja)
let priljubljene = naloziPriljubljene();

const filterDaril = { iskanje: '', kategorija: 'vse', cena: 'vse', samoNajbolj: false, samoTrgovina: false, razvrsti: 'zelja' };
const filterIger = { iskanje: '', cena: 'vse', samoPopust: false, samoPriljubljene: false, zvrst: 'vse', razvrsti: 'seznam' };


// ===== pomožne funkcije =====

function $(id) { return document.getElementById(id); }

// da nihče ne more podtakniti HTML kode
function varno(besedilo) {
  return String(besedilo ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function varnaPovezava(url) {
  url = String(url || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

// "čevlji" najde tudi, če babi napiše "cevlji"
function brezSumnikov(besedilo) {
  return String(besedilo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function evri(cena) {
  if (cena == null || isNaN(cena)) return '';
  const celo = Number.isInteger(Number(cena));
  return Number(cena).toLocaleString('sl-SI', { minimumFractionDigits: celo ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
}

// slovenščina ima dvojino :)  1 darilo, 2 darili, 3 darila, 5 daril
function mnozina(n, oblike) {
  const ostanek = n % 100;
  if (ostanek === 1) return oblike[0];
  if (ostanek === 2) return oblike[1];
  if (ostanek === 3 || ostanek === 4) return oblike[2];
  return oblike[3];
}

function vRazponu(cena, razpon) {
  if (!razpon || razpon.id === 'vse') return true;
  if (cena == null) return false;
  const odOk = razpon.od === 0 ? cena >= 0 : cena > razpon.od;
  return odOk && cena <= razpon.do;
}

function datumSl(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('sl-SI') + ' ob ' + d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

let casovnikObvestila;
function pokaziObvestilo(besedilo, jeNapaka) {
  const obv = $('obvestilo');
  obv.textContent = besedilo;
  obv.classList.toggle('napaka-obv', !!jeNapaka);
  obv.hidden = false;
  clearTimeout(casovnikObvestila);
  casovnikObvestila = setTimeout(() => obv.hidden = true, jeNapaka ? 6000 : 3500);
}

async function naloziJson(pot, privzeto) {
  try {
    const odgovor = await fetch(pot + '?t=' + Date.now(), { cache: 'no-store' });
    if (!odgovor.ok) throw new Error(odgovor.status);
    return await odgovor.json();
  } catch (e) {
    console.warn('Ne morem naložiti ' + pot, e);
    return privzeto;
  }
}


// ===== priljubljene (shranjene samo v brskalniku) =====

function naloziPriljubljene() {
  try {
    return JSON.parse(localStorage.getItem('priljubljene')) || [];
  } catch (e) {
    return [];
  }
}

function shraniPriljubljene() {
  try { localStorage.setItem('priljubljene', JSON.stringify(priljubljene)); } catch (e) { /* zasebni način */ }
}

function jePriljubljeno(kljuc) { return priljubljene.includes(kljuc); }

function preklopiPriljubljeno(kljuc) {
  if (jePriljubljeno(kljuc)) {
    priljubljene = priljubljene.filter(k => k !== kljuc);
    pokaziObvestilo('Odstranjeno iz priljubljenih');
  } else {
    priljubljene.push(kljuc);
    pokaziObvestilo('Dodano med priljubljene ❤️');
  }
  shraniPriljubljene();
  narisiVse();
}


// ===== kartice =====

function slikaDarila(d, razred) {
  const src = zacasneSlike[d.slika] || d.slika;
  const ikona = (KATEGORIJE[d.kategorija] || KATEGORIJE.ostalo).ikona;
  if (!src) return `<div class="ni-slike">${ikona}</div>`;
  return `<img class="${razred || ''}" src="${varno(src)}" alt="${varno(d.ime)}" loading="lazy"
           onerror="this.outerHTML='<div class=&quot;ni-slike&quot;>${ikona}</div>'">`;
}

function karticaDarila(d) {
  const kljuc = 'd:' + d.id;
  const kat = KATEGORIJE[d.kategorija] || KATEGORIJE.ostalo;
  const povezava = varnaPovezava(d.povezava);
  const trgovine = d.trgovine || [];

  let trgovineBesedilo = '';
  if (trgovine.length) {
    const prva = trgovine[0].split(',')[0];
    trgovineBesedilo = `<p class="drobno">🏬 Tudi v trgovini: ${varno(prva)}${trgovine.length > 1 ? ' in drugih' : ''}</p>`;
  }

  return `
  <article class="kartica">
    <div class="slika-okvir" data-akcija="podrobnosti" data-kljuc="${kljuc}">
      ${slikaDarila(d)}
      <button class="srcek" data-akcija="srcek" data-kljuc="${kljuc}"
        title="${jePriljubljeno(kljuc) ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}">${jePriljubljeno(kljuc) ? '❤️' : '🤍'}</button>
      ${d.zelja == 3 ? '<span class="trak-zelja">Najbolj si želim!</span>' : ''}
    </div>
    <div class="kartica-telo">
      <span class="znacka">${kat.ikona} ${kat.ime}</span>
      <h3 data-akcija="podrobnosti" data-kljuc="${kljuc}">${varno(d.ime)}</h3>
      <p class="cena">približno <b>${evri(d.cena)}</b></p>
      <p class="zvezdice">${ZELJE[d.zelja] || ZELJE[1]}</p>
      ${trgovineBesedilo}
    </div>
    <div class="kartica-gumbi">
      ${povezava ? `<a class="gumb gumb-kupi" href="${varno(povezava)}" target="_blank" rel="noopener">🛒 Kupi na spletu</a>` : ''}
      <button class="gumb gumb-vec" data-akcija="podrobnosti" data-kljuc="${kljuc}">ℹ️ Več podrobnosti</button>
    </div>
    ${jeAdmin ? `
    <div class="admin-gumbi">
      <button class="gumb gumb-siv" data-akcija="uredi" data-kljuc="${kljuc}">✏️ Uredi</button>
      <button class="gumb gumb-siv" data-akcija="izbrisi" data-kljuc="${kljuc}">🗑️ Izbriši</button>
    </div>` : ''}
  </article>`;
}

function cenaIgre(igra) {
  if (igra.brezplacna) return '<b>Brezplačna</b>';
  if (igra.cena == null) return igra.kmalu ? 'Še ni izšla' : 'Cena ni znana';
  if (igra.popust) return `<s>${evri(igra.cenaPrej)}</s><b>${evri(igra.cena)}</b>`;
  return `<b>${evri(igra.cena)}</b>`;
}

function karticaIgre(igra) {
  const kljuc = 'i:' + igra.appid;
  return `
  <article class="kartica">
    <div class="slika-okvir slika-igra" data-akcija="podrobnosti" data-kljuc="${kljuc}">
      <img src="${varno(igra.slika)}" alt="${varno(igra.ime)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;ni-slike&quot;>🎮</div>'">
      <button class="srcek" data-akcija="srcek" data-kljuc="${kljuc}"
        title="${jePriljubljeno(kljuc) ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}">${jePriljubljeno(kljuc) ? '❤️' : '🤍'}</button>
      ${igra.popust ? `<span class="popust-znacka">-${igra.popust} %</span>` : ''}
    </div>
    <div class="kartica-telo">
      <span class="znacka">🎮 Steam</span>
      <h3 data-akcija="podrobnosti" data-kljuc="${kljuc}">${varno(igra.ime)}</h3>
      <p class="cena">${cenaIgre(igra)}</p>
      ${igra.zvrsti && igra.zvrsti.length ? `<p class="zvrsti">${varno(igra.zvrsti.join(' · '))}</p>` : ''}
    </div>
    <div class="kartica-gumbi">
      <a class="gumb gumb-kupi" href="https://store.steampowered.com/app/${Number(igra.appid)}/" target="_blank" rel="noopener">🛒 Kupi na Steamu</a>
      <button class="gumb gumb-vec" data-akcija="podrobnosti" data-kljuc="${kljuc}">ℹ️ Več podrobnosti</button>
    </div>
  </article>`;
}

function praznoSporocilo(ikona, besedilo, zGumbom) {
  return `<div class="prazno"><span class="velika-ikona">${ikona}</span>${besedilo}
    ${zGumbom ? `<br><br><button class="gumb gumb-vec" data-akcija="${zGumbom}">✖ Počisti filtre</button>` : ''}</div>`;
}


// ===== filtri =====

function narisiCipe(posoda, moznosti, izbrano, kaj) {
  posoda.innerHTML = moznosti.map(m =>
    `<button class="cip ${m.id === izbrano ? 'aktiven' : ''}" data-${kaj}="${m.id}">${m.ime}</button>`
  ).join('');
}

function narisiFiltreDaril() {
  // pokažem samo kategorije, ki jih res imam
  const kategorije = [{ id: 'vse', ime: `Vse (${darila.length})` }];
  for (const id in KATEGORIJE) {
    const st = darila.filter(d => d.kategorija === id).length;
    if (st > 0) kategorije.push({ id, ime: `${KATEGORIJE[id].ikona} ${KATEGORIJE[id].ime} (${st})` });
  }
  narisiCipe($('filter-kategorije'), kategorije, filterDaril.kategorija, 'kategorija');
  narisiCipe($('filter-cene-darila'), CENE_DARIL, filterDaril.cena, 'cena');
}

function narisiFiltreIger() {
  narisiCipe($('filter-cene-igre'), CENE_IGER, filterIger.cena, 'cena');

  const zvrsti = [...new Set(igre.flatMap(i => i.zvrsti || []))].sort();
  $('zvrst-igre').innerHTML = '<option value="vse">Vse zvrsti</option>' +
    zvrsti.map(z => `<option value="${varno(z)}" ${z === filterIger.zvrst ? 'selected' : ''}>${varno(z)}</option>`).join('');
}

function filtriranaDarila() {
  const f = filterDaril;
  const iskano = brezSumnikov(f.iskanje.trim());
  const razpon = CENE_DARIL.find(c => c.id === f.cena);

  const seznam = darila.filter(d => {
    if (f.kategorija !== 'vse' && d.kategorija !== f.kategorija) return false;
    if (!vRazponu(Number(d.cena), razpon)) return false;
    if (f.samoNajbolj && d.zelja != 3) return false;
    if (f.samoTrgovina && !(d.trgovine && d.trgovine.length)) return false;
    if (iskano) {
      const vse = brezSumnikov([d.ime, d.opis, d.trgovina, (d.trgovine || []).join(' ')].join(' '));
      if (!vse.includes(iskano)) return false;
    }
    return true;
  });

  if (f.razvrsti === 'zelja') seznam.sort((a, b) => (b.zelja || 1) - (a.zelja || 1) || String(b.dodano).localeCompare(String(a.dodano)));
  if (f.razvrsti === 'cena-gor') seznam.sort((a, b) => a.cena - b.cena);
  if (f.razvrsti === 'cena-dol') seznam.sort((a, b) => b.cena - a.cena);
  if (f.razvrsti === 'novo') seznam.sort((a, b) => String(b.dodano).localeCompare(String(a.dodano)));
  return seznam;
}

function filtriraneIgre() {
  const f = filterIger;
  const iskano = brezSumnikov(f.iskanje.trim());
  const razpon = CENE_IGER.find(c => c.id === f.cena);

  const seznam = igre.filter(i => {
    const cena = i.brezplacna ? 0 : i.cena;
    if (!vRazponu(cena, razpon)) return false;
    if (f.samoPopust && !i.popust) return false;
    if (f.samoPriljubljene && !jePriljubljeno('i:' + i.appid)) return false;
    if (f.zvrst !== 'vse' && !(i.zvrsti || []).includes(f.zvrst)) return false;
    if (iskano && !brezSumnikov(i.ime).includes(iskano)) return false;
    return true;
  });

  const cenaZaRazvrscanje = i => i.brezplacna ? 0 : (i.cena ?? 9999);
  if (f.razvrsti === 'cena-gor') seznam.sort((a, b) => cenaZaRazvrscanje(a) - cenaZaRazvrscanje(b));
  if (f.razvrsti === 'cena-dol') seznam.sort((a, b) => cenaZaRazvrscanje(b) - cenaZaRazvrscanje(a));
  if (f.razvrsti === 'popust') seznam.sort((a, b) => (b.popust || 0) - (a.popust || 0));
  return seznam;
}


// ===== risanje =====

function narisiDarila() {
  narisiFiltreDaril();
  const seznam = filtriranaDarila();
  const mreza = $('mreza-darila');

  if (darila.length === 0) {
    $('stevilo-daril').textContent = '';
    mreza.innerHTML = praznoSporocilo('🎁', 'Na seznamu še ni daril.');
    return;
  }
  $('stevilo-daril').textContent = `Prikazujem ${seznam.length} od ${darila.length} ${mnozina(darila.length, ['darila', 'daril', 'daril', 'daril'])}`;
  mreza.innerHTML = seznam.length
    ? seznam.map(karticaDarila).join('')
    : praznoSporocilo('🔍', 'Nobeno darilo ne ustreza izbranim filtrom.', 'pocisti-darila');
}

function narisiIgre() {
  narisiFiltreIger();
  const mreza = $('mreza-igre');

  // kdaj je bil seznam nazadnje prebran s Steama
  $('steam-posodobljeno').textContent = podatkiIger.posodobljeno
    ? 'Zadnja posodobitev s Steama: ' + datumSl(podatkiIger.posodobljeno)
    : '';

  let povezave = '';
  const profil = varnaPovezava(nastavitve.steamProfil);
  if (profil) povezave += `<a class="gumb gumb-majhen" href="${varno(profil)}" target="_blank" rel="noopener">👤 Moj Steam profil</a>`;
  if (podatkiIger.steamId) povezave += `<a class="gumb gumb-majhen" href="https://store.steampowered.com/wishlist/profiles/${varno(podatkiIger.steamId)}/" target="_blank" rel="noopener">📜 Celoten seznam na Steamu</a>`;
  $('steam-povezave').innerHTML = povezave;

  if (igre.length === 0) {
    $('stevilo-iger').textContent = '';
    mreza.innerHTML = jeAdmin && !nastavitve.steamProfil
      ? praznoSporocilo('🎮', 'Steam še ni povezan. Klikni ⚙️ Nastavitve zgoraj in vpiši povezavo do svojega Steam profila.')
      : praznoSporocilo('🎮', 'Na seznamu trenutno ni iger.');
    return;
  }

  const seznam = filtriraneIgre();
  $('stevilo-iger').textContent = `Prikazujem ${seznam.length} od ${igre.length} ${mnozina(igre.length, ['igre', 'iger', 'iger', 'iger'])}`;
  mreza.innerHTML = seznam.length
    ? seznam.map(karticaIgre).join('')
    : praznoSporocilo('🔍', 'Nobena igra ne ustreza izbranim filtrom.', 'pocisti-igre');
}

function narisiPriljubljene() {
  // tukaj so samo darila – igre so skrite na svoji strani (#igre)
  const kartice = [];
  for (const kljuc of priljubljene) {
    const najdeno = poisciPoKljucu(kljuc);
    if (najdeno && najdeno.vrsta === 'darilo') kartice.push(karticaDarila(najdeno.stvar));
  }
  $('st-priljubljenih').textContent = kartice.length;
  $('mreza-priljubljene').innerHTML = kartice.length
    ? kartice.join('')
    : praznoSporocilo('🤍', 'Še nič ni med priljubljenimi.<br>Pri darilu klikni na srček 🤍 in prikazalo se bo tukaj.');
}

function narisiVse() {
  narisiDarila();
  narisiIgre();
  narisiPriljubljene();
}

function poisciPoKljucu(kljuc) {
  const [vrsta, id] = [kljuc.slice(0, 1), kljuc.slice(2)];
  if (vrsta === 'd') {
    const d = darila.find(x => x.id === id);
    return d ? { vrsta: 'darilo', stvar: d } : null;
  }
  const i = igre.find(x => String(x.appid) === id);
  return i ? { vrsta: 'igra', stvar: i } : null;
}


// ===== okno s podrobnostmi =====

function odpriPodrobnosti(kljuc) {
  const najdeno = poisciPoKljucu(kljuc);
  if (!najdeno) return;
  const html = najdeno.vrsta === 'darilo' ? podrobnostiDarila(najdeno.stvar, kljuc) : podrobnostiIgre(najdeno.stvar, kljuc);
  $('vsebina-podrobnosti').innerHTML = html;
  if (!$('okno-podrobnosti').open) $('okno-podrobnosti').showModal();
}

function gumbPriljubljeno(kljuc) {
  return `<button class="gumb gumb-vec" data-akcija="srcek" data-kljuc="${kljuc}">
    ${jePriljubljeno(kljuc) ? '❤️ Odstrani iz priljubljenih' : '🤍 Dodaj med priljubljene'}</button>`;
}

function podrobnostiDarila(d, kljuc) {
  const kat = KATEGORIJE[d.kategorija] || KATEGORIJE.ostalo;
  const povezava = varnaPovezava(d.povezava);
  const trgovine = d.trgovine || [];

  let kjeKupiti = '';
  if (povezava) {
    kjeKupiti += `<p><b>Spletna trgovina:</b> ${varno(d.trgovina || 'odpri povezavo')}</p>
      <a class="gumb gumb-kupi" href="${varno(povezava)}" target="_blank" rel="noopener">🛒 Kupi na spletu</a>`;
  }
  if (trgovine.length) {
    kjeKupiti += `<p style="margin-top:14px"><b>Trgovine, kamor lahko greš osebno:</b></p>
      <ul class="seznam-trgovin">` +
      trgovine.map(t => `<li><span>🏬 ${varno(t)}</span>
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}" target="_blank" rel="noopener">📍 Pokaži na zemljevidu</a></li>`).join('') +
      `</ul>`;
  }
  if (!kjeKupiti) kjeKupiti = '<p>Ni podatka o trgovini.</p>';

  return `
    <div class="okno-glava">
      <h2>${varno(d.ime)}</h2>
      <button class="zapri-x" data-akcija="zapri">✖ Zapri</button>
    </div>
    <div class="okno-telo">
      ${slikaDarila(d, 'okno-slika')}
      <p class="cena" style="margin-top:12px">Cena: približno <b>${evri(d.cena)}</b></p>
      <p>${kat.ikona} ${kat.ime} &nbsp;·&nbsp; ${ZELJE[d.zelja] || ZELJE[1]}</p>

      <div class="opis-okvir">
        <h4>📝 Opis</h4>
        <p>${varno(d.opis) || 'Za to darilo ni dodatnega opisa.'}</p>
      </div>

      <div class="opis-okvir">
        <h4>🛒 Kje lahko kupiš</h4>
        ${kjeKupiti}
      </div>

      <div class="okno-gumbi">
        ${gumbPriljubljeno(kljuc)}
        <button class="gumb gumb-rdec" data-akcija="zapri">Zapri</button>
      </div>
    </div>`;
}

function podrobnostiIgre(igra, kljuc) {
  return `
    <div class="okno-glava">
      <h2>${varno(igra.ime)}</h2>
      <button class="zapri-x" data-akcija="zapri">✖ Zapri</button>
    </div>
    <div class="okno-telo">
      <img class="okno-slika" src="${varno(igra.slika)}" alt="${varno(igra.ime)}">
      <p class="cena" style="margin-top:12px">Cena na Steamu: ${cenaIgre(igra)}
        ${igra.popust ? ` &nbsp;<span class="znacka">🏷️ ${igra.popust} % popust</span>` : ''}</p>
      ${igra.zvrsti && igra.zvrsti.length ? `<p><b>Zvrst:</b> ${varno(igra.zvrsti.join(', '))}</p>` : ''}
      ${igra.izid ? `<p><b>${igra.kmalu ? 'Izide' : 'Izšla'}:</b> ${varno(igra.izid)}</p>` : ''}

      <div class="opis-okvir">
        <h4>📝 Opis (s Steama, v angleščini)</h4>
        <p>${varno(igra.opis) || 'Ni opisa.'}</p>
      </div>

      <div class="okno-gumbi">
        <a class="gumb gumb-kupi" href="https://store.steampowered.com/app/${Number(igra.appid)}/" target="_blank" rel="noopener">🛒 Kupi na Steamu</a>
        ${gumbPriljubljeno(kljuc)}
        <button class="gumb gumb-rdec" data-akcija="zapri">Zapri</button>
      </div>
    </div>`;
}


// ===== zavihki =====

function odpriZavihek(ime) {
  if (!['darila', 'igre', 'priljubljene'].includes(ime)) ime = 'darila';
  document.querySelectorAll('.zavihek').forEach(z => z.classList.toggle('aktiven', z.dataset.zavihek === ime));
  document.querySelectorAll('.vsebina-zavihka').forEach(s => s.hidden = s.id !== 'zavihek-' + ime);
  history.replaceState(null, '', ime === 'darila' ? location.pathname : '#' + ime);
  if (ime === 'igre') window.scrollTo(0, 0);
}


// ===== kliki in vnosi =====

function poveziDogodke() {
  document.querySelectorAll('.zavihek').forEach(z =>
    z.addEventListener('click', () => odpriZavihek(z.dataset.zavihek)));

  // skrita povezava 🎮 v nogi in gumb "Nazaj" samo spremenita #
  window.addEventListener('hashchange', () => odpriZavihek(location.hash.slice(1)));

  // en poslušalec za vse gumbe na kartah in v oknu
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-akcija]');
    if (!el) return;
    const akcija = el.dataset.akcija;
    const kljuc = el.dataset.kljuc;

    if (akcija === 'srcek') {
      e.stopPropagation();
      preklopiPriljubljeno(kljuc);
      if ($('okno-podrobnosti').open) odpriPodrobnosti(kljuc);  // osveži gumb v oknu
    }
    if (akcija === 'podrobnosti') odpriPodrobnosti(kljuc);
    if (akcija === 'zapri') el.closest('dialog').close();
    if (akcija === 'pocisti-darila') pocistiDarila();
    if (akcija === 'pocisti-igre') pocistiIgre();
    if (akcija === 'uredi' && typeof urediDarilo === 'function') urediDarilo(kljuc.slice(2));
    if (akcija === 'izbrisi' && typeof izbrisiDarilo === 'function') izbrisiDarilo(kljuc.slice(2));
  });

  // klik zunaj okna ga zapre
  document.querySelectorAll('dialog').forEach(okno =>
    okno.addEventListener('click', e => { if (e.target === okno) okno.close(); }));

  // filtri za darila
  $('filter-kategorije').addEventListener('click', e => {
    const cip = e.target.closest('[data-kategorija]');
    if (cip) { filterDaril.kategorija = cip.dataset.kategorija; narisiDarila(); }
  });
  $('filter-cene-darila').addEventListener('click', e => {
    const cip = e.target.closest('[data-cena]');
    if (cip) { filterDaril.cena = cip.dataset.cena; narisiDarila(); }
  });
  $('iskanje-darila').addEventListener('input', e => { filterDaril.iskanje = e.target.value; narisiDarila(); });
  $('samo-najbolj').addEventListener('change', e => { filterDaril.samoNajbolj = e.target.checked; narisiDarila(); });
  $('samo-v-trgovini').addEventListener('change', e => { filterDaril.samoTrgovina = e.target.checked; narisiDarila(); });
  $('razvrsti-darila').addEventListener('change', e => { filterDaril.razvrsti = e.target.value; narisiDarila(); });
  $('pocisti-darila').addEventListener('click', pocistiDarila);

  // filtri za igre
  $('filter-cene-igre').addEventListener('click', e => {
    const cip = e.target.closest('[data-cena]');
    if (cip) { filterIger.cena = cip.dataset.cena; narisiIgre(); }
  });
  $('iskanje-igre').addEventListener('input', e => { filterIger.iskanje = e.target.value; narisiIgre(); });
  $('samo-popust').addEventListener('change', e => { filterIger.samoPopust = e.target.checked; narisiIgre(); });
  $('samo-priljubljene-igre').addEventListener('change', e => { filterIger.samoPriljubljene = e.target.checked; narisiIgre(); });
  $('zvrst-igre').addEventListener('change', e => { filterIger.zvrst = e.target.value; narisiIgre(); });
  $('razvrsti-igre').addEventListener('change', e => { filterIger.razvrsti = e.target.value; narisiIgre(); });
  $('pocisti-igre').addEventListener('click', pocistiIgre);
}

function pocistiDarila() {
  Object.assign(filterDaril, { iskanje: '', kategorija: 'vse', cena: 'vse', samoNajbolj: false, samoTrgovina: false, razvrsti: 'zelja' });
  $('iskanje-darila').value = '';
  $('samo-najbolj').checked = false;
  $('samo-v-trgovini').checked = false;
  $('razvrsti-darila').value = 'zelja';
  narisiDarila();
}

function pocistiIgre() {
  Object.assign(filterIger, { iskanje: '', cena: 'vse', samoPopust: false, samoPriljubljene: false, zvrst: 'vse', razvrsti: 'seznam' });
  $('iskanje-igre').value = '';
  $('samo-popust').checked = false;
  $('samo-priljubljene-igre').checked = false;
  $('razvrsti-igre').value = 'seznam';
  narisiIgre();
}

function nastaviNaslov() {
  const ime = (nastavitve.ime || '').trim();
  const naslov = ime ? `Seznam želja – ${ime}` : 'Moj seznam želja';
  $('naslov').textContent = naslov;
  document.title = '🎁 ' + naslov;
}


// ===== začetek =====

async function zacni() {
  $('leto').textContent = new Date().getFullYear();
  poveziDogodke();
  odpriZavihek(location.hash.slice(1));

  nastavitve = await naloziJson('podatki/nastavitve.json', {});
  darila = await naloziJson('podatki/darila.json', []);
  podatkiIger = await naloziJson('podatki/igre.json', {});
  igre = podatkiIger.igre || [];

  nastaviNaslov();
  narisiVse();

  if (typeof preveriPrijavo === 'function') preveriPrijavo();
}

zacni();
