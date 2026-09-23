// ==UserScript==
// @name         TwinSpires Mobile Handicapper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Floating Handicapping Overlay for TwinSpires
// @match        https://*.twinspires.com/*
// @run-at       document-end
// @grant        none
// ==UserScript==

(function launchTwinSpiresMobileModelV1() {
  let currentZoom = 1.0;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isOverlayVisible = true;

  // Embedded Horse Image URL / Base64 Data String
const HORSE_IMAGE_URL = 'https://raw.githubusercontent.com/littlejohn2201/handicapping2.0/blob/main/apple-touch-icon.png';

  // Loader, Tab & Calculation Tracking State
  const REQUIRED_TABS = ['Summary', 'Advanced', 'Speed', 'Class', 'Pace', 'Comments'];
  let loadedTabs = {
    'Summary': false,
    'Advanced': false,
    'Speed': false,
    'Class': false,
    'Pace': false,
    'Comments': false
  };

  let isLoaderVisible = true;
  let isCalculating = false;
  let calcProgressPercent = 0;
  let calcInterval = null;
  let collectionStartTime = Date.now();
  let collectionTicker = null;

  function getLoadingProgress() {
    let hasComments = Object.values(cachedHorsesMap).some(h => 
      (h.COMMENTS_POS && h.COMMENTS_POS !== '""') || 
      (h.COMMENTS_NEG && h.COMMENTS_NEG !== '""')
    );
    if (hasComments) {
      loadedTabs['Comments'] = true;
    }

    if (!loadedTabs['Comments'] && (Date.now() - collectionStartTime) >= 30000) {
      loadedTabs['Comments'] = true;
    }

    let completed = 0;
    REQUIRED_TABS.forEach(tab => {
      if (loadedTabs[tab]) completed++;
    });
    let percent = Math.round((completed / REQUIRED_TABS.length) * 100);
    return { completed, total: REQUIRED_TABS.length, percent };
  }

  function updateZoomPreview(previewZoom) {
    let overlay = document.getElementById('ts-model-overlay');
    if (!overlay) return;

    let label = document.getElementById('ts-zoom-label');
    if (label) label.innerText = `${Math.round(previewZoom * 100)}%`;

    let outline = document.getElementById('ts-zoom-outline');
    if (!outline) {
      outline = document.createElement('div');
      outline.id = 'ts-zoom-outline';
      outline.style.cssText = 'position:fixed;z-index:1000000;border:2px dashed #60a5fa;background:rgba(59,130,246,0.18);pointer-events:none;border-radius:8px;box-shadow:0 0 15px rgba(96,165,250,0.4);transition:none;';
      document.body.appendChild(outline);
    }

    let rect = overlay.getBoundingClientRect();
    let unscaledW = overlay.offsetWidth;

    let previewW = unscaledW * previewZoom;
    let previewH = overlay.offsetHeight * previewZoom;

    outline.style.top = `${rect.top}px`;
    outline.style.left = `${rect.left}px`;
    outline.style.width = `${previewW}px`;
    outline.style.height = `${previewH}px`;
    outline.style.display = 'block';
  }

  function removeZoomPreview() {
    let outline = document.getElementById('ts-zoom-outline');
    if (outline) outline.style.display = 'none';
  }

  function applyZoom() {
    let overlay = document.getElementById('ts-model-overlay');
    if (overlay) {
      overlay.style.transformOrigin = 'top left';
      overlay.style.transform = `scale(${currentZoom})`;
      let label = document.getElementById('ts-zoom-label');
      if (label) label.innerText = `${Math.round(currentZoom * 100)}%`;
      let slider = document.getElementById('ts-zoom-slider');
      if (slider && parseFloat(slider.value) !== Math.round(currentZoom * 100)) {
        slider.value = Math.round(currentZoom * 100);
      }
    }
    removeZoomPreview();
  }

  function resetRaceData() {
    cachedHorsesMap = {};
    cachedScratchedMap = {};
    cachedStatsObj = null;
    cachedStatsCsv = "Awaiting Race Stats Data...";
    cachedTrackCondition = "";
    cachedPostTime = "N/A";
    REQUIRED_TABS.forEach(tab => loadedTabs[tab] = false);
    
    isLoaderVisible = true;
    isCalculating = false;
    calcProgressPercent = 0;
    collectionStartTime = Date.now();

    if (calcInterval) {
      clearInterval(calcInterval);
      calcInterval = null;
    }
    if (collectionTicker) {
      clearInterval(collectionTicker);
      collectionTicker = null;
    }
    
    startCollectionTicker();
  }

  function startCollectionTicker() {
    if (collectionTicker) clearInterval(collectionTicker);
    collectionTicker = setInterval(() => {
      if (isLoaderVisible && !isCalculating) {
        updateOverlay();
      } else {
        clearInterval(collectionTicker);
        collectionTicker = null;
      }
    }, 1000);
  }

  function handleDragStart(clientX, clientY) {
    let overlay = document.getElementById('ts-model-overlay');
    if (!overlay) return;
    isDragging = true;
    let rect = overlay.getBoundingClientRect();
    dragOffsetX = clientX - rect.left;
    dragOffsetY = clientY - rect.top;
  }

  function handleDragMove(clientX, clientY) {
    if (!isDragging) return;
    let overlay = document.getElementById('ts-model-overlay');
    if (!overlay) return;

    let newLeft = clientX - dragOffsetX;
    let newTop = clientY - dragOffsetY;

    overlay.style.right = 'auto';
    overlay.style.left = `${newLeft}px`;
    overlay.style.top = `${newTop}px`;
  }

  if (!window.__tsEventListenerAttached) {
    document.addEventListener('input', function(e) {
      if (e.target && e.target.id === 'ts-zoom-slider') {
        let previewVal = parseFloat(e.target.value) / 100.0;
        updateZoomPreview(previewVal);
      }
    });

    function commitZoom(e) {
      if (e.target && e.target.id === 'ts-zoom-slider') {
        let slider = document.getElementById('ts-zoom-slider');
        if (slider) {
          currentZoom = parseFloat(slider.value) / 100.0;
          applyZoom();
        }
      }
    }

    document.addEventListener('change', commitZoom);
    document.addEventListener('mouseup', commitZoom);
    document.addEventListener('touchend', commitZoom);

    document.addEventListener('click', function(e) {
      if (!e.target) return;

      let clickedText = (e.target.innerText || e.target.textContent || '').trim();
      REQUIRED_TABS.forEach(tab => {
        if (tab !== 'Comments' && (clickedText.toLowerCase() === tab.toLowerCase() || clickedText.toLowerCase().includes(tab.toLowerCase()))) {
          loadedTabs[tab] = true;
          setTimeout(updateOverlay, 100);
        }
      });

      if (e.target.id === 'ts-refresh-btn') {
        let urlData = parseTwinSpiresUrl();
        if (urlData) {
          cachedTrackName = urlData.trackName;
          cachedRaceNum = urlData.raceNum;
        }
        resetRaceData();
        updateOverlay();
      }
    });

    document.addEventListener('mousedown', function(e) {
      if (!e.target) return;
      if (e.target.id === 'ts-drag-handle' || e.target.closest('#ts-drag-handle')) {
        handleDragStart(e.clientX, e.clientY);
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', function(e) {
      handleDragMove(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
    });

    document.addEventListener('touchstart', function(e) {
      if (!e.target) return;
      if (e.target.id === 'ts-drag-handle' || e.target.closest('#ts-drag-handle')) {
        let touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
      if (isDragging) {
        let touch = e.touches[0];
        handleDragMove(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchend', function() {
      isDragging = false;
    });

    window.__tsEventListenerAttached = true;
  }

  // 1. Strict CSS Injection with !important overrides to neutralize host styles
  function injectToggleStyles() {
    let style = document.getElementById('ts-toggle-btn-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ts-toggle-btn-styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      button#ts-toggle-btn.ts-toggle-btn {
        position: fixed !important;
        bottom: 85px !important;
        left: 15px !important;
        z-index: 1000001 !important;
        width: 60px !important;
        height: 60px !important;
        min-width: 60px !important;
        max-width: 60px !important;
        min-height: 60px !important;
        max-height: 60px !important;
        border-radius: 50% !important;
        border: 3px solid #64748b !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        cursor: pointer !important;
        background-color: #0f172a !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        outline: none !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.6) !important;
        transition: transform 0.15s ease, border-color 0.2s ease, opacity 0.2s ease !important;
        opacity: 0.65 !important;
        box-sizing: border-box !important;
        font-size: 0 !important;
        line-height: 0 !important;
        text-indent: -9999px !important;
      }

      button#ts-toggle-btn.ts-toggle-btn:hover {
        transform: scale(1.05) !important;
      }

      button#ts-toggle-btn.ts-toggle-btn:active {
        transform: scale(0.95) !important;
      }

      button#ts-toggle-btn.ts-toggle-btn img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
        pointer-events: none !important;
        border-radius: 50% !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      button#ts-toggle-btn.ts-toggle-btn.active {
        border-color: #3b82f6 !important;
        opacity: 1.0 !important;
      }
    `;
  }

  // 2. Pure Icon Rendering
  function renderToggleButton() {
    injectToggleStyles();

    let btn = document.getElementById('ts-toggle-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'ts-toggle-btn';
      btn.type = 'button';
      btn.className = `ts-toggle-btn ${isOverlayVisible ? 'active' : ''}`;
      
      const toggleImg = document.createElement('img');
      toggleImg.src = HORSE_IMAGE_URL;
      toggleImg.alt = 'Toggle Model';
      
      btn.appendChild(toggleImg);

      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        let overlay = document.getElementById('ts-model-overlay');
        if (overlay) {
          isOverlayVisible = !isOverlayVisible;
          overlay.style.display = isOverlayVisible ? 'block' : 'none';
          btn.classList.toggle('active', isOverlayVisible);
        }
      });

      document.body.appendChild(btn);
    }
  }

  function parseTwinSpiresUrl(url = window.location.href) {
    const regex = /\/program\/[^\/]+\/([a-z0-9-]+)\/([a-z0-9]+)\/([a-z0-9]+)\/(\d+)/i;
    const match = url.match(regex);
    if (match) {
      let trackSlug = match[1];
      let trackCode = match[2];
      let breed = match[3];
      let raceNum = parseInt(match[4], 10);
      let trackName = trackSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      return { trackName, trackCode, breed, raceNum };
    }
    return null;
  }

  let cachedTrackName = "";
  let cachedRaceNum = "";
  let cachedPostTime = "N/A";
  let cachedBreed = "Thoroughbred";
  let cachedTrackCondition = "";
  let cachedHorsesMap = {}; 
  let cachedScratchedMap = {};
  let cachedStatsObj = null;
  let cachedStatsCsv = "Awaiting Race Stats Data...";

  const ROUTE_IGNORE_LIST = [
    'bet', 'bets', 'betting', 'race', 'races', 'handicapping', 
    'today', 'summary', 'entries', 'results', 'overview', 
    'brisnet', 'track', 'tracks', 'speed', 'pace', 'class', 'program', 'classic'
  ];

  function isHeavyWetTrack(condVal) {
    if (!condVal) return false;
    let c = String(condVal).toUpperCase().trim();
    const wetKeywords = ['MUDDY', 'SLOPPY', 'HEAVY', 'YIELDING', 'SOFT', 'WET', 'MY', 'SY', 'HY', 'YL', 'SF', 'WF'];
    return wetKeywords.some(k => c === k || c.includes(k));
  }

  function getActiveTrackName(payloadObj) {
    let urlData = parseTwinSpiresUrl();
    if (urlData && urlData.trackName) return urlData.trackName;

    if (payloadObj) {
      let candidate = payloadObj.trackName || payloadObj.track_name || payloadObj.trackTitle || payloadObj.trackCode || payloadObj.track;
      if (candidate && String(candidate).trim() !== '' && !String(candidate).includes('Awaiting')) {
        let candStr = String(candidate).trim();
        if (!ROUTE_IGNORE_LIST.includes(candStr.toLowerCase())) return candStr;
      }
    }

    if (cachedTrackName && !cachedTrackName.includes('Awaiting') && !ROUTE_IGNORE_LIST.includes(cachedTrackName.toLowerCase())) {
      return cachedTrackName;
    }

    let headerElem = document.querySelector('h1, header, [class*="track-name"], [class*="trackName"], .track-title');
    if (headerElem && headerElem.innerText.trim().length > 0) {
      let domText = headerElem.innerText.trim().split('\n')[0];
      if (!ROUTE_IGNORE_LIST.includes(domText.toLowerCase()) && domText.length > 2) return domText;
    }
    return "Unknown Track";
  }

  function getActiveRaceNum(payloadRace) {
    let urlData = parseTwinSpiresUrl();
    if (urlData && urlData.raceNum) return urlData.raceNum;
    if (payloadRace) return payloadRace;
    return cachedRaceNum || 1;
  }

  function getVal(obj, keys, defaultVal = 0) {
    if (!obj) return defaultVal;
    let keyList = Array.isArray(keys) ? keys : [keys];
    for (let k of keyList) {
      if (obj[k] !== undefined && obj[k] !== null) {
        let val = obj[k];
        if (typeof val === 'number') return val;
        let cleaned = String(val).replace('%', '').trim();
        let parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return defaultVal;
  }

  function getStr(obj, keys, defaultVal = '') {
    if (!obj) return defaultVal;
    let keyList = Array.isArray(keys) ? keys : [keys];
    for (let k of keyList) {
      if (obj[k] !== undefined && obj[k] !== null) {
        return String(obj[k]).trim();
      }
    }
    return defaultVal;
  }

  function parseOddsToDecimal(oddsVal) {
    if (!oddsVal) return NaN;
    let s = String(oddsVal).trim();
    if (!s || s.toUpperCase() === 'NAN') return NaN;
    try {
      if (s.includes('/')) {
        let parts = s.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(s);
    } catch (e) {
      return NaN;
    }
  }

  function findStatsObject(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return null;
    if (obj.meetCountRaces !== undefined || obj.meetRaces !== undefined || obj.meetSpeedBias !== undefined || obj.weekCountRaces !== undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      for (let item of obj) {
        let found = findStatsObject(item, depth + 1);
        if (found) return found;
      }
    } else {
      for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          let found = findStatsObject(obj[key], depth + 1);
          if (found) return found;
        }
      }
    }
    return null;
  }

  function findRunnersArray(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return null;
    if (Array.isArray(obj) && obj.length > 0 && (obj[0].programNumber !== undefined || obj[0].priorRunStyle !== undefined || obj[0].averageSpeed !== undefined)) {
      return obj;
    }
    let candidateKeys = ['runners', 'entries', 'starts', 'horses'];
    for (let k of candidateKeys) {
      if (Array.isArray(obj[k]) && obj[k].length > 0) return obj[k];
    }
    for (let key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        let found = findRunnersArray(obj[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function parseAndMergeRunnerRow(r) {
    if (!r || typeof r !== 'object') return null;

    let runnerCond = getStr(r, ['trackCondition', 'condition', 'surfaceCondition'], '');
    if (runnerCond) cachedTrackCondition = runnerCond;

    let rawName = getStr(r, ['name', 'horseName'], '').replace(/"/g, '');
    let prog = getStr(r, ['programNumber', 'postPosition'], '1');
    let post = getVal(r, ['postPosition', 'programNumber'], parseInt(prog) || 1);

    let isScratched = r.scratched === true || 
                      String(r.scratched).toLowerCase() === 'true' || 
                      r.isScratched === true || 
                      getStr(r, ['scratchStatus', 'status'], '').toLowerCase() === 'scratched';

    if (isScratched) {
      delete cachedHorsesMap[prog];
      cachedScratchedMap[prog] = rawName || prog;
      return null;
    } else {
      delete cachedScratchedMap[prog];
    }

    let posComm = getStr(r, ['commentsPositive', 'positiveComments', 'commentPositive'], '').replace(/"/g, "'");
    let negComm = getStr(r, ['commentsNegative', 'negativeComments', 'commentNegative'], '').replace(/"/g, "'");

    if (posComm || negComm) {
      loadedTabs['Comments'] = true;
    }

    let freshData = {
      PROGRAM: prog,
      HORSE_NAME: rawName ? `"${rawName}"` : '""',
      POST: post,
      ML_ODDS: getStr(r, ['morningLineOdds', 'mlOdds'], ''),
      LIVE_ODDS: getStr(r, ['liveOdds', 'currentOdds', 'odds'], ''),
      RUN_STYLE: getStr(r, ['priorRunStyle', 'runStyle'], '').toUpperCase(),
      RUN_STYLE_PTS: getVal(r, ['speedPoints', 'quirinSpeedPoints'], 0),
      PRM_PWR: getVal(r, ['primePower', 'brisnetPrimePower'], 0),
      AVG_SPD: getVal(r, ['averageSpeed', 'avgSpeed'], 0),
      BACK_SPD: getVal(r, ['bestSpeedAtDistance', 'bestSpeedAtDist'], 0),
      SPD_LR: getVal(r, ['speedLastRace', 'lastRaceSpeed'], 0),
      AVG_CLS: getVal(r, ['averageClass', 'avgClass', 'classRating'], 0),
      LAST_CLS: getVal(r, ['lastClass'], 0),
      AVG_DIST_SPD: getVal(r, ['averageSpeedAtDistanceSurface', 'averageSpeedAtDistance'], 0),
      BEST_SPD: getVal(r, ['bestSpeedDistance', 'bestSpeedAtDistance', 'bestSpeed'], 0),
      W_JKY: getVal(r, ['jockeyWinPercent', 'jockeyWinPct'], 0),
      W_TRN: getVal(r, ['trainerWinPercent', 'trainerWinPct'], 0),
      E1: getVal(r, ['averagePaceE1', 'avgPaceE1', 'e1Pace'], 0),
      E2: getVal(r, ['averagePaceE2', 'avgPaceE2', 'e2Pace'], 0),
      LP: getVal(r, ['averagePaceLP', 'avgPaceLP', 'latePace'], 0),
      DAYS_OFF: getVal(r, ['daysOff', 'daysSinceLastRace'], 0),
      PL_PRED: getVal(r, ['plPredScore', 'pl_pred_score'], 0),
      COMMENTS_POS: posComm ? `"${posComm}"` : '""',
      COMMENTS_NEG: negComm ? `"${negComm}"` : '""'
    };

    let existing = cachedHorsesMap[prog];
    if (!existing) {
      cachedHorsesMap[prog] = freshData;
      return cachedHorsesMap[prog];
    }

    for (let key in freshData) {
      let val = freshData[key];
      if (key === 'HORSE_NAME') {
        if (val !== '""' && val !== '"Unknown"') existing[key] = val;
      } else if (typeof val === 'number') {
        if (val !== 0 || existing[key] === undefined) existing[key] = val;
      } else if (typeof val === 'string') {
        if ((val !== '' && val !== '""' && val !== 'N/A' && val !== 'UNDEFINED') || !existing[key]) existing[key] = val;
      }
    }
    return existing;
  }

  function parseStatsRows(s) {
    let urlData = parseTwinSpiresUrl();
    let rawBreed = getStr(s, 'breedType', urlData ? urlData.breed : 'TB');
    let breed = rawBreed.toUpperCase() === 'TB' ? 'Thoroughbred' : rawBreed;
    cachedBreed = breed;
    let track = getActiveTrackName(s);
    let raceNum = getActiveRaceNum(s.raceNumber);

    let statCond = getStr(s, ['trackCondition', 'condition', 'surfaceCondition'], '');
    if (statCond) cachedTrackCondition = statCond;

    function formatBias(val) {
      let num = parseFloat(val) || 0;
      return num > 1.0 ? num / 100.0 : num;
    }

    let meetRow = {
      BREED: breed,
      TRACK: `"${track}"`,
      RACE_NUMBER: raceNum,
      STAT_SET: 'Meet',
      RACES: getVal(s, ['meetCountRaces', 'meetRaces', 'meetCount']),
      SPEED_BIAS: formatBias(getVal(s, 'meetSpeedBias')),
      IV_RAIL: getVal(s, 'meetPost1Impact'),
      IV_1to3: getVal(s, 'meetPost2Impact'),
      IV_4to7: getVal(s, 'meetPost3Impact'),
      IV_8plus: getVal(s, 'meetPost4Impact'),
      IV_E: getVal(s, 'meetRs1Impact'),
      IV_EP: getVal(s, 'meetRs2Impact'),
      IV_P: getVal(s, 'meetRs3Impact'),
      IV_S: getVal(s, 'meetRs4Impact')
    };

    let weekRow = {
      BREED: breed,
      TRACK: `"${track}"`,
      RACE_NUMBER: raceNum,
      STAT_SET: 'Week',
      RACES: getVal(s, ['weekCountRaces', 'weekRaces', 'weekCount']),
      SPEED_BIAS: formatBias(getVal(s, 'weekSpeedBias')),
      IV_RAIL: getVal(s, 'weekPost1Impact'),
      IV_1to3: getVal(s, 'weekPost2Impact'),
      IV_4to7: getVal(s, 'weekPost3Impact'),
      IV_8plus: getVal(s, 'weekPost4Impact'),
      IV_E: getVal(s, 'weekRs1Impact'),
      IV_EP: getVal(s, 'weekRs2Impact'),
      IV_P: getVal(s, 'weekRs3Impact'),
      IV_S: getVal(s, 'weekRs4Impact')
    };
    return [meetRow, weekRow];
  }

  function calculateModelOutput() {
    let runnerKeys = Object.keys(cachedHorsesMap);
    if (runnerKeys.length < 3) {
      return {
        ruleAppliedMsg: "Awaiting field data...",
        leaderboard: [],
        gaps: [],
        wagerRecs: { optionA: "N/A", optionB: "N/A", optionC: null, scenario: "Insufficient Data" }
      };
    }

    let cleanTrack = getActiveTrackName();
    let cleanBreed = cachedBreed || "Thoroughbred";

    let weekRaces = 0, meetRaces = 100;
    let weekBias = 0, meetBias = 0;
    let weekIV = { RAIL: 1.0, "1-3": 1.0, "4-7": 1.0, "8+": 1.0, E: 1.0, EP: 1.0, P: 1.0, S: 1.0 };
    let meetIV = { RAIL: 1.0, "1-3": 1.0, "4-7": 1.0, "8+": 1.0, E: 1.0, EP: 1.0, P: 1.0, S: 1.0 };

    if (cachedStatsObj) {
      let s = cachedStatsObj;
      weekRaces = getVal(s, ['weekCountRaces', 'weekRaces'], 0);
      meetRaces = getVal(s, ['meetCountRaces', 'meetRaces', 'meetCount'], 100);

      function normB(v) { let n = parseFloat(v) || 0; return n > 1.0 ? n / 100.0 : n; }
      weekBias = normB(getVal(s, 'weekSpeedBias'));
      meetBias = normB(getVal(s, 'meetSpeedBias'));

      weekIV = {
        RAIL: getVal(s, 'weekPost1Impact', 1.0),
        "1-3": getVal(s, 'weekPost2Impact', 1.0),
        "4-7": getVal(s, 'weekPost3Impact', 1.0),
        "8+": getVal(s, 'weekPost4Impact', 1.0),
        E: getVal(s, 'weekRs1Impact', 1.0),
        EP: getVal(s, 'weekRs2Impact', 1.0),
        P: getVal(s, 'weekRs3Impact', 1.0),
        S: getVal(s, 'weekRs4Impact', 1.0)
      };

      meetIV = {
        RAIL: getVal(s, 'meetPost1Impact', 1.0),
        "1-3": getVal(s, 'meetPost2Impact', 1.0),
        "4-7": getVal(s, 'meetPost3Impact', 1.0),
        "8+": getVal(s, 'meetPost4Impact', 1.0),
        E: getVal(s, 'meetRs1Impact', 1.0),
        EP: getVal(s, 'meetRs2Impact', 1.0),
        P: getVal(s, 'meetRs3Impact', 1.0),
        S: getVal(s, 'meetRs4Impact', 1.0)
      };
    }

    let wWeek = 0.0, wMeet = 1.0;
    let ruleAppliedMsg = "";

    if (weekRaces < 15) {
      wWeek = 0.00; wMeet = 1.00;
      ruleAppliedMsg = `[Rule Applied] Using 100% Meet stats (Week sample too small: ${Math.round(weekRaces)} < 15 races)`;
    } else {
      wWeek = 0.65; wMeet = 0.35;
      ruleAppliedMsg = `[Rule Applied] Blending 65% Week / 35% Meet (Week sample sufficient: ${Math.round(weekRaces)} >= 15 races)`;
    }

    let isWet = isHeavyWetTrack(cachedTrackCondition);
    if (isWet) {
      ruleAppliedMsg += ` | [Track Condition: ${cachedTrackCondition.toUpperCase()} — Power Bonus Zeroed]`;
    }

    let activeSpeedBias = (wWeek * weekBias) + (wMeet * meetBias);
    let postIvMapping = {
      "RAIL": Math.round(((wWeek * weekIV.RAIL) + (wMeet * meetIV.RAIL)) * 100) / 100,
      "1-3": Math.round(((wWeek * weekIV["1-3"]) + (wMeet * meetIV["1-3"])) * 100) / 100,
      "4-7": Math.round(((wWeek * weekIV["4-7"]) + (wMeet * meetIV["4-7"])) * 100) / 100,
      "8+": Math.round(((wWeek * weekIV["8+"]) + (wMeet * meetIV["8+"])) * 100) / 100
    };

    let runStyleIvMapping = {
      "E": Math.round(((wWeek * weekIV.E) + (wMeet * meetIV.E)) * 100) / 100,
      "E/P": Math.round(((wWeek * weekIV.EP) + (wMeet * meetIV.EP)) * 100) / 100,
      "P": Math.round(((wWeek * weekIV.P) + (wMeet * meetIV.P)) * 100) / 100,
      "S": Math.round(((wWeek * weekIV.S) + (wMeet * meetIV.S)) * 100) / 100
    };

    const weightsDict = {
      'Thoroughbred': { W_Speed: 0.18, W_Power: 0.10, W_Class: 0.16, W_Distance: 0.11, W_Driver: 0.06, W_Trainer: 0.06, W_Early: 0.15, W_Finish: 0.10, W_Recency: 0.03, W_Market: 0.03 },
      'Harness': { W_Speed: 0.16, W_Power: 0.07, W_Class: 0.13, W_Distance: 0.04, W_Driver: 0.18, W_Trainer: 0.06, W_Early: 0.18, W_Finish: 0.08, W_Recency: 0.04, W_Market: 0.03 },
      'Quarter Horse': { W_Speed: 0.26, W_Power: 0.10, W_Class: 0.09, W_Distance: 0.02, W_Driver: 0.07, W_Trainer: 0.07, W_Early: 0.34, W_Finish: 0.00, W_Recency: 0.02, W_Market: 0.03 },
      'Churchill Downs': { W_Speed: 0.16, W_Power: 0.09, W_Class: 0.17, W_Distance: 0.11, W_Driver: 0.08, W_Trainer: 0.08, W_Early: 0.11, W_Finish: 0.12, W_Recency: 0.03, W_Market: 0.03 }
    };

    let activeWeights = Object.assign({}, cleanTrack === 'Churchill Downs' ? weightsDict['Churchill Downs'] : (weightsDict[cleanBreed] || weightsDict['Thoroughbred']));

    let activeMeetCount = meetRaces;
    let sampleScaleFactor = 0.0;
    if (activeMeetCount < 6) sampleScaleFactor = 0.0;
    else if (activeMeetCount <= 15) sampleScaleFactor = 0.10;
    else sampleScaleFactor = 1.00;

    let biasDecimal = activeSpeedBias > 1.0 ? activeSpeedBias / 100.0 : activeSpeedBias;
    if (biasDecimal > 0.55) {
      let rawEarlyBoost = (biasDecimal - 0.55) * 0.5;
      activeWeights.W_Early += (rawEarlyBoost * sampleScaleFactor);
    }

    let postIvMultiplier = 6.0, styleIvMultiplier = 6.0;
    if (cleanBreed === 'Harness') { postIvMultiplier = 7.0; styleIvMultiplier = 7.0; }
    else if (cleanBreed === 'Quarter Horse') { postIvMultiplier = 4.0; styleIvMultiplier = 5.0; }

    function getPostCat(postVal) {
      let p = parseInt(postVal, 10);
      if (p === 1) return "RAIL";
      if (p >= 1 && p <= 3) return "1-3";
      if (p >= 4 && p <= 7) return "4-7";
      if (p >= 8) return "8+";
      return "1-3";
    }

    function calcPostBonus(cat) {
      if (activeMeetCount < 15) return 0.0;
      let iv = postIvMapping[cat] || 1.0;
      let diff = Math.max(0.0, iv - 1.0);
      return diff >= 0.03 ? Math.round(Math.min(5.0, diff * postIvMultiplier) * 100) / 100 : 0.0;
    }

    function calcStyleBonus(code, pts) {
      if (activeMeetCount < 15) return 0.0;
      let iv = runStyleIvMapping[code] || 1.0;
      let diff = Math.max(0.0, iv - 1.0);
      if (diff >= 0.03) {
        let ptsFactor = Math.min(Math.max(parseFloat(pts) / 8.0, 0.0), 1.0);
        return Math.round(Math.min(5.0, diff * styleIvMultiplier * ptsFactor) * 100) / 100;
      }
      return 0.0;
    }

    let runners = Object.values(cachedHorsesMap).map(h => Object.assign({}, h));

    let numCols = ['PRM_PWR', 'AVG_SPD', 'BACK_SPD', 'SPD_LR', 'AVG_CLS', 'LAST_CLS', 'AVG_DIST_SPD', 'BEST_SPD', 'W_JKY', 'W_TRN', 'E1', 'E2', 'LP', 'DAYS_OFF'];
    numCols.forEach(col => {
      let validVals = runners.map(r => parseFloat(r[col]) || 0).filter(v => v > 0);
      let avg = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0.0;
      runners.forEach(r => {
        let v = parseFloat(r[col]) || 0;
        if (v <= 0) r[col] = Math.round(avg * 10) / 10;
      });
    });

    let pwrVals = runners.map(r => parseFloat(r.PRM_PWR) || 0).sort((a, b) => a - b);
    let medianPwr = 0;
    if (pwrVals.length > 0) {
      let mid = Math.floor(pwrVals.length / 2);
      medianPwr = pwrVals.length % 2 !== 0 ? pwrVals[mid] : (pwrVals[mid - 1] + pwrVals[mid]) / 2;
    }

    runners.forEach(r => {
      let mlDec = parseOddsToDecimal(r.ML_ODDS);
      let liveDec = parseOddsToDecimal(r.LIVE_ODDS);
      let finalOddsDec = !isNaN(liveDec) && liveDec > 0 ? liveDec : mlDec;

      let avgDist = parseFloat(r.AVG_DIST_SPD) || 0;
      let spdLr = parseFloat(r.SPD_LR) || 0;
      let avgSpd = parseFloat(r.AVG_SPD) || 0;
      let cSpeed = 0;
      if (avgDist > 0 && spdLr > 0) cSpeed = (0.70 * avgDist) + (0.30 * spdLr);
      else if (spdLr > 0) cSpeed = spdLr;
      else if (avgDist > 0) cSpeed = avgDist;
      else cSpeed = avgSpd;

      let rawPower = parseFloat(r.PRM_PWR) || 0;
      let cPower = rawPower;

      let powerBonus = (isWet || rawPower <= medianPwr) ? 0.0 : 0.0; 

      let avgCls = parseFloat(r.AVG_CLS) || 0;
      let lastCls = parseFloat(r.LAST_CLS) || 0;
      let cClass = avgCls > 0 ? avgCls : (lastCls > 0 ? lastCls : 0);

      let bestSpd = parseFloat(r.BEST_SPD) || parseFloat(r.BACK_SPD) || 0;
      let cDist = avgDist > 0 ? avgDist : (bestSpd > 0 ? bestSpd : 0);

      let cDriver = parseFloat(r.W_JKY) || 0;
      let cTrainer = parseFloat(r.W_TRN) || 0;

      let e1 = parseFloat(r.E1) || 0;
      let e2 = parseFloat(r.E2) || 0;
      let cEarly = (e1 > 0 && e2 > 0) ? (0.50 * e1 + 0.50 * e2) : (e2 > 0 ? e2 : e1);

      let cFinish = parseFloat(r.LP) || 0;

      let days = parseFloat(r.DAYS_OFF) || 0;
      let cRecency = 75.0;
      if (days >= 14 && days <= 45) cRecency = 100.0;
      else if (days < 14) cRecency = 85.0;
      else if (days >= 46 && days <= 90) cRecency = 70.0;
      else if (days > 90) cRecency = 50.0;

      let cMarket = !isNaN(finalOddsDec) && finalOddsDec > 0 ? (1.0 / (finalOddsDec + 1.0)) * 100.0 : 0.0;

      let baseSkill = 
        (cSpeed * activeWeights.W_Speed) +
        (cPower * activeWeights.W_Power) +
        (cClass * activeWeights.W_Class) +
        (cDist * activeWeights.W_Distance) +
        (cDriver * activeWeights.W_Driver) +
        (cTrainer * activeWeights.W_Trainer) +
        (cEarly * activeWeights.W_Early) +
        (cFinish * activeWeights.W_Finish) +
        (cRecency * activeWeights.W_Recency) +
        (cMarket * activeWeights.W_Market);

      let postCat = getPostCat(r.POST);
      let postBonus = calcPostBonus(postCat);
      let styleBonus = calcStyleBonus(r.RUN_STYLE, r.RUN_STYLE_PTS);

      r.POWER_BONUS = powerBonus;
      r.BASE_SKILL = Math.round(baseSkill * 100) / 100;
      r.POST_BONUS = postBonus;
      r.STYLE_BONUS = styleBonus;
      r.FINAL_SCORE = Math.round((baseSkill + postBonus + styleBonus + powerBonus) * 100) / 100;
    });

    runners.sort((a, b) => b.FINAL_SCORE - a.FINAL_SCORE);
    runners.forEach((r, idx) => { r.RANK = idx + 1; });

    let topField = runners.slice(0, 5);
    let s1 = topField[0] ? topField[0].FINAL_SCORE : 0;
    let s2 = topField[1] ? topField[1].FINAL_SCORE : 0;
    let s3 = topField[2] ? topField[2].FINAL_SCORE : 0;
    let s4 = topField[3] ? topField[3].FINAL_SCORE : 0;
    let s5 = topField[4] ? topField[4].FINAL_SCORE : 0;

    let gap12 = Math.round((s1 - s2) * 100) / 100;
    let gap23 = Math.round((s2 - s3) * 100) / 100;
    let gap34 = Math.round((s3 - s4) * 100) / 100;
    let gap45 = Math.round((s4 - s5) * 100) / 100;

    let gap13 = Math.round((s1 - s3) * 100) / 100;
    let gap14 = Math.round((s1 - s4) * 100) / 100;

    let p1 = topField[0] ? topField[0].PROGRAM : "N/A";
    let p2 = topField[1] ? topField[1].PROGRAM : "N/A";
    let p3 = topField[2] ? topField[2].PROGRAM : "N/A";
    let p4 = topField[3] ? topField[3].PROGRAM : "N/A";

    let scenario = "", optionA = "", optionB = "", optionC = null;

    if (gap14 < 5.0 && runners.length >= 4) {
      scenario = "Ultra-Tight Field / High Chaos (Top 4 within 5.0 pts)";
      optionA = `PASS / NO BET (Or Value WIN Wager on highest live odds among #${p1}, #${p2}, #${p3})`;
      optionB = `3-Horse Exacta Box: #${p1}, #${p2}, #${p3} (6 combos / low cost)`;
    } else if (gap12 >= 8.0) {
      scenario = `Dominant Standout (#${p1} holds >=8.0 pt lead)`;
      optionA = `WIN Wager on #${p1}`;
      optionB = (gap23 < 4.0 && gap34 >= 4.0) 
        ? `Straight Exacta: #${p1} / #${p2}, #${p3}`
        : `Straight Exacta: #${p1} / #${p2} (Or Exacta Key: #${p1} / #${p2}, #${p3}, #${p4})`;
    } else if (gap12 < 8.0 && gap23 >= 4.0) {
      scenario = `Competitive Top Duo (#${p1} & #${p2} separated from field)`;
      optionA = `WIN Wager on #${p1} (Or PLACE Wager on #${p2})`;
      optionB = `Exacta Box: #${p1}, #${p2}`;
    } else if (gap13 < 4.0) {
      scenario = `Volatile Top Group (Top 3 within 4.0 pts: #${p1}, #${p2}, #${p3})`;
      optionA = `PLACE / SHOW Wager on highest live odds among #${p1}, #${p2}, #${p3}`;
      optionB = `Trifecta Box: #${p1}, #${p2}, #${p3} (6 combos / $3.00 total at $0.50 base)`;
    } else {
      scenario = "Standard Competitive Field";
      optionA = `WIN / PLACE Wager on #${p1}`;
      optionB = `Straight Exacta Wheel: #${p1} / #${p2}, #${p3}`;
    }

    if (cleanTrack === "Churchill Downs" && runners.length >= 6) {
      let oddSum = 0, evenSum = 0;
      topField.forEach(r => {
        let pNum = parseInt(r.PROGRAM.replace(/\D/g, ''), 10);
        if (!isNaN(pNum)) {
          if (pNum % 2 !== 0) oddSum += r.FINAL_SCORE;
          else evenSum += r.FINAL_SCORE;
        }
      });
      let pref = oddSum >= evenSum ? "ODD" : "EVEN";
      optionC = `CHURCHILL ODD/EVEN WAGER: Bet [${pref}] (Score Weight: ${Math.max(oddSum, evenSum).toFixed(2)} vs ${Math.min(oddSum, evenSum).toFixed(2)})`;
    }

    return {
      ruleAppliedMsg,
      leaderboard: runners,
      gaps: { gap12, gap23, gap34, gap45, gap13, gap14 },
      wagerRecs: { scenario, optionA, optionB, optionC }
    };
  }

  function getCommentsSectionHtml(leaderboard) {
    let top5 = leaderboard.slice(0, 5);
    if (!top5 || top5.length === 0) {
      return `
        <div style="background:#1e293b;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #f59e0b;">
          <div style="color:#f59e0b;font-weight:bold;margin-bottom:4px;font-size:11px;">COMMENTS</div>
          <div style="color:#9ca3af;font-size:10px;">Awaiting Runner Data...</div>
        </div>
      `;
    }

    let contentHtml = top5.map(h => {
      let nameStr = h.HORSE_NAME.replace(/"/g, '');
      let posStr = h.COMMENTS_POS ? h.COMMENTS_POS.replace(/^"|"$/g, '').trim() : '';
      let negStr = h.COMMENTS_NEG ? h.COMMENTS_NEG.replace(/^"|"$/g, '').trim() : '';

      return `
        <div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px dashed #334155;">
          <div style="color:#fbbf24;font-weight:bold;font-size:10px;margin-bottom:2px;">#${h.PROGRAM} ${nameStr}</div>
          <div style="color:#34d399;font-size:9.5px;margin-bottom:1px;"><b>(+) Pos:</b> ${posStr || 'None'}</div>
          <div style="color:#f87171;font-size:9.5px;"><b>(-) Neg:</b> ${negStr || 'None'}</div>
        </div>
      `;
    }).join('');

    return `
      <div style="background:#1e293b;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #f59e0b;">
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:4px;font-size:11px;">COMMENTS</div>
        <div style="background:#0f172a;padding:6px;border-radius:4px;max-height:160px;overflow-y:auto;">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  function getLoaderSectionHtml() {
    if (!isLoaderVisible) return '';

    let progress = getLoadingProgress();
    let isDataComplete = progress.percent === 100;

    if (isDataComplete && !isCalculating && calcProgressPercent === 0) {
      if (collectionTicker) {
        clearInterval(collectionTicker);
        collectionTicker = null;
      }
      isCalculating = true;
      let startTime = Date.now();
      calcInterval = setInterval(() => {
        let elapsed = Date.now() - startTime;
        calcProgressPercent = Math.min(100, (elapsed / 16000) * 100);
        if (elapsed >= 16000) {
          clearInterval(calcInterval);
          calcInterval = null;
          isLoaderVisible = false;
          isCalculating = false;
        }
        updateOverlay();
      }, 100);
    }

    if (isCalculating) {
      let secondsLeft = Math.max(0, (16 - (calcProgressPercent * 0.16))).toFixed(1);
      return `
        <div style="background:#1e293b;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #3b82f6;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="color:#60a5fa;font-weight:bold;font-size:11px;">⚙️ MODEL CALCULATING</div>
            <div style="color:#93c5fd;font-weight:bold;font-size:10px;">${Math.round(calcProgressPercent)}%</div>
          </div>
          
          <div style="color:#cbd5e1;font-size:10px;margin-bottom:8px;line-height:1.2;">
            Calculating ratings...
          </div>

          <div style="position:relative;margin-top:18px;background:#0f172a;border-radius:8px;padding:2px;border:1px solid #334155;">
            <div style="position:absolute;top:-18px;left:${calcProgressPercent}%;transform:translateX(-50%) scaleX(-1);font-size:14px;line-height:1;pointer-events:none;transition:left 0.1s linear;">
              🏇
            </div>
            <div style="width:${calcProgressPercent}%;background:linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);height:8px;border-radius:4px;transition:width 0.1s linear;"></div>
          </div>
          <div style="text-align:right;color:#9ca3af;font-size:9px;margin-top:4px;">
            ${secondsLeft}s remaining
          </div>
        </div>
      `;
    }

    let elapsedSecs = Math.floor((Date.now() - collectionStartTime) / 1000);
    let timeRemaining = Math.max(0, 30 - elapsedSecs);

    let tabListHtml = REQUIRED_TABS.map(tab => {
      let isLoaded = loadedTabs[tab];
      let color = isLoaded ? '#34d399' : '#f87171';
      let icon = isLoaded ? '🟢' : '🔴';
      let statusText = isLoaded ? 'LOADED' : (tab === 'Comments' ? `AWAITING DATA (${timeRemaining}s)` : 'CLICK TAB');
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:#0f172a;border-radius:4px;margin-bottom:3px;border:1px solid ${isLoaded ? '#059669' : '#991b1b'};">
          <span style="color:#ffffff;font-weight:bold;font-size:10px;">${icon} ${tab}</span>
          <span style="color:${color};font-weight:bold;font-size:9px;">${statusText}</span>
        </div>
      `;
    }).join('');

    return `
      <div style="background:#1e293b;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #ef4444;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="color:#fbbf24;font-weight:bold;font-size:11px;">⏳ DATA COLLECTION STATUS</div>
          <div style="color:#f87171;font-weight:bold;font-size:10px;">${progress.percent}% COMPLETE</div>
        </div>
        
        <div style="color:#cbd5e1;font-size:9.5px;margin-bottom:6px;">
          Tap each program tab on TwinSpires to capture race metrics:
        </div>

        <div style="margin-bottom:6px;">
          ${tabListHtml}
        </div>

        <div style="position:relative;margin-top:18px;background:#0f172a;border-radius:8px;padding:2px;border:1px solid #334155;">
          <div style="position:absolute;top:-18px;left:${progress.percent}%;transform:translateX(-50%) scaleX(-1);font-size:14px;line-height:1;pointer-events:none;transition:left 0.3s ease;">
            🏇
          </div>
          <div style="width:${progress.percent}%;background:linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%);height:8px;border-radius:4px;transition:width 0.3s ease;"></div>
        </div>
        <div style="text-align:right;color:#9ca3af;font-size:9px;margin-top:3px;">
          ${progress.completed} of ${progress.total} Items Collected
        </div>
      </div>
    `;
  }

  function updateOverlay() {
    renderToggleButton();

    let existing = document.getElementById('ts-model-overlay');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'ts-model-overlay';
      existing.style.cssText = 'position:fixed;top:10px;left:3vw;z-index:999999;background:#111827;color:#ffffff;padding:12px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.6);font-family:monospace;width:94vw;max-width:480px;max-height:82vh;overflow-y:auto;border:2px solid #3b82f6;font-size:11px;box-sizing:border-box;transform-origin:top left;';
      document.body.appendChild(existing);
    }

    existing.style.display = isOverlayVisible ? 'block' : 'none';

    let trackDisplay = getActiveTrackName().toUpperCase().replace(/"/g, '');
    let raceDisplay = String(getActiveRaceNum()).replace(/[^0-9]/g, '');
    let activeStartersCount = Object.keys(cachedHorsesMap).length;
    let scratchedHorsesCount = Object.keys(cachedScratchedMap).length;
    let currentDate = new Date().toISOString().split('T')[0];
    let condTag = cachedTrackCondition ? ` (${cachedTrackCondition.toUpperCase()})` : '';

    let modelRes = calculateModelOutput();

    let leaderboardHtml = modelRes.leaderboard.map(h => {
      let nameStr = h.HORSE_NAME.replace(/"/g, '');
      let pwrBonusStr = h.POWER_BONUS > 0 ? ` + Pwr: ${h.POWER_BONUS.toFixed(2)}` : '';
      return `R${h.RANK} | #${h.PROGRAM} ${nameStr} | Final: ${h.FINAL_SCORE.toFixed(2)} = Base: ${h.BASE_SKILL.toFixed(2)} + Post: ${h.POST_BONUS.toFixed(2)} + Style: ${h.STYLE_BONUS.toFixed(2)}${pwrBonusStr}`;
    }).join('\n');

    let gapHtml = modelRes.leaderboard.slice(0, 5).map((h, i, arr) => {
      let nameStr = h.HORSE_NAME.replace(/"/g, '');
      let gapStr = i === 0 
        ? "(Leader)" 
        : `(Gap to Rank ${i}: -${(arr[i - 1].FINAL_SCORE - h.FINAL_SCORE).toFixed(2)})`;
      return `  Rank ${i+1}: #${h.PROGRAM} ${nameStr} — Score: ${h.FINAL_SCORE.toFixed(2)} ${gapStr}`;
    }).join('\n');

    existing.innerHTML = `
      <div style="border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:#60a5fa;font-weight:bold;font-size:12px;">
          <span>📍 ${trackDisplay} — RACE #${raceDisplay}${condTag}</span>
          <span style="color:#9ca3af;font-size:10px;">📅 ${currentDate}</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <button id="ts-drag-handle" title="Drag to move panel" style="flex:1;background:#374151;color:#fbbf24;border:1px solid #4b5563;border-radius:6px;padding:8px 6px;cursor:move;font-weight:bold;font-size:11px;touch-action:none;">✋ DRAG</button>
            <button id="ts-refresh-btn" title="Reset Race Data" style="flex:1;background:#2563eb;color:#ffffff;border:1px solid #3b82f6;border-radius:6px;padding:8px 6px;cursor:pointer;font-weight:bold;font-size:11px;">🔄 RESET</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;background:#1f2937;padding:6px 10px;border-radius:6px;border:1px solid #374151;">
            <span style="color:#9ca3af;font-size:10px;font-weight:bold;min-width:38px;">ZOOM</span>
            <input type="range" id="ts-zoom-slider" min="50" max="150" value="${Math.round(currentZoom * 100)}" style="width:100%;height:24px;cursor:pointer;accent-color:#3b82f6;touch-action:manipulation;">
            <span id="ts-zoom-label" style="color:#60a5fa;font-size:11px;font-weight:bold;min-width:36px;text-align:right;">${Math.round(currentZoom * 100)}%</span>
          </div>
        </div>

        <div style="color:#9ca3af;font-size:10px;text-align:center;background:#1f2937;padding:4px;border-radius:4px;border:1px solid #374151;">
          <span style="color:#34d399;font-weight:bold;">${activeStartersCount}</span> Active Starters &nbsp;|&nbsp; <span style="color:#f87171;font-weight:bold;">${scratchedHorsesCount}</span> Scratched
        </div>
      </div>

      ${getLoaderSectionHtml()}

      <div style="background:#1e293b;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #475569;">
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:4px;font-size:11px;">Little John's Top Picks</div>
        <div style="color:#a7f3d0;font-style:italic;margin-bottom:6px;font-size:9.5px;">${modelRes.ruleAppliedMsg}</div>

        <div style="color:#f32424;font-weight:bold;margin-bottom:2px;font-size:10px;">--- RANKED LEADERBOARD ---</div>
        <div style="background:#0f172a;padding:6px;border-radius:4px;white-space:pre-wrap;margin-bottom:6px;color:#e2e8f0;max-height:140px;overflow-y:auto;font-size:9.5px;">${leaderboardHtml || 'Awaiting Field Calculation...'}</div>

        <div style="color:#f32424;font-weight:bold;margin-bottom:2px;font-size:10px;">--- TOP 5 DISTRIBUTION & GAPS ---</div>
        <div style="background:#0f172a;padding:6px;border-radius:4px;white-space:pre-wrap;margin-bottom:6px;color:#cbd5e1;font-size:9.5px;">${gapHtml || 'N/A'}</div>

        <div style="color:#f59e0b;font-weight:bold;margin-bottom:2px;font-size:10px;">--- WAGER RECOMMENDATIONS ---</div>
        <div style="background:#0f172a;padding:6px;border-radius:4px;color:#38bdf8;font-size:9.5px;">
          <b>Scenario:</b> ${modelRes.wagerRecs.scenario}<br/><br/>
          <b>OPTION A (Straight Focus):</b><br/> ${modelRes.wagerRecs.optionA}<br/><br/>
          <b>OPTION B (Exotic Payout):</b><br/> ${modelRes.wagerRecs.optionB}
          ${modelRes.wagerRecs.optionC ? `<br/><br/><b>OPTION C (Churchill Special):</b><br/> ${modelRes.wagerRecs.optionC}` : ''}
        </div>
      </div>

      ${getCommentsSectionHtml(modelRes.leaderboard)}
    `;

    applyZoom();
  }

  function processResponse(url, text) {
    if (!text || (text.trim().charAt(0) !== '{' && text.trim().charAt(0) !== '[')) return;
    try {
      let data = JSON.parse(text);

      let payloadCond = getStr(data, ['trackCondition', 'condition', 'surfaceCondition', 'track_condition'], '');
      if (payloadCond) cachedTrackCondition = payloadCond;

      let payloadPostTime = getStr(data, [
        'postTime', 'post_time', 'startTime', 'racePostTime', 
        'postTimeFormatted', 'post_time_formatted', 'scheduledStart', 
        'postTimeEpoch', 'postTimeLocal', 'postTimeText'
      ], '');
      if (payloadPostTime) cachedPostTime = payloadPostTime;

      let urlData = parseTwinSpiresUrl();
      if (urlData) {
        if (urlData.raceNum && cachedRaceNum && urlData.raceNum !== cachedRaceNum) {
          resetRaceData();
          cachedRaceNum = urlData.raceNum;
        }
        if (urlData.trackName && cachedTrackName && urlData.trackName !== cachedTrackName && urlData.trackName !== "Unknown Track") {
          resetRaceData();
          cachedTrackName = urlData.trackName;
        }
      }

      let runners = findRunnersArray(data);
      if (runners && runners.length > 0) {
        let sample = runners[0];
        let payloadTrack = getActiveTrackName(sample) || getActiveTrackName(data);
        let payloadRace = sample.raceNumber || data.raceNumber;

        if (payloadTrack && payloadTrack !== "Unknown Track") cachedTrackName = payloadTrack;
        if (payloadRace) cachedRaceNum = payloadRace;

        runners.forEach(r => parseAndMergeRunnerRow(r));
        updateOverlay();
      }

      let statsObj = findStatsObject(data);
      if (statsObj) {
        cachedStatsObj = statsObj;
        let payloadTrack = getActiveTrackName(statsObj) || getActiveTrackName(data);
        let payloadRace = statsObj.raceNumber || data.raceNumber;

        if (payloadTrack && payloadTrack !== "Unknown Track") cachedTrackName = payloadTrack;
        if (payloadRace) cachedRaceNum = payloadRace;

        let statRows = parseStatsRows(statsObj);
        let statsHeader = Object.keys(statRows[0]).join(',');
        cachedStatsCsv = `${statsHeader}\n${statRows.map(r => Object.values(r).join(',')).join('\n')}`;
        updateOverlay();
      }
    } catch(e) {}
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.addEventListener('load', function() {
      processResponse(url, this.responseText);
    });
    origOpen.apply(this, arguments);
  };

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = async function(...args) {
      let response = await origFetch.apply(this, args);
      try {
        let clone = response.clone();
        let url = typeof args[0] === 'string' ? args[0] : (args[0] ? args[0].url : '');
        clone.text().then(text => processResponse(url, text));
      } catch(e) {}
      return response;
    };
  }

  startCollectionTicker();
  updateOverlay();
  console.log("🚀 Mobile Handicapping Model V1 Running!");
})();