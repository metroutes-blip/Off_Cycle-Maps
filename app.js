/* ================================================
   Work Order Map PWA — app.js
   ================================================ */

'use strict';

// ── Version ───────────────────────────────────
const APP_VERSION = 'v6.0';

// ── Google Sheets published CSV URL ───────────
// Dispatcher: File → Share → Publish to web → CSV → paste the URL here
const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmjcAZ6v2j5Lrs_XhyPovwduIdtVjfnQKr0bqOau-MSyW3nuePnfoHsFAU4-OJWxilBqxCL3DKe2AA/pub?gid=0&single=true&output=csv';

// GitHub Gist — token is stored in localStorage, entered once via the burger menu
const GITHUB_GIST_ID = 'aa005d9b6708553fc37317c35900aefb';
const GITHUB_GIST_OWNER = 'metroutes-blip';
const GIST_TOKEN_KEY = 'wo_gist_token';
function getGistToken() { return localStorage.getItem(GIST_TOKEN_KEY) || ''; }

// ── Engineer PINs ─────────────────────────────
// Key: engineer name exactly as it appears in Google Sheets
// Engineers not listed here are not required to enter a PIN
const ENGINEER_PINS = {
  'BORNEMAM': '6711',
  'CRUISEM': '0499',
  'ROTHD1': '4719',
  'CHANA13': '4818',
  'NASRJ': '4894',
  'DUFFYJ': '5381',
  'BRISSONJ': '4053',
  'ROBINSC5': '6922',
  'AGIUSA': '8770',
  'FARRUGIM': '3100',
  'MCNEILK': '1856',
  'HASTIEM': '8272',
  'SEWELLG2': '1868',
  'CONEJ': '6336',
  'PLATTB': '3784',
  'DOWS1': '9850',
  'DAWSONJ2': '7004',
  'DAWSONS': '6276',
  'GRANDMAK': '0760',
  'BRANDC': '4542',
  'CHAVEZP1': '5914',
  'HENDERM2': '8249',
  'MELVINS': '8990',
};

// Workers who always appear on the "Who are you?" page, whether or not they
// currently hold any work. Anyone else shows up only while they have work
// orders assigned — but they keep their PIN in ENGINEER_PINS above, so they are
// still challenged when they do appear.
const ROSTER = [
  'AGIUSA', 'BORNEMAM', 'BRANDC', 'CHAVEZP1', 'CRUISEM',
  'DUFFYJ', 'HENDERM2', 'MELVINS', 'NASRJ', 'ROTHD1',
];
const PIN_UNLOCK_PREFIX = 'wo_pin_'; // localStorage: wo_pin_<engineer> = 'YYYY-MM-DD'

// ── ID prefixes ───────────────────────────────
const CUSTOM_ID_PREFIX = 'CUSTOM-';
const NEW_WO_ID_PREFIX = 'NWO-';

// ── Storage keys ──────────────────────────────
const RECORDS_KEY = 'wo_records';
const GEOCACHE_KEY = 'wo_geocache';
const COMPLETIONS_KEY = 'wo_completions';
const MAP_STYLE_KEY = 'wo_map_style';
const ENGINEER_KEY = 'wo_engineer';
const POINTS_KEY = 'wo_points';


// ── State ─────────────────────────────────────
let workOrders = [];       // parsed CSV rows
let geocodedPoints = [];       // { lat, lng, row }
let geocodeFailures = [];       // { row, query }
let completions = {};       // { [workorder]: { date } }
let mapInitialized = false;
let leafletMap = null;
let clusterGroup = null;     // L.markerClusterGroup holding all WO markers
let mapMarkers = [];
let userLocationMarker = null;
let gpsWatching = false;
let gpsAutoStopTimer = null;
let activeRow = null;     // row shown in detail sheet
let activeGroup = [];     // all WOs at the same location as activeRow
let activeGroupIndex = 0;
let sheetJustOpened = false;    // guard: prevents same tap from immediately closing the sheet
let dueTodayActive = false;
let dateFilter = 'all';  // 'all' | 'today' | 'tomorrow'
let locationFilter = 'all';  // 'all' | 'inside' | 'outside'
let showLabels = true;
let selectedEngineer = '';
let pendingRecords = null;
let pendingPinEngineer = '';
let pendingPinCallback = null;
let mapStyle = localStorage.getItem(MAP_STYLE_KEY) || 'auto';
let darkMQ = null;

// ── DOM refs ──────────────────────────────────
const splash = document.getElementById('splash');
const viewHome = document.getElementById('view-home');
const viewMap = document.getElementById('view-map');
const viewPin = document.getElementById('view-pin');
const pinInput = document.getElementById('pin-input');
const btnPinUnlock = document.getElementById('btn-pin-unlock');
const pinError = document.getElementById('pin-error');
const btnRetry = document.getElementById('btn-retry');
const btnLoadNew = document.getElementById('btn-load-new');
const woCountBadge = document.getElementById('wo-count-badge');
const geocodeBar = document.getElementById('geocode-bar');
const geocodeBarText = document.getElementById('geocode-bar-text');
const geocodeBarFill = document.getElementById('geocode-bar-fill');
const notFoundBanner = document.getElementById('not-found-banner');
const notFoundText = document.getElementById('not-found-text');
const btnFixAddresses = document.getElementById('btn-fix-addresses');
const detailSheet = document.getElementById('detail-sheet');
const detailClose = document.getElementById('detail-close');
const detailNotifChip = document.getElementById('detail-notif-chip');
const detailWoNum = document.getElementById('detail-wo-num');
const detailAddress = document.getElementById('detail-address');
const detailMis = document.getElementById('detail-mis');
const detailCity = document.getElementById('detail-city');
const detailLocRow = document.getElementById('detail-loc-row');
const detailLoc = document.getElementById('detail-loc');
const detailWorkType = document.getElementById('detail-work-type');
const detailNotifCode = document.getElementById('detail-notif-code');
const detailMeterNum = document.getElementById('detail-meter-num');
const detailMeterSize = document.getElementById('detail-meter-size');
const detailLastReadRow = document.getElementById('detail-last-read-row');
const detailLastRead = document.getElementById('detail-last-read');
const detailRefErt = document.getElementById('detail-ref-ert');
const detailDatesRow = document.getElementById('detail-dates-row');
const detailDates = document.getElementById('detail-dates');
const navGoogle = document.getElementById('nav-google');
const navApple = document.getElementById('nav-apple');
const navWaze = document.getElementById('nav-waze');
const geocodeFixModal = document.getElementById('geocode-fix-modal');
const geocodeFixList = document.getElementById('geocode-fix-list');
const geocodeFixClose = document.getElementById('geocode-fix-close');
const engineerFilterSel = document.getElementById('engineer-filter');
const btnDueToday = document.getElementById('btn-due-today');
const btnDateFilter = document.getElementById('btn-date-filter');
const btnLocationFilter = document.getElementById('btn-location-filter');
const dateFilterValue = document.getElementById('date-filter-value');
const locationFilterValue = document.getElementById('location-filter-value');
const btnRefresh = null; // button removed
const btnGarminExport = document.getElementById('btn-garmin-export');
const btnLabels = document.getElementById('btn-labels');
const btnAddAddress = document.getElementById('btn-add-address');
const btnBurger = document.getElementById('btn-burger');
const burgerMenu = document.getElementById('burger-menu');
const btnLocate = document.getElementById('btn-locate');
const btnDeleteCompleted = document.getElementById('btn-delete-completed');
const completedCountBadge = document.getElementById('completed-count-badge');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmDesc = document.getElementById('delete-confirm-desc');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');
const addAddressModal = document.getElementById('add-address-modal');
const addAddressInput = document.getElementById('add-address-input');
const addAddressStatus = document.getElementById('add-address-status');
const btnAddAddrSubmit = document.getElementById('btn-add-address-submit');
const btnAddAddrCancel = document.getElementById('btn-add-address-cancel');
const fixLocationModal = document.getElementById('fix-location-modal');
const fixLocationInput = document.getElementById('fix-location-input');
const fixLocationStatus = document.getElementById('fix-location-status');
const fixLocationOriginal = document.getElementById('fix-location-original');
const btnFixLocation = document.getElementById('btn-fix-location');
const btnFixLocationSubmit = document.getElementById('btn-fix-location-submit');
const btnFixLocationCancel = document.getElementById('btn-fix-location-cancel');
const detailGroupNav = document.getElementById('detail-group-nav');
const detailGroupLabel = document.getElementById('detail-group-label');
const btnDetailPrev = document.getElementById('detail-prev');
const btnDetailNext = document.getElementById('detail-next');
const toast = document.getElementById('toast');
const btnComplete = document.getElementById('btn-complete');
const btnDeleteWO = document.getElementById('btn-delete-wo');
const overdueWarning = document.getElementById('detail-overdue-warning');
const overdueText = document.getElementById('detail-overdue-text');
const overdueDismiss = document.getElementById('detail-overdue-dismiss');
const statusBar = document.getElementById('status-bar');
const btnMapStyle = document.getElementById('btn-map-style');
const mapStyleMenu = document.getElementById('map-style-menu');
const viewEngineer = document.getElementById('view-engineer');
const engineerList = document.getElementById('engineer-list');
const mergeModal = document.getElementById('merge-modal');
const mergeModalDesc = document.getElementById('merge-modal-desc');
const btnMergeKeep = document.getElementById('btn-merge-keep');
const btnMergeFresh = document.getElementById('btn-merge-fresh');
const btnUploadCsv = document.getElementById('btn-upload-csv');
const csvFileInput = document.getElementById('csv-file-input');
const uploadCsvModal = document.getElementById('upload-csv-modal');
const uploadCsvDesc = document.getElementById('upload-csv-desc');
const uploadAssignDate = document.getElementById('upload-assign-date');
const btnUploadConfirm = document.getElementById('btn-upload-confirm');
const btnUploadCancel = document.getElementById('btn-upload-cancel');
const listViewPanel = document.getElementById('list-view-panel');
const listViewBody = document.getElementById('list-view-body');
const listViewCount = document.getElementById('list-view-count');
const btnListClose = document.getElementById('btn-list-close');
const btnListView = document.getElementById('btn-list-view');
const newWoModal = document.getElementById('new-wo-modal');
const newWoStatus = document.getElementById('new-wo-status');
const btnNewWo = document.getElementById('btn-new-wo');
const btnNewWoSubmit = document.getElementById('btn-new-wo-submit');
const btnNewWoCancel = document.getElementById('btn-new-wo-cancel');
const nwoWorkorder = document.getElementById('nwo-workorder');
const nwoAddress = document.getElementById('nwo-address');
const nwoCity = document.getElementById('nwo-city');
const nwoNotifType = document.getElementById('nwo-notif-type');
const nwoNotifCode = document.getElementById('nwo-notif-code');
const nwoMeterNum = document.getElementById('nwo-meter-num');
const nwoMeterSize = document.getElementById('nwo-meter-size');
const nwoMeterLoc = document.getElementById('nwo-meter-loc');
const nwoLocNote = document.getElementById('nwo-loc-note');

// ── Helpers ───────────────────────────────────
function fmtDate(str) {
  if (!str) return str;
  try {
    const d = new Date(str);
    if (isNaN(d)) return str;
    const mon = d.toLocaleDateString('en-CA', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const wday = d.toLocaleDateString('en-CA', { weekday: 'short' });
    return `${mon} ${day} (${wday})`;
  } catch (_) { return str; }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.background = isError ? 'rgba(180,30,30,0.92)' : 'rgba(26,36,56,0.92)';
  toast.classList.remove('hidden', 'fade-out');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 2800);
}

// ── CSV Parsing ───────────────────────────────
function parseCSV(text) {
  const lines = [];
  let cur = '', inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQ = !inQ; cur += ch; }
    else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.trim()) lines.push(cur);
      cur = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else { cur += ch; }
  }
  if (cur.trim()) lines.push(cur);

  const parseLine = (line) => {
    const fields = []; let f = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { f += '"'; i++; }
        else q = !q;
      } else if (ch === ',' && !q) {
        fields.push(f.trim());
        f = '';
      } else { f += ch; }
    }
    fields.push(f.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (vals[i] || '').replace(/^"|"$/g, '').trim();
    });
    return obj;
  });
}

