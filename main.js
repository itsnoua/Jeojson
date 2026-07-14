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
  zoomAnimation: true,
  markerZoomAnimation: true,
  fadeAnimation: true,

  dragging: true,          
  doubleClickZoom: true,  
  scrollWheelZoom: true,  
  boxZoom: true,          
  keyboard: true,         
  zoomControl: true,      
  touchZoom: true,         
  tap: false               
}).setView([18.22, 42.50], 12);



L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
  attribution: "© Google Maps"
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


// Hardcoded static locations (saved by developer)
const STATIC_LOCATIONS = {
  "ابها 4": [
    18.220219115804223,
    42.50473022460938
  ],
  "ابها 2": [
    18.242680037676948,
    42.4910831451416
  ],
  "أبها 1": [
    18.281830176825945,
    42.47520446777344
  ],
  "ابها 3": [
    18.20847826303262,
    42.545585632324226
  ],
  "مدينة سلطان 6": [
    18.1951104148039,
    42.62626647949219
  ],
  "مدينة سلطان 5": [
    18.248262243111036,
    42.62866973876954
  ],
  "مدينة سلطان 1": [
    18.424901819109163,
    42.5390625
  ],
  "مدينة سلطان 2": [
    18.362345208940763,
    42.54730224609376
  ],
  "مدينة سلطان 3": [
    18.325849873036884,
    42.529449462890625
  ],
  "مدينة سلطان 4": [
    18.298797873311763,
    42.60429382324219
  ],
  "مدينة سلطان 7": [
    18.25332043867211,
    42.570133209228516
  ],
  "ابها 5": [
    18.202284296988033,
    42.458724975585945
  ],
  "السودة": [
    18.233261939081714,
    42.39280700683594
  ],
  "طبب": [
    18.38417470693145,
    42.38319396972657
  ],
  "الشعف": [
    18.07275515593532,
    42.72857666015626
  ],
  "الشعف 2": [
    17.948368797346852,
    42.74917602539063
  ],
  "مربة 2": [
    17.84158586422059,
    42.51777648925781
  ],
  "مربة": [
    17.974134820152663,
    42.403793334960945
  ],
  "ابها 1": [
    18.285439254503277,
    42.45941162109376
  ]
};

// Retrieve custom positions from localStorage
let customPositions = JSON.parse(localStorage.getItem("custom_label_positions") || "{}");
let editMode = false;
let currentCategory = "940";

let sectorsGeojson = null;
let marker = null;
let geojsonLayer = null;
let labelsLayerGroup = null;
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
    expandSheet();
    return;
  }
  resultBox.textContent = `النطاق: ${info.sector} — المراقب: ${info.inspector}`;
  expandSheet();
}

function loadCategory(cat) {
  currentCategory = cat;

  // Clear previous layer
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }
  if (labelsLayerGroup) {
    map.removeLayer(labelsLayerGroup);
  }
  labelsLayerGroup = L.layerGroup().addTo(map);

  layerByIdx.clear();
  unhighlightPrev();
  MANUAL = {};
  sectorsGeojson = null;
  resultBox.textContent = "جاري التحميل... ⏳";

  const fileMap = {
    "940": "data/LastUpdayejson.geojson",
    "evening": "data/evening.geojson",
    "raqaba": "data/تسليم_2_نظيف.geojson"
  };

  const url = fileMap[cat];

  fetch(url)
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
          sector: String(f.properties["المنا"] || f.properties["Zone"] || `نطاق ${i}`).trim(),
          inspector: String(f.properties["Name"] || f.properties["المراقب"] || "—").trim(),
          color: colorFromIndex(i) 
        };
      });

      console.log(`✅ Loaded ${cat} features:`, sectorsGeojson.features.length);

      geojsonLayer = L.geoJSON(sectorsGeojson, {
        style: f => baseStyle(MANUAL[f.properties.__idx]),
        onEachFeature: (feature, lyr) => {
          const idx = feature.properties.__idx;
          layerByIdx.set(idx, lyr);

          // Bind permanent tooltip or draggable marker based on editMode
          const info = MANUAL[idx];
          if (info && info.sector) {
            // Check if there is a custom position stored
            let center = STATIC_LOCATIONS[info.sector] || customPositions[info.sector];

            // If not, calculate it using Turf.js centroid
            if (!center && lyr.getBounds) {
              try {
                const centroid = turf.centroid(feature);
                const [lng, lat] = centroid.geometry.coordinates;
                center = [lat, lng];
              } catch(e) {
                console.warn("Centroid calc failed", e);
              }
            }

            if (center) {
              const labelIcon = L.divIcon({
                className: editMode ? 'zone-label-icon-draggable' : 'zone-label-icon',
                html: editMode ? `<div class="drag-badge">📍 ${info.sector}</div>` : `<div class="zone-label-badge">${info.sector}</div>`,
                iconSize: [120, 30],
                iconAnchor: [60, 15] // Centered perfectly on the coordinate
              });

              const labelMarker = L.marker(center, {
                icon: labelIcon,
                draggable: editMode,
                interactive: editMode
              }).addTo(labelsLayerGroup);

              if (editMode) {
                labelMarker.on('dragend', () => {
                  const newLatLng = labelMarker.getLatLng();
                  customPositions[info.sector] = [newLatLng.lat, newLatLng.lng];
                  localStorage.setItem("custom_label_positions", JSON.stringify(customPositions));
                });
              }
            }
          }

          lyr.on("click", () => {
            unhighlightPrev();
            highlightIdx(idx);
            showTop(idx);
          });
        }
      }).addTo(map);

      map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
      map.setZoom(map.getZoom() + 1);
      resultBox.textContent = "( ﾉ ﾟｰﾟ)ﾉ";
    })
    .catch((err) => {
      console.error("❌ GEOJSON LOAD ERROR:", err);
      resultBox.textContent = ` فشل تحميل بيانات ${cat}: ${err.message}`;
      // Fallback message if file missing
      if (cat === "evening") {
        resultBox.textContent = "ملف 'evening.geojson' غير موجود في مجلد data";
      } else if (cat === "raqaba") {
        resultBox.textContent = "ملف 'تسليم_2_نظيف.geojson' غير موجود في مجلد data";
      }
    });
}

// Category buttons
const btnEvening = document.getElementById("btnEvening");
const btnRaqaba = document.getElementById("btnRaqaba");

function setActiveButton(activeBtn) {
  [btnEvening, btnRaqaba].forEach(btn => {
    if (btn) btn.classList.remove("active");
  });
  if (activeBtn) activeBtn.classList.add("active");
}

btnEvening.addEventListener("click", () => {
  if (btnEvening.classList.contains("active")) return;
  setActiveButton(btnEvening);
  loadCategory("evening");
});

btnRaqaba.addEventListener("click", () => {
  if (btnRaqaba.classList.contains("active")) return;
  setActiveButton(btnRaqaba);
  loadCategory("raqaba");
});

// Initial load
loadCategory("raqaba");


checkBtn.addEventListener("click", () => {
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    resultBox.textContent = "اكتب الاحداثيات صح 😒";
    expandSheet();
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
    expandSheet();
    return;
  }

  highlightIdx(hitIndex);
  showTop(hitIndex);
});

