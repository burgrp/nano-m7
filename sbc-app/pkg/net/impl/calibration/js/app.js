/* ============================================================
   SAC Calibration – main application logic
   ============================================================ */

/* app.js – main orchestration, state, UI, HTML builders, YAML export */
/* Dependencies (loaded before app.js): utils.js, fitting.js, charts.js  */
'use strict';

/* ---------- Global application state ---------------------- */
const state = {
    filename:          null,   // Name of the loaded file
    fluence:           null,   // AmBe source fluence [n/s]
    parsedYaml:        null,   // Full parsed YAML object
    rawData:           null,   // Array of pulse timestamps [µs], full data
    rawDataTrimmed:    null,   // After trimming, shifted to t = 0 [µs]
    hist1s:            null,   // 1 s histogram from full data (for the trim control)
    cutTimeSec:        0,      // Number of seconds trimmed from the beginning
    autoCutTimeSec:    0,      // Automatically detected cut point
    histograms:        null,   // [{binSize, points:[{x,y}]}] for bins 1–20 s
    fits:              null,   // [{binSize, fit:{k1,k2,y0,...}}] fit results
    fitAxisXMax:       null,   // Fixed max x-axis range for the fit chart
    fitAxisYMax:       null,   // Fixed max y-axis range for the fit chart
    charts:            {},     // References to Chart.js instances (for destroy)
    backgroundPPM:    null,   // Background value [pulses/min]; null = free fit parameter
    backgroundSource: null,   // 'yaml' | 'manual' | 'free'
};

/* ---------- Initialisation after DOM load ----------------- */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('calib-form')
            .addEventListener('submit', handleFormSubmit);

    /* Enable/disable the manual background input field */
    document.querySelectorAll('input[name="bg-source"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('bg-manual').disabled =
                document.querySelector('input[name="bg-source"]:checked')?.value !== 'manual';
        });
    });

    /* Experiment picker */
    document.getElementById('load-experiments-btn')
            ?.addEventListener('click', loadExperimentList);
    loadExperimentList();
});

/* ============================================================
   Server API helper
   ============================================================ */

/**
 * Calls a UiApi method via the webglue REST endpoint.
 * Authentication token is read from localStorage (set by the main SAC web UI).
 */
async function sacApiFetch(method, ...args) {
    const token = localStorage.getItem('webglue.headers.Authorization');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = token;
    const resp = await fetch('/api/ui/' + method, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.result;
}

/* ============================================================
   Experiment picker
   ============================================================ */

async function loadExperimentList() {
    const status  = document.getElementById('experiments-load-status');
    const list    = document.getElementById('experiments-list');
    const loadBtn = document.getElementById('load-experiments-btn');
    if (!list) return;

    status.textContent = t('form.loadingList');
    loadBtn.disabled   = true;
    list.innerHTML     = '';

    try {
        const experiments = (await sacApiFetch('getExperiments')) || [];

        if (!experiments.length) {
            list.innerHTML = `<span class="exp-picker-empty">${escHtml(t('form.noExperiments'))}</span>`;
            status.textContent = '';
            return;
        }

        /* Newest first */
        experiments.slice().reverse().forEach(id => {
            const item = document.createElement('div');
            item.className   = 'exp-picker-item';
            item.textContent = id;
            item.dataset.id  = id;
            item.setAttribute('tabindex', '0');
            item.addEventListener('click', e => {
                const items = [...list.querySelectorAll('.exp-picker-item')];
                if (e.ctrlKey || e.metaKey) {
                    item.classList.toggle('selected');
                } else if (e.shiftKey) {
                    const clickedIdx = items.indexOf(item);
                    const selIdxs = items
                        .map((el, i) => el.classList.contains('selected') ? i : -1)
                        .filter(i => i >= 0);
                    const lo = Math.min(...selIdxs, clickedIdx);
                    const hi = Math.max(...selIdxs, clickedIdx);
                    items.forEach((el, i) => { if (i >= lo && i <= hi) el.classList.add('selected'); });
                } else {
                    items.forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                }
                updateExperimentSelectionInfo();
                showExperimentPreview(id);
            });
            item.addEventListener('keydown', e => {
                const items = [...list.querySelectorAll('.exp-picker-item')];
                const idx   = items.indexOf(item);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const next = items[e.key === 'ArrowDown' ? idx + 1 : idx - 1];
                    if (next) { next.focus(); showExperimentPreview(next.dataset.id); }
                } else if (e.key === ' ') {
                    e.preventDefault();
                    item.classList.toggle('selected');
                    updateExperimentSelectionInfo();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    items.forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    updateExperimentSelectionInfo();
                }
            });
            list.appendChild(item);
        });

        status.textContent = t('form.listLoaded', { n: experiments.length });
    } catch (err) {
        list.innerHTML = `<span class="exp-picker-error">${escHtml(t('form.loadError') + ': ' + err.message)}</span>`;
        status.textContent = '';
    } finally {
        loadBtn.disabled = false;
    }
}

function getSelectedExperimentIds() {
    return [...document.querySelectorAll('.exp-picker-item.selected')].map(el => el.dataset.id);
}

/* ============================================================
   Experiment preview panel
   ============================================================ */

let _previewAbort = null;   // tracks in-flight preview request

async function showExperimentPreview(id) {
    const placeholder = document.getElementById('exp-preview-placeholder');
    const content     = document.getElementById('exp-preview-content');
    const idEl        = document.getElementById('exp-preview-id');
    const scrollEl    = document.getElementById('exp-preview-scroll');

    if (!placeholder || !content) return;

    // Show loading state
    placeholder.style.display = 'flex';
    placeholder.textContent = 'Loading…';
    content.style.display = 'none';

    if (_previewAbort) _previewAbort();
    let cancelled = false;
    _previewAbort = () => { cancelled = true; };

    try {
        const [yaml, data] = await Promise.all([
            sacApiFetch('getExperimentYaml', id),
            sacApiFetch('getExperiment', id),
        ]);
        if (cancelled) return;

        idEl.textContent = id;
        scrollEl.innerHTML = buildPreviewDataTable(data)
            + `<pre class="exp-preview-yaml-text">${escHtml(yaml)}</pre>`;

        placeholder.style.display = 'none';
        content.style.display = 'flex';
    } catch (err) {
        if (cancelled) return;
        placeholder.textContent = 'Error: ' + err.message;
    }
}

function buildPreviewDataTable(data) {
    const result = data?.result;
    const setup  = data?.setup;
    const rows = [];

    // Date/time from startTime
    if (result?.startTime) {
        const d = new Date(result.startTime / 1000);
        rows.push(['Date', d.toLocaleDateString()]);
        rows.push(['Time', d.toLocaleTimeString()]);
    }

    if (setup?.detectorDistanceM !== undefined)
        rows.push(['Distance', setup.detectorDistanceM + ' m']);

    if (result?.pulseCount !== undefined)
        rows.push(['Pulse count', result.pulseCount]);

    if (result?.pulseCountAfterOneMinute !== undefined)
        rows.push(['After 1 min.', result.pulseCountAfterOneMinute]);

    if (result?.pulseCountAfterOneMinuteCorrected != null && isFinite(result.pulseCountAfterOneMinuteCorrected))
        rows.push(['Corrected', result.pulseCountAfterOneMinuteCorrected.toFixed(1)]);

    if (result?.calibration !== undefined) {
        const labels = { valid: 'valid', invalid: 'invalid', extrapolation: 'extrapol' };
        rows.push(['Calibration', labels[result.calibration] ?? result.calibration]);
    }

    if (result?.neutronYield != null && result?.neutronYieldUncertainty != null &&
        isFinite(result.neutronYield) && isFinite(result.neutronYieldUncertainty) &&
        result.neutronYieldUncertainty > 0) {
        const exp = Math.floor(Math.log10(result.neutronYieldUncertainty));
        const div = Math.pow(10, exp);
        rows.push([
            `Yield (×10<sup>${exp}</sup>)`,
            `${(result.neutronYield / div).toFixed(1)} ±${(result.neutronYieldUncertainty / div).toFixed(1)}`
        ]);
    }

    if (!rows.length) return '';

    const trs = rows.map(([label, val]) =>
        `<tr><th>${label}</th><td>${val}</td></tr>`
    ).join('');
    return `<table class="exp-preview-table"><tbody>${trs}</tbody></table>`;
}

function updateExperimentSelectionInfo() {
    const info = document.getElementById('experiments-selection-info');
    if (!info) return;
    const n = getSelectedExperimentIds().length;
    info.textContent = n ? t('form.selectedCount', { n }) : '';
}

/* ============================================================
   Language change handler (called by i18n.js applyTranslations)
   ============================================================ */

/**
 * Re-renders all visible dynamic sections after a language change.
 * Called by applyTranslations() in i18n.js.
 */
function onLangChange() {
    const s1 = document.getElementById('section-step1');
    const s2 = document.getElementById('section-step2');
    const s3 = document.getElementById('section-step3');
    if (state.parsedYaml) {
        if (s1 && s1.style.display !== 'none') runStep1();
        if (s2 && s2.style.display !== 'none') runStep2();
        if (s3 && s3.style.display !== 'none') runStep3(true);
    }
    if (typeof onMultiLangChange === 'function') onMultiLangChange();
}

/* ============================================================
   Determining the background value
   ============================================================ */

/**
 * Determines/calculates the detector background value [pulses/min] according to the user's choice.
 * Saves the result to state.backgroundPPM, backgroundSource, backgroundQuality.
 *
 * Quality criterion for 'auto':
 *   Q = σ_actual / σ_Poisson = σ_actual / √mean
 *   Q ≈ 1  … data are stable (Poisson noise only)
 *   Q >> 1 … data are still decreasing, background estimate is unreliable
 */
function determineBackground(_rawData) {
    const source = document.querySelector('input[name="bg-source"]:checked')?.value ?? 'yaml';
    state.backgroundSource = source;

    if (source === 'free') {
        state.backgroundPPM     = null;
        state.backgroundQuality = null;
        return;
    }

    if (source === 'yaml') {
        state.backgroundPPM     = state.parsedYaml?.setup?.backgroundPulsesPerMinute ?? 0;
        state.backgroundQuality = null;
        return;
    }

    if (source === 'manual') {
        state.backgroundPPM     = parseFloat(document.getElementById('bg-manual').value) || 0;
        state.backgroundQuality = null;
        return;
    }
}

/**
 * Formats the background information for display in the table.
 */
function formatBackgroundInfo() {
    const src = state.backgroundSource;
    const ppm = state.backgroundPPM ?? 0;

    if (src === 'free') {
        return `<em>${t('bg.freeParam')}</em>`;
    }

    if (src === 'yaml') {
        const yamlVal = state.parsedYaml?.setup?.backgroundPulsesPerMinute;
        if (yamlVal === undefined) {
            return `<em>${t('bg.missingYaml')}</em>`;
        }
        return `${ppm.toFixed(2)}&nbsp;${t('bg.unitPpm')} <small style="color:#666">${t('bg.fromYaml')}</small>`;
    }

    if (src === 'manual') {
        return `${ppm.toFixed(2)}&nbsp;${t('bg.unitPpm')} <small style="color:#666">${t('bg.manual')}</small>`;
    }

    return `${ppm.toFixed(2)}&nbsp;${t('bg.unitPpm')}`;
}

/**
 * Formats the signal-to-background ratio with a colour-coded assessment.
 * ratio = (pulses in the first 60 s) / (background [pulses/min])
 */
/** Recalculates and displays the SNR in the Step 1 table for the given cut.
 *  Uses rawData directly → works even before a full applyManualCut. */