// ── Uploaded CSV normalisation ─────────────────
// RDLK list exports write the lock end as "Jun 22 (Mon)" — no year, weekday in
// brackets. new Date() would guess year 2001 and mark every lock overdue, so
// strip the bracket part and infer the year (assume next year only when the
// date would otherwise be more than ~6 months in the past).
function parseLockEndDate(val) {
  const s = (val || '').replace(/\(.*?\)/g, '').trim();
  if (!s) return '';
  if (/\d{4}/.test(s)) return s; // already has a year
  const now = new Date();
  let d = new Date(`${s}, ${now.getFullYear()}`);
  if (isNaN(d.getTime())) return s;
  if (d.getTime() < now.getTime() - 182 * 24 * 3600 * 1000) {
    d = new Date(`${s}, ${now.getFullYear() + 1}`);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Maps a raw Maximo "MMR_Workorder_List" export (headers like "Work Order",
// "Target Start", "Red Lock Type") onto the record schema the app and the
// Gist use ("Workorder", "targetfinish", "Notification Code", ...). Rows that
// are already in app format pass through unchanged.
function normalizeUploadedRows(rows, assignDate) {
  return rows.map(r => ({
    'Workorder': (r['Workorder'] || r['Work Order'] || '').trim(),
    'Street Address': (r['Street Address'] || '').trim(),
    'Mis Address': (r['Mis Address'] || '').trim(),
    'City': (r['City'] || '').trim(),
    'engineer': (r['engineer'] || r['Engineer'] || '').trim(),
    'Notification Code': (r['Notification Code'] || r['Red Lock Type'] || '').trim().toUpperCase(),
    'Notification Type': (r['Notification Type'] || '').trim(),
    'Meter Location': (r['Meter Location'] || '').trim(),
    'Meter Number': (r['Meter Number'] || '').trim(),
    'Meter Size': (r['Meter Size'] || '').trim(),
    'Grid': (r['Grid'] || ((r['Grid Letter'] || '').trim() + (r['Grid #'] || '').trim())).trim(),
    'Device Location Note': (r['Device Location Note'] || '').trim(),
    'targetstart': (r['targetstart'] || r['Target Start'] || '').trim(),
    // RDLK lists carry the due date in "Lock End Date"; it beats Target Start
    'targetfinish': (r['targetfinish'] || parseLockEndDate(r['Lock End Date']) ||
      r['Target Finish'] || r['targetstart'] || r['Target Start'] || '').trim(),
    'aptstart': (r['aptstart'] || r['Appt Start'] || '').trim(),
    '_assignDate': (r['_assignDate'] || assignDate || '').trim(),
    // Placed-notice type from the MMR Combined tab (tenant_notice, tenant_rdlk,
    // school_read, special_rmbe, special_read) — drives a distinctive marker icon.
    '_placedType': (r['_placedType'] || '').trim(),
  })).filter(r => r['Workorder'] && r['Street Address']);
}

// ── Gist error reporting ───────────────────────
// The Gists API only accepts a *classic* personal access token carrying the
// `gist` scope. Fine-grained tokens are silently unsupported and come back as
// 404, which is indistinguishable from "gist deleted" unless we spell it out.
function gistErrorMessage(status) {
  if (status === 401) return 'Sync token rejected — it has expired or is wrong';
  if (status === 403) return 'Sync token lacks the "gist" scope (or rate limited)';
  if (status === 404) return 'Token has no gist access — needs a CLASSIC token';
  if (status === 422) return 'Work order list too large for the cloud sync';
  if (status >= 500) return `GitHub is having trouble (${status}) — try again`;
  return `Cloud sync failed (${status})`;
}

// ── GitHub Gist fetch ──────────────────────────
// Records the last failure so callers can tell "no data" apart from "the fetch
// broke", instead of silently falling back and resurrecting deleted rows.
let lastGistFetchError = null;

// The list is ~430 KB, big enough that GET /gists/:id intermittently 504s while
// GitHub serialises it. That 504 page carries no CORS headers, so the browser
// surfaces it as a bare "TypeError: Failed to fetch" with no status to inspect.
// Reading the raw file sidesteps that entirely: resolve the newest revision SHA
// (a tiny, reliable call), then fetch SHA-pinned content, which is immutable —
// so it can never be a stale CDN copy and never gets truncated.
async function fetchGistViaRaw(headers) {
  const cRes = await fetch(
    `https://api.github.com/gists/${GITHUB_GIST_ID}/commits?per_page=1`,
    { cache: 'no-store', headers });
  if (!cRes.ok) throw new Error(`commits ${cRes.status}`);
  const sha = (await cRes.json())?.[0]?.version;
  if (!sha) throw new Error('no revision found');

  const rRes = await fetch(
    `https://gist.githubusercontent.com/${GITHUB_GIST_OWNER}/${GITHUB_GIST_ID}/raw/${sha}/workorders.json`);
  if (!rRes.ok) throw new Error(`raw ${rRes.status}`);
  return await rRes.json();
}

// Falls back to the plain API read if the raw route fails, so a change of gist
// owner or a renamed file degrades instead of breaking outright.
async function fetchGistViaApi(headers) {
  const res = await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}`, {
    cache: 'no-store',
    headers,
  });
  if (!res.ok) throw new Error(gistErrorMessage(res.status));
  const data = await res.json();
  const content = data.files?.['workorders.json']?.content;
  if (!content) throw new Error('workorders.json missing from the gist');
  return JSON.parse(content);
}

function looksLikeWorkOrders(records) {
  return Array.isArray(records) && records.length &&
    records[0]['Street Address'] !== undefined;
}

async function fetchFromGist() {
  const token = getGistToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  lastGistFetchError = null;

  for (const route of [fetchGistViaRaw, fetchGistViaApi]) {
    try {
      const records = await route(headers);
      if (looksLikeWorkOrders(records)) return records;
      lastGistFetchError = 'Cloud list was empty or malformed';
    } catch (e) {
      lastGistFetchError = e.message || 'Could not reach GitHub';
      console.error(`Gist fetch failed via ${route.name}:`, e);
    }
  }
  return null;
}

// ── GitHub Gist write-back ──────────────────────
async function updateGist(records) {
  const token = getGistToken();
  if (!token) {
    showToast('No sync token set — open the burger menu → Set Sync Token', true);
    return false;
  }
  try {
    const res = await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Compact, not pretty-printed — the pretty form is ~25% larger for no
      // benefit and the list is already near half of the 1 MB gist file limit.
      body: JSON.stringify({
        files: {
          'workorders.json': { content: JSON.stringify(records) },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Gist update failed:', res.status, err);
      showToast(gistErrorMessage(res.status), true);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Gist update error:', e);
    showToast('Network error — could not sync to cloud', true);
    return false;
  }
}

// ── Row identity ───────────────────────────────
// The same Workorder can be assigned on more than one date, so anything that
// removes "this row" needs the date too — matching on the id alone would take
// the other date's copy with it.
function woId(row) { return (row['Workorder'] || '').trim(); }
function rowKey(row) { return `${woId(row)}|${(row['_assignDate'] || '').trim()}`; }

// ── Cloud delta write ──────────────────────────
// Applies a delta to the CLOUD list instead of overwriting it with this
// device's snapshot. `updateGist(workOrders)` erased anything another engineer
// had added since this device last fetched — and after selectEngineer() the
// restored list holds only one engineer's rows, so a single delete could wipe
// everyone else's work. Mirrors the merge btnUploadConfirm already does.
async function pushCloudDelta({ removeIds = [], removeKeys = [], upsertRows = [] } = {}) {
  // Checked up front so the caller reports the real reason — otherwise
  // updateGist's own "no token" toast is immediately overwritten by ours.
  if (!getGistToken()) {
    return { ok: false, reason: 'No sync token set' };
  }

  const cloud = await fetchFromGist();

  // A failed read must never be treated as an empty cloud list.
  if (cloud === null && lastGistFetchError) {
    return { ok: false, reason: lastGistFetchError };
  }

  const dropIds = new Set(removeIds);
  const dropKeys = new Set(removeKeys);
  upsertRows.forEach(r => dropIds.add(woId(r)));

  const merged = (cloud || [])
    .filter(r => !dropIds.has(woId(r)) && !dropKeys.has(rowKey(r)))
    .concat(upsertRows);

  const ok = await updateGist(merged);
  return ok ? { ok: true, merged } : { ok: false, reason: 'Cloud write failed' };
}

// ── Record persistence ─────────────────────────
// Swallowing a quota failure silently leaves this device holding an older,
// smaller list than the cloud, which is exactly what made the old blind
// overwrites destructive. Warn once instead of failing invisibly.
let recordsSaveWarned = false;
function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    recordsSaveWarned = false;
  } catch (e) {
    console.error('Could not persist records:', e);
    if (!recordsSaveWarned) {
      recordsSaveWarned = true;
      showToast('Device storage is full — this list may not survive a restart', true);
    }
  }
}

// ── Google Sheets CSV fetch ────────────────────
// Routed through a CORS proxy so the browser never navigates directly to
// docs.google.com — this prevents mobile Android from intercepting the
// request via App Links and opening the Google Sheets app.
async function fetchCSVFromSheets() {
  if (!SHEETS_CSV_URL || SHEETS_CSV_URL.startsWith('PASTE_')) return null;
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(SHEETS_CSV_URL)}`;
  try {
    const res = await fetch(proxyUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch (_) {
    return null;
  }
}

// ── Completions persistence ───────────────────
function loadCompletions() {
  try { return JSON.parse(localStorage.getItem(COMPLETIONS_KEY) || '{}'); } catch (_) { return {}; }
}
function saveCompletions() {
  try { localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions)); } catch (_) { }
}

// ── Purge completed work orders from previous days ────────────────────────
// Runs at startup: any WO completed before today is removed entirely from
// local records, points cache, and the completions log.
function purgeOldCompletions() {
  const today = todayISO();

  // Find WO IDs completed before today
  const staleIds = new Set(
    Object.entries(completions)
      .filter(([, v]) => {
        // date stored as toLocaleString('en-CA'): "2026-04-12, 3:45:00 p.m."
        // or toLocaleDateString('en-CA'): "2026-04-12"
        const dateStr = (v.date || '').split(',')[0].trim();
        return dateStr && dateStr < today;
      })
      .map(([wo]) => wo)
  );

  if (!staleIds.size) return;

  // Remove from completions
  staleIds.forEach(wo => delete completions[wo]);
  saveCompletions();

  // Remove from persisted records
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    const cleaned = raw.filter(r => !staleIds.has((r['Workorder'] || '').trim()));
    localStorage.setItem(RECORDS_KEY, JSON.stringify(cleaned));
  } catch (_) { }

  // Remove from persisted geocoded points
  try {
    const raw = JSON.parse(localStorage.getItem(POINTS_KEY) || '[]');
    const cleaned = raw.filter(p => !staleIds.has((p.row?.['Workorder'] || '').trim()));
    localStorage.setItem(POINTS_KEY, JSON.stringify(cleaned));
  } catch (_) { }
}

// ── Geocache ──────────────────────────────────
function loadGeoCache() {
  try { return JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}'); } catch (_) { return {}; }
}
function saveGeoCache(cache) {
  try { localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache)); } catch (_) { }
}

// ── Persisted geocoded points ─────────────────
function savePoints() {
  try { localStorage.setItem(POINTS_KEY, JSON.stringify(geocodedPoints)); } catch (_) { }
}
function loadPoints() {
  try { return JSON.parse(localStorage.getItem(POINTS_KEY) || '[]'); } catch (_) { return []; }
}

// Strip trailing city name from a street address string for display
function stripCityFromAddr(addr, city) {
  if (!city) return addr;
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return addr.replace(new RegExp(',?\\s*' + escaped + '\\s*$', 'i'), '').trim();
}

// ── Address cleaning for geocoding ───────────
// Strip the Mis Address portion (unit/suite info) from Street Address
function cleanAddressForGeocode(streetAddress, misAddress) {
  let addr = (streetAddress || '').trim();
  if (misAddress) {
    // Strip /U: prefix from Mis Address to get the unit identifier text
    const unitText = misAddress.replace(/^\/U:/i, '').trim();
    if (unitText) {
      // Escape any regex special chars in the unit text before substituting
      const escaped = unitText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      addr = addr.replace(new RegExp(escaped, 'gi'), '');
    }
  }
  // Clean up leftover double-commas, extra spaces, trailing commas
  return addr
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[,\s]+$/, '');
}

// ── Single-address geocoder (Nominatim) ───────
function geocodeAddress(streetAddress, misAddress, city, cache) {
  const cleanAddr = cleanAddressForGeocode(streetAddress, misAddress);
  const cacheKey = `${cleanAddr},${city}`.toLowerCase();

  if (cache[cacheKey]) return Promise.resolve({ coords: cache[cacheKey], count: 0 });

  const doFetch = (q) =>
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ca`,
      { headers: { 'User-Agent': 'WorkOrderMapPWA/1.0' } }
    )
      .then(r => r.json())
      .then(d => (d && d[0]) ? { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) } : null)
      .catch(() => null);

  // Attempt 1: cleanAddr + Ontario
  return doFetch(`${cleanAddr}, Ontario`).then(coords => {
    if (coords) {
      cache[cacheKey] = coords;
      saveGeoCache(cache);
      return { coords, count: 1 };
    }
    // Attempt 2: cleanAddr + City + Ontario
    return doFetch(`${cleanAddr}, ${city}, Ontario`).then(coords2 => {
      if (coords2) { cache[cacheKey] = coords2; saveGeoCache(cache); }
      return { coords: coords2, count: 2 };
    });
  });
}

// ── Batch geocoding with rate-limiting ────────
function geocodeAllRecords(progressCb) {
  const cache = loadGeoCache();
  const tasks = workOrders.map(row => ({
    row,
    streetAddress: (row['Street Address'] || '').trim(),
    misAddress: (row['Mis Address'] || '').trim(),
    city: (row['City'] || '').trim(),
  })).filter(t => t.streetAddress &&
    (!selectedEngineer || t.row['_isCustom'] || (t.row['engineer'] || '').trim() === selectedEngineer));

  const results = [], failures = [];
  let done = 0;
  const total = tasks.length;

  function processNext(i) {
    if (i >= total) return Promise.resolve({ points: results, failures });
    const { row, streetAddress, misAddress, city } = tasks[i];

    // Use pre-supplied coordinates when available (exported from MMR Setup)
    const preLat = parseFloat(row['_lat']);
    const preLng = parseFloat(row['_lng']);
    if (!isNaN(preLat) && !isNaN(preLng)) {
      done++;
      progressCb(done, total);
      results.push({ lat: preLat, lng: preLng, row });
      return processNext(i + 1);  // no delay — no API call made
    }

    return geocodeAddress(streetAddress, misAddress, city, cache).then(({ coords, count }) => {
      done++;
      progressCb(done, total);
      if (coords) results.push({ lat: coords.lat, lng: coords.lng, row });
      else failures.push({
        row, streetAddress, misAddress, city,
        query: `${cleanAddressForGeocode(streetAddress, misAddress)}, Ontario`
      });
      const delay = count * 1050;
      return new Promise(res => setTimeout(res, delay)).then(() => processNext(i + 1));
    });
  }

  return processNext(0);
}

// ── Marker icons ──────────────────────────────
const NOTIF_CODE = (row) => (row['Notification Code'] || '').trim().toUpperCase();

function isRedLock(row) { return NOTIF_CODE(row) === 'RDLK'; }
function isBlackLock(row) { return ['LKFS', 'TLOC', 'LOCK', 'LKSN'].includes(NOTIF_CODE(row)); }
function isOpenLock(row) { return NOTIF_CODE(row) === 'LKOO'; }
function isBattery(row) { return NOTIF_CODE(row) === 'RMBE'; }
function isTamper(row) { return NOTIF_CODE(row) === 'TC01'; }
function isMove(row) { return NOTIF_CODE(row) === 'MOVE'; }
function isSpecialRead(row) { return ['MT31', 'ESTS', 'CKRD'].includes(NOTIF_CODE(row)); }

function getMarkerColor(row) {
  if (isRedLock(row)) return '#ef4444';   // red lock
  if (isBlackLock(row)) return '#1a1a1a';   // black lock
  if (isOpenLock(row)) return '#4b5563';   // dark grey open lock
  if (isBattery(row)) return '#f97316';   // orange battery
  if (isTamper(row)) return '#0d9488';   // turquoise tamper
  if (isSpecialRead(row)) return '#eab308';   // yellow special read
  return '#3b82f6';                           // default blue
}

function markerBg(color) {
  return `<circle cx="13" cy="13" r="10" fill="${color}" stroke="#fff" stroke-width="1.8"/>`;
}

function makeCircleIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg(color)}
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14] });
}

// RDLK must be done Mon–Thu; if targetfinish is Fri/Sat/Sun, shift back to that Thursday
function effectiveLockDate(row) {
  const tf = (row['targetfinish'] || '').trim();
  if (!tf) return null;
  try {
    const d = new Date(tf);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
    if (day === 5) d.setDate(d.getDate() - 1); // Fri → Thu
    if (day === 6) d.setDate(d.getDate() - 2); // Sat → Thu
    if (day === 0) d.setDate(d.getDate() - 3); // Sun → Thu (prev week)
    return d;
  } catch (_) { return null; }
}

function isLockEndToday(row) {
  const effective = effectiveLockDate(row);
  if (!effective) return false;
  const today = new Date();
  return effective.getFullYear() === today.getFullYear() &&
    effective.getMonth() === today.getMonth() &&
    effective.getDate() === today.getDate();
}

function isLockEndPast(row) {
  const effective = effectiveLockDate(row);
  if (!effective) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return effective < today;
}

function isAptToday(row) {
  const val = (row['aptstart'] || '').trim();
  if (!val) return false;
  try {
    const d = new Date(val);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
  } catch (_) { return false; }
}

// Returns true when the row's _assignDate matches the given YYYY-MM-DD string.
// Both values are already YYYY-MM-DD so compare directly — avoid new Date() which
// parses ISO strings as UTC and can shift the date in non-UTC timezones.
function isTargetOnDate(row, isoDate) {
  return (row['_assignDate'] || '').trim() === isoDate;
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function tomorrowISO() {
  const n = new Date();
  n.setDate(n.getDate() + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function isDueToday(row) {
  if (isRedLock(row)) return isLockEndToday(row);
  if (isTamper(row)) return true;                    // TC01
  if (isBlackLock(row)) return true;                    // LKFS, TLOC, LOCK
  if (isSpecialRead(row)) return !!(row['aptstart'] || '').trim();  // MT31, ESTS, CKRD — any aptstart date
  return false;
}

// badge: null | 'star' | 'exclamation'
function makeLockIcon(bgColor, keyColor, badge = null) {
  let badgeSvg = '';
  if (badge === 'star') {
    badgeSvg = `<polygon points="20,2 20.88,4.29 23.33,4.42 21.43,5.96 22.06,8.33 20,7 17.94,8.33 18.57,5.96 16.67,4.42 19.12,4.29"
         fill="#fbbf24" stroke="#fff" stroke-width="0.6"/>`;
  } else if (badge === 'exclamation') {
    badgeSvg = `<circle cx="21" cy="5" r="3.8" fill="#fff" stroke="#dc2626" stroke-width="1"/>
      <text x="21" y="7.8" text-anchor="middle" font-size="6" font-weight="bold" fill="#dc2626">!</text>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg(bgColor)}
    <rect x="9" y="12" width="8" height="6" rx="1.2" fill="#fff"/>
    <path d="M10.5 12v-2a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="13" cy="15" r="1" fill="${keyColor}"/>
    ${badgeSvg}
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16] });
}

function makeOpenLockIcon() {
  // Dark grey circle with an open padlock (shackle raised on right side)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg('#4b5563')}
    <rect x="9" y="13" width="8" height="6" rx="1.2" fill="#fff"/>
    <path d="M10.5 13v-3a2.5 2.5 0 0 1 5 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="13" cy="16" r="1" fill="#4b5563"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16] });
}

function makeBatteryIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg('#f97316')}
    <rect x="7" y="10.5" width="10" height="5.5" rx="1.2" fill="none" stroke="#fff" stroke-width="1.5"/>
    <rect x="17" y="12" width="2" height="2.5" rx="0.5" fill="#fff"/>
    <line x1="9.5" y1="13.25" x2="11.5" y2="13.25" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16] });
}

function makeTamperIcon() {
  // Turquoise circle: closed lock body with a "!" exclamation — tamper alert
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg('#0d9488')}
    <rect x="9.5" y="12.5" width="7" height="5.5" rx="1.2" fill="#fff"/>
    <path d="M11 12.5v-1.8a2 2 0 0 1 4 0v1.8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13" y1="14.2" x2="13" y2="16" stroke="#0d9488" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="13" cy="17" r="0.6" fill="#0d9488"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16] });
}

function makeMoveIcon() {
  // Blue circle with a bold right-pointing arrow — represents relocation/move
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg('#3b82f6')}
    <line x1="7" y1="13" x2="17" y2="13" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <polyline points="13,9 17,13 13,17" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16] });
}

function makeSpecialReadIcon() {
  // Yellow circle with a checkmark — special/check read
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    ${markerBg('#eab308')}
    <polyline points="7.5,13.5 11,17 18.5,9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16] });
}

// ── Placed-notice icons (from MMR Combined tab) ───────────────────────────
// These mirror the distinctive markers the MMR "Add to Map" types create, so
// tenant notices / school reads / special reads etc. are recognisable in the
// field instead of collapsing into a plain notif-code marker.
function _placedLockSvg(color) {
  return `<svg viewBox="0 0 20 20" width="15" height="15" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="9" width="14" height="10" rx="2" fill="${color}"/>
    <path d="M6.5 9V6a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
}
function _placedCheckReadSvg(color) {
  return `<svg viewBox="0 0 20 20" width="15" height="15" xmlns="http://www.w3.org/2000/svg" fill="none">
    <rect x="3" y="2" width="14" height="17" rx="1.5" stroke="${color}" stroke-width="1.5"/>
    <path d="M7 2v-1h6v1" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6 11.5l3 3 5-5" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function _placedBatterySvg(color) {
  return `<svg viewBox="0 0 20 20" width="15" height="15" xmlns="http://www.w3.org/2000/svg" fill="none">
    <rect x="1" y="5.5" width="14.5" height="9" rx="1.5" stroke="${color}" stroke-width="1.5"/>
    <path d="M18 8.5v3" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="4" y1="10" x2="9" y2="10" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
function _placedEnvelopeSvg(color) {
  return `<svg viewBox="0 0 20 20" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="4.5" width="17" height="12" rx="1.5" fill="none" stroke="${color}" stroke-width="1.6"/>
    <path d="M1.5 6l8.5 5.5L18.5 6" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function _placedSchoolSvg(color) {
  return `<svg viewBox="0 0 20 20" width="16" height="15" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3 L19 7 L10 11 L1 7 Z" fill="${color}"/>
    <path d="M4.5 8.7 V12 C4.5 13.3 7 14.5 10 14.5 C13 14.5 15.5 13.3 15.5 12 V8.7" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="18.4" y1="7.3" x2="18.4" y2="11.5" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="18.4" cy="12" r="1" fill="${color}"/>
  </svg>`;
}

// Keyed to MMR's PLACED_TYPES so the icons match exactly.
const PLACED_TYPES = {
  tenant_notice: { bg: '#f39c12', ring: '#e67e22', icon: _placedEnvelopeSvg('#fff') },
  tenant_rdlk:   { bg: '#f39c12', ring: '#e67e22', icon: _placedEnvelopeSvg('#fff'),
                   overlay: _placedLockSvg('#e74c3c') },
  school_read:   { bg: '#8e44ad', ring: '#6c3483', icon: _placedSchoolSvg('#fff') },
  special_rmbe:  { bg: '#f1c40f', ring: '#d4ac0d', icon: _placedBatterySvg('#fff') },
  special_read:  { bg: '#fff',    ring: '#d4a017', icon: _placedCheckReadSvg('#d4a017'),
                   doubleRing: true },
};

function makePlacedNoticeIcon(type) {
  const cfg = PLACED_TYPES[type];
  if (!cfg) return null;
  const ring = cfg.doubleRing
    ? `<div style="position:absolute;top:-5px;left:-5px;right:-5px;bottom:-5px;border:2px solid ${cfg.ring};border-radius:50%"></div>`
    : '';
  const overlay = cfg.overlay
    ? `<span style="position:absolute;right:-5px;bottom:-5px;width:15px;height:15px;background:#fff;border-radius:3px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 2px rgba(0,0,0,0.6)"><span style="transform:scale(0.7);display:flex">${cfg.overlay}</span></span>`
    : '';
  const html = `<div style="position:relative;width:28px;height:28px;background:${cfg.bg};border-radius:50%;border:2px solid ${cfg.ring};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.5)">${cfg.icon}${overlay}${ring}</div>`;
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16] });
}

function makeBaseMarkerIcon(row) {
  const placed = (row['_placedType'] || '').trim();
  if (placed) {
    const icon = makePlacedNoticeIcon(placed);
    if (icon) return icon;
  }
  if (isRedLock(row)) {
    const badge = isLockEndPast(row) ? 'exclamation' : isLockEndToday(row) ? 'star' : null;
    return makeLockIcon('#ef4444', '#ef4444', badge);
  }
  if (isBlackLock(row)) return makeLockIcon('#1a1a1a', '#1a1a1a');
  if (isOpenLock(row)) return makeOpenLockIcon();
  if (isBattery(row)) return makeBatteryIcon();
  if (isTamper(row)) return makeTamperIcon();
  if (isMove(row)) return makeMoveIcon();
  if (isSpecialRead(row)) return makeSpecialReadIcon();
  return makeCircleIcon(getMarkerColor(row));
}