// Helper function to decode URL and extract coordinates using regex patterns
function parseAndSetCoordinates(urlText) {
  const decodedUrl = decodeURIComponent(urlText);
  const commaRegex = /([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/;
  
  // Specific Google Maps URL coordinate patterns
  const patterns = [
    /place\/([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/,
    /[?&]q=([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/,
    /@([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/,
    /center=([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)/,
    commaRegex // General fallback
  ];

  for (let pattern of patterns) {
    const match = decodedUrl.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        latInput.value = lat;
        lngInput.value = lng;
        checkBtn.click();
        resultBox.innerHTML = "✅ تم فك الرابط وتحديد الموقع بنجاح!";
        return true;
      }
    }
  }
  return false;
}

// Google Maps links/coordinates parser
const gmapsInput = document.getElementById("gmaps-link");
if (gmapsInput) {
  gmapsInput.addEventListener("input", () => {
    const val = gmapsInput.value.trim();
    if (!val) return;

    // 1. Check if the user pasted coordinates directly
    const commaRegex = /([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/;
    let match = val.match(commaRegex);

    if (!match) {
      const spaceRegex = /([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)/;
      match = val.match(spaceRegex);
    }

    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        latInput.value = lat;
        lngInput.value = lng;
        checkBtn.click();
        return;
      }
    }

    // 2. Resolve mobile short URLs (maps.app.goo.gl or goo.gl/maps or g.co/maps)
    if (val.includes("maps.app.goo.gl") || val.includes("goo.gl/maps") || val.includes("g.co/maps")) {
      resultBox.innerHTML = "⏳ جاري فك رابط الجوال المختصر... 🔄";
      expandSheet();

      // Strip query parameters to avoid API request errors on unshorten.me
      const cleanUrl = val.split('?')[0];
      const apiUrl = `https://unshorten.me/json/${encodeURIComponent(cleanUrl)}`;

      // Try to unshorten using unshorten.me directly
      fetch(apiUrl)
        .then(res => {
          if (!res.ok) throw new Error("CORS or network error");
          return res.json();
        })
        .then(data => {
          if (data && data.success && data.resolved_url) {
            const success = parseAndSetCoordinates(data.resolved_url);
            if (!success) throw new Error("Coordinates not found in resolved URL");
          } else {
            throw new Error("Failed to resolve URL");
          }
        })
        .catch(err => {
          console.warn("Direct unshorten failed, trying proxy fallback...", err);
          
          // Proxy fallback through AllOrigins
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
          fetch(proxyUrl)
            .then(res => {
              if (!res.ok) throw new Error("Proxy error");
              return res.json();
            })
            .then(wrapper => {
              const data = JSON.parse(wrapper.contents);
              if (data && data.success && data.resolved_url) {
                const success = parseAndSetCoordinates(data.resolved_url);
                if (!success) throw new Error("Coordinates not found in resolved URL");
              } else {
                throw new Error("Failed in proxy wrapper");
              }
            })
            .catch(proxyErr => {
              console.error("All resolution attempts failed:", proxyErr);
              resultBox.innerHTML = "⚠️ فشل فك الرابط تلقائياً. يرجى كتابة أو لصق الإحداثيات مباشرة (مثل: 18.22, 42.50).";
              expandSheet();
            });
        });
    }
  });
}

// Developer Mode Edit Listeners
const toggleEditBtn = document.getElementById("toggleEditBtn");
const exportPositionsBtn = document.getElementById("exportPositionsBtn");

if (toggleEditBtn && exportPositionsBtn) {
  toggleEditBtn.addEventListener("click", () => {
    editMode = !editMode;
    if (editMode) {
      toggleEditBtn.textContent = "🛠️ تعديل المواقع: مفعل ✅";
      toggleEditBtn.style.background = "#dcfce7";
      toggleEditBtn.style.borderColor = "#16a34a";
      exportPositionsBtn.style.display = "block";
    } else {
      toggleEditBtn.textContent = "🛠️ تعديل المواقع: مغلق ❌";
      toggleEditBtn.style.background = "#fff";
      toggleEditBtn.style.borderColor = "#222";
      exportPositionsBtn.style.display = "none";
    }
    // Reload the current category to redraw the labels in draggable or static mode
    loadCategory(currentCategory);
  });

  exportPositionsBtn.addEventListener("click", () => {
    const jsonStr = JSON.stringify(customPositions, null, 2);
    // Create text container
    const textarea = document.createElement("textarea");
    textarea.value = `// انسخ هذا الكود واستبدله بالـ STATIC_LOCATIONS في أعلى ملف main.js:\nconst STATIC_LOCATIONS = ${jsonStr};`;
    textarea.style.width = "100%";
    textarea.style.height = "150px";
    textarea.style.direction = "ltr";
    textarea.style.fontFamily = "monospace";
    textarea.style.fontSize = "11px";
    textarea.style.padding = "8px";
    textarea.style.borderRadius = "8px";
    textarea.style.border = "1px solid #ccc";
    
    // Show overlay modal
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.6)";
    overlay.style.zIndex = "100000";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "20px";

    const modal = document.createElement("div");
    modal.style.background = "#fff";
    modal.style.padding = "20px";
    modal.style.borderRadius = "12px";
    modal.style.width = "400px";
    modal.style.maxWidth = "90vw";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.gap = "10px";

    const title = document.createElement("h3");
    title.textContent = "تصدير مواقع المسميات 💾";
    title.style.margin = "0";
    title.style.fontFamily = "'Cairo', sans-serif";
    
    const info = document.createElement("p");
    info.textContent = "انسخ الكود أدناه واستبدله في ملف main.js عند الانتهاء لتثبيت المواقع بشكل دائم:";
    info.style.margin = "0";
    info.style.fontSize = "12px";
    info.style.color = "#666";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "نسخ إلى الحافظة 📋";
    copyBtn.style.height = "36px";
    copyBtn.style.background = "#222";
    copyBtn.style.color = "#fff";
    copyBtn.style.border = "none";
    copyBtn.style.borderRadius = "8px";
    copyBtn.style.cursor = "pointer";
    copyBtn.style.fontFamily = "'Cairo', sans-serif";
    copyBtn.style.fontWeight = "bold";

    copyBtn.addEventListener("click", () => {
      textarea.select();
      document.execCommand("copy");
      copyBtn.textContent = "تم النسخ بنجاح! 🎉";
      setTimeout(() => {
        copyBtn.textContent = "نسخ إلى الحافظة 📋";
      }, 2000);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "إغلاق ❌";
    closeBtn.style.height = "36px";
    closeBtn.style.background = "#f1f5f9";
    closeBtn.style.border = "1px solid #cbd5e1";
    closeBtn.style.borderRadius = "8px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontFamily = "'Cairo', sans-serif";

    closeBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    modal.appendChild(title);
    modal.appendChild(info);
    modal.appendChild(textarea);
    modal.appendChild(copyBtn);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}


// ----------------------------------------------------
// BOTTOM SHEET TOGGLE BUTTON FOR MOBILE
// ----------------------------------------------------
const topbar = document.querySelector(".topbar.floating");
const toggleSheetBtn = document.getElementById("toggleSheetBtn");
const categorySelector = document.querySelector(".category-selector");

let isExpanded = true;
let maxTranslateY = 0;
let currentTranslateY = 0;

function isMobile() {
  return window.innerWidth <= 768; // Mobile & Tablet breakpoint (768px)
}

function updateDimensions() {
  if (!topbar || !toggleSheetBtn || !categorySelector) return;
  
  if (!isMobile()) {
    topbar.style.transform = '';
    topbar.style.transition = '';
    topbar.classList.remove("collapsed");
    currentTranslateY = 0;
    return;
  }

  const H = topbar.getBoundingClientRect().height;
  const btnRect = toggleSheetBtn.getBoundingClientRect();
  const selectorRect = categorySelector.getBoundingClientRect();
  
  const topbarStyle = window.getComputedStyle(topbar);
  const paddingTop = parseFloat(topbarStyle.paddingTop) || 10;
  const gap = parseFloat(topbarStyle.gap) || 8;
  
  // Peek height = paddingTop + toggleSheetBtnHeight + gap + categorySelectorHeight + paddingTop
  const P = paddingTop + btnRect.height + gap + selectorRect.height + paddingTop;
  maxTranslateY = Math.max(0, H - P);

  // Smooth slide-in/out transition
  topbar.style.transition = 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)';

  if (isExpanded) {
    topbar.style.transform = 'translateY(0)';
    topbar.classList.remove("collapsed");
    currentTranslateY = 0;
  } else {
    topbar.style.transform = `translateY(${maxTranslateY}px)`;
    topbar.classList.add("collapsed");
    currentTranslateY = maxTranslateY;
  }
}

function expandSheet() {
  if (isMobile() && !isExpanded) {
    isExpanded = true;
    updateDimensions();
  }
}

// Click & Touch listener to toggle the sheet state with zero delay
if (toggleSheetBtn) {
  const toggleAction = (e) => {
    isExpanded = !isExpanded;
    updateDimensions();
    if (e.cancelable) e.preventDefault();
    e.stopPropagation(); // Prevents map/parent click side-effects
  };

  toggleSheetBtn.addEventListener("click", toggleAction);
  toggleSheetBtn.addEventListener("touchstart", toggleAction, { passive: false });

  // Dynamic layout changes tracking
  const resizeObserver = new ResizeObserver(() => {
    updateDimensions();
  });
  resizeObserver.observe(topbar);
  
  // Listen to orientation/resize changes
  window.addEventListener("resize", () => {
    updateDimensions();
  });
}