function updateSnrDisplay(cutSec) {
    const snrCell = document.getElementById('snr-value');
    if (!snrCell || !(state.backgroundPPM > 0) || !state.rawData) return;
    const cutUs     = cutSec * 1e6;
    const pulses60s = state.rawData.filter(t => t >= cutUs && t < cutUs + 60e6).length;
    snrCell.innerHTML = formatSnrRatio(pulses60s / state.backgroundPPM, pulses60s);
}

function formatSnrRatio(ratio, pulses60s) {
    const ratioStr  = ratio.toFixed(1);
    const pulsesStr = pulses60s.toLocaleString('cs-CZ');
    const detail    = `<small style="color:#666">(${t('snr.pulsesBg', { n: pulsesStr, bg: Math.round(state.backgroundPPM) })})</small>`;

    if (ratio > 10) {
        return `<span style="color:#1a7a3a;font-weight:700">${ratioStr}</span> ${detail}`
             + ` <span style="color:#1a7a3a;font-weight:700">${t('snr.ok')}</span>`;
    } else if (ratio >= 3) {
        return `<span style="color:#7a5a00;font-weight:700">${ratioStr}</span> ${detail}`
             + ` <span style="color:#7a5a00;font-weight:700">${t('snr.acceptable')}</span>`;
    } else {
        return `<span style="color:#b00000;font-weight:700">${ratioStr}</span> ${detail}`
             + ` <span style="color:#b00000;font-weight:700">${t('snr.tooLow')}</span>`;
    }
}

/* ============================================================
   STEP 1 – Loading and parsing data
   ============================================================ */

async function handleFormSubmit(event) {
    event.preventDefault();

    const selectedIds  = getSelectedExperimentIds();
    const fluenceInput = document.getElementById('fluence');
    const submitBtn    = document.querySelector('button[type="submit"]');

    if (!selectedIds.length) {
        showSection('section-step1');
        showError('step1-content', t('err.noFile'));
        return;
    }

    /* Hide previous results on new processing */
    ['section-step1', 'section-step2', 'section-step3', 'section-multi-summary'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'none';
        const content = el.querySelector('[id$="-content"]');
        if (content) content.innerHTML = '';
    });
    Object.values(state.charts).forEach(c => c.destroy());
    state.charts = {};

    const fluence = parseFloat(fluenceInput.value);
    submitBtn.disabled    = true;
    submitBtn.textContent = t('btn.loadingFiles');

    /* Fetch YAML content for all selected experiments from the server */
    let files;
    try {
        const texts = await Promise.all(selectedIds.map(id => sacApiFetch('getExperimentYaml', id)));
        files = selectedIds.map((id, i) => ({ name: id + '.yaml', text: texts[i] }));
    } catch (err) {
        showSection('section-step1');
        showError('step1-content', t('err.fileRead') + ' ' + err.message);
        submitBtn.disabled    = false;
        submitBtn.textContent = t('btn.submit');
        return;
    }

    /* Multiple files → multi-distance calibration */
    if (files.length > 1) {
        handleMultiFileSubmit(files, fluence);
        return;
    }

    /* Single file */
    state.filename = files[0].name;
    state.fluence  = fluence;

    /* setTimeout allows the browser to repaint before the blocking parse */
    setTimeout(() => {
        try {
            state.parsedYaml = jsyaml.load(files[0].text);
            runStep1();
            runStep2();
            runStep3();
        } catch (err) {
            showSection('section-step1');
            showError('step1-content', t('err.yamlParse') + ' ' + err.message);
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = t('btn.submit');
        }
    }, 20);
}

function runStep1() {
    const yaml = state.parsedYaml;

    /* --- Extract data from YAML --- */
    const datetime        = parseDateFromFilename(state.filename);
    const detectorName    = yaml.detectorSettings?.detectorName         ?? 'N/A';
    const experimentDesc  = yaml.detectorSettings?.experimentDescription ?? 'N/A';
    const tubes           = yaml.setup?.tubes ?? [];
    const samplingTimeSec = yaml.setup?.samplingTimeSec;
    const detectorDistM   = yaml.setup?.detectorDistanceM
                         ?? yaml.detectorSettings?.detectorDistanceM
                         ?? yaml.detectorDistanceM;
    const rawData         = yaml.result?.rawData ?? [];

    state.rawData = rawData;

    /* Determine background value (according to user's choice) */
    determineBackground(rawData);

    /* --- Build HTML output --- */
    let html = '';

    html += `<h3 class="step-subheading">${t('step1.basicInfo')}</h3>`;
    html += '<table class="info-table">';
    html += row(t('step1.datetime'),
                datetime ?? `<em>${t('step1.datetimeUnknown')}</em>`);
    html += row(t('step1.filename'),   escHtml(state.filename));
    html += row(t('step1.detector'),   escHtml(detectorName));
    html += row(t('step1.expDesc'),    escHtml(experimentDesc));
    html += row(t('step1.distance'),
                detectorDistM !== undefined && detectorDistM !== null
                    ? `${detectorDistM} m` : 'N/A');
    html += row(t('step1.samplingTime'),
                samplingTimeSec !== undefined ? `${samplingTimeSec} s` : 'N/A');
    html += row(t('step1.background'), formatBackgroundInfo());
    html += row(t('step1.totalPulses'), rawData.length.toLocaleString('cs-CZ'));

    /* SNR row – placeholder; filled in by runStep2() after trimming */
    if (state.backgroundSource !== 'free' && state.backgroundPPM > 0) {
        html += `<tr id="snr-row"><th>${t('step1.snrRow')}</th>`
              + `<td id="snr-value"><em style="color:#888">${t('step1.computing')}</em></td></tr>`;
    }

    html += row(t('step1.fluence'), `${fmtSciNice(state.fluence, 2)} n/s`);
    html += '</table>';

    html += `<h3 class="step-subheading">${t('step1.tubes')}</h3>`;
    html += buildTubesTable(tubes);

    html += `<h3 class="step-subheading">${t('step1.rawPreview')}</h3>`;
    const preview = rawData.slice(0, 10).map(v => v.toLocaleString('cs-CZ')).join(', ')
                  + (rawData.length > 10 ? ', \u2026' : '');
    html += `<pre class="raw-preview">[ ${preview} ]</pre>`;
    const tSec = rawData.length > 0 ? (rawData[rawData.length - 1] / 1e6).toFixed(2) + ' s' : 'N/A';
    html += `<p style="font-size:0.88rem;color:#666;margin-top:0.4rem;">
        ${t('step1.rawRange', { n: rawData.length.toLocaleString('cs-CZ'), t: tSec })}
    </p>`;

    document.getElementById('step1-content').innerHTML = html;
    showSection('section-step1');
    document.getElementById('section-step1').scrollIntoView({ behavior: 'smooth' });
}

