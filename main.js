let MANUAL = {}; 

function colorFromIndex(i) {
  const PALETTE = [
    "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
    "#EDC949", "#AF7AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
    "#8C564B", "#17BECF"
  ];
  return PALETTE[i % PALETTE.length];
}

const resultBox = document.getElementById("result");
const checkBtn  = document.getElementById("checkBtn");
const latInput  = document.getElementById("lat");
const lngInput  = document.getElementById("lng");


const map = L.map("map", {
  zoomAnimation: false,
  markerZoomAnimation: false,
  fadeAnimation: false
}).setView([18.22, 42.50], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);


function baseStyle(info){
  return {
    color: "#333",
    weight: 2,
    fillColor: info?.color || "#999",
    fillOpacity: 0.22
  };
}

function highlightStyle(info){
  return {
    color: "#000",
    weight: 4,
    fillColor: info?.color || "#999",
    fillOpacity: 0.5
  };
}

function scopeNumberFromName(name){
  const m = String(name || "").match(/(\d+)\s*$/);
  return m ? m[1] : "—";
}


let sectorsGeojson = null;
let marker = null;

let highlightedIdx = null;
const layerByIdx = new Map();

function unhighlightPrev(){
  if (highlightedIdx === null) return;
  const lyr = layerByIdx.get(highlightedIdx);
  if (lyr) lyr.setStyle(baseStyle(MANUAL[highlightedIdx]));
  highlightedIdx = null;
}

function highlightIdx(idx){
  const lyr = layerByIdx.get(idx);
  if (!lyr) return;
  lyr.setStyle(highlightStyle(MANUAL[idx]));
  highlightedIdx = idx;
}

function showTop(idx){
  const info = MANUAL[idx];
  if (!info) {
    resultBox.textContent = `القطاع رقم ${idx} غير معرف`;
    return;
  }
  const num = scopeNumberFromName(info.sector);
  resultBox.textContent = `النطاق: ${info.sector} — المراقب: ${info.inspector}`;
}

fetch("data/LastUpdayejson.geojson")
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
    return r.json();
  })
  .then(gj => {
    sectorsGeojson = gj;

    sectorsGeojson.features.forEach((f, i) => {
      if (!f.properties) f.properties = {};
      f.properties.__idx = i;

      MANUAL[i] = {
        sector: String(f.properties["المنا"] || `نطاق ${i}`).trim(),
        inspector: String(f.properties["Name"] || "—").trim(),
        color: colorFromIndex(i) 
      };
    });

    console.log("✅ Loaded features:", sectorsGeojson.features.length);
    console.log("✅ MANUAL:", MANUAL);

    const layer = L.geoJSON(sectorsGeojson, {
      style: f => baseStyle(MANUAL[f.properties.__idx]),
      onEachFeature: (feature, lyr) => {
        const idx = feature.properties.__idx;
        layerByIdx.set(idx, lyr);

        lyr.on("click", () => {
          unhighlightPrev();
          highlightIdx(idx);
          showTop(idx);
        });
      }
    }).addTo(map);

    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    resultBox.textContent = "( ﾉ ﾟｰﾟ)ﾉ";
  })
  .catch((err) => {
    console.error("❌ GEOJSON LOAD ERROR:", err);
    resultBox.textContent = ` فشل تحميل GeoJSON: ${err.message}`;
  });


checkBtn.addEventListener("click", () => {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    resultBox.textContent = "اكتب الاحداثيات صح 😒";
    return;
  }
  if (!sectorsGeojson) return;

  const pt = turf.point([lng, lat]);
  let hitIndex = null;

  for (let i = 0; i < sectorsGeojson.features.length; i++) {
    if (turf.booleanPointInPolygon(pt, sectorsGeojson.features[i])) {
      hitIndex = i;
      break;
    }
  }

  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng]).addTo(map);
  }

  unhighlightPrev();

  if (hitIndex === null) {
    resultBox.textContent = "خارج جميع النطاقات";
    return;
  }

  highlightIdx(hitIndex);
  showTop(hitIndex);
});