function makeMarkerIcon(row, count = 1) {
  let icon;
  if (row._isCustom) icon = makeCircleIcon('#7c3aed');
  else if (completions[row['Workorder'] || '']) icon = makeCircleIcon('#d1d5db');
  else icon = makeBaseMarkerIcon(row);
  if (count > 1) {
    icon = L.divIcon({
      html: `<div class="wo-marker-wrap">${icon.options.html}<span class="wo-stack-badge">${count}</span></div>`,
      className: '',
      iconSize: icon.options.iconSize,
      iconAnchor: icon.options.iconAnchor,
      popupAnchor: icon.options.popupAnchor,
    });
  }
  return icon;
}

function refreshMarkerIcon(workorder) {
  const entry = mapMarkers.find(m => (m.row['Workorder'] || '') === workorder);
  if (!entry) return;
  // Completing/un-completing changes the to-do count for every marker
  // stacked at the same coordinates, so refresh the whole stack
  const peers = entry.key ? mapMarkers.filter(m => m.key === entry.key) : [entry];
  const count = peers.filter(m => !completions[m.row['Workorder'] || '']).length;
  peers.forEach(m => {
    m.marker.setIcon(makeMarkerIcon(m.row, count));
    m.marker.setZIndexOffset(completions[m.row['Workorder'] || ''] ? -100 : 0);
  });
}

// ── Map initialisation ────────────────────────
const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com/">Esri</a> © OpenStreetMap',
  },
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

let tileLayerRef = null;

function applyTileTheme(style) {
  if (!leafletMap) return;
  mapStyle = style;
  let cfg;
  if (style === 'auto') {
    cfg = (darkMQ && darkMQ.matches) ? TILES.dark : TILES.light;
  } else {
    cfg = TILES[style] || TILES.light;
  }
  if (tileLayerRef) leafletMap.removeLayer(tileLayerRef);
  tileLayerRef = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19 });
  tileLayerRef.addTo(leafletMap);
  tileLayerRef.bringToBack();
}

function initLeafletMap() {
  if (mapInitialized) return;

  leafletMap = L.map('map-container', { zoomControl: true });

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 40,
    disableClusteringAtZoom: 16,   // street level: individual icons + count badges take over
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    iconCreateFunction: (c) => L.divIcon({
      html: `<div class="wo-cluster-icon">${c.getChildCount()}</div>`,
      className: '', iconSize: [34, 34], iconAnchor: [17, 17],
    }),
  }).addTo(leafletMap);

  darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  applyTileTheme(mapStyle);
  darkMQ.addEventListener('change', () => { if (mapStyle === 'auto') applyTileTheme('auto'); });

  leafletMap.on('locationfound', onLocationFound);
  leafletMap.on('locationerror', () => showToast('Could not get your location', true));
  leafletMap.on('move', resetGpsTimer);
  leafletMap.on('zoom', resetGpsTimer);

  mapInitialized = true;
}

// ── GPS tracking ──────────────────────────────
const GPS_TIMEOUT_MS = 5 * 60 * 1000;

function startLocating() {
  if (!mapInitialized || !leafletMap) return;
  if (!('geolocation' in navigator)) { showToast('Geolocation not supported', true); return; }
  leafletMap.locate({ setView: false, watch: true });
  gpsWatching = true;
  resetGpsTimer();
}

function onLocationFound(e) {
  if (userLocationMarker) {
    userLocationMarker.setLatLng(e.latlng);
  } else {
    const icon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
        fill="#1e50a2" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });
    userLocationMarker = L.marker(e.latlng, { icon, zIndexOffset: 1000 })
      .addTo(leafletMap)
      .bindPopup('<strong>Your Location</strong>');
    leafletMap.setView(e.latlng, 16);
  }
}

function resetGpsTimer() {
  if (!gpsWatching) return;
  clearTimeout(gpsAutoStopTimer);
  gpsAutoStopTimer = setTimeout(() => {
    if (leafletMap) leafletMap.stopLocate();
    gpsWatching = false;
    showToast('GPS stopped after 5 minutes of inactivity.');
  }, GPS_TIMEOUT_MS);
}

// ── Place markers ─────────────────────────────
function clearMapMarkers() {
  if (clusterGroup) clusterGroup.clearLayers();
  mapMarkers = [];
}

function placeMarkers(points, zoomToFit = true) {
  if (!mapInitialized) return;
  clearMapMarkers();
  const bounds = [];

  // Count incomplete WOs sharing the exact same coordinates so stacked
  // markers get a badge showing how many are still to do there
  const coordCounts = {};
  points.forEach(({ lat, lng, row }) => {
    if (completions[row['Workorder'] || '']) return;
    const key = `${lat},${lng}`;
    coordCounts[key] = (coordCounts[key] || 0) + 1;
  });

  points.forEach(({ lat, lng, row }) => {
    const key = `${lat},${lng}`;
    const icon = makeMarkerIcon(row, coordCounts[key] || 0);
    const addr = (row['Street Address'] || '').trim();
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const appleUrl = `https://maps.apple.com/?daddr=${lat},${lng}`;
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    const popup = `<strong>${esc(addr)}</strong>
      <br><a href="${googleUrl}" target="_blank" rel="noopener" class="popup-nav-link">Google</a>
      · <a href="${appleUrl}" target="_blank" rel="noopener" class="popup-nav-link">Apple</a>
      · <a href="${wazeUrl}" target="_blank" rel="noopener" class="popup-nav-link">Waze</a>`;

    // Completed (grey) markers sit below active ones so they never hide a live job
    const marker = L.marker([lat, lng], { icon, zIndexOffset: completions[row['Workorder'] || ''] ? -100 : 0 })
      .bindPopup(popup, { autoClose: false, closeOnClick: false });

    if (addr) {
      const city = (row['City'] || '').trim();
      marker.bindTooltip(stripCityFromAddr(addr, city), {
        permanent: true, direction: 'bottom', className: 'address-label', offset: [0, 4],
      });
    }

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (e.originalEvent) e.originalEvent.stopPropagation();
      marker.closePopup();
      activeGroup = geocodedPoints.filter(p => p.lat === lat && p.lng === lng);
      activeGroupIndex = activeGroup.findIndex(p => p.row === row);
      if (activeGroupIndex < 0) activeGroupIndex = 0;
      openDetailSheet(row, lat, lng);
    });

    clusterGroup.addLayer(marker);
    mapMarkers.push({ marker, row, key });
    bounds.push([lat, lng]);
  });

  if (bounds.length && zoomToFit) {
    leafletMap.invalidateSize();
    leafletMap.fitBounds(bounds, { padding: [48, 48] });
  }
}

// ── Add a single marker (from geocode fix) ────
function addSingleMarker(coords, row) {
  const key = `${coords.lat},${coords.lng}`;
  const count = geocodedPoints.filter(p =>
    p.lat === coords.lat && p.lng === coords.lng && !completions[p.row['Workorder'] || '']).length || 1;
  const icon = makeMarkerIcon(row, count);
  const addr = (row['Street Address'] || '').trim();
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  const appleUrl = `https://maps.apple.com/?daddr=${coords.lat},${coords.lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
  const popup = `<strong>${esc(addr)}</strong>
    <br><a href="${googleUrl}" target="_blank" rel="noopener" class="popup-nav-link">Google</a>
    · <a href="${appleUrl}" target="_blank" rel="noopener" class="popup-nav-link">Apple</a>
    · <a href="${wazeUrl}" target="_blank" rel="noopener" class="popup-nav-link">Waze</a>`;

  const marker = L.marker([coords.lat, coords.lng], { icon })
    .bindPopup(popup, { autoClose: false, closeOnClick: false });

  marker.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    if (e.originalEvent) e.originalEvent.stopPropagation();
    marker.closePopup();
    openDetailSheet(row, coords.lat, coords.lng);
  });

  clusterGroup.addLayer(marker);
  mapMarkers.push({ marker, row, key });
}

// ── Not-found banner ──────────────────────────
function updateNotFoundBar() {
  const n = geocodeFailures.length;
  if (n === 0) {
    notFoundBanner.classList.add('hidden');
  } else {
    notFoundText.textContent = `${n} address${n > 1 ? 'es' : ''} not found`;
    notFoundBanner.classList.remove('hidden');
  }
}

// ── Chip class for notification type ──────────
function chipClass(type) {
  const t = (type || '').toUpperCase();
  if (t === 'ZB') return 'chip-zb';
  if (t === 'YD') return 'chip-yd';
  if (t === 'YE') return 'chip-ye';
  return 'chip-default';
}

// ── Detail sheet ──────────────────────────────
function openDetailSheet(row, lat, lng) {
  sheetJustOpened = true;
  clearTimeout(openDetailSheet._guard);
  openDetailSheet._guard = setTimeout(() => { sheetJustOpened = false; }, 600);
  activeRow = row;

  if (activeGroup.length > 1) {
    detailGroupLabel.textContent = `${activeGroupIndex + 1} of ${activeGroup.length}`;
    detailGroupNav.classList.remove('hidden');
  } else {
    detailGroupNav.classList.add('hidden');
  }

  const notifType = (row['Notification Type'] || '').trim();
  detailNotifChip.textContent = notifType || '—';
  detailNotifChip.className = `notif-chip ${chipClass(notifType)}`;
  detailWoNum.textContent = `WO# ${row['Workorder'] || '—'}`;

  detailAddress.textContent = (row['Street Address'] || '').trim() || '—';

  const mis = (row['Mis Address'] || '').trim();
  if (mis) {
    detailMis.textContent = mis;
    detailMis.classList.remove('hidden');
  } else {
    detailMis.classList.add('hidden');
  }

  detailCity.textContent = (row['City'] || '').trim();

  const loc = (row['Device Location Note'] || '').trim();
  if (loc) {
    detailLoc.textContent = loc;
    detailLocRow.classList.remove('hidden');
  } else {
    detailLocRow.classList.add('hidden');
  }

  detailWorkType.textContent = (row['Meter Location'] || '').trim() || '—';
  detailNotifCode.textContent = (row['Notification Code'] || '').trim() || '—';
  detailMeterNum.textContent = (row['Meter Number'] || '').trim() || '—';
  detailMeterSize.textContent = (row['Meter Size'] || '').trim() || '—';

  const grid = (row['Grid'] || '').trim();
  const refErt = (row['Reference ERT'] || '').trim();
  detailLastRead.textContent = grid || '—';
  detailRefErt.textContent = refErt || '—';
  if (grid || refErt) {
    detailLastReadRow.classList.remove('hidden');
  } else {
    detailLastReadRow.classList.add('hidden');
  }

  const ts = (row['targetstart'] || '').trim();
  const tf = (row['targetfinish'] || '').trim();
  if (ts || tf) {
    detailDates.textContent = ts && tf ? `${fmtDate(ts)} → ${fmtDate(tf)}` : fmtDate(ts || tf);
    detailDatesRow.classList.remove('hidden');
  } else {
    detailDatesRow.classList.add('hidden');
  }

  navGoogle.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  navApple.href = `https://maps.apple.com/?daddr=${lat},${lng}`;
  navWaze.href = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  // Set complete button state
  const wo = (row['Workorder'] || '').trim();
  if (completions[wo]) {
    btnComplete.classList.add('done');
    btnComplete.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/></svg> Completed`;
  } else {
    btnComplete.classList.remove('done');
    btnComplete.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/></svg> Complete`;
  }

  if (row._isCustom) {
    detailNotifChip.textContent = 'Custom';
    detailNotifChip.className = 'notif-chip chip-default';
    detailWoNum.textContent = 'Added Address';
    btnComplete.classList.add('hidden');
    btnFixLocation.classList.add('hidden');
    btnDeleteWO.style.display = 'flex';
    btnDeleteWO.querySelector('span') && (btnDeleteWO.querySelector('span').textContent = 'Delete Address');
  } else {
    btnComplete.classList.remove('hidden');
    btnFixLocation.classList.remove('hidden');
    btnDeleteWO.style.display = 'flex';
    btnDeleteWO.querySelector('span') && (btnDeleteWO.querySelector('span').textContent = 'Delete Work Order');
  }

  if (isRedLock(row) && isLockEndPast(row)) {
    const tf = (row['targetfinish'] || '').trim();
    overdueText.textContent = `⚠ Lock end date has passed (${tf})`;
    overdueWarning.classList.remove('hidden');
  } else {
    overdueWarning.classList.add('hidden');
  }

  detailSheet.classList.remove('hidden');
  requestAnimationFrame(() => detailSheet.classList.add('open'));
}