/* ============================================================
   STEP 2 – Histograms and jump detection
   ============================================================ */

function runStep2() {
    const rawData = state.rawData;

    if (!rawData || rawData.length === 0) {
        showError('step2-content', t('step2.noRawData'));
        showSection('section-step2');
        return;
    }

    /* 1. 1 s histogram from full data */
    const hist1s = buildHistogram1s(rawData);
    state.hist1s = hist1s;

    /* 2. Automatic cut detection using p-value */
    const y0PerSecAuto = (state.backgroundSource !== 'free' && state.backgroundPPM != null)
        ? state.backgroundPPM / 60 : null;
    const autoCut = autoDetectCut(rawData, y0PerSecAuto);

    /* 3. Trim and shift data */
    state.autoCutTimeSec = autoCut;
    state.cutTimeSec     = autoCut;
    state.rawDataTrimmed = trimRawData(rawData, autoCut);

    /* Fill in the SNR in the Step 1 table (trimmed data are now available) */
    const snrCell = document.getElementById('snr-value');
    if (snrCell && state.backgroundPPM > 0) {
        const pulses60s = state.rawDataTrimmed.filter(t => t < 60e6).length;
        const snr       = pulses60s / state.backgroundPPM;
        snrCell.innerHTML = formatSnrRatio(snr, pulses60s);
    }

    /* 4. All histograms (bins 1–20 s) from trimmed data */
    state.histograms = buildAllHistograms(state.rawDataTrimmed);

    /* --- HTML section --- */
    let html = '';

    /* Chart 1: initial 1 s histogram (original data) */
    html += `<h3 class="step-subheading">${t('step2.hist1sTitle')}</h3>`;
    html += '<div class="chart-container"><canvas id="chart-hist1s"></canvas></div>';

    /* Cut detection result */
    html += `<h3 class="step-subheading">${t('step2.jumpDetect')}</h3>`;
    if (autoCut > 0) {
        html += `<div class="trim-info trim-found" id="trim-info-box">
            <strong>&#9888; ${t('step2.jumpFoundTitle')}</strong> &ndash;
            ${t('step2.jumpFoundPart1')} <strong id="trim-cut-label">${autoCut}</strong>&nbsp;${t('step2.cutUnit')}
            ${t('step2.jumpFoundPart2')}<br>
            ${t('step2.jumpFoundPart3')} <span id="trim-origin-label">${autoCut}</span>&nbsp;${t('step2.jumpFoundPart4')}
        </div>`;
    } else {
        html += `<div class="trim-info trim-none" id="trim-info-box">
            <strong>&#10003; ${t('step2.noJump')}</strong>
            ${t('step2.noJumpDesc')}
        </div>`;
    }

    /* Control element for manual adjustment of the cut point */
    const maxCutSec = hist1s.length - 2;
    html += `<div class="cut-control">
        <span class="cut-control__label">${t('step2.cutLabel')}</span>
        <input type="range"  id="cut-range"  class="cut-control__range"
               min="0" max="${maxCutSec}" step="1" value="${autoCut}">
        <input type="number" id="cut-number" class="cut-control__number"
               min="0" max="${maxCutSec}" step="1" value="${autoCut}">
        <span class="cut-control__unit">${t('step2.cutUnit')}</span>
        ${autoCut > 0
            ? `<span class="cut-control__auto">${t('step2.cutAuto', { t: autoCut })}</span>`
            : `<span class="cut-control__auto">${t('step2.cutAutoNone')}</span>`}
    </div>`;

    /* Chart 2: all histograms (trimmed data) */
    html += `<h3 class="step-subheading">${t('step2.allHistTitle')}</h3>`;
    html += '<div class="chart-container" style="position:relative">'
          + '<canvas id="chart-all-hist"></canvas>'
          + '<div id="legend-all-hist" class="hlgnd-container"></div>'
          + '</div>';

    document.getElementById('step2-content').innerHTML = html;
    showSection('section-step2');

    /* Render charts (only after insertion into the DOM) */
    renderHist1sChart('chart-hist1s', hist1s, state.cutTimeSec);
    renderAllHistogramsChart('chart-all-hist', state.histograms);

    /* Events for the cut control */
    setupCutControl();

    document.getElementById('section-step2').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Sets up events for the cut slider/input.
 * 'input'  → live update of the rectangle in the chart (no recalculation)
 * 'change' → full recalculation: trim + histograms + fits
 */
function setupCutControl() {
    const rangeEl  = document.getElementById('cut-range');
    const numberEl = document.getElementById('cut-number');
    if (!rangeEl || !numberEl) return;

    rangeEl.addEventListener('input', () => {
        const v = parseInt(rangeEl.value);
        numberEl.value = v;
        updateCutRectangle(v);
        updateSnrDisplay(v);
    });

    rangeEl.addEventListener('change', () => {
        applyManualCut(parseInt(rangeEl.value));
    });

    numberEl.addEventListener('input', () => {
        const max = parseInt(rangeEl.max);
        const v   = Math.max(0, Math.min(parseInt(numberEl.value) || 0, max));
        rangeEl.value = v;
        updateCutRectangle(v);
        updateSnrDisplay(v);
    });

    numberEl.addEventListener('change', () => {
        const max = parseInt(rangeEl.max);
        const v   = Math.max(0, Math.min(parseInt(numberEl.value) || 0, max));
        rangeEl.value  = v;
        numberEl.value = v;
        applyManualCut(v);
    });

}

/**
 * Updates only the cut rectangle in the 1 s chart (without recalculating data).
 */
function updateCutRectangle(cutSec) {
    const chart = state.charts['chart-hist1s'];
    if (chart && chart._cutRef) {
        chart._cutRef.value = cutSec;
        chart.draw();   // chart.update() may skip a redraw when data have not changed
    }
}

/**
 * Full recalculation from the cut onwards: new trimData → histograms → fits.
 */
function applyManualCut(newCutSec) {
    state.cutTimeSec     = newCutSec;
    state.rawDataTrimmed = trimRawData(state.rawData, newCutSec);

    /* Update labels */
    const lbl = document.getElementById('trim-cut-label');
    if (lbl) lbl.textContent = newCutSec;
    const originLbl = document.getElementById('trim-origin-label');
    if (originLbl) originLbl.textContent = newCutSec;

    /* SNR */
    const snrCell = document.getElementById('snr-value');
    if (snrCell && state.backgroundPPM > 0) {
        const pulses60s = state.rawDataTrimmed.filter(t => t < 60e6).length;
        const snr       = pulses60s / state.backgroundPPM;
        snrCell.innerHTML = formatSnrRatio(snr, pulses60s);
    }

    /* Recalculate histograms and charts */
    state.histograms = buildAllHistograms(state.rawDataTrimmed);
    renderAllHistogramsChart('chart-all-hist', state.histograms);

    /* Recalculate fits (without scrolling) */
    runStep3(true);
}

/* ============================================================
   Shared helper functions
   ============================================================ */

function buildTubesTable(tubes) {
    if (!tubes.length) return `<p><em>${t('tubes.empty')}</em></p>`;
    let tbl = '<table class="tubes-table"><thead><tr>'
            + `<th>${t('tubes.col.num')}</th><th>${t('tubes.col.id')}</th>`
            + `<th>${t('tubes.col.type')}</th><th>${t('tubes.col.material')}</th>`
            + `<th>${t('tubes.col.weight')}</th>`
            + '</tr></thead><tbody>';
    tubes.forEach((tube, i) => {
        tbl += '<tr>'
             + `<td>${i + 1}</td>`
             + `<td>${escHtml(String(tube.id ?? 'N/A'))}</td>`
             + `<td>${escHtml(String(tube.type ?? 'N/A'))}</td>`
             + `<td>${escHtml(String(tube.materialSymbol ?? 'N/A'))}</td>`
             + `<td>${tube.materialWeightGram !== undefined
                     ? tube.materialWeightGram.toFixed(3) : 'N/A'}</td>`
             + '</tr>';
    });
    return tbl + '</tbody></table>';
}

function row(label, value) {
    return `<tr><th>${label}</th><td>${value}</td></tr>`;
}

function showSection(id) {
    document.getElementById(id).style.display = '';
}

function showError(containerId, message) {
    document.getElementById(containerId).innerHTML =
        `<div class="error-box">&#9888; ${escHtml(message)}</div>`;
}

/* ============================================================
   STEP 3 – Fitting with a double exponential
   ============================================================
   Method: Weighted Ordinary Least Squares (Weighted OLS).
   t1 and t2 are fixed → f(t) = k1·e^(-t/t1) + k2·e^(-t/t2) + y0
   is linear in the parameters [k1, k2, y0].
   Weights: Poissonian (w_i = B/y_i = 1/Var(y_i)).
   The system of normal equations (3×3) is solved by analytical inversion.
   ============================================================ */

function runStep3(skipScroll = false) {
    if (!state.histograms || state.histograms.length === 0) {
        showError('step3-content', t('step3.noHistograms'));
        showSection('section-step3');
        return;
    }

    /* Fixed y0 value [pulses/s] — null if y0 is a free parameter */
    const y0fixed = (state.backgroundSource !== 'free' && state.backgroundPPM != null)
        ? state.backgroundPPM / 60
        : null;

    /* Fit each histogram */
    state.fits = state.histograms.map(h => ({
        binSize: h.binSize,
        fit:     fitHistogram(h.binSize, h.points, y0fixed),
    }));

    /* Fixed axis ranges for a stable fit chart when the selection changes */
    {
        let yMax = 0;
        state.histograms.forEach(h => {
            h.points.forEach(p => { if (p.y > yMax) yMax = p.y; });
        });
        state.fitAxisXMax = 600;          // physically reasonable range for SAC calibration
        state.fitAxisYMax = niceMax(yMax);
    }

    /* --- Build HTML --- */
    let html = '';

    /* Method info */
    const y0info = y0fixed !== null
        ? t('step3.y0Fixed', { v: y0fixed.toFixed(2), bg: state.backgroundPPM.toFixed(2) })
        : t('step3.y0Free');
    html += `<div class="method-info">
        <strong>${t('step3.methodLabel') ?? 'Method:'}</strong> ${t('step3.methodDesc')},<br>
        ${t('step3.methodFixed', { T1, T2 })},&ensp;
        ${y0info}.
    </div>`;

    /* Fit table – wrapped in a container (highlighting changes with selection) */
    html += `<h3 class="step-subheading">${t('step3.tableTitle')}</h3>`;
    html += '<div id="fit-table-container"></div>';

    /* Bin-size dependency charts – two rows of two charts each */
    /* Row 1: χ²_red + p-value (fit quality metrics) */
    html += '<div class="charts-row">';
    html += '<div class="chart-container chart-container--small">'
          + '<canvas id="chart-chi2-vs-bin"></canvas></div>';
    html += '<div class="chart-container chart-container--small">'
          + '<canvas id="chart-p-value"></canvas></div>';
    html += '</div>';
    /* Row 2: δk₂/k₂ + Adj. R² (parameter precision metrics) */
    html += '<div class="charts-row">';
    html += '<div class="chart-container chart-container--small">'
          + '<canvas id="chart-dk-pct"></canvas></div>';
    html += '<div class="chart-container chart-container--small">'
          + '<canvas id="chart-adjr2"></canvas></div>';
    html += '</div>';

    /* Fit selection */
    html += `<h3 class="step-subheading">${t('step3.selectorHeading')}</h3>`;
    const validBins  = state.fits.filter(r => r.fit && r.fit.k2 > 0).map(r => r.binSize);
    const binOptions = validBins.map(b => `<option value="${b}">${b} s</option>`).join('');
    html += `<div class="fit-selector">
        <div style="width:100%;font-size:0.85rem;color:#555;margin-bottom:0.3rem;">
            ${t('step3.selectorDesc')}
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem 1.6rem;width:100%;">
            <label class="fit-selector__option">
                <input type="radio" name="fit-method" value="recommended">
                ${t('step3.modeRecommended')}
            </label>
            <label class="fit-selector__option">
                <input type="radio" name="fit-method" value="minChiSq" checked>
                ${t('step3.modeMinChi')}
            </label>
            <label class="fit-selector__option">
                <input type="radio" name="fit-method" value="minDk2">
                ${t('step3.modeMinDk')}
            </label>
        </div>
        <div style="display:flex;align-items:center;width:100%;margin-top:0.35rem;">
            <label class="fit-selector__option">
                <input type="radio" name="fit-method" value="manual">
                ${t('step3.modeManual')}&ensp;
                <select id="fit-manual-bin" disabled>${binOptions}</select>&ensp;s
            </label>
        </div>
    </div>`;

    /* Result of the selected fit (filled dynamically) */
    html += '<div id="best-fit-result"></div>';

    /* YAML export – static controls, dynamic output */
    html += `<h3 class="step-subheading">${t('yaml.heading')}</h3>`;
    html += `<div class="yaml-export">
        <div class="yaml-export__controls">
            <label class="yaml-export__label">${t('yaml.distLabel')}
                <input type="number" id="calib-dist-m" class="yaml-export__input"
                       step="0.001" min="0" placeholder="${t('yaml.distPlaceholder')}">
            </label>
            <label class="yaml-export__label">${t('yaml.typeLabel')}
                <select id="calib-type" class="yaml-export__select">
                    <option value="fissionAmBeNeutron">${t('yaml.typeAmBe')}</option>
                    <option value="fusionDdNeutron">${t('yaml.typeDd')}</option>
                </select>
            </label>
        </div>
        <p class="yaml-export__note">
            ${t('yaml.noteCoeff')}
        </p>
        <div id="yaml-output"></div>
    </div>`;

    document.getElementById('step3-content').innerHTML = html;
    showSection('section-step3');

    /* Pre-fill distance from the loaded YAML file */
    const distFromYaml = state.parsedYaml?.setup?.detectorDistanceM
                      ?? state.parsedYaml?.detectorSettings?.detectorDistanceM
                      ?? state.parsedYaml?.detectorDistanceM;
    if (distFromYaml !== undefined && distFromYaml !== null && distFromYaml > 0) {
        document.getElementById('calib-dist-m').value = distFromYaml;
    }

    /* Event listeners for fit selection */
    document.querySelectorAll('input[name="fit-method"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('fit-manual-bin').disabled =
                document.querySelector('input[name="fit-method"]:checked').value !== 'manual';
            updateBestFitResult();
        });
    });
    document.getElementById('fit-manual-bin').addEventListener('change', updateBestFitResult);

    /* Event listeners for YAML export */
    document.getElementById('calib-dist-m').addEventListener('input',  updateYamlOutput);
    document.getElementById('calib-type').addEventListener('change', updateYamlOutput);

    renderChi2vsBinChart('chart-chi2-vs-bin', state.fits);
    renderAdjR2Chart('chart-adjr2', state.fits);
    renderDkPctChart('chart-dk-pct', state.fits);
    renderPValueChart('chart-p-value', state.fits);
    updateBestFitResult();

    if (!skipScroll) {
        document.getElementById('section-step3').scrollIntoView({ behavior: 'smooth' });
    }
}

