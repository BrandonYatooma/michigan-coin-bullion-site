document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
  initPriceBoard();
});

/* ==========================================================================
   Live Bullion Price Board
   Pulls live gold/silver spot prices from the free, keyless, CORS-enabled
   gold-api.com feed, then prices out each item on your actual sheet against
   that spot using the rule that item uses (spot +/- a dollar amount, spot
   +/- a percentage, a straight flat price, a multiple of face value, or a
   percent-of-melt for scrap karat gold).

   IMPORTANT — how this persists:
   PRICE_ITEMS below is what every visitor sees by default. To permanently
   change a price or rule for everyone, edit the numbers in this array and
   redeploy. The "Edit Prices" toggle on the page is a quick preview tool —
   it saves to *your own browser's* local storage only, so it won't change
   what other visitors or other devices see. Because this is a static site
   with no server/database, there's no way for an on-page edit to broadcast
   to every visitor without adding a backend — edit the defaults here
   instead when you want a permanent, site-wide change.

   Modes:
     spot_adj      buy/sell = spot + a flat dollar amount per oz
     spot_pct      buy/sell = spot + a percentage of spot
     face_multiple buy/sell = a straight multiple of the item's face value
     purity_pct    buy = spot-per-gram × purity × a percent (scrap gold)
     flat          buy/sell = a fixed dollar amount, not tied to spot
     text          buy/sell is shown exactly as typed (e.g. "+ Condition")
   ========================================================================== */

var PRICE_ITEMS = [
  { id:'silver-round',  name:'1 oz Silver Round / Bar',  metal:'XAG', group:'Bullion (Live Spot)',
    buyMode:'spot_adj', buyVal:-5,  sellMode:'spot_adj', sellVal:1 },
  { id:'sovereign',     name:'1 oz Silver Sovereign / Bullion Coin', metal:'XAG', group:'Bullion (Live Spot)',
    buyMode:'spot_adj', buyVal:-4,  sellMode:'spot_adj', sellVal:2 },
  { id:'silver-5oz',    name:'5 oz Silver Bar',          metal:'XAG', group:'Bullion (Live Spot)',
    buyMode:'spot_adj', buyVal:-5,  sellMode:'spot_adj', sellVal:1 },
  { id:'silver-10oz',   name:'10 oz Silver Bar',         metal:'XAG', group:'Bullion (Live Spot)',
    buyMode:'spot_adj', buyVal:-5,  sellMode:'spot_adj', sellVal:1 },
  { id:'silver-eagle',  name:'Silver Eagle',             metal:'XAG', group:'Bullion (Live Spot)',
    buyMode:'spot_adj', buyVal:-3,  sellMode:'spot_adj', sellVal:4 },
  { id:'gold-eagle',    name:'Gold Eagle',               metal:'XAU', group:'Bullion (Live Spot)',
    buyMode:'spot_pct', buyVal:-2,  sellMode:'spot_pct', sellVal:2.5 },

  { id:'karat-gold',    name:'Karat Gold (scrap/jewelry)', metal:'XAU', group:'Coins & Currency (Reference)',
    buyMode:'purity_pct', buyVal:88, sellMode:'text', sellVal:'—',
    note:'We pay 88% of melt value based on weight and karat purity.' },
  { id:'morgan',        name:'Morgan Dollar',            metal:null, group:'Coins & Currency (Reference)',
    buyMode:'text', buyVal:'$37 + Condition', sellMode:'text', sellVal:'+ Condition',
    note:'Price depends on date, mint mark, and grade — call for a quote.' },
  { id:'peace',         name:'Peace Dollar',             metal:null, group:'Coins & Currency (Reference)',
    buyMode:'text', buyVal:'$36 + Condition', sellMode:'text', sellVal:'+ Condition',
    note:'Price depends on date, mint mark, and grade — call for a quote.' },
  { id:'ninety-pct',    name:'90% Silver (pre-1965 coins)', metal:null, group:'Coins & Currency (Reference)',
    buyMode:'face_multiple', buyVal:36, sellMode:'face_multiple', sellVal:42,
    note:'Priced per $1 of face value — e.g. $1 face value pays $36.00.' },
  { id:'buffalo-nodate',name:'Buffalo Nickel (no date)', metal:null, group:'Coins & Currency (Reference)',
    buyMode:'flat', buyVal:0.07, sellMode:'flat', sellVal:0.12 },
  { id:'buffalo-full',  name:'Buffalo Nickel (full date)', metal:null, group:'Coins & Currency (Reference)',
    buyMode:'flat', buyVal:0.25, sellMode:'flat', sellVal:1.00 },
  { id:'indian-cent',   name:'Indian Head Cent',         metal:null, group:'Coins & Currency (Reference)',
    buyMode:'flat', buyVal:0.25, sellMode:'flat', sellVal:1.00 },
  { id:'wheat-cent',    name:'Wheat Cent',                metal:null, group:'Coins & Currency (Reference)',
    buyMode:'flat', buyVal:0.03, sellMode:'flat', sellVal:0.05 }
];