function closeDetailSheet() {
  detailSheet.classList.remove('open');
  setTimeout(() => detailSheet.classList.add('hidden'), 310);
  activeRow = null;
}

// ── Geocode fix modal ─────────────────────────
function showGeocodeFix() {
  geocodeFixList.innerHTML = '';
  const cache = loadGeoCache();

  geocodeFailures.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'geocode-fix-item';
    item.innerHTML = `
      <div class="geocode-fix-addr">${esc((f.row['Street Address'] || '').trim())}, ${esc((f.row['City'] || '').trim())}</div>
      <div class="geocode-fix-row">
        <input type="text" class="geocode-fix-input" value="${esc(f.query)}" />
        <button class="geocode-fix-btn">Retry</button>
      </div>
      <div class="geocode-fix-status"></div>
    `;

    const input = item.querySelector('.geocode-fix-input');
    const btn = item.querySelector('.geocode-fix-btn');
    const status = item.querySelector('.geocode-fix-status');

    btn.addEventListener('click', () => {
      const q = input.value.trim();
      if (!q) return;
      btn.disabled = true;
      btn.textContent = '…';
      status.textContent = '';

      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ca`,
        { headers: { 'User-Agent': 'WorkOrderMapPWA/1.0' } }
      )
        .then(r => r.json())
        .then(data => {
          if (!data || !data[0]) {
            status.textContent = 'Not found — try a different query';
            status.className = 'geocode-fix-status geocode-fix-fail';
            btn.disabled = false;
            btn.textContent = 'Retry';
            return;
          }
          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          const cacheKey = `${cleanAddressForGeocode(f.streetAddress, f.misAddress)},${f.city}`.toLowerCase();
          cache[cacheKey] = coords;
          saveGeoCache(cache);

          geocodedPoints.push({ lat: coords.lat, lng: coords.lng, row: f.row });
          geocodeFailures = geocodeFailures.filter((_, i) => i !== idx);
          savePoints();
          addSingleMarker(coords, f.row);
          updateNotFoundBar();

          status.textContent = 'Located!';
          status.className = 'geocode-fix-status geocode-fix-ok';
          btn.textContent = '✓';
          input.disabled = true;
        })
        .catch(() => {
          status.textContent = 'Network error — try again';
          status.className = 'geocode-fix-status geocode-fix-fail';
          btn.disabled = false;
          btn.textContent = 'Retry';
        });
    });

    geocodeFixList.appendChild(item);
  });

  geocodeFixModal.classList.remove('hidden');
}

// ── Engineer filter ───────────────────────────
function buildEngineerFilter() {
  const engineers = [...new Set(
    workOrders.map(r => (r['engineer'] || '').trim()).filter(Boolean)
  )].sort();
  engineerFilterSel.innerHTML = '<option value="">All Engineers</option>';
  engineers.forEach(eng => {
    const opt = document.createElement('option');
    opt.value = eng;
    opt.textContent = eng;
    engineerFilterSel.appendChild(opt);
  });
  engineerFilterSel.classList.toggle('hidden', engineers.length === 0);
}

function getFilteredPoints() {
  const eng = engineerFilterSel.value;
  return geocodedPoints.filter(p => {
    if (eng && !p.row['_isCustom'] && (p.row['engineer'] || '').trim() !== eng) return false;

    if (dueTodayActive && !isDueToday(p.row)) return false;
    if (dateFilter === 'today' && !isTargetOnDate(p.row, todayISO())) return false;
    if (dateFilter === 'tomorrow' && !isTargetOnDate(p.row, tomorrowISO())) return false;
    if (locationFilter !== 'all') {
      const loc = (p.row['Meter Location'] || '').trim().toUpperCase();
      const isOutside = ['AB', 'AR', 'AL', 'AF', 'AO', 'AG', 'AT'].includes(loc);
      if (locationFilter === 'outside' && !isOutside) return false;
      if (locationFilter === 'inside' && isOutside) return false;
    }
    return true;
  });
}

function updateBadge() {
  const n = getFilteredPoints().length;
  woCountBadge.textContent = `${n} job${n !== 1 ? 's' : ''}`;
}

function updateCompletedCountBadge() {
  const n = Object.keys(completions).length;
  if (n > 0) {
    completedCountBadge.textContent = n;
    completedCountBadge.classList.remove('hidden');
  } else {
    completedCountBadge.classList.add('hidden');
  }
}

function updateStatusBar() {
  const pts = getFilteredPoints();
  const total = pts.length;
  if (total === 0) { statusBar.classList.add('hidden'); return; }
  const done = pts.filter(p => completions[p.row['Workorder'] || '']).length;
  const remaining = total - done;
  statusBar.innerHTML = `<span class="status-bar-version">${APP_VERSION}</span><span>${done} complete · ${remaining} remaining</span>`;
  statusBar.classList.remove('hidden');
}

// ── Load CSV and kick off geocoding ───────────
function applyNewCSV(records, keepPrev) {
  closeListView();
  let finalRecords = records;

  if (keepPrev && workOrders.length && selectedEngineer) {
    const prevIncomplete = workOrders.filter(r => {
      const wo = (r['Workorder'] || '').trim();
      return (r['engineer'] || '').trim() === selectedEngineer && wo && !completions[wo];
    });
    if (prevIncomplete.length) {
      const newWoIds = new Set(records.map(r => (r['Workorder'] || '').trim()));
      const extras = prevIncomplete.filter(r => !newWoIds.has((r['Workorder'] || '').trim()));
      finalRecords = [...records, ...extras];
    }
  }

  workOrders = finalRecords;
  geocodedPoints = [];
  geocodeFailures = [];
  selectedEngineer = '';
  clearMapMarkers();

  saveRecords(workOrders);
  try { localStorage.removeItem(ENGINEER_KEY); } catch (_) { }
  try { localStorage.removeItem(POINTS_KEY); } catch (_) { }

  showEngineerView();
}

// ── Engineer picker ───────────────────────────
// The roster always shows, whether or not those workers currently have work.
// Deriving this list purely from the loaded work orders locked people out once
// they cleared their route — and Upload CSV lives in the burger menu on the map,
// so they could never get far enough in to add any. Names present in the data
// are unioned in so anyone holding work can always reach it.
function engineerNames() {
  return [...new Set([
    ...ROSTER,
    ...workOrders.map(r => (r['engineer'] || '').trim()).filter(Boolean),
  ])].sort();
}

function showEngineerView() {
  viewHome.classList.add('hidden');
  viewMap.classList.add('hidden');
  viewPin.classList.add('hidden');
  viewEngineer.classList.remove('hidden');

  const names = engineerNames();

  engineerList.innerHTML = '';
  names.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'engineer-pick-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => selectEngineer(name));
    engineerList.appendChild(btn);
  });
}

function proceedToMap(myJobs) {
  showMapView();
  woCountBadge.textContent = `${myJobs.length} job${myJobs.length !== 1 ? 's' : ''}`;
  geocodeBar.classList.remove('hidden');
  geocodeBarFill.style.width = '0%';
  geocodeBarText.textContent = `Locating addresses… 0 / ${myJobs.length}`;
  notFoundBanner.classList.add('hidden');
  geocodeAllRecords((done, total) => {
    geocodeBarFill.style.width = Math.round((done / total) * 100) + '%';
    geocodeBarText.textContent = `Locating addresses… ${done} / ${total}`;
  }).then(({ points, failures }) => {
    geocodedPoints = points;
    geocodeFailures = failures;
    savePoints();
    geocodeBar.classList.add('hidden');
    placeMarkers(getFilteredPoints(), true);
    updateBadge();
    updateStatusBar();
    updateNotFoundBar();
    if (failures.length) showToast(`${failures.length} address${failures.length > 1 ? 'es' : ''} could not be located`);
  });
}

function selectEngineer(name) {
  selectedEngineer = name;
  try { localStorage.setItem(ENGINEER_KEY, name); } catch (_) { }

  // Narrow the saved records down to just this engineer's rows so the
  // localStorage payload stays small regardless of how large the full CSV is.
  const myJobs = workOrders.filter(r => (r['engineer'] || '').trim() === name);
  saveRecords(myJobs);

  viewEngineer.classList.add('hidden');

  if (!isPinUnlocked(name)) {
    showPinView(name, () => proceedToMap(myJobs));
    return;
  }
  proceedToMap(myJobs);
}

// ── View switching ────────────────────────────
function showMapView() {
  viewHome.classList.add('hidden');
  viewPin.classList.add('hidden');
  viewMap.classList.remove('hidden');
  initLeafletMap();
  // Fix Leaflet size after view switch
  setTimeout(() => leafletMap && leafletMap.invalidateSize(), 100);
}

function showHomeView() {
  viewMap.classList.add('hidden');
  viewPin.classList.add('hidden');
  viewHome.classList.remove('hidden');
}

// ── Restore from localStorage ─────────────────
function tryRestoreSession() {
  try {
    const saved = localStorage.getItem(RECORDS_KEY);
    if (!saved) return false;
    const records = JSON.parse(saved);
    if (!Array.isArray(records) || !records.length) return false;
    workOrders = records;
    return true;
  } catch (_) { return false; }
}

// ── Event listeners ───────────────────────────
async function reloadFromSheets() {
  if (btnRefresh) btnRefresh.classList.add('is-loading');

  // The cloud gist is the authority — it is the only copy that reflects
  // deletions. Google Sheets is the original import and still lists everything.
  const gistRecords = await fetchFromGist();
  if (gistRecords && gistRecords.length) {
    if (btnRefresh) btnRefresh.classList.remove('is-loading');
    showToast('Work orders reloaded');
    applyNewCSV(gistRecords, false);
    return;
  }

  // If the cloud read *failed*, stop. Falling through to Sheets here would
  // silently resurrect every work order that has been deleted.
  if (lastGistFetchError) {
    if (btnRefresh) btnRefresh.classList.remove('is-loading');
    showToast(`${lastGistFetchError} — keeping current list`, true);
    return;
  }

  // Fall back to Google Sheets
  const csvText = await fetchCSVFromSheets();
  if (btnRefresh) btnRefresh.classList.remove('is-loading');
  if (csvText) {
    const records = parseCSV(csvText);
    if (records.length && records[0].hasOwnProperty('Street Address')) {
      showToast('Work orders reloaded from Google Sheets');
      applyNewCSV(records, false);
      return;
    }
  }
  showToast('Could not reach Google Sheets — check your connection', true);
}

btnLoadNew.addEventListener('click', reloadFromSheets);
if (btnRefresh) btnRefresh.addEventListener('click', reloadFromSheets);

// ── Upload CSV file ───────────────────────────
let pendingUpload = null; // { rows, filename }

btnUploadCsv.addEventListener('click', () => {
  closeBurgerMenu();
  csvFileInput.value = '';
  csvFileInput.click();
});

csvFileInput.addEventListener('change', () => {
  const file = csvFileInput.files && csvFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let rows = [];
    try { rows = parseCSV(String(reader.result)); } catch (_) { }
    const hasCols = rows.length &&
      rows[0]['Street Address'] !== undefined &&
      (rows[0]['Work Order'] !== undefined || rows[0]['Workorder'] !== undefined);
    if (!hasCols) {
      showToast('Could not read that file — needs Street Address and Work Order columns', true);
      return;
    }
    pendingUpload = { rows, filename: file.name };
    uploadCsvDesc.textContent = `${rows.length} work order${rows.length !== 1 ? 's' : ''} found in ${file.name}.`;
    uploadAssignDate.value = todayISO();
    uploadCsvModal.classList.remove('hidden');
  };
  reader.onerror = () => showToast('Could not read that file', true);
  reader.readAsText(file);
});

btnUploadCancel.addEventListener('click', () => {
  pendingUpload = null;
  uploadCsvModal.classList.add('hidden');
});

btnUploadConfirm.addEventListener('click', async () => {
  if (!pendingUpload) return;
  const assignDate = uploadAssignDate.value || todayISO();
  const uploaded = normalizeUploadedRows(pendingUpload.rows, assignDate);
  const filename = pendingUpload.filename;
  pendingUpload = null;
  uploadCsvModal.classList.add('hidden');

  if (!uploaded.length) {
    showToast('No usable work orders in that file', true);
    return;
  }

  // Merge with the cloud list so other engineers' work orders are kept —
  // uploaded rows replace any existing record with the same Workorder.
  const uploadedIds = new Set(uploaded.map(r => r['Workorder']));
  const existing = await fetchFromGist();

  // Treating a failed read as an empty cloud list would push only these
  // uploaded rows back up, deleting every other engineer's work orders.
  if (existing === null && lastGistFetchError) {
    showToast(`${lastGistFetchError} — upload cancelled`, true);
    return;
  }

  const merged = (existing || [])
    .filter(r => !uploadedIds.has((r['Workorder'] || '').trim()))
    .concat(uploaded);

  const prevEngineer = selectedEngineer;
  applyNewCSV(merged, false);

  // Stay signed in: skip the engineer picker and go straight back to the map
  if (prevEngineer && merged.some(r => (r['engineer'] || '').trim() === prevEngineer)) {
    selectEngineer(prevEngineer);
  }

  showToast(`${uploaded.length} work order${uploaded.length !== 1 ? 's' : ''} loaded from ${filename}`);

  if (getGistToken()) {
    const ok = await updateGist(merged);
    if (ok) showToast('Synced to cloud — all devices will get this list');
  } else {
    showToast('Loaded on this device only — set a sync token to share to all devices');
  }
});

detailClose.addEventListener('click', closeDetailSheet);

// Tap outside detail sheet to close; also close burger menu
viewMap.addEventListener('click', (e) => {
  if (!burgerMenu.classList.contains('hidden') &&
    !burgerMenu.contains(e.target) &&
    e.target !== btnBurger && !btnBurger.contains(e.target)) {
    closeBurgerMenu();
  }
  if (sheetJustOpened) return;
  if (!detailSheet.classList.contains('hidden') && !detailSheet.contains(e.target)) {
    closeDetailSheet();
  }
});

engineerFilterSel.addEventListener('change', () => {
  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
});

btnAddAddress.addEventListener('click', () => {
  addAddressInput.value = '';
  addAddressStatus.classList.add('hidden');
  addAddressModal.classList.remove('hidden');
  addAddressInput.focus();
});

btnAddAddrCancel.addEventListener('click', () => {
  addAddressModal.classList.add('hidden');
});

btnAddAddrSubmit.addEventListener('click', async () => {
  const q = addAddressInput.value.trim();
  if (!q) return;
  btnAddAddrSubmit.disabled = true;
  btnAddAddrSubmit.textContent = '…';
  addAddressStatus.classList.add('hidden');
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ca`,
      { headers: { 'User-Agent': 'WorkOrderMapPWA/1.0' } }
    );
    const data = await res.json();
    if (data && data[0]) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      // Generate a unique ID for this custom address so it can be deleted later
      const customId = CUSTOM_ID_PREFIX + Date.now();
      const row = {
        'Street Address': q,
        'Workorder': customId,
        '_lat': String(coords.lat),
        '_lng': String(coords.lng),
        '_isCustom': true,
      };
      // Add to in-memory state and map
      geocodedPoints.push({ lat: coords.lat, lng: coords.lng, row });
      workOrders.push(row);
      savePoints();
      saveRecords(workOrders);
      addSingleMarker(coords, row);
      updateBadge();
      updateStatusBar();
      leafletMap.setView([coords.lat, coords.lng], Math.max(leafletMap.getZoom(), 15));
      addAddressModal.classList.add('hidden');
      // Sync to Gist
      btnAddAddrSubmit.textContent = 'Syncing…';
      const ok = (await pushCloudDelta({ upsertRows: [row] })).ok;
      showToast(ok ? 'Address added & synced to cloud' : 'Address added locally (sync failed)');
    } else {
      addAddressStatus.textContent = 'Address not found — try a more specific query';
      addAddressStatus.classList.remove('hidden');
    }
  } catch (_) {
    addAddressStatus.textContent = 'Network error — try again';
    addAddressStatus.classList.remove('hidden');
  }
  btnAddAddrSubmit.disabled = false;
  btnAddAddrSubmit.textContent = 'Add to Map';
});

addAddressInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnAddAddrSubmit.click();
});

// ── Fix location modal ────────────────────────
function showFixLocationModal() {
  if (!activeRow) return;
  const addr = (activeRow['Street Address'] || '').trim();
  const city = (activeRow['City'] || '').trim();
  const cleanAddr = cleanAddressForGeocode(addr, activeRow['Mis Address'] || '');
  const query = city ? `${cleanAddr}, ${city}, Ontario` : `${cleanAddr}, Ontario`;

  fixLocationOriginal.textContent = `Original: ${addr}${city ? ', ' + city : ''}`;
  fixLocationInput.value = query;
  fixLocationStatus.classList.add('hidden');
  fixLocationStatus.textContent = '';
  btnFixLocationSubmit.disabled = false;
  btnFixLocationSubmit.textContent = 'Relocate Pin';
  fixLocationModal.classList.remove('hidden');
  setTimeout(() => fixLocationInput.select(), 80);
}

async function handleFixLocationSubmit() {
  const q = fixLocationInput.value.trim();
  if (!q || !activeRow) return;

  btnFixLocationSubmit.disabled = true;
  btnFixLocationSubmit.textContent = 'Searching…';
  fixLocationStatus.classList.add('hidden');

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ca`,
      { headers: { 'User-Agent': 'WorkOrderMapPWA/1.0' } }
    );
    const data = await res.json();

    if (!data || !data[0]) {
      fixLocationStatus.textContent = 'Address not found — try a more specific query';
      fixLocationStatus.style.color = '#dc2626';
      fixLocationStatus.classList.remove('hidden');
      btnFixLocationSubmit.disabled = false;
      btnFixLocationSubmit.textContent = 'Relocate Pin';
      return;
    }

    const newLat = parseFloat(data[0].lat);
    const newLng = parseFloat(data[0].lon);

    // Update geocache so future loads use the corrected position
    const cache = loadGeoCache();
    const streetAddress = (activeRow['Street Address'] || '').trim();
    const misAddress = (activeRow['Mis Address'] || '').trim();
    const city = (activeRow['City'] || '').trim();
    const cacheKey = `${cleanAddressForGeocode(streetAddress, misAddress)},${city}`.toLowerCase();
    cache[cacheKey] = { lat: newLat, lng: newLng };
    saveGeoCache(cache);

    // Move the point in geocodedPoints
    const pt = geocodedPoints.find(p => p.row === activeRow);
    if (pt) {
      pt.lat = newLat;
      pt.lng = newLng;
    } else {
      geocodedPoints.push({ lat: newLat, lng: newLng, row: activeRow });
    }
    savePoints();

    // Redraw markers and pan to new position
    placeMarkers(getFilteredPoints(), false);
    if (leafletMap) leafletMap.setView([newLat, newLng], Math.max(leafletMap.getZoom(), 16));

    fixLocationModal.classList.add('hidden');
    showToast('Pin relocated successfully');

    // Re-open the detail sheet at the corrected location
    activeGroup = geocodedPoints.filter(p => p.lat === newLat && p.lng === newLng);
    activeGroupIndex = activeGroup.findIndex(p => p.row === activeRow);
    if (activeGroupIndex < 0) activeGroupIndex = 0;
    openDetailSheet(activeRow, newLat, newLng);

  } catch (_) {
    fixLocationStatus.textContent = 'Network error — try again';
    fixLocationStatus.style.color = '#dc2626';
    fixLocationStatus.classList.remove('hidden');
    btnFixLocationSubmit.disabled = false;
    btnFixLocationSubmit.textContent = 'Relocate Pin';
  }
}

btnFixLocation.addEventListener('click', showFixLocationModal);
btnFixLocationSubmit.addEventListener('click', handleFixLocationSubmit);
btnFixLocationCancel.addEventListener('click', () => fixLocationModal.classList.add('hidden'));
fixLocationInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleFixLocationSubmit(); });

function optimiseRoute(points) {
  if (points.length <= 2) return points.slice();

  // Squared lat/lng distance — fast enough for nearest-neighbour within a city
  function dist2(a, b) {
    const dlat = a.lat - b.lat;
    const dlng = a.lng - b.lng;
    return dlat * dlat + dlng * dlng;
  }

  // Start from the GPS location if available, otherwise first point
  let startLat, startLng;
  if (userLocationMarker) {
    const ll = userLocationMarker.getLatLng();
    startLat = ll.lat; startLng = ll.lng;
  } else {
    startLat = points[0].lat; startLng = points[0].lng;
  }

  const unvisited = points.slice();
  const route = [];
  let cur = { lat: startLat, lng: startLng };

  while (unvisited.length) {
    let bestIdx = 0, bestD = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = dist2(cur, unvisited[i]);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    cur = unvisited.splice(bestIdx, 1)[0];
    route.push(cur);
  }

  return route;
}

btnGarminExport.addEventListener('click', () => {
  const points = getFilteredPoints();
  if (!points.length) {
    showToast('No work orders to export', true);
    return;
  }
  const ordered = optimiseRoute(points);
  const wpts = ordered.map(({ lat, lng, row }) => {
    const addr = stripCityFromAddr((row['Street Address'] || '').trim(), (row['City'] || '').trim());
    const wo = (row['Workorder'] || '').trim();
    const name = addr || wo || 'Work Order';
    const desc = wo ? `WO# ${wo}` : 'Added Address';
    return `  <wpt lat="${lat}" lon="${lng}">\n    <name>${esc(name)}</name>\n    <desc>${esc(desc)}</desc>\n  </wpt>`;
  }).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="WorkOrderMap" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>`;
  const date = new Date().toLocaleDateString('en-CA');
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workorders-${date}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeBurgerMenu();
  showToast(`${ordered.length} waypoint${ordered.length !== 1 ? 's' : ''} exported (optimised)`);
});

btnLabels.addEventListener('click', () => {
  showLabels = !showLabels;
  btnLabels.classList.toggle('active', showLabels);
  document.getElementById('map-container').classList.toggle('hide-labels', !showLabels);
});

btnDetailPrev.addEventListener('click', () => {
  if (activeGroup.length < 2) return;
  activeGroupIndex = (activeGroupIndex - 1 + activeGroup.length) % activeGroup.length;
  const { lat, lng, row } = activeGroup[activeGroupIndex];
  openDetailSheet(row, lat, lng);
});

btnDetailNext.addEventListener('click', () => {
  if (activeGroup.length < 2) return;
  activeGroupIndex = (activeGroupIndex + 1) % activeGroup.length;
  const { lat, lng, row } = activeGroup[activeGroupIndex];
  openDetailSheet(row, lat, lng);
});

btnDueToday.addEventListener('click', () => {
  dueTodayActive = !dueTodayActive;
  btnDueToday.classList.toggle('active', dueTodayActive);
  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
});

btnDateFilter.addEventListener('click', () => {
  if (dateFilter === 'all') {
    dateFilter = 'today';
    dateFilterValue.textContent = 'Today';
    btnDateFilter.classList.add('active');
    btnDateFilter.classList.remove('tomorrow');
  } else if (dateFilter === 'today') {
    dateFilter = 'tomorrow';
    dateFilterValue.textContent = 'Tomorrow';
    btnDateFilter.classList.add('active', 'tomorrow');
  } else {
    dateFilter = 'all';
    dateFilterValue.textContent = 'All Dates';
    btnDateFilter.classList.remove('active', 'tomorrow');
  }
  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
});

btnLocationFilter.addEventListener('click', () => {
  if (locationFilter === 'all') {
    locationFilter = 'inside';
    locationFilterValue.textContent = 'Inside';
    btnLocationFilter.classList.add('active-inside');
    btnLocationFilter.classList.remove('active-outside');
  } else if (locationFilter === 'inside') {
    locationFilter = 'outside';
    locationFilterValue.textContent = 'Outside';
    btnLocationFilter.classList.remove('active-inside');
    btnLocationFilter.classList.add('active-outside');
  } else {
    locationFilter = 'all';
    locationFilterValue.textContent = 'All Locations';
    btnLocationFilter.classList.remove('active-inside', 'active-outside');
  }
  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
});

mapStyleMenu.querySelectorAll('[data-style]').forEach(item => {
  item.addEventListener('click', e => {
    e.stopPropagation();
    const style = item.dataset.style;
    applyTileTheme(style);
    localStorage.setItem(MAP_STYLE_KEY, style);
    mapStyleMenu.querySelectorAll('[data-style]').forEach(i =>
      i.classList.toggle('active', i.dataset.style === mapStyle));
    closeBurgerMenu();
  });
});

document.addEventListener('click', e => {
  if (!burgerMenu.classList.contains('hidden') &&
    !burgerMenu.contains(e.target) &&
    e.target !== btnBurger && !btnBurger.contains(e.target)) {
    closeBurgerMenu();
  }
});

btnMergeKeep.addEventListener('click', () => {
  mergeModal.classList.add('hidden');
  applyNewCSV(pendingRecords, true);
  pendingRecords = null;
});

btnMergeFresh.addEventListener('click', () => {
  mergeModal.classList.add('hidden');
  applyNewCSV(pendingRecords, false);
  pendingRecords = null;
});

btnFixAddresses.addEventListener('click', showGeocodeFix);
geocodeFixClose.addEventListener('click', () => geocodeFixModal.classList.add('hidden'));
overdueDismiss.addEventListener('click', () => overdueWarning.classList.add('hidden'));

// ── Burger menu ───────────────────────────────
function openBurgerMenu() {
  mapStyleMenu.querySelectorAll('[data-style]').forEach(i =>
    i.classList.toggle('active', i.dataset.style === mapStyle));
  burgerMenu.classList.remove('hidden');
}

function closeBurgerMenu() {
  burgerMenu.classList.add('hidden');
}

// ── List view ─────────────────────────────────
function openListView() {
  closeBurgerMenu();
  detailSheet.classList.add('hidden');
  detailSheet.classList.remove('open');
  activeRow = null;
  buildListView();
  listViewPanel.classList.remove('hidden');
}

function closeListView() {
  listViewPanel.classList.add('hidden');
}

function buildListView() {
  const pts = getFilteredPoints();

  function urgency(row) {
    if (isRedLock(row) && isLockEndPast(row)) return 0;
    if (isDueToday(row)) return 1;
    return 2;
  }

  const incomplete = pts
    .filter(p => !completions[(p.row['Workorder'] || '').trim()])
    .sort((a, b) => {
      const ud = urgency(a.row) - urgency(b.row);
      if (ud) return ud;
      return (a.row['Street Address'] || '').localeCompare(b.row['Street Address'] || '');
    });

  const done = pts
    .filter(p => completions[(p.row['Workorder'] || '').trim()])
    .sort((a, b) => (a.row['Street Address'] || '').localeCompare(b.row['Street Address'] || ''));

  listViewCount.textContent = `${pts.length} job${pts.length !== 1 ? 's' : ''}`;
  listViewBody.innerHTML = '';

  function makeItem(pt, isDone) {
    const { lat, lng, row } = pt;
    const addr = stripCityFromAddr((row['Street Address'] || '').trim(), (row['City'] || '').trim());
    const city = (row['City'] || '').trim();
    const wo = (row['Workorder'] || '').trim();
    const code = (row['Notification Code'] || '').trim();
    const type = (row['Notification Type'] || '').trim();
    const color = isDone ? '#d1d5db' : getMarkerColor(row);
    const isOverdue = !isDone && isRedLock(row) && isLockEndPast(row);

    const metaParts = [];
    if (wo) metaParts.push(`WO# ${wo}`);
    if (code) metaParts.push(code);
    if (city) metaParts.push(city);

    const item = document.createElement('div');
    item.className = `list-item${isDone ? ' list-item-done' : ''}`;
    item.innerHTML = `
      <div class="list-item-dot" style="background:${esc(color)}"></div>
      <div class="list-item-body">
        <div class="list-item-address">${esc(addr || wo || '—')}${isOverdue ? '<span class="list-item-overdue">OVERDUE</span>' : ''}</div>
        <div class="list-item-meta">${esc(metaParts.join(' · '))}</div>
      </div>
      <div class="list-item-right">
        <span class="notif-chip ${chipClass(type)}">${esc(type || '—')}</span>
        ${isDone ? '<svg class="list-item-done-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>`;

    item.addEventListener('click', () => {
      closeListView();
      activeGroup = geocodedPoints.filter(p => p.lat === lat && p.lng === lng);
      activeGroupIndex = activeGroup.findIndex(p => p.row === row);
      if (activeGroupIndex < 0) activeGroupIndex = 0;
      if (leafletMap) leafletMap.setView([lat, lng], Math.max(leafletMap.getZoom(), 16));
      openDetailSheet(row, lat, lng);
    });

    return item;
  }

  if (incomplete.length) {
    const hdr = document.createElement('div');
    hdr.className = 'list-section-header';
    hdr.textContent = `Pending (${incomplete.length})`;
    listViewBody.appendChild(hdr);
    incomplete.forEach(pt => listViewBody.appendChild(makeItem(pt, false)));
  }

  if (done.length) {
    const hdr = document.createElement('div');
    hdr.className = 'list-section-header';
    hdr.textContent = `Completed (${done.length})`;
    listViewBody.appendChild(hdr);
    done.forEach(pt => listViewBody.appendChild(makeItem(pt, true)));
  }

  if (!pts.length) {
    const empty = document.createElement('div');
    empty.className = 'list-view-empty';
    empty.textContent = 'No work orders match the current filters.';
    listViewBody.appendChild(empty);
  }
}