/* ----------------------------------------------------------
   Compute the index of the best fit according to the current selection
   ---------------------------------------------------------- */

function computeBestIdx() {
    const method = document.querySelector('input[name="fit-method"]:checked')?.value ?? 'recommended';
    if (method === 'recommended') {
        /* Criterion: p-value ∈ [0.05, 0.95] → from acceptable fits, min δk₂/k₂.
           Fallback (none acceptable): min |χ²_red − 1|. */
        const acceptable = state.fits.filter(r =>
            r.fit && r.fit.k2 > 0 && isFinite(r.fit.pValue) &&
            r.fit.pValue >= 0.05 && r.fit.pValue <= 0.95
        );
        if (acceptable.length > 0) {
            let best = -1, minRelDk2 = Infinity;
            acceptable.forEach(r => {
                const relDk2 = r.fit.dk2 / r.fit.k2;
                if (relDk2 < minRelDk2) { minRelDk2 = relDk2; best = state.fits.indexOf(r); }
            });
            return best;
        }
        /* fallback */
        let best = -1, minDist = Infinity;
        state.fits.forEach((r, i) => {
            if (r.fit && r.fit.k2 > 0) {
                const dist = Math.abs(r.fit.redChiSq - 1.0);
                if (dist < minDist) { minDist = dist; best = i; }
            }
        });
        return best;
    }
    if (method === 'minChiSq') {
        let best = -1, minDist = Infinity;
        state.fits.forEach((r, i) => {
            if (r.fit && r.fit.k2 > 0) {
                const dist = Math.abs(r.fit.redChiSq - 1.0);
                if (dist < minDist) { minDist = dist; best = i; }
            }
        });
        return best;
    }
    if (method === 'minDk2') {
        let best = -1, minRelDk2 = Infinity;
        state.fits.forEach((r, i) => {
            const relDk2 = r.fit && r.fit.k2 > 0 ? r.fit.dk2 / r.fit.k2 : Infinity;
            if (relDk2 < minRelDk2) { minRelDk2 = relDk2; best = i; }
        });
        return best;
    }
    /* manual */
    const binSize = parseInt(document.getElementById('fit-manual-bin').value);
    return state.fits.findIndex(r => r.binSize === binSize);
}