var GOLD_PURITY = { '10K': 0.417, '14K': 0.583, '18K': 0.75 };
var TROY_OZ_IN_GRAMS = 31.1035;
var PRICE_API_BASE = 'https://api.gold-api.com/price/';
var REFRESH_MS = 45000;

function loadItemOverrides() {
  try {
    var saved = window.localStorage.getItem('mcb_price_items_v2');
    return saved ? JSON.parse(saved) : {};
  } catch (e) { return {}; }
}

function saveItemOverrides(overrides) {
  try {
    window.localStorage.setItem('mcb_price_items_v2', JSON.stringify(overrides));
    return true;
  } catch (e) {
    return false;
  }
}

function fmtUsd(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeValue(mode, val, spot) {
  if (mode === 'spot_adj') return (spot == null) ? null : fmtUsd(spot + val);
  if (mode === 'spot_pct') return (spot == null) ? null : fmtUsd(spot * (1 + val / 100));
  if (mode === 'flat') return fmtUsd(val);
  if (mode === 'face_multiple') return val.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '\u00d7 Face Value';
  if (mode === 'purity_pct') return (spot == null) ? null : val + '% of melt value';
  if (mode === 'text') return val;
  return '—';
}

function initPriceBoard() {
  var root = document.getElementById('price-board');
  if (!root) return;

  var overrides = loadItemOverrides();
  var items = PRICE_ITEMS.map(function (item) {
    var o = overrides[item.id] || {};
    return Object.assign({}, item, {
      buyVal: (o.buyVal !== undefined) ? o.buyVal : item.buyVal,
      sellVal: (o.sellVal !== undefined) ? o.sellVal : item.sellVal
    });
  });
  var latest = { XAU: null, XAG: null };

  var groups = [];
  items.forEach(function (item) {
    if (groups.indexOf(item.group) === -1) groups.push(item.group);
  });

  function rowsHtml() {
    return groups.map(function (group) {
      var groupRows = items.filter(function (i) { return i.group === group; }).map(function (item) {
        return '<tr data-id="' + item.id + '">' +
          '<td class="metal">' + item.name + (item.note ? '<div class="pb-item-note">' + item.note + '</div>' : '') + '</td>' +
          '<td class="pb-buy-cell">' +
            '<span class="pb-val" data-field="buy">—</span>' +
            '<input class="pb-cell-input" data-field="buy" style="display:none;" type="' + (item.buyMode === 'text' ? 'text' : 'number') + '" step="0.01">' +
          '</td>' +
          '<td class="hi pb-sell-cell">' +
            '<span class="pb-val" data-field="sell">—</span>' +
            '<input class="pb-cell-input" data-field="sell" style="display:none;" type="' + (item.sellMode === 'text' ? 'text' : 'number') + '" step="0.01">' +
          '</td>' +
        '</tr>';
      }).join('');
      return '<tr class="pb-group-row"><td colspan="3">' + group + '</td></tr>' + groupRows;
    }).join('');
  }

  root.innerHTML =
    '<div class="pb-head">' +
      '<span class="pb-status"><span class="pb-dot stale" id="pb-dot"></span><span id="pb-status-text">Loading live prices…</span></span>' +
      '<button class="pb-edit-toggle" id="pb-edit-toggle" aria-expanded="false">Edit Prices</button>' +
    '</div>' +
    '<table class="pb-table" id="pb-table">' +
      '<thead><tr><th>Item</th><th>We Pay (Buy)</th><th>We Sell At</th></tr></thead>' +
      '<tbody id="pb-body">' + rowsHtml() + '</tbody>' +
    '</table>' +
    '<p class="pb-note">Spot-based items update live throughout the trading day. Coins and currency are shown at our standard reference pricing and can vary by date, mint mark, and condition &mdash; call to confirm before you come in.</p>' +
    '<div class="pb-editor" id="pb-editor">' +
      '<p class="pb-help">Toggle "Edit Prices" above to change any buy/sell figure directly in the table above, then save. Saving here only previews in this browser &mdash; see the note at the top of script.js to change the default for every visitor.</p>' +
      '<button class="pb-save" id="pb-save">Save &amp; Recalculate</button>' +
      '<span class="pb-saved-msg" id="pb-saved-msg" style="display:none;">Saved in this browser</span>' +
    '</div>';

  var table = document.getElementById('pb-table');
  var editToggle = document.getElementById('pb-edit-toggle');
  var editor = document.getElementById('pb-editor');

  editToggle.addEventListener('click', function () {
    var open = table.classList.toggle('editing');
    editor.classList.toggle('open', open);
    editToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    editToggle.textContent = open ? 'Cancel Editing' : 'Edit Prices';
    if (open) {
      items.forEach(function (item) {
        var row = table.querySelector('tr[data-id="' + item.id + '"]');
        row.querySelector('input[data-field="buy"]').value = item.buyVal;
        row.querySelector('input[data-field="sell"]').value = item.sellVal;
      });
    }
  });

  document.getElementById('pb-save').addEventListener('click', function () {
    var newOverrides = {};
    items.forEach(function (item) {
      var row = table.querySelector('tr[data-id="' + item.id + '"]');
      var buyIn = row.querySelector('input[data-field="buy"]');
      var sellIn = row.querySelector('input[data-field="sell"]');
      var buyVal = (item.buyMode === 'text') ? buyIn.value : (parseFloat(buyIn.value) || 0);
      var sellVal = (item.sellMode === 'text') ? sellIn.value : (parseFloat(sellIn.value) || 0);
      item.buyVal = buyVal;
      item.sellVal = sellVal;
      newOverrides[item.id] = { buyVal: buyVal, sellVal: sellVal };
    });
    var ok = saveItemOverrides(newOverrides);
    renderPrices();
    table.classList.remove('editing');
    editor.classList.remove('open');
    editToggle.setAttribute('aria-expanded', 'false');
    editToggle.textContent = 'Edit Prices';
    var msg = document.getElementById('pb-saved-msg');
    msg.textContent = ok ? 'Saved in this browser' : 'Could not save (storage blocked) — using this session only';
    msg.style.display = 'inline';
    setTimeout(function () { msg.style.display = 'none'; }, 3000);
  });

  function renderPrices() {
    items.forEach(function (item) {
      var row = table.querySelector('tr[data-id="' + item.id + '"]');
      var spot = item.metal ? latest[item.metal] : null;
      var buyDisplay = computeValue(item.buyMode, item.buyVal, spot);
      var sellDisplay = computeValue(item.sellMode, item.sellVal, spot);
      row.querySelector('span[data-field="buy"]').textContent = (buyDisplay == null) ? '—' : buyDisplay;
      row.querySelector('span[data-field="sell"]').textContent = (sellDisplay == null) ? '—' : sellDisplay;

      if (item.id === 'karat-gold' && spot != null) {
        var perGram = spot / TROY_OZ_IN_GRAMS;
        var breakdown = Object.keys(GOLD_PURITY).map(function (k) {
          return k + ': ' + fmtUsd(perGram * GOLD_PURITY[k] * (item.buyVal / 100)) + '/g';
        }).join(' &middot; ');
        var noteEl = row.querySelector('.pb-item-note');
        if (noteEl) noteEl.innerHTML = item.note + '<br>' + breakdown;
      }
    });
  }

  function fetchSpot(symbol) {
    return fetch(PRICE_API_BASE + symbol)
      .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(function (data) { return data.price; });
  }

  function refresh() {
    var dot = document.getElementById('pb-dot');
    var statusText = document.getElementById('pb-status-text');
    Promise.all([fetchSpot('XAU'), fetchSpot('XAG')])
      .then(function (results) {
        latest.XAU = results[0];
        latest.XAG = results[1];
        renderPrices();
        dot.classList.remove('stale');
        statusText.textContent = 'Live — updated ' + new Date().toLocaleTimeString();
      })
      .catch(function () {
        dot.classList.add('stale');
        statusText.textContent = 'Live prices unavailable right now — call for current rates';
      });
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
}