btnBurger.addEventListener('click', e => {
  e.stopPropagation();
  burgerMenu.classList.contains('hidden') ? openBurgerMenu() : closeBurgerMenu();
});

btnListView.addEventListener('click', openListView);
btnListClose.addEventListener('click', closeListView);

btnLocate.addEventListener('click', () => {
  closeBurgerMenu();
  startLocating();
});

btnDeleteCompleted.addEventListener('click', () => {
  const n = Object.keys(completions).length;
  if (!n) {
    showToast('No completed work orders to delete', true);
    closeBurgerMenu();
    return;
  }
  deleteConfirmDesc.textContent = `Permanently remove ${n} completed work order${n !== 1 ? 's' : ''} from the map?`;
  closeBurgerMenu();
  deleteConfirmModal.classList.remove('hidden');
});

btnDeleteCancel.addEventListener('click', () => deleteConfirmModal.classList.add('hidden'));

// ── Delete by Date ─────────────────────────────────────────────────────────
const deleteByDateModal = document.getElementById('delete-by-date-modal');
const deleteByDateInput = document.getElementById('delete-by-date-input');
const deleteByDateCount = document.getElementById('delete-by-date-count');
const btnDeleteByDate = document.getElementById('btn-delete-by-date');
const btnDeleteByDateConfirm = document.getElementById('btn-delete-by-date-confirm');
const btnDeleteByDateCancel = document.getElementById('btn-delete-by-date-cancel');

btnDeleteByDate.addEventListener('click', () => {
  closeBurgerMenu();
  deleteByDateInput.value = todayISO();
  updateDeleteByDateCount();
  deleteByDateModal.classList.remove('hidden');
});

// A blank engineer used to match every engineer's rows, and custom addresses
// were included regardless of owner. The modal's count must be exactly what
// gets deleted, so neither widening is allowed. Custom addresses are removed
// individually via Delete Work Order.
function myWorkOrdersOnDate(date) {
  if (!selectedEngineer) return [];
  return workOrders.filter(r =>
    (r['_assignDate'] || '').trim() === date &&
    (r['engineer'] || '').trim() === selectedEngineer
  );
}

function updateDeleteByDateCount() {
  const date = deleteByDateInput.value;
  if (!date) { deleteByDateCount.textContent = ''; return; }
  const n = myWorkOrdersOnDate(date).length;
  deleteByDateCount.textContent = n
    ? `${n} work order${n !== 1 ? 's' : ''} will be deleted.`
    : 'No work orders found for this date.';
  deleteByDateCount.style.color = n ? '#dc2626' : 'var(--text-medium)';
  btnDeleteByDateConfirm.disabled = n === 0;
}

deleteByDateInput.addEventListener('input', updateDeleteByDateCount);
btnDeleteByDateCancel.addEventListener('click', () => deleteByDateModal.classList.add('hidden'));

btnDeleteByDateConfirm.addEventListener('click', async () => {
  const date = deleteByDateInput.value;
  if (!date) return;

  const matched = myWorkOrdersOnDate(date);
  const n = matched.length;
  if (!n) return;

  const matchedKeys = new Set(matched.map(rowKey));
  const completionIds = matched.map(woId).filter(Boolean);

  // Sync before touching local state: a deletion that lands here but not in the
  // cloud simply comes back on the next refresh.
  btnDeleteByDateConfirm.disabled = true;
  btnDeleteByDateConfirm.textContent = 'Deleting…';
  const res = await pushCloudDelta({ removeKeys: [...matchedKeys] });
  btnDeleteByDateConfirm.disabled = false;
  btnDeleteByDateConfirm.textContent = 'Delete';

  if (!res.ok) {
    showToast(`${res.reason} — nothing deleted`, true);
    return;
  }

  geocodedPoints = geocodedPoints.filter(p => !matchedKeys.has(rowKey(p.row)));
  workOrders = workOrders.filter(r => !matchedKeys.has(rowKey(r)));
  completionIds.forEach(wo => delete completions[wo]);
  saveCompletions();
  savePoints();
  saveRecords(workOrders);

  if (activeRow && matchedKeys.has(rowKey(activeRow))) closeDetailSheet();

  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
  updateCompletedCountBadge();
  deleteByDateModal.classList.add('hidden');

  showToast(`${n} work order${n !== 1 ? 's' : ''} deleted & synced`);
});

btnDeleteConfirm.addEventListener('click', async () => {
  const completedIds = new Set(Object.keys(completions));
  const n = completedIds.size;
  if (!n) return;

  btnDeleteConfirm.disabled = true;
  btnDeleteConfirm.textContent = 'Deleting…';
  const res = await pushCloudDelta({ removeIds: [...completedIds] });
  btnDeleteConfirm.disabled = false;
  btnDeleteConfirm.textContent = 'Delete';

  if (!res.ok) {
    showToast(`${res.reason} — nothing deleted`, true);
    return;
  }

  geocodedPoints = geocodedPoints.filter(p => !completedIds.has(woId(p.row)));
  workOrders = workOrders.filter(r => !completedIds.has(woId(r)));
  completions = {};
  saveCompletions();
  saveRecords(workOrders);
  savePoints();

  if (activeRow && completedIds.has(woId(activeRow))) {
    closeDetailSheet();
  }

  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
  updateCompletedCountBadge();
  deleteConfirmModal.classList.add('hidden');

  showToast(`${n} work order${n !== 1 ? 's' : ''} deleted & synced`);
});

function onNavClick(e) {
  if (activeRow && isRedLock(activeRow) && isLockEndPast(activeRow)) {
    e.preventDefault();
    const tf = (activeRow['targetfinish'] || '').trim();
    overdueText.textContent = `⚠ Lock end date has passed (${tf})`;
    overdueWarning.classList.remove('hidden');
  }
}
navGoogle.addEventListener('click', onNavClick);
navApple.addEventListener('click', onNavClick);
navWaze.addEventListener('click', onNavClick);

btnComplete.addEventListener('click', () => {
  if (!activeRow) return;
  const wo = (activeRow['Workorder'] || '').trim();
  if (!wo) return;

  if (completions[wo]) {
    // Undo
    delete completions[wo];
    saveCompletions();
    refreshMarkerIcon(wo);
    btnComplete.classList.remove('done');
    btnComplete.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/></svg> Complete`;
  } else {
    // Mark complete
    completions[wo] = { date: new Date().toLocaleString('en-CA') };
    saveCompletions();
    refreshMarkerIcon(wo);
    btnComplete.classList.add('done');
    btnComplete.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/></svg> Completed`;
    showToast('Work order completed');
  }
  updateStatusBar();
  updateCompletedCountBadge();
});

// ── Universal delete work order (covers regular WOs, TN- notices, and custom addresses) ──
btnDeleteWO.addEventListener('click', async () => {
  if (!activeRow) return;
  const wo = woId(activeRow);
  const addr = (activeRow['Street Address'] || '').trim();
  const label = activeRow._isCustom ? 'address' : 'work order';

  if (!confirm(`Delete this ${label} (${addr || wo})? This will sync to all users.`)) return;

  const res = await pushCloudDelta({ removeIds: [wo] });
  if (!res.ok) {
    showToast(`${res.reason} — nothing deleted`, true);
    return;
  }

  geocodedPoints = geocodedPoints.filter(p => woId(p.row) !== wo);
  workOrders = workOrders.filter(r => woId(r) !== wo);
  delete completions[wo];
  saveCompletions();
  savePoints();
  saveRecords(workOrders);

  closeDetailSheet();
  placeMarkers(getFilteredPoints(), false);
  updateBadge();
  updateStatusBar();
  updateCompletedCountBadge();

  showToast('Deleted & synced to cloud');
});