/* ----------------------------------------------------------
   Update the fit result (table + chart + coefficients)
   ---------------------------------------------------------- */

function updateBestFitResult() {
    const bestIdx = computeBestIdx();

    /* Update highlighting in the fit table */
    document.getElementById('fit-table-container').innerHTML =
        buildFitTable(state.fits, bestIdx);

    /* Destroy the old best-fit chart */
    if (state.charts['chart-best-fit']) {
        state.charts['chart-best-fit'].destroy();
        delete state.charts['chart-best-fit'];
    }

    let html = '';
    if (bestIdx >= 0) {
        const bestH   = state.histograms[bestIdx];
        const bestFit = state.fits[bestIdx].fit;
        const B       = bestH.binSize;

        html += `<h3 class="step-subheading">${t('fit.chartTitle', { b: B })}</h3>`;
        html += '<div class="chart-container chart-container--tall">'
              + '<canvas id="chart-best-fit"></canvas></div>';

        const pct = (v, dv) => Math.abs(v) > 0
                              ? t('fit.uncertainty', { pct: (Math.abs(dv / v) * 100).toFixed(2) }) : 'N/A';
        const fl   = state.fluence;
        const k1c  = bestFit.k1 / fl,  dk1c = bestFit.dk1 / fl;
        const k2c  = bestFit.k2 / fl,  dk2c = bestFit.dk2 / fl;

        html += `<h3 class="step-subheading">${t('fit.coeffHeading', { b: B })}</h3>`;
        html += '<table class="info-table">';
        html += row(t('fit.k1'),
                    `${fmtValUnc(bestFit.k1, bestFit.dk1)} (${pct(bestFit.k1, bestFit.dk1)})`);
        html += row(t('fit.k2'),
                    `${fmtValUnc(bestFit.k2, bestFit.dk2)} (${pct(bestFit.k2, bestFit.dk2)})`);
        html += row(t('fit.y0'),
                    bestFit.y0IsFixed
                        ? `${bestFit.y0.toFixed(2)} <small style="color:#666">${t('fit.y0Fixed')}</small>`
                        : `${fmtValUnc(bestFit.y0, bestFit.dy0)} (${pct(bestFit.y0, bestFit.dy0)})`);
        html += row(t('fit.k1Phi'), fmtValUnc(k1c, dk1c));
        html += row(t('fit.k2Phi'), fmtValUnc(k2c, dk2c));
        html += row(t('fit.fluence'), fmtSciNice(state.fluence, 2));
        html += '</table>';
    }

    document.getElementById('best-fit-result').innerHTML = html;
    if (bestIdx >= 0) {
        renderBestFitChart('chart-best-fit',
                           state.histograms[bestIdx],
                           state.fits[bestIdx].fit);
    }

    /* Highlight the selected bin in both small charts */
    const selFit = bestIdx >= 0 ? state.fits[bestIdx].fit : null;
    const selBin = bestIdx >= 0 ? state.fits[bestIdx].binSize : null;
    highlightPointInChart('chart-chi2-vs-bin',
        selBin,
        selFit ? selFit.redChiSq : null);
    highlightPointInChart('chart-adjr2',
        selBin,
        selFit ? selFit.adjR2 : null);
    highlightPointInChart('chart-dk-pct',
        selBin,
        selFit && selFit.k2 > 0 ? (selFit.dk2 / selFit.k2) * 100 : null);
    highlightPointInChart('chart-p-value',
        selBin,
        selFit && isFinite(selFit.pValue) ? selFit.pValue : null);

    /* Update YAML output */
    updateYamlOutput();
}

/* ----------------------------------------------------------
   YAML calibration export
   ---------------------------------------------------------- */

/**
 * Generates the YAML text for the calibratedConfiguration section.
 */
function generateCalibYaml(bestIdx) {
    const bestFit = state.fits[bestIdx].fit;
    const fl   = state.fluence;
    const k1c  = bestFit.k1 / fl,  dk1c = bestFit.dk1 / fl;
    const k2c  = bestFit.k2 / fl,  dk2c = bestFit.dk2 / fl;

    const distRaw = parseFloat(document.getElementById('calib-dist-m')?.value);
    const distStr = isFinite(distRaw) && distRaw > 0 ? distRaw.toFixed(3) : '???';
    const calType = document.getElementById('calib-type')?.value ?? 'fissionAmBeNeutron';

    const tubes   = state.parsedYaml?.setup?.tubes ?? [];
    const tubeIds = tubes.map(t => String(t.id ?? ''));

    const mDate = state.filename?.match(/(\d{4})(\d{2})(\d{2})/);
    const calId = mDate ? `${mDate[1]}-${mDate[2]}-${mDate[3]}`
                        : new Date().toISOString().slice(0, 10);

    const tubeLines = tubeIds.length
        ? tubeIds.map(id => `  - "${id}"`).join('\n')
        : '  - ""';

    return [
        `calibratedConfiguration:`,
        `- tubeConfiguration:`,
        tubeLines,
        `  calibrations:`,
        `  - calibrationType: ${calType}`,
        `    calibrationId: "${calId}"`,
        `    distanceMinM: ${distStr}`,
        `    distanceMaxM: ${distStr}`,
        `    fitType: singleDistance`,
        `    fittings:`,
        `    - coefficients: [${k1c.toExponential(6).toUpperCase().replace(/E([+-])(\d)$/, 'E$1' + '0$2')}]`,
        `      uncertainties: [${dk1c.toExponential(6).toUpperCase().replace(/E([+-])(\d)$/, 'E$1' + '0$2')}]`,
        `    - coefficients: [${k2c.toExponential(6).toUpperCase().replace(/E([+-])(\d)$/, 'E$1' + '0$2')}]`,
        `      uncertainties: [${dk2c.toExponential(6).toUpperCase().replace(/E([+-])(\d)$/, 'E$1' + '0$2')}]`,
    ].join('\n');
}