// ── New Work Order ─────────────────────────────────────────────────────────
function openNewWoModal() {
  closeBurgerMenu();
  nwoWorkorder.value = '';
  nwoAddress.value = '';
  nwoCity.value = '';
  nwoNotifType.value = '';
  nwoNotifCode.value = '';
  nwoMeterNum.value = '';
  nwoMeterSize.value = '';
  nwoMeterLoc.value = '';
  nwoLocNote.value = '';
  newWoStatus.classList.add('hidden');
  btnNewWoSubmit.disabled = false;
  btnNewWoSubmit.textContent = 'Create & Add to Map';
  newWoModal.classList.remove('hidden');
  setTimeout(() => nwoAddress.focus(), 80);
}

btnNewWo.addEventListener('click', openNewWoModal);

// ── Set Sync Token ─────────────────────────────────────────────────────────
const setTokenModal = document.getElementById('set-token-modal');
const setTokenInput = document.getElementById('set-token-input');
const btnSetToken = document.getElementById('btn-set-token');
const btnSetTokenSave = document.getElementById('btn-set-token-save');
const btnSetTokenClear = document.getElementById('btn-set-token-clear');
const btnSetTokenCancel = document.getElementById('btn-set-token-cancel');
const tokenStatusLabel = document.getElementById('token-status-label');

function updateTokenStatusLabel() {
  tokenStatusLabel.textContent = getGistToken() ? 'Set ✓' : 'Not set';
  tokenStatusLabel.style.color = getGistToken() ? '#22c55e' : '#f97316';
}

const btnSetTokenTest = document.getElementById('btn-set-token-test');
const tokenCheckResult = document.getElementById('token-check-result');

function showTokenCheck(msg, ok) {
  tokenCheckResult.textContent = msg;
  tokenCheckResult.style.color = ok ? '#22c55e' : '#f97316';
  tokenCheckResult.classList.remove('hidden');
}

// Checks a token end to end: is it valid, is it the right *kind* of token, does
// it carry the gist scope, and can it actually reach our gist. GitHub exposes
// x-oauth-scopes only for classic tokens — a missing header is how we detect a
// fine-grained token, which the Gists API does not support at all.
async function validateGistToken(token) {
  let res;
  try {
    res = await fetch('https://api.github.com/user', {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch (_) {
    return { ok: false, msg: 'Could not reach GitHub — check your connection' };
  }

  if (res.status === 401) {
    return { ok: false, msg: 'Rejected — token is wrong, revoked, or expired' };
  }
  if (!res.ok) {
    return { ok: false, msg: gistErrorMessage(res.status) };
  }

  const scopes = res.headers.get('x-oauth-scopes');
  if (scopes === null) {
    return {
      ok: false,
      msg: 'This is a fine-grained token. Gists need a CLASSIC token — ' +
        'GitHub → Settings → Developer settings → Tokens (classic), tick "gist".',
    };
  }
  if (!scopes.split(',').map(x => x.trim()).includes('gist')) {
    return {
      ok: false,
      msg: 'Classic token, but the "gist" scope is not ticked. ' +
        `Scopes found: ${scopes || 'none'}.`,
    };
  }

  let gistRes;
  try {
    gistRes = await fetch(`https://api.github.com/gists/${GITHUB_GIST_ID}`, {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch (_) {
    return { ok: false, msg: 'Could not reach the gist — check your connection' };
  }
  if (!gistRes.ok) {
    return { ok: false, msg: `Token is valid but the gist is unreachable (${gistRes.status})` };
  }

  const login = (await res.json().catch(() => ({}))).login || 'unknown';
  return { ok: true, msg: `Working — signed in as ${login}, gist reachable.` };
}

btnSetToken.addEventListener('click', () => {
  closeBurgerMenu();
  setTokenInput.value = getGistToken();
  tokenCheckResult.classList.add('hidden');
  setTokenModal.classList.remove('hidden');
  setTimeout(() => setTokenInput.focus(), 80);
});

btnSetTokenTest.addEventListener('click', async () => {
  const val = setTokenInput.value.trim();
  if (!val) { showTokenCheck('Enter a token first.', false); return; }
  btnSetTokenTest.disabled = true;
  btnSetTokenTest.textContent = 'Testing…';
  const result = await validateGistToken(val);
  btnSetTokenTest.disabled = false;
  btnSetTokenTest.textContent = 'Test Token';
  showTokenCheck(result.msg, result.ok);
});

btnSetTokenSave.addEventListener('click', async () => {
  const val = setTokenInput.value.trim();
  if (!val) { showToast('Token cannot be empty', true); return; }

  btnSetTokenSave.disabled = true;
  btnSetTokenSave.textContent = 'Checking…';
  const result = await validateGistToken(val);
  btnSetTokenSave.disabled = false;
  btnSetTokenSave.textContent = 'Save';

  // A token that cannot write is worse than none — it fails silently at delete
  // time. Save it only if it checks out, and say why when it does not.
  if (!result.ok) { showTokenCheck(result.msg, false); return; }

  localStorage.setItem(GIST_TOKEN_KEY, val);
  updateTokenStatusLabel();
  setTokenModal.classList.add('hidden');
  showToast('Sync token saved & verified');
});

btnSetTokenClear.addEventListener('click', () => {
  localStorage.removeItem(GIST_TOKEN_KEY);
  setTokenInput.value = '';
  updateTokenStatusLabel();
  setTokenModal.classList.add('hidden');
  showToast('Sync token cleared');
});

btnSetTokenCancel.addEventListener('click', () => setTokenModal.classList.add('hidden'));
btnNewWoCancel.addEventListener('click', () => newWoModal.classList.add('hidden'));

btnNewWoSubmit.addEventListener('click', async () => {
  const addr = nwoAddress.value.trim();
  if (!addr) {
    newWoStatus.textContent = 'Street Address is required.';
    newWoStatus.style.color = '#dc2626';
    newWoStatus.classList.remove('hidden');
    nwoAddress.focus();
    return;
  }

  btnNewWoSubmit.disabled = true;
  btnNewWoSubmit.textContent = 'Geocoding…';
  newWoStatus.classList.add('hidden');

  const city = nwoCity.value.trim();
  const q = city ? `${addr}, ${city}, Ontario` : `${addr}, Ontario`;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ca`,
      { headers: { 'User-Agent': 'WorkOrderMapPWA/1.0' } }
    );
    const data = await res.json();

    if (!data || !data[0]) {
      newWoStatus.textContent = 'Address not found — try a more specific query.';
      newWoStatus.style.color = '#dc2626';
      newWoStatus.classList.remove('hidden');
      btnNewWoSubmit.disabled = false;
      btnNewWoSubmit.textContent = 'Create & Add to Map';
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    const newWoId = nwoWorkorder.value.trim() || (NEW_WO_ID_PREFIX + Date.now());

    const row = {
      'Workorder': newWoId,
      'Street Address': addr,
      'City': city,
      'Notification Type': nwoNotifType.value,
      'Notification Code': nwoNotifCode.value,
      'Meter Number': nwoMeterNum.value.trim(),
      'Meter Size': nwoMeterSize.value.trim(),
      'Meter Location': nwoMeterLoc.value.trim(),
      'Device Location Note': nwoLocNote.value.trim(),
      'engineer': selectedEngineer,
      '_lat': String(lat),
      '_lng': String(lng),
    };

    // Save to geocache so relocations work
    const cache = loadGeoCache();
    const cacheKey = `${cleanAddressForGeocode(addr, '')},${city}`.toLowerCase();
    cache[cacheKey] = { lat, lng };
    saveGeoCache(cache);

    workOrders.push(row);
    geocodedPoints.push({ lat, lng, row });
    savePoints();
    saveRecords(workOrders);

    addSingleMarker({ lat, lng }, row);
    updateBadge();
    updateStatusBar();
    if (leafletMap) leafletMap.setView([lat, lng], Math.max(leafletMap.getZoom(), 15));

    newWoModal.classList.add('hidden');

    btnNewWoSubmit.textContent = 'Syncing…';
    const ok = (await pushCloudDelta({ upsertRows: [row] })).ok;
    showToast(ok ? `Work order ${newWoId} created & synced` : `Work order ${newWoId} created locally (sync failed)`);
  } catch (_) {
    newWoStatus.textContent = 'Network error — try again.';
    newWoStatus.style.color = '#dc2626';
    newWoStatus.classList.remove('hidden');
    btnNewWoSubmit.disabled = false;
    btnNewWoSubmit.textContent = 'Create & Add to Map';
  }
});

// ── PIN lock helpers ──────────────────────────
function isPinUnlocked(engineer) {
  if (!(engineer in ENGINEER_PINS)) return true; // no PIN configured for this engineer
  const today = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
  return localStorage.getItem(PIN_UNLOCK_PREFIX + engineer) === today;
}

function showPinView(engineer, onSuccess) {
  pendingPinEngineer = engineer;
  pendingPinCallback = onSuccess;
  viewHome.classList.add('hidden');
  viewEngineer.classList.add('hidden');
  viewMap.classList.add('hidden');
  viewPin.classList.remove('hidden');
  pinInput.value = '';
  pinError.classList.add('hidden');
  setTimeout(() => pinInput.focus(), 100);
}

function attemptPinUnlock() {
  const expectedPin = ENGINEER_PINS[pendingPinEngineer] || '';
  if (pinInput.value === expectedPin) {
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem(PIN_UNLOCK_PREFIX + pendingPinEngineer, today);
    viewPin.classList.add('hidden');
    pinError.classList.add('hidden');
    if (pendingPinCallback) pendingPinCallback();
  } else {
    pinError.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
  }
}

btnPinUnlock.addEventListener('click', attemptPinUnlock);
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptPinUnlock(); });

// ── Boot ──────────────────────────────────────
function restoreSession(savedEngineer) {
  selectedEngineer = savedEngineer;
  showMapView();
  const myJobs = workOrders.filter(r => (r['engineer'] || '').trim() === savedEngineer);
  woCountBadge.textContent = `${myJobs.length} job${myJobs.length !== 1 ? 's' : ''}`;
  const savedPoints = loadPoints();
  setTimeout(() => {
    if (savedPoints.length) {
      geocodedPoints = savedPoints;
      placeMarkers(getFilteredPoints(), true);
      updateBadge(); updateStatusBar(); updateNotFoundBar();
    } else {
      // No saved points (e.g. crash during geocoding) — re-geocode from cache
      geocodeAllRecords(() => { }).then(({ points, failures }) => {
        geocodedPoints = points; geocodeFailures = failures;
        if (points.length) savePoints();
        placeMarkers(getFilteredPoints(), true);
        updateBadge(); updateStatusBar(); updateNotFoundBar();
      });
    }
  }, 150);
}

// Last resort when no fresh list could be loaded: bring back whatever this
// device already had, which is the copy that reflects local deletions.
function restoreOrPrompt() {
  const savedEngineer = localStorage.getItem(ENGINEER_KEY) || '';
  const hasSession = tryRestoreSession();

  if (hasSession && savedEngineer) {
    if (!isPinUnlocked(savedEngineer)) {
      showPinView(savedEngineer, () => restoreSession(savedEngineer));
      return;
    }
    restoreSession(savedEngineer);
  } else if (hasSession) {
    // Records loaded but no engineer saved — show picker
    showEngineerView();
  } else {
    showHomeView();
  }
}

function bootContinue() {
  // The cloud gist is the authority — see reloadFromSheets().
  fetchFromGist().then(gistRecords => {
    if (gistRecords && gistRecords.length) {
      showToast('Work orders loaded');
      applyNewCSV(gistRecords, false);
      return;
    }

    // Cloud unreachable: fall through to the saved session below rather than to
    // Sheets, so deleted work orders do not reappear on this device.
    if (lastGistFetchError) {
      showToast(`${lastGistFetchError} — using saved list`, true);
      return Promise.resolve(null).then(() => restoreOrPrompt());
    }

    // Fall back to Google Sheets
    return fetchCSVFromSheets().then(csvText => {
      if (csvText) {
        const records = parseCSV(csvText);
        if (records.length && records[0].hasOwnProperty('Street Address')) {
          showToast('Work orders loaded from Google Sheets');
          applyNewCSV(records, false);
          return;
        }
      }

      // Sheets not configured or fetch failed — fall back to session restore
      restoreOrPrompt();
    });
  });
}

function boot() {
  completions = loadCompletions();
  purgeOldCompletions();   // remove work orders completed before today
  updateCompletedCountBadge();
  updateTokenStatusLabel();

  // Hide splash after letter animation sequence completes (~4.3s)
  setTimeout(() => {
    splash.style.transition = 'opacity 0.4s';
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 400);
    bootContinue();
  }, 4300);
}

btnRetry.addEventListener('click', () => {
  viewHome.classList.add('hidden');
  bootContinue();
});

boot();

// ── Service worker registration ───────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { });
}