/**
 * Updates the #yaml-output div: generates the YAML text and a Copy button.
 */
function updateYamlOutput() {
    const container = document.getElementById('yaml-output');
    if (!container) return;

    const bestIdx = computeBestIdx();
    if (bestIdx < 0) {
        container.innerHTML = `<p class="table-note">${t('yaml.noFit')}</p>`;
        return;
    }

    const yamlText = generateCalibYaml(bestIdx);
    container.innerHTML =
        `<pre class="yaml-block">${escHtml(yamlText)}</pre>`
      + `<div class="yaml-actions">`
      + `<button type="button" id="copy-yaml-btn" class="btn-copy">${t('yaml.copyBtn')}</button>`
      + `<button type="button" id="save-calib-btn" class="btn-copy btn-save-calib">${t('yaml.saveBtn')}</button>`
      + `</div>`;

    document.getElementById('copy-yaml-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(yamlText).then(() => {
            const btn = document.getElementById('copy-yaml-btn');
            btn.innerHTML = t('yaml.copied');
            setTimeout(() => { btn.innerHTML = t('yaml.copyBtn'); }, 2000);
        }).catch(() => {
            alert(t('yaml.copyFail'));
        });
    });

    document.getElementById('save-calib-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-calib-btn');
        btn.disabled = true;
        try {
            await sacApiFetch('addCalibration', yamlText);
            btn.innerHTML = t('yaml.saved');
            setTimeout(() => { btn.innerHTML = t('yaml.saveBtn'); btn.disabled = false; }, 2000);
        } catch (err) {
            alert(t('yaml.saveFail') + err.message);
            btn.disabled = false;
        }
    });
}

/* ----------------------------------------------------------
   Build the results table
   ---------------------------------------------------------- */

function buildFitTable(fits, bestIdx) {
    let tbl = `<div class="table-scroll"><table class="fit-table">
    <thead><tr>
        <th>${t('fitTable.bin')}</th>
        <th>k<sub>1</sub></th>
        <th>δk<sub>1</sub></th>
        <th>k<sub>2</sub></th>
        <th>δk<sub>2</sub></th>
        <th>δk<sub>2</sub>/k<sub>2</sub> (%)</th>
        <th>y<sub>0</sub></th>
        <th>δy<sub>0</sub></th>
        <th>${t('fitTable.adjR2')}</th>
        <th>${t('fitTable.redChi')}</th>
        <th>${t('fitTable.pVal')}</th>
        <th>${t('fitTable.n')}</th>
    </tr></thead><tbody>`;

    fits.forEach((r, i) => {
        const f   = r.fit;
        const classes = [
            i === bestIdx      ? 'best-fit-row' : '',
            f && (f.k1 < 0 || f.k2 < 0) ? 'warn-neg' : '',
        ].filter(Boolean).join(' ');
        const cls = classes ? `class="${classes}"` : '';
        if (!f) {
            tbl += `<tr ${cls}><td>${r.binSize}</td>
                  <td colspan="11"><em>${t('fitTable.noData')}</em></td></tr>`;
            return;
        }
        tbl += `<tr ${cls}>
            <td>${r.binSize}</td>
            <td>${fmt3(f.k1)}</td>
            <td>${fmt3(f.dk1)}</td>
            <td>${fmt3(f.k2)}</td>
            <td>${fmt3(f.dk2)}</td>
            <td>${f.k2 > 0 ? ((f.dk2 / f.k2) * 100).toFixed(4) : '—'}</td>
            <td>${fmt3(f.y0)}</td>
            <td>${f.y0IsFixed ? `<em style="color:#888">${t('fitTable.fixed')}</em>` : fmt3(f.dy0)}</td>
            <td>${f.adjR2.toFixed(6)}</td>
            <td>${f.redChiSq.toFixed(4)}</td>
            <td style="color:${
                !isFinite(f.pValue)  ? '#888' :
                f.pValue < 0.05      ? '#c00' :
                f.pValue > 0.95      ? '#b07000' :
                                       '#1a7a2a'
            }">${isFinite(f.pValue) ? f.pValue.toFixed(3) : '—'}</td>
            <td>${f.n}</td>
        </tr>`;
    });

    const y0note = fits.length > 0 && fits.find(r => r.fit)?.fit?.y0IsFixed
        ? ' ' + t('fitTable.y0Fixed')
        : ' ' + t('fitTable.y0Free');
    return tbl + '</tbody></table></div>'
               + `<p class="table-note">${t('fitTable.note')}${y0note}</p>`;
}

/* ----------------------------------------------------------
   Print – automatic expand/collapse of <details> sections
   ---------------------------------------------------------- */
window.addEventListener('beforeprint', () => {
    document.querySelectorAll('details').forEach(d => {
        d._printOpen = d.open;
        d.open = true;
    });
});
window.addEventListener('afterprint', () => {
    document.querySelectorAll('details').forEach(d => {
        if ('_printOpen' in d) {
            d.open = d._printOpen;
            delete d._printOpen;
        }
    });
});
