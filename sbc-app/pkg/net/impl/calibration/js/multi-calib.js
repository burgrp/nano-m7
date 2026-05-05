/* multi-calib.js – multi-distance calibration (Block 1: loading + validation) */
/* Dependencies (loaded before multi-calib.js): utils.js, fitting.js, charts.js, app.js */
'use strict';

/* ---------- Global state for multi-distance calibration ---------- */
const multiState = {
    files:            [],   // [{filename, yaml, distance, tubeConfig, date, rawDataLen}]
    validationOk:     false,
    commonTubeConfig: null,
    fluence:          null,
    hideTimeSec:      6,    // source hiding time [s] – correction of ki to t=0
    batchMode:        false, // true = batch processing (YAML export summary only)
    lastFit:          null,  // { fit1, fit2, pts1, pts2 } – for Excel export
    _suppressRefresh: false, // internal: suppress refreshFinalFit during batch update
};

/* ============================================================
   Helper functions
   ============================================================ */

/* ============================================================
   Block 1 – Loading and validating multiple files
   ============================================================ */

/**
 * Entry point for batch processing of multiple YAML files.
 * Called from handleFormSubmit() in app.js when multiple files are selected.
 * @param {Array<{name: string, text: string}>} files - pre-fetched YAML files
 */
async function handleMultiFileSubmit(files, fluence) {
    const submitBtn = document.querySelector('button[type="submit"]');

    multiState.fluence      = fluence;
    multiState.hideTimeSec  = parseFloat(document.getElementById('hide-time-sec')?.value) || 0;

    try {
        /* Parse YAML from pre-fetched texts */
        const parsed = files.map(f => {
            const filename   = f.name;
            const yaml       = jsyaml.load(f.text);
            const distance   = yaml.setup?.detectorDistanceM
                            ?? yaml.detectorSettings?.detectorDistanceM
                            ?? null;
            const tubeConfig = yaml.setup?.tubeConfiguration ?? null;
            const rawDataLen = (yaml.result?.rawData ?? []).length;
            const date       = parseDateFromFilename(filename);
            return { filename, yaml, distance, tubeConfig, date, rawDataLen };
        });

        /* ---------- Validation ---------- */
        const errors   = [];
        const warnings = [];

        /* 1) Same GM tube configuration in all files */
        const tubeConfigStrs = parsed.map(f => JSON.stringify(f.tubeConfig));
        const allSameTubeConfig = tubeConfigStrs.every(tc => tc === tubeConfigStrs[0]);
        if (!allSameTubeConfig) {
            errors.push(t('multi.errTubeConfig'));
            multiState.commonTubeConfig = null;
        } else {
            multiState.commonTubeConfig = parsed[0].tubeConfig;
        }

        /* 2) Files without a defined distance */
        const missingDist = parsed.filter(f => f.distance === null || f.distance === undefined);
        if (missingDist.length > 0) {
            errors.push(t('multi.errMissingDist', { files: missingDist.map(f => escHtml(f.filename)).join(', ') }));
        }

        /* 3) Unique distances */
        let hasDupDistError = false;
        if (missingDist.length === 0) {
            const distances    = parsed.map(f => f.distance);
            const distanceDups = distances.filter((d, i) => distances.indexOf(d) !== i);
            if (distanceDups.length > 0) {
                const dupVals = [...new Set(distanceDups)].map(d => d.toFixed(2) + ' m').join(', ');
                errors.push(t('multi.errDupDist', { vals: dupVals }));
                hasDupDistError = true;
            }
        }

        /* 4) Minimum number of files for batch processing (min. 4) */
        const MIN_FILES = 4;
        if (errors.length === 0 && parsed.length < MIN_FILES) {
            warnings.push(t('multi.warnMinFiles', { n: MIN_FILES, m: parsed.length }));
        }

        multiState.validationOk = errors.length === 0 && parsed.length >= MIN_FILES;
        multiState._errors   = errors;
        multiState._warnings = warnings;

        /* Sort files ascending by distance (if no distance-related errors) */
        if (missingDist.length === 0 && !hasDupDistError) {
            parsed.sort((a, b) => a.distance - b.distance);
        }

        multiState.files = parsed;

        /* Display the summary UI */
        renderMultiSummary(errors, warnings);

    } catch (err) {
        showSection('section-multi-summary');
        document.getElementById('multi-summary-content').innerHTML =
            `<div class="error-box">&#9888; ${t('multi.errLoading', { msg: escHtml(err.message) })}</div>`;
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = t('btn.submit');
    }
}

/* ============================================================
   Rendering the summary UI after loading files
   ============================================================ */

function renderMultiSummary(errors, warnings) {
    showSection('section-multi-summary');
    const container = document.getElementById('multi-summary-content');

    let html = '';

    /* --- Errors and warnings --- */
    if (errors.length > 0) {
        html += `<div class="error-box"><strong>${t('multi.errHeader')}</strong><ul style="margin:0.4rem 0 0 1.2rem;padding:0">`;
        errors.forEach(e => { html += `<li>${e}</li>`; });
        html += '</ul></div>';
    }
    if (warnings.length > 0) {
        html += `<div class="warning-box"><strong>${t('multi.warnHeader')}</strong><ul style="margin:0.4rem 0 0 1.2rem;padding:0">`;
        warnings.forEach(w => { html += `<li>${w}</li>`; });
        html += '</ul></div>';
    }

    /* --- Summary table --- */
    html += `<h3 class="step-subheading">${t('multi.summaryHeading')}</h3>`;
    html += '<table class="info-table">';
    html += `<tr><th>${t('multi.fileCount')}</th><td>${multiState.files.length}</td></tr>`;

    const distList = multiState.files
        .map(f => f.distance !== null ? `${f.distance.toFixed(2)} m` : '<em>N/A</em>')
        .join(', ');
    html += `<tr><th>${t('multi.distances')}</th><td>${distList}</td></tr>`;

    if (multiState.commonTubeConfig) {
        const tcStr = multiState.commonTubeConfig.map(tc => escHtml(tc)).join(', ');
        html += `<tr><th>${t('multi.tubeConfig')}</th><td>${tcStr}</td></tr>`;
    } else if (errors.length === 0) {
        html += `<tr><th>${t('multi.tubeConfig')}</th><td><em>${t('multi.tubeConfigVarious')}</em></td></tr>`;
    }

    html += `<tr><th>${t('multi.fluence')}</th><td>${fmtSciNice(multiState.fluence, 2)} n/s</td></tr>`;
    html += '</table>';

    /* --- Detailed file table --- */
    html += `<h3 class="step-subheading">${t('multi.detailHeading')}</h3>`;
    html += '<table class="fit-table"><thead><tr>'
          + `<th>${t('multi.col.num')}</th><th>${t('multi.col.file')}</th><th>${t('multi.col.datetime')}</th>`
          + `<th>${t('multi.col.dist')}</th><th>${t('multi.col.pulses')}</th><th>${t('multi.col.tubeConfig')}</th>`
          + '</tr></thead><tbody>';

    multiState.files.forEach((f, i) => {
        const distOk = f.distance !== null && f.distance !== undefined;
        const tcOk   = multiState.commonTubeConfig !== null ||
                       (f.tubeConfig !== null && f.tubeConfig !== undefined);
        const rowOk  = distOk && tcOk;
        const rowStyle = rowOk ? '' : ' style="background:#fff8f8"';

        const distCell = distOk
            ? f.distance.toFixed(2)
            : '<span style="color:#b00000">N/A</span>';
        const tcCell = f.tubeConfig
            ? f.tubeConfig.map(tc => escHtml(tc)).join(', ')
            : '<span style="color:#b00000">N/A</span>';
        const statusIcon = rowOk ? '&#10003;' : '&#10007;';
        const statusStyle = rowOk
            ? 'color:#2a7a2a;font-weight:700'
            : 'color:#b00000;font-weight:700';

        html += `<tr${rowStyle}>`;
        html += `<td style="${statusStyle}">${statusIcon} ${i + 1}</td>`;
        html += `<td>${escHtml(f.filename)}</td>`;
        html += `<td>${f.date ?? '<em>N/A</em>'}</td>`;
        html += `<td>${distCell}</td>`;
        html += `<td>${f.rawDataLen.toLocaleString()}</td>`;
        html += `<td>${tcCell}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    /* --- Action buttons --- */
    html += '<div style="margin-top:1.5rem;display:flex;gap:1rem;flex-wrap:wrap;">';

    if (multiState.validationOk) {
        html += `<button id="btn-process-batch" onclick="handleBatchProcess()">`
              + t('multi.btnBatch', { n: multiState.files.length })
              + `</button>`;
    }

    html += `<button id="btn-process-individual" onclick="handleIndividualProcess()">`
          + t('multi.btnIndividual')
          + `</button>`;

    html += '</div>';

    /* Containers for outputs of further blocks */
    html += '<div id="multi-individual-sections" style="margin-top:1rem;"></div>';
    html += '<div id="multi-batch-section" style="margin-top:1rem;"></div>';

    container.innerHTML = html;
}

/* ============================================================
   "Zpracovat hromadně" – Block 2 + Block 3 automatically
   ============================================================ */

function handleBatchProcess() {
    const batchEl = document.getElementById('multi-batch-section');
    if (batchEl) batchEl.innerHTML = '';
    handleIndividualProcess(() => {
        triggerFinalFit();
    });
}

/* ============================================================
   Block 2 – Processing individual files
   ============================================================ */

/**
 * Returns {backgroundPPM, backgroundSource} for file idx
 * according to the current selection in the global form.
 */
function getFileBackground(idx) {
    const source = document.querySelector('input[name="bg-source"]:checked')?.value ?? 'yaml';
    if (source === 'free') return { backgroundPPM: null, backgroundSource: 'free' };
    if (source === 'manual') {
        return {
            backgroundPPM:    parseFloat(document.getElementById('bg-manual').value) || 0,
            backgroundSource: 'manual',
        };
    }
    /* yaml */
    const bpm = multiState.files[idx].yaml?.setup?.backgroundPulsesPerMinute ?? 0;
    return { backgroundPPM: bpm, backgroundSource: 'yaml' };
}

/**
 * Initialises the per-file state (proc object) for file idx.
 */
function initFileProc(idx) {
    const { backgroundPPM, backgroundSource } = getFileBackground(idx);
    multiState.files[idx].proc = {
        rawData:         multiState.files[idx].yaml?.result?.rawData ?? [],
        rawDataTrimmed:  null,
        hist1s:          null,
        cutTimeSec:      0,
        autoCutTimeSec:  0,
        histograms:      null,
        fits:            null,
        fitAxisXMax:     null,
        fitAxisYMax:     null,
        backgroundPPM,
        backgroundSource,
        k1: null, dk1: null, k2: null, dk2: null,
    };
}

/**
 * Processes histograms and fits for file idx.
 */
function processOneFile(idx) {
    const p       = multiState.files[idx].proc;
    const rawData = p.rawData;
    if (!rawData || rawData.length === 0) return;

    p.hist1s = buildHistogram1s(rawData);
    const y0PerSecAuto = (p.backgroundSource !== 'free' && p.backgroundPPM != null)
        ? p.backgroundPPM / 60 : null;
    const autoCut    = autoDetectCut(rawData, y0PerSecAuto);
    p.autoCutTimeSec = autoCut;
    p.cutTimeSec     = autoCut;
    p.rawDataTrimmed = trimRawData(rawData, autoCut);
    p.histograms     = buildAllHistograms(p.rawDataTrimmed);

    const y0fixed = (p.backgroundSource !== 'free' && p.backgroundPPM != null)
        ? p.backgroundPPM / 60 : null;
    p.fits = p.histograms.map(h => ({
        binSize: h.binSize,
        fit:     fitHistogram(h.binSize, h.points, y0fixed),
    }));

    let yMax = 0;
    p.histograms.forEach(h => h.points.forEach(pt => { if (pt.y > yMax) yMax = pt.y; }));
    p.fitAxisXMax = 600;
    p.fitAxisYMax = niceMax(yMax);
}

/* ----------------------------------------------------------
   Computing the best fit for file idx
   ---------------------------------------------------------- */

function computeFileBestIdx(idx) {
    const p      = multiState.files[idx].proc;
    const fits   = p.fits;
    const method = document.querySelector(`input[name="f${idx}-fit-method"]:checked`)?.value
                ?? 'recommended';

    if (method === 'recommended') {
        const ok = fits.filter(r =>
            r.fit && r.fit.k2 > 0 && isFinite(r.fit.pValue) &&
            r.fit.pValue >= 0.05 && r.fit.pValue <= 0.95
        );
        if (ok.length > 0) {
            let best = -1, minRel = Infinity;
            ok.forEach(r => {
                const rel = r.fit.dk2 / r.fit.k2;
                if (rel < minRel) { minRel = rel; best = fits.indexOf(r); }
            });
            return best;
        }
        let best = -1, minD = Infinity;
        fits.forEach((r, i) => {
            if (r.fit && r.fit.k2 > 0) {
                const d = Math.abs(r.fit.redChiSq - 1.0);
                if (d < minD) { minD = d; best = i; }
            }
        });
        return best;
    }
    if (method === 'minChiSq') {
        let best = -1, minD = Infinity;
        fits.forEach((r, i) => {
            if (r.fit && r.fit.k2 > 0) {
                const d = Math.abs(r.fit.redChiSq - 1.0);
                if (d < minD) { minD = d; best = i; }
            }
        });
        return best;
    }
    if (method === 'minDk2') {
        let best = -1, minRel = Infinity;
        fits.forEach((r, i) => {
            const rel = r.fit && r.fit.k2 > 0 ? r.fit.dk2 / r.fit.k2 : Infinity;
            if (rel < minRel) { minRel = rel; best = i; }
        });
        return best;
    }
    /* manual */
    const binSize = parseInt(document.getElementById(`f${idx}-fit-manual-bin`)?.value ?? '0');
    return fits.findIndex(r => r.binSize === binSize);
}

/* ----------------------------------------------------------
   Updating the fit result + saving coefficients
   ---------------------------------------------------------- */

function updateFileSummaryBadge(idx) {
    const p     = multiState.files[idx].proc;
    const badge = document.getElementById(`f${idx}-badge`);
    if (!badge) return;
    if (p.k2 != null) {
        const pct = p.dk2 > 0 && p.k2 > 0
            ? ` (${((Math.abs(p.dk2 / p.k2)) * 100).toFixed(2)}\u202f%)`
            : '';
        badge.innerHTML = `<span class="file-badge-ok">k\u2082/\u03A6\u202f=\u202f${fmtSci(p.k2)}${pct}</span>`;
    } else {
        badge.innerHTML = `<span class="file-badge-err">${t('file.badgeNoResult')}</span>`;
    }
}

function updateFileBestFit(idx) {
    const p       = multiState.files[idx].proc;
    const bestIdx = computeFileBestIdx(idx);

    /* Highlight in the fit table */
    const tblEl = document.getElementById(`f${idx}-fit-table`);
    if (tblEl) tblEl.innerHTML = buildFitTable(p.fits, bestIdx);

    /* Destroy the old best-fit chart */
    const bestFitId = `f${idx}-chart-bestfit`;
    if (state.charts[bestFitId]) {
        state.charts[bestFitId].destroy();
        delete state.charts[bestFitId];
    }

    const resEl = document.getElementById(`f${idx}-best-fit`);
    if (!resEl) return;

    let html = '';
    if (bestIdx >= 0) {
        const bestH   = p.histograms[bestIdx];
        const bestFit = p.fits[bestIdx].fit;
        const B       = bestH.binSize;
        const fl      = multiState.fluence;
        const k1c     = bestFit.k1 / fl,  dk1c = bestFit.dk1 / fl;
        const k2c     = bestFit.k2 / fl,  dk2c = bestFit.dk2 / fl;
        const pct     = (v, dv) => Math.abs(v) > 0
            ? t('file.uncertainty', { pct: (Math.abs(dv / v) * 100).toFixed(2) }) : 'N/A';

        html += `<h4 class="step-subheading">${t('file.fitChartTitle', { b: B })}</h4>`;
        html += `<div class="chart-container chart-container--tall">`
              + `<canvas id="${bestFitId}"></canvas></div>`;
        html += `<h4 class="step-subheading">${t('file.fitCoeffHeading', { b: B })}</h4>`;
        html += '<table class="info-table">';
        html += `<tr><th>${t('file.k1')}</th><td>${fmtValUnc(bestFit.k1, bestFit.dk1)} (${pct(bestFit.k1, bestFit.dk1)})</td></tr>`;
        html += `<tr><th>${t('file.k2')}</th><td>${fmtValUnc(bestFit.k2, bestFit.dk2)} (${pct(bestFit.k2, bestFit.dk2)})</td></tr>`;
        html += `<tr><th>${t('file.y0')}</th><td>${
            bestFit.y0IsFixed
                ? `${bestFit.y0.toFixed(2)} <small style="color:#666">${t('file.y0Fixed')}</small>`
                : `${fmtValUnc(bestFit.y0, bestFit.dy0)} (${pct(bestFit.y0, bestFit.dy0)})`
        }</td></tr>`;
        html += `<tr><th>${t('file.k1Phi')}</th><td>${fmtValUnc(k1c, dk1c)}</td></tr>`;
        html += `<tr><th>${t('file.k2Phi')}</th><td>${fmtValUnc(k2c, dk2c)}</td></tr>`;
        html += '</table>';

        /* YAML export for this file (singleDistance) – only in standalone processing mode */
        if (!multiState.batchMode) {
            html += `<h4 class="step-subheading">${t('file.yamlExportHeading')}</h4>`;
            html += buildFileYamlBlock(idx, bestFit);
        }

        /* Save results for Block 3 – correction of ki to t=0 (exp. of source hiding) */
        const tH = multiState.hideTimeSec ?? 0;
        p.k1 = k1c * Math.exp(tH / T1);  p.dk1 = dk1c * Math.exp(tH / T1);
        p.k2 = k2c * Math.exp(tH / T2);  p.dk2 = dk2c * Math.exp(tH / T2);
        p.selectedBinSize = B;
        p.selectedMethod  = document.querySelector(`input[name="f${idx}-fit-method"]:checked`)?.value ?? 'recommended';

        resEl.innerHTML = html;
        renderBestFitChart(bestFitId, bestH, bestFit, p.fitAxisXMax, p.fitAxisYMax);
    } else {
        p.k1 = null; p.dk1 = null; p.k2 = null; p.dk2 = null;
        resEl.innerHTML = `<p class="table-note">${t('file.noFit')}</p>`;
    }

    /* Highlight in diagnostic charts */
    const sf  = bestIdx >= 0 ? p.fits[bestIdx].fit  : null;
    const sb  = bestIdx >= 0 ? p.fits[bestIdx].binSize : null;
    highlightPointInChart(`f${idx}-chi2`,   sb, sf ? sf.redChiSq : null);
    highlightPointInChart(`f${idx}-adjr2`,  sb, sf ? sf.adjR2    : null);
    highlightPointInChart(`f${idx}-dkpct`,  sb, sf && sf.k2 > 0 ? (sf.dk2 / sf.k2) * 100 : null);
    highlightPointInChart(`f${idx}-pval`,   sb, sf && isFinite(sf.pValue) ? sf.pValue : null);

    updateFileSummaryBadge(idx);

    /* Automatically redraw the summary fit on every change */
    if (multiState.batchMode) refreshFinalFit();
}

/* ----------------------------------------------------------
   Data trimming for a single file
   ---------------------------------------------------------- */

/** Recalculates and displays the SNR in the file idx table for the given trim.
 *  Uses rawData directly → works even before a full applyFileCut. */
function updateFileSnrDisplay(idx, cutSec) {
    const p = multiState.files[idx]?.proc;
    const snrCell = document.getElementById(`f${idx}-snr-value`);
    if (!snrCell || !p || !(p.backgroundPPM > 0)) return;
    const cutUs     = cutSec * 1e6;
    const pulses60s = p.rawData.filter(t => t >= cutUs && t < cutUs + 60e6).length;
    const ratio     = pulses60s / p.backgroundPPM;
    const color     = ratio >= 10 ? '#1a7a2a' : ratio >= 3 ? '#b07000' : '#b00000';
    const icon      = ratio >= 10 ? '&#10003;' : ratio >= 3 ? '&#9888;' : `&#10007;\u202f${t('file.snrTooLow')}`;
    const detail    = `<small style="color:#666">(${t('snr.pulsesBg', { n: pulses60s.toLocaleString(), bg: Math.round(p.backgroundPPM) })})</small>`;
    snrCell.innerHTML = `<span style="color:${color};font-weight:700">${ratio.toFixed(1)}</span>\u202f${detail}\u202f<span style="color:${color};font-weight:700">${icon}</span>`;
}

function applyFileCut(idx, newCutSec) {
    const p = multiState.files[idx].proc;
    p.cutTimeSec     = newCutSec;
    p.rawDataTrimmed = trimRawData(p.rawData, newCutSec);

    const lbl = document.getElementById(`f${idx}-trim-cut-label`);
    if (lbl) lbl.textContent = newCutSec;
    const origLbl = document.getElementById(`f${idx}-trim-origin-label`);
    if (origLbl) origLbl.textContent = newCutSec;

    updateFileSnrDisplay(idx, newCutSec);

    /* Recalculate histograms */
    p.histograms = buildAllHistograms(p.rawDataTrimmed);
    renderAllHistogramsChart(`f${idx}-chart-allhist`, p.histograms);
    const legendEl = document.getElementById(`f${idx}-legend-allhist`);
    if (legendEl) legendEl.innerHTML = buildHistLegendHtml(p.histograms);

    /* Recalculate fits */
    const y0fixed = (p.backgroundSource !== 'free' && p.backgroundPPM != null)
        ? p.backgroundPPM / 60 : null;
    p.fits = p.histograms.map(h => ({
        binSize: h.binSize,
        fit:     fitHistogram(h.binSize, h.points, y0fixed),
    }));

    let yMax = 0;
    p.histograms.forEach(h => h.points.forEach(pt => { if (pt.y > yMax) yMax = pt.y; }));
    p.fitAxisYMax = niceMax(yMax);

    renderChi2vsBinChart(`f${idx}-chi2`,  p.fits);
    renderAdjR2Chart(`f${idx}-adjr2`,     p.fits);
    renderDkPctChart(`f${idx}-dkpct`,     p.fits);
    renderPValueChart(`f${idx}-pval`,     p.fits);

    updateFileBestFit(idx);
}

function setupFileCutControl(idx) {
    const rangeEl  = document.getElementById(`f${idx}-cut-range`);
    const numberEl = document.getElementById(`f${idx}-cut-number`);
    if (!rangeEl || !numberEl) return;

    const updateRect = v => {
        const ch = state.charts[`f${idx}-chart-hist1s`];
        if (ch && ch._cutRef) { ch._cutRef.value = v; ch.draw(); }
    };

    rangeEl.addEventListener('input',  () => { const v = parseInt(rangeEl.value); numberEl.value = v; updateRect(v); updateFileSnrDisplay(idx, v); });
    rangeEl.addEventListener('change', () => applyFileCut(idx, parseInt(rangeEl.value)));

    numberEl.addEventListener('input', () => {
        const max = parseInt(rangeEl.max);
        const v   = Math.max(0, Math.min(parseInt(numberEl.value) || 0, max));
        rangeEl.value = v;
        updateRect(v);
        updateFileSnrDisplay(idx, v);
    });
    numberEl.addEventListener('change', () => {
        const max = parseInt(rangeEl.max);
        const v   = Math.max(0, Math.min(parseInt(numberEl.value) || 0, max));
        rangeEl.value = numberEl.value = v;
        applyFileCut(idx, v);
    });

}

function setupFileFitSelector(idx) {
    document.querySelectorAll(`input[name="f${idx}-fit-method"]`).forEach(radio => {
        radio.addEventListener('change', () => {
            const manBin = document.getElementById(`f${idx}-fit-manual-bin`);
            if (manBin) {
                manBin.disabled = document.querySelector(
                    `input[name="f${idx}-fit-method"]:checked`)?.value !== 'manual';
            }
            updateFileBestFit(idx);
        });
    });
    const manBinSel = document.getElementById(`f${idx}-fit-manual-bin`);
    if (manBinSel) manBinSel.addEventListener('change', () => updateFileBestFit(idx));
}

/* ----------------------------------------------------------
   Building the HTML section for a single file
   ---------------------------------------------------------- */

/* ----------------------------------------------------------
   YAML export for a single file (singleDistance)
   ---------------------------------------------------------- */

function generateFileCalibYaml(idx, bestFit) {
    const f   = multiState.files[idx];
    const fl  = multiState.fluence;
    const k1c = bestFit.k1 / fl,  dk1c = bestFit.dk1 / fl;
    const k2c = bestFit.k2 / fl,  dk2c = bestFit.dk2 / fl;

    const distRaw = f.distance;
    const distStr = distRaw != null ? distRaw.toFixed(2) : '???';

    const calType = document.getElementById('calib-type')?.value ?? 'fissionAmBeNeutron';

    const tubes    = f.yaml?.setup?.tubes ?? [];
    const tubeIds  = tubes.length
        ? tubes.map(t => String(t.id ?? ''))
        : (f.tubeConfig ?? multiState.commonTubeConfig ?? []).map(t => String(t));
    const tubeLines = tubeIds.length
        ? tubeIds.map(id => `  - "${id}"`).join('\n')
        : '  - ""';

    const mDate = f.date?.match(/(\d{4})-(\d{2})-(\d{2})/);
    const calId = mDate ? `${mDate[1]}-${mDate[2]}-${mDate[3]}`
                        : new Date().toISOString().slice(0, 10);

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

function buildFileYamlBlock(idx, bestFit) {
    const yamlText = generateFileCalibYaml(idx, bestFit);
    const preId    = `f${idx}-yaml-pre`;
    const btnId    = `f${idx}-yaml-copy`;
    let html = `<pre class="yaml-block" id="${preId}">${escHtml(yamlText)}</pre>`;
    html += `<button type="button" id="${btnId}" class="btn-copy">${t('yaml.copyBtn')}</button>`;
    setTimeout(() => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(yamlText).then(() => {
                btn.textContent = t('yaml.copied');
                setTimeout(() => { btn.innerHTML = t('yaml.copyBtn'); }, 2000);
            }).catch(() => {
                alert(t('yaml.copyFail'));
            });
        });
    }, 0);
    return html;
}

function buildFileStep1Html(idx) {
    const f  = multiState.files[idx];
    const p  = f.proc;
    const bgTxt = p.backgroundSource === 'yaml'   ? t('file.bgFromYaml')
                : p.backgroundSource === 'manual' ? t('file.bgManual')
                :                                   t('file.bgFree');
    const bgVal = p.backgroundPPM != null
        ? `${p.backgroundPPM.toFixed(2)} ${t('bg.unitPpm')} (${bgTxt})`
        : bgTxt;

    let html = '<table class="info-table">';
    html += `<tr><th>${t('file.col.file')}</th><td>${escHtml(f.filename)}</td></tr>`;
    html += `<tr><th>${t('file.col.datetime')}</th><td>${f.date ?? '<em>N/A</em>'}</td></tr>`;
    html += `<tr><th>${t('file.col.dist')}</th><td>${f.distance != null ? f.distance.toFixed(2) : 'N/A'} m</td></tr>`;
    html += `<tr><th>${t('file.col.bg')}</th><td>${bgVal}</td></tr>`;
    html += `<tr><th>${t('file.col.totalPulses')}</th><td>${p.rawData.length.toLocaleString()}</td></tr>`;
    if (p.backgroundPPM > 0) {
        html += `<tr><th>${t('file.col.snr')}</th>`
              + `<td id="f${idx}-snr-value"><em style="color:#888">${t('file.computing')}</em></td></tr>`;
    }
    html += '</table>';
    return html;
}

function buildFileStep2Html(idx) {
    const p   = multiState.files[idx].proc;
    const maxCutSec = p.hist1s.length - 2;

    let html = '';
    html += `<h4 class="step-subheading">${t('step2.hist1sTitle')}</h4>`;
    html += `<div class="chart-container"><canvas id="f${idx}-chart-hist1s"></canvas></div>`;

    html += `<h4 class="step-subheading">${t('step2.jumpDetect')}</h4>`;
    if (p.autoCutTimeSec > 0) {
        html += `<div class="trim-info trim-found">
            <strong>&#9888; ${t('step2.jumpFoundTitle')}</strong> \u2013
            ${t('step2.jumpFoundPart1')} <strong id="f${idx}-trim-cut-label">${p.cutTimeSec}</strong>\u202f${t('step2.jumpFoundPart2')}<br>
            ${t('step2.jumpFoundPart3')} <span id="f${idx}-trim-origin-label">${p.cutTimeSec}</span>\u202f${t('step2.jumpFoundPart4')}
        </div>`;
    } else {
        html += `<div class="trim-info trim-none">
            <strong>&#10003; ${t('step2.noJump')}</strong>
            ${t('step2.noJumpDesc')}
        </div>`;
    }

    html += `<div class="cut-control">
        <span class="cut-control__label">${t('step2.cutLabel')}</span>
        <input type="range"  id="f${idx}-cut-range"  class="cut-control__range"
               min="0" max="${maxCutSec}" step="1" value="${p.cutTimeSec}">
        <input type="number" id="f${idx}-cut-number" class="cut-control__number"
               min="0" max="${maxCutSec}" step="1" value="${p.cutTimeSec}">
        <span class="cut-control__unit">${t('step2.cutUnit')}</span>
        ${p.autoCutTimeSec > 0
            ? `<span class="cut-control__auto" id="f${idx}-cut-auto-label">${t('step2.cutAuto', { t: p.autoCutTimeSec })}</span>`
            : `<span class="cut-control__auto" id="f${idx}-cut-auto-label">${t('step2.cutAutoNone')}</span>`}
    </div>`;

    html += `<h4 class="step-subheading">${t('step2.allHistTitle')}</h4>`;
    html += `<div class="chart-container" style="position:relative">`
          + `<canvas id="f${idx}-chart-allhist"></canvas>`
          + `<div id="f${idx}-legend-allhist" class="hlgnd-container"></div>`
          + `</div>`;
    return html;
}

function buildFileStep3Html(idx) {
    const p      = multiState.files[idx].proc;
    const y0info = (p.backgroundSource !== 'free' && p.backgroundPPM != null)
        ? t('file.y0FixedShort', { v: fmt4(p.backgroundPPM / 60) })
        : t('file.y0FreeShort');
    const validBins  = p.fits.filter(r => r.fit && r.fit.k2 > 0).map(r => r.binSize);
    const binOptions = validBins.map(b => `<option value="${b}">${b} s</option>`).join('');

    let html = '';
    html += `<div class="method-info">${t('file.methodDesc', { T1, T2, y0info })}</div>`;

    html += `<h4 class="step-subheading">${t('step3.tableTitle')}</h4>`;
    html += `<div id="f${idx}-fit-table"></div>`;

    html += '<div class="charts-row">';
    html += `<div class="chart-container chart-container--small"><canvas id="f${idx}-chi2"></canvas></div>`;
    html += `<div class="chart-container chart-container--small"><canvas id="f${idx}-pval"></canvas></div>`;
    html += '</div>';
    html += '<div class="charts-row">';
    html += `<div class="chart-container chart-container--small"><canvas id="f${idx}-dkpct"></canvas></div>`;
    html += `<div class="chart-container chart-container--small"><canvas id="f${idx}-adjr2"></canvas></div>`;
    html += '</div>';

    html += `<h4 class="step-subheading">${t('step3.selectorHeading')}</h4>`;
    html += `<div class="fit-selector">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem 1.6rem;">
            <label class="fit-selector__option">
                <input type="radio" name="f${idx}-fit-method" value="recommended">
                ${t('step3.modeRecommended')}
            </label>
            <label class="fit-selector__option">
                <input type="radio" name="f${idx}-fit-method" value="minChiSq" checked>
                ${t('step3.modeMinChi')}
            </label>
            <label class="fit-selector__option">
                <input type="radio" name="f${idx}-fit-method" value="minDk2">
                ${t('step3.modeMinDk')}
            </label>
        </div>
        <div style="display:flex;align-items:center;margin-top:0.35rem;">
            <label class="fit-selector__option">
                <input type="radio" name="f${idx}-fit-method" value="manual">
                ${t('step3.modeManual')}&ensp;
                <select id="f${idx}-fit-manual-bin" disabled>${binOptions}</select>&ensp;s
            </label>
        </div>
    </div>`;

    html += `<div id="f${idx}-best-fit"></div>`;
    return html;
}

/**
 * Builds the HTML wrapper (details/summary) for the file idx section.
 */
function buildFileSection(idx) {
    const f       = multiState.files[idx];
    const distStr = f.distance !== null ? `${f.distance.toFixed(2)}\u202fm` : 'N/A';
    return `<details class="file-section" id="f${idx}-section" open>
        <summary>
            <span class="file-section__title">
                ${t('file.sectionTitle', { i: idx + 1, d: distStr })}
                &ensp;<code>${escHtml(f.filename)}</code>
            </span>
            <span class="file-section__badge" id="f${idx}-badge">
                <span style="color:#888">${t('file.badgeProcessing')}</span>
            </span>
        </summary>
        <div class="file-section__body" id="f${idx}-body">
            <div class="file-loading">${t('file.loading')}</div>
        </div>
    </details>`;
}

/**
 * Fills the body of file idx section with processed data (histograms, fits, charts).
 */
function renderFileBody(idx) {
    const body = document.getElementById(`f${idx}-body`);
    if (!body) return;
    const p = multiState.files[idx].proc;

    if (!p || !p.rawData || p.rawData.length === 0) {
        body.innerHTML = `<div class="error-box">${t('file.errNoRawData')}</div>`;
        const badge = document.getElementById(`f${idx}-badge`);
        if (badge) badge.innerHTML = `<span class="file-badge-err">${t('file.badgeMissingData')}</span>`;
        return;
    }

    let html = '';
    html += `<h3 class="step-subheading">${t('file.step1heading')}</h3>`;
    html += buildFileStep1Html(idx);
    html += buildFileStep2Html(idx);
    html += `<h3 class="step-subheading">${t('file.step3heading')}</h3>`;
    html += buildFileStep3Html(idx);

    body.innerHTML = html;

    /* Render charts (after inserting into the DOM) */
    renderHist1sChart(`f${idx}-chart-hist1s`, p.hist1s, p.cutTimeSec);
    renderAllHistogramsChart(`f${idx}-chart-allhist`, p.histograms);
    const legendEl = document.getElementById(`f${idx}-legend-allhist`);
    if (legendEl) legendEl.innerHTML = buildHistLegendHtml(p.histograms);

    renderChi2vsBinChart(`f${idx}-chi2`,  p.fits);
    renderAdjR2Chart(`f${idx}-adjr2`,     p.fits);
    renderDkPctChart(`f${idx}-dkpct`,     p.fits);
    renderPValueChart(`f${idx}-pval`,     p.fits);

    /* SNR */
    updateFileSnrDisplay(idx, p.cutTimeSec);

    /* Set up event listeners */
    updateFileBestFit(idx);
    setupFileCutControl(idx);
    setupFileFitSelector(idx);
}

/**
 * Main entry point – processes all files one by one.
 * @param {Function|null} onComplete  Callback called after all files have been processed.
 *   null → per-file processing only, no summary fit
 */
function handleIndividualProcess(onComplete = null) {
    const container = document.getElementById('multi-individual-sections');
    if (!container) return;

    multiState.batchMode = (onComplete !== null);

    /* Destroy old per-file charts */
    multiState.files.forEach((f, i) => {
        const ids = [`f${i}-chart-hist1s`, `f${i}-chart-allhist`, `f${i}-chi2`,
                     `f${i}-adjr2`, `f${i}-dkpct`, `f${i}-pval`, `f${i}-chart-bestfit`];
        ids.forEach(id => {
            if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
        });
    });

    /* Destroy final fit charts + clear the section */
    ['mc-chart-k1', 'mc-chart-k2'].forEach(id => {
        if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
    });
    const batchEl = document.getElementById('multi-batch-section');
    if (batchEl) batchEl.innerHTML = '';

    /* Render empty section wrappers */
    container.innerHTML = multiState.files.map((_, i) => buildFileSection(i)).join('');

    /* Process files asynchronously, one after another */
    let idx = 0;
    function processNext() {
        if (idx >= multiState.files.length) {
            if (onComplete) onComplete();
            return;
        }
        const i = idx++;
        initFileProc(i);
        processOneFile(i);
        renderFileBody(i);
        /* After the first one, keep other sections collapsed */
        if (i > 0) {
            const sec = document.getElementById(`f${i}-section`);
            if (sec) sec.removeAttribute('open');
        }
        setTimeout(processNext, 30);
    }
    setTimeout(processNext, 20);
}

/* ============================================================
   Block 3 – Summary fit ki(r) = Ai / (r − r0i)²
   ============================================================ */

/**
 * Fits data (r, k, dk) with the function k(r) = A/(r−r0)².
 * Method: coarse grid search for r0 + analytical linear regression for A + refinement.
 * @returns {{A,r0,dA,dr0,cov,redChiSq,adjR2,pValue,n}|null}
 */
function fitGeometricDecay(r_vals, k_vals, dk_vals) {
    const n = r_vals.length;
    if (n < 3) return null;

    const w    = dk_vals.map(dk => dk > 0 ? 1 / (dk * dk) : 0);
    const rMin = Math.min(...r_vals);

    /* Search range for r0 (model: k = A/(r+r0)², r0 > 0) */
    const r0Min   = 0.005;
    const r0Max   = 2.5;
    const N_COARSE = 2000;
    const N_FINE   = 400;

    /* For a given r0: compute the optimal A and weighted RSS (model: k = A/(r+r0)²) */
    function evalR0(r0) {
        let num = 0, den = 0;
        for (let j = 0; j < n; j++) {
            const d = r_vals[j] + r0;
            if (d <= 0) return { rss: Infinity, A: NaN };
            const b = 1 / (d * d);
            num += w[j] * k_vals[j] * b;
            den += w[j] * b * b;
        }
        if (den <= 0) return { rss: Infinity, A: NaN };
        const A = num / den;
        if (A <= 0) return { rss: Infinity, A };
        let rss = 0;
        for (let j = 0; j < n; j++) {
            const d   = r_vals[j] + r0;
            const res = k_vals[j] - A / (d * d);
            rss += w[j] * res * res;
        }
        return { rss, A };
    }

    /* Coarse grid search */
    let bestRSS = Infinity, bestR0 = r0Min, bestA = 1;
    for (let i = 0; i <= N_COARSE; i++) {
        const r0        = r0Min + (r0Max - r0Min) * i / N_COARSE;
        const { rss, A } = evalR0(r0);
        if (rss < bestRSS) { bestRSS = rss; bestR0 = r0; bestA = A; }
    }

    /* Fine refinement around the minimum */
    const step = (r0Max - r0Min) / N_COARSE;
    const lo   = bestR0 - 2 * step;
    const hi   = Math.min(bestR0 + 2 * step, r0Max);
    for (let i = 0; i <= N_FINE; i++) {
        const r0        = lo + (hi - lo) * i / N_FINE;
        if (r0 <= 0) continue;
        const { rss, A } = evalR0(r0);
        if (rss < bestRSS) { bestRSS = rss; bestR0 = r0; bestA = A; }
    }

    /* Covariance matrix from the Jacobian at the optimum
     * f(r; A, r0) = A/(r+r0)²
     * ∂f/∂A  = 1/(r+r0)²
     * ∂f/∂r0 = −2A/(r+r0)³
     */
    let JtWJ = [[0, 0], [0, 0]];
    r_vals.forEach((r, j) => {
        const d  = r + bestR0;
        const d2 = d * d, d3 = d2 * d;
        const J0 = 1 / d2;
        const J1 = -2 * bestA / d3;
        JtWJ[0][0] += w[j] * J0 * J0;
        JtWJ[0][1] += w[j] * J0 * J1;
        JtWJ[1][0] += w[j] * J1 * J0;
        JtWJ[1][1] += w[j] * J1 * J1;
    });
    const det = JtWJ[0][0] * JtWJ[1][1] - JtWJ[0][1] * JtWJ[1][0];
    const cov = det !== 0 ? [
        [ JtWJ[1][1] / det, -JtWJ[0][1] / det],
        [-JtWJ[1][0] / det,  JtWJ[0][0] / det],
    ] : [[0, 0], [0, 0]];
    const dA  = Math.sqrt(Math.max(0, cov[0][0]));
    const dr0 = Math.sqrt(Math.max(0, cov[1][1]));

    /* Fit quality statistics */
    const dof = n - 2;
    const redChiSq = dof > 0 ? bestRSS / dof : NaN;

    /* Adj. R² (unweighted) */
    const kMean = k_vals.reduce((s, v) => s + v, 0) / n;
    let ssTot = 0, ssRes = 0;
    k_vals.forEach((k, j) => {
        const d = r_vals[j] + bestR0;
        ssTot += (k - kMean) * (k - kMean);
        ssRes += (k - bestA / (d * d)) * (k - bestA / (d * d));
    });
    const r2    = ssTot > 0 ? 1 - ssRes / ssTot : NaN;
    const adjR2 = n > 2 ? 1 - (1 - r2) * (n - 1) / dof : NaN;
    const pValue = isFinite(redChiSq) ? chiSqPValue(redChiSq * dof, dof) : NaN;

    /* Scale uncertainties by √max(1, χ²_red):
     * If χ²_red > 1, points scatter more than the input uncertainties dk_j predict
     * → formal uncertainties from (JᵀWJ)⁻¹ would be underestimated.
     * We scale the entire covariance matrix (so that propagateFitUnc gives consistent results). */
    const scale = (isFinite(redChiSq) && redChiSq > 1) ? Math.sqrt(redChiSq) : 1.0;
    const s2    = scale * scale;
    const dA_sc  = dA  * scale;
    const dr0_sc = dr0 * scale;
    const covSc  = [[cov[0][0] * s2, cov[0][1] * s2], [cov[1][0] * s2, cov[1][1] * s2]];

    return { A: bestA, r0: bestR0, dA: dA_sc, dr0: dr0_sc, cov: covSc, redChiSq, adjR2, pValue, n, rss: bestRSS };
}

/**
 * Propagates the uncertainty of the fit curve k(r) = A/(r+r0)² at point r.
 * δk² = (∂k/∂A·σA)² + (∂k/∂r0·σr0)² + 2·Cov(A,r0)·(∂k/∂A)·(∂k/∂r0)
 */
function propagateFitUnc(r, A, r0, cov) {
    const d  = r + r0;
    const d2 = d * d, d3 = d2 * d;
    const pA  = 1 / d2;          /* ∂k/∂A  */
    const pr0 = -2 * A / d3;     /* ∂k/∂r0 */
    const var_ = cov[0][0] * pA * pA
               + cov[1][1] * pr0 * pr0
               + 2 * cov[0][1] * pA * pr0;
    return Math.sqrt(Math.max(0, var_));
}

/* ----------------------------------------------------------
   Buttons to trigger Block 3
   ---------------------------------------------------------- */

/** Adds a "Run final fit" button at the end of container.
 *  Shown only if validation passed (multiState.validationOk). */
function addFinalFitButton(container) {
    const old = document.getElementById('mc-final-btn');
    if (old) old.remove();
    if (!multiState.validationOk) return;   /* batch processing not allowed */
    const all = multiState.files.every(f => f.proc && f.proc.k2 != null);
    const div = document.createElement('div');
    div.id    = 'mc-final-btn';
    div.style.cssText = 'margin-top:1.5rem;';
    if (all) {
        div.innerHTML = `<button onclick="triggerFinalFit()">${t('final.btnRun')}</button>`;
    } else {
        div.innerHTML = `<div class="warning-box">${t('final.warnPartial')}</div>
            <button onclick="triggerFinalFit()">${t('final.btnRunPartial')}</button>`;
    }
    container.appendChild(div);
}

/* ----------------------------------------------------------
   Cut optimisation – coordinated descent
   ---------------------------------------------------------- */

/**
 * Silently recomputes k₂/Φ and δk₂/Φ for file idx with the given cutSec.
 * Does not touch the DOM. Returns { k2, dk2 } or null.
 */
function silentRefitFile(idx, cutSec) {
    const p = multiState.files[idx]?.proc;
    if (!p?.rawData?.length) return null;

    const trimmed    = trimRawData(p.rawData, cutSec);
    const histograms = buildAllHistograms(trimmed);
    const y0fixed    = (p.backgroundSource !== 'free' && p.backgroundPPM != null)
        ? p.backgroundPPM / 60 : null;
    const fits = histograms.map(h => ({
        binSize: h.binSize,
        fit:     fitHistogram(h.binSize, h.points, y0fixed),
    }));

    /* Select the best fit according to the current method in the UI */
    const method = document.querySelector(`input[name="f${idx}-fit-method"]:checked`)?.value ?? 'minChiSq';
    let bestIdx = -1, minDist = Infinity, minRelDk2 = Infinity;
    fits.forEach((r, i) => {
        if (!r.fit || r.fit.k2 <= 0) return;
        if (method === 'minDk2') {
            const rel = r.fit.dk2 / r.fit.k2;
            if (rel < minRelDk2) { minRelDk2 = rel; bestIdx = i; }
        } else {
            /* minChiSq and recommended → min |χ²_red − 1| */
            const dist = Math.abs(r.fit.redChiSq - 1.0);
            if (dist < minDist) { minDist = dist; bestIdx = i; }
        }
    });

    if (bestIdx < 0) return null;
    const bf = fits[bestIdx].fit;
    const fl = multiState.fluence;
    const tH = multiState.hideTimeSec ?? 0;
    return {
        k1:  (bf.k1  / fl) * Math.exp(tH / T1),  dk1: (bf.dk1 / fl) * Math.exp(tH / T1),
        k2:  (bf.k2  / fl) * Math.exp(tH / T2),  dk2: (bf.dk2 / fl) * Math.exp(tH / T2),
    };
}

/**
 * Balanced quality metric for the geometric fit of both coefficients,
 * with temporary substitution of the values from file overrideIdx.
 * Returns 3·|χ²_red(k₂)−1| + |χ²_red(k₁)−1| (smaller = better, Infinity = failure).
 */
function geometricMetric(overrideK1, overrideDk1, overrideK2, overrideDk2, overrideIdx) {
    const r1 = [], k1v = [], dk1v = [];
    const r2 = [], k2v = [], dk2v = [];
    multiState.files.forEach((f, i) => {
        const p  = f.proc;
        if (!p) return;
        const k1  = i === overrideIdx ? overrideK1  : p.k1;
        const dk1 = i === overrideIdx ? overrideDk1 : p.dk1;
        const k2  = i === overrideIdx ? overrideK2  : p.k2;
        const dk2 = i === overrideIdx ? overrideDk2 : p.dk2;
        if (k1 != null && dk1 != null && dk1 > 0) {
            r1.push(f.distance); k1v.push(k1); dk1v.push(dk1);
        }
        if (k2 != null && dk2 != null && dk2 > 0) {
            r2.push(f.distance); k2v.push(k2); dk2v.push(dk2);
        }
    });
    if (r2.length < 3) return Infinity;
    const fit2 = fitGeometricDecay(r2, k2v, dk2v);
    const m2 = (fit2 && isFinite(fit2.redChiSq)) ? Math.abs(fit2.redChiSq - 1.0) : Infinity;
    if (!isFinite(m2)) return Infinity;
    if (r1.length < 3) return 3 * m2;
    const fit1 = fitGeometricDecay(r1, k1v, dk1v);
    const m1 = (fit1 && isFinite(fit1.redChiSq)) ? Math.abs(fit1.redChiSq - 1.0) : Infinity;
    return 3 * m2 + (isFinite(m1) ? m1 : 0);
}

/**
 * Coordinated descent: for each file, tries shifts 0..+5 s
 * from autoCutTimeSec and selects the shift that minimises 3·|χ²_red(k₂)−1| + |χ²_red(k₁)−1|.
 * Iterates up to 3×. Updates p.cutTimeSec and p.k1/dk1/k2/dk2 in multiState (without DOM).
 */
function optimizeCutTimes() {
    const MAX_SHIFT = 5;
    const MAX_ITER  = 3;

    for (let iter = 0; iter < MAX_ITER; iter++) {
        let iterChanged = false;

        for (let idx = 0; idx < multiState.files.length; idx++) {
            const f = multiState.files[idx];
            const p = f.proc;
            if (!p?.rawData?.length || p.k2 == null) continue;

            let bestMetric = Infinity;
            let bestCut    = p.autoCutTimeSec;
            let bestK1     = null, bestDk1 = null;
            let bestK2     = null, bestDk2 = null;

            for (let shift = 0; shift <= MAX_SHIFT; shift++) {
                const candidate = p.autoCutTimeSec + shift;
                const result    = silentRefitFile(idx, candidate);
                if (!result || result.k2 <= 0 || result.dk2 <= 0) continue;
                const metric = geometricMetric(result.k1, result.dk1, result.k2, result.dk2, idx);
                if (metric < bestMetric) {
                    bestMetric = metric;
                    bestCut    = candidate;
                    bestK1     = result.k1;
                    bestDk1    = result.dk1;
                    bestK2     = result.k2;
                    bestDk2    = result.dk2;
                }
            }

            if (bestK2 === null) continue;
            if (bestCut !== p.cutTimeSec) iterChanged = true;
            /* Commit immediately → subsequent files in this round see the new k₁/k₂ */
            p.cutTimeSec = bestCut;
            p.k1  = bestK1;
            p.dk1 = bestDk1;
            p.k2  = bestK2;
            p.dk2 = bestDk2;
        }

        if (!iterChanged) break;
    }
}

/**
 * "Optimalizovat ořezy" button – runs optimisation and updates the UI.
 */
function handleOptimizeCuts() {
    const btn = document.getElementById('btn-optimize-cuts');
    if (btn) { btn.disabled = true; btn.textContent = t('opt.btnProcessing'); }

    setTimeout(() => {
        /* 1. Coordinated descent (pure computation, no DOM) */
        optimizeCutTimes();

        /* 2. Apply results to per-file sections.
              _suppressRefresh = true so that updateFileBestFit does not trigger
              refreshFinalFit after each individual file (batchMode stays unchanged
              → YAML export in per-file sections remains correctly hidden). */
        multiState._suppressRefresh = true;

        multiState.files.forEach((f, idx) => {
            const p = f.proc;
            if (!p?.rawData?.length) return;

            /* Update slider + number input */
            const rangeEl  = document.getElementById(`f${idx}-cut-range`);
            const numberEl = document.getElementById(`f${idx}-cut-number`);
            if (rangeEl)  rangeEl.value  = p.cutTimeSec;
            if (numberEl) numberEl.value = p.cutTimeSec;

            /* Label – shows the auto value + shift (positive or negative) */
            const autoLabel = document.getElementById(`f${idx}-cut-auto-label`);
            if (autoLabel) {
                const shift = p.cutTimeSec - p.autoCutTimeSec;
                if (shift > 0) {
                    autoLabel.textContent = t('opt.autoLabelPlus', { a: p.autoCutTimeSec, s: shift });
                } else if (shift < 0) {
                    autoLabel.textContent = t('opt.autoLabelMinus', { a: p.autoCutTimeSec, s: Math.abs(shift) });
                } else {
                    autoLabel.textContent = t('opt.autoLabel', { a: p.autoCutTimeSec });
                }
            }

            /* Full recomputation: histograms → fits → charts → k₂ */
            applyFileCut(idx, p.cutTimeSec);
        });

        /* 3. Ensure current proc values for buildFinalSummaryTable
              (in case updateFileBestFit did not find the DOM element).
              p.fits and p.histograms are already recomputed by applyFileCut above. */
        multiState.files.forEach((f, idx) => {
            const p = f.proc;
            if (!p?.fits?.length) return;
            const bestIdx = computeFileBestIdx(idx);
            const fl = multiState.fluence;
            const tH = multiState.hideTimeSec ?? 0;
            if (bestIdx >= 0) {
                const bf = p.fits[bestIdx].fit;
                p.k1 = (bf.k1 / fl) * Math.exp(tH / T1);  p.dk1 = (bf.dk1 / fl) * Math.exp(tH / T1);
                p.k2 = (bf.k2 / fl) * Math.exp(tH / T2);  p.dk2 = (bf.dk2 / fl) * Math.exp(tH / T2);
                p.selectedBinSize = p.histograms[bestIdx].binSize;
                p.selectedMethod  = document.querySelector(`input[name="f${idx}-fit-method"]:checked`)?.value ?? 'minChiSq';
            } else {
                p.k1 = null; p.dk1 = null; p.k2 = null; p.dk2 = null;
            }
        });

        /* 4. Redraw the summary fit once */
        multiState._suppressRefresh = false;
        refreshFinalFit();
        /* refreshFinalFit rebuilds the entire HTML including the button – the old reference is now stale */
    }, 30);
}

/** Triggers Block 3, result goes into #multi-batch-section. */
function triggerFinalFit() {
    refreshFinalFit();
}

/** Redraws Block 3 without scrolling – called on every per-file result change. */
function refreshFinalFit() {
    if (multiState._suppressRefresh) return;
    const batchEl = document.getElementById('multi-batch-section');
    if (!batchEl) return;
    ['mc-chart-k1', 'mc-chart-k2'].forEach(id => {
        if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
    });
    batchEl.innerHTML = `<h2 style="border-bottom:2px solid #3d5a9e;padding-bottom:0.5rem;margin-bottom:1.2rem;margin-top:2.5rem">${t('final.heading')}</h2>`;
    runFinalFit(batchEl);
}

/* ----------------------------------------------------------
   Block 3 orchestration
   ---------------------------------------------------------- */

function runFinalFit(containerEl) {
    /* Collect points from Block 2 – only files with valid results */
    const pts1 = [], pts2 = [];
    multiState.files.forEach(f => {
        const p = f.proc;
        if (!p || p.k1 == null || p.k2 == null) return;
        pts1.push({ r: f.distance, k: p.k1, dk: p.dk1 });
        pts2.push({ r: f.distance, k: p.k2, dk: p.dk2 });
    });

    if (pts1.length < 3) {
        containerEl.innerHTML += `<div class="error-box">${t('final.errInsufficient', { n: pts1.length })}</div>`;
        return;
    }

    const fit1 = fitGeometricDecay(pts1.map(p => p.r), pts1.map(p => p.k), pts1.map(p => p.dk));
    const fit2 = fitGeometricDecay(pts2.map(p => p.r), pts2.map(p => p.k), pts2.map(p => p.dk));
    multiState.lastFit = { fit1, fit2, pts1, pts2 };
    renderFinalFitSection(containerEl, pts1, pts2, fit1, fit2);
}

/* ----------------------------------------------------------
   Rendering Block 3 results
   ---------------------------------------------------------- */

/**
 * Builds the cut optimisation results table – how many seconds each file was shifted.
 */
function buildOptCutsResultHtml() {
    let html = '<table class="fit-table" style="width:auto;margin-bottom:1rem">'
             + '<thead><tr>'
             + `<th>${t('opt.col.dist')}</th>`
             + `<th>${t('opt.col.autoCut')}</th>`
             + `<th>${t('opt.col.finalCut')}</th>`
             + `<th>${t('opt.col.shift')}</th>`
             + '</tr></thead><tbody>';
    multiState.files.forEach(f => {
        const p = f.proc;
        if (!p) return;
        const shift = p.cutTimeSec - p.autoCutTimeSec;
        const sign  = shift > 0 ? '+' : '';
        const cls   = Math.abs(shift) === 0 ? 'shift-zero'
                    : Math.abs(shift) <= 2   ? 'shift-small' : 'shift-large';
        html += `<tr>`
              + `<td>${f.distance.toFixed(2)}</td>`
              + `<td>${p.autoCutTimeSec}</td>`
              + `<td>${p.cutTimeSec}</td>`
              + `<td class="${cls}">${sign}${shift}</td>`
              + `</tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function renderFinalFitSection(container, pts1, pts2, fit1, fit2) {
    let html = '';

    /* --- Overview of used data --- */
    html += `<h3 class="step-subheading">${t('final.usedDataHeading')}</h3>`;
    html += buildFinalSummaryTable();

    /* --- Fit results table --- */
    html += `<h3 class="step-subheading">${t('final.coeffHeading')}</h3>`;
    const pct = (v, dv) => v > 0 ? `(${((dv / v) * 100).toFixed(2)}\u202f%)` : '';
    const hdrStyle = 'padding:0.3rem 0.6rem;font-weight:700;background:#2c4a7a;color:#fff;text-align:center';
    const na = '<em>N/A</em>';

    const c1A   = fit1 ? `${fmtValUnc(fit1.A,  fit1.dA,  4)}  ${pct(fit1.A,  fit1.dA)}`  : na;
    const c1r0  = fit1 ? `${fmtValUnc(fit1.r0, fit1.dr0, 4)} ${pct(Math.abs(fit1.r0), fit1.dr0)}` : na;
    const c1sta = fit1 ? `${fit1.adjR2.toFixed(6)}, ${fit1.redChiSq.toFixed(4)}, ${isFinite(fit1.pValue) ? fit1.pValue.toFixed(3) : '—'}, ${fit1.n}` : na;

    const c2A   = fit2 ? `${fmtValUnc(fit2.A,  fit2.dA,  4)}  ${pct(fit2.A,  fit2.dA)}`  : na;
    const c2r0  = fit2 ? `${fmtValUnc(fit2.r0, fit2.dr0, 4)} ${pct(Math.abs(fit2.r0), fit2.dr0)}` : na;
    const c2sta = fit2 ? `${fit2.adjR2.toFixed(6)}, ${fit2.redChiSq.toFixed(4)}, ${isFinite(fit2.pValue) ? fit2.pValue.toFixed(3) : '—'}, ${fit2.n}` : na;

    html += '<div class="table-scroll"><table class="fit-table" style="font-size:0.88rem"><thead>'
          + '<tr>'
          + `<th rowspan="2">${t('final.param')}</th>`
          + `<th style="${hdrStyle}">${t('final.coeff.k1')}</th>`
          + `<th style="${hdrStyle}">${t('final.coeff.k2')}</th>`
          + '</tr></thead><tbody>'
          + `<tr><th>${t('final.row.A')}</th><td>${c1A}</td><td>${c2A}</td></tr>`
          + `<tr><th>${t('final.row.r0')}</th><td>${c1r0}</td><td>${c2r0}</td></tr>`
          + `<tr><th style="font-size:0.85rem;color:#555">${t('final.row.stats')}</th><td>${c1sta}</td><td>${c2sta}</td></tr>`
          + '</tbody></table></div>';

    /* --- k1 and k2 vs r charts --- */
    html += `<h3 class="step-subheading">${t('final.fitsHeading')}</h3>`;
    html += '<div class="charts-row">';
    html += '<div class="chart-container chart-container--tall" style="flex:1">'
          + '<canvas id="mc-chart-k1"></canvas></div>';
    html += '<div class="chart-container chart-container--tall" style="flex:1">'
          + '<canvas id="mc-chart-k2"></canvas></div>';
    html += '</div>';

    /* --- Fit evaluation table at measurement points --- */
    html += `<h3 class="step-subheading">${t('final.evalHeading')}</h3>`;
    html += buildFitEvalTable(pts1, pts2, fit1, fit2);
    html += buildFitUncNote();

    /* --- Cut optimisation --- */
    html += `<div class="opt-cuts-row">
        <button type="button" id="btn-optimize-cuts" onclick="handleOptimizeCuts()">
            ${t('opt.btn')}
        </button>
        <span class="opt-cuts-note">${t('opt.note')}</span>
    </div>`;
    html += buildOptCutsResultHtml();

    /* --- Excel export --- */
    html += `<h3 class="step-subheading">${t('final.downloadHeading')}</h3>`;
    html += `<button type="button" onclick="downloadCalibExcel()">${t('final.downloadBtn')}</button>`;

    /* --- YAML export --- */
    html += `<h3 class="step-subheading">${t('final.yamlHeading')}</h3>`;
    html += '<div id="mc-yaml-export"></div>';

    container.innerHTML += html;

    /* Render charts (after inserting into the DOM) */
    renderFinalFitChart('mc-chart-k1', pts1, fit1, t('chart.yLabelK1'), t('chart.k1vsr'));
    renderFinalFitChart('mc-chart-k2', pts2, fit2, t('chart.yLabelK2'), t('chart.k2vsr'));

    /* YAML export */
    document.getElementById('mc-yaml-export').innerHTML = buildFinalYamlBlock(fit1, fit2);
}

/* ----------------------------------------------------------
   Fit evaluation table at measurement points
   ---------------------------------------------------------- */

/**
 * Formats value ± uncertainty: uncertainty to 2 significant figures,
 * value to the corresponding number of decimal places. Result as (x.xx ± y.yy)×10ⁿ.
 */
function fmtPM(val, unc) {
    if (!isFinite(val) || !isFinite(unc) || unc <= 0) return fmtSci(val);
    const uncExp    = Math.floor(Math.log10(Math.abs(unc)));
    const commonExp = Math.floor(Math.log10(Math.abs(val)));
    const scale     = Math.pow(10, commonExp);
    const uncRound  = parseFloat(unc.toPrecision(2));
    const decPlaces = Math.max(0, -(uncExp - commonExp) + 1);
    const supMap    = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
    const expStr    = String(commonExp).split('').map(c => supMap[c] ?? c).join('');
    return `(${(val / scale).toFixed(decPlaces)}\u202f\u00B1\u202f${(uncRound / scale).toFixed(decPlaces)})\u00D710${expStr}`;
}

/**
 * Combined table for k₁ and k₂:
 * r [m] | k₁ fit±σ | σ₁[%] | k₁ data±σ | Dev.k₁[%] | k₂ fit±σ | σ₂[%] | k₂ data±σ | Dev.k₂[%]
 */
function buildFitEvalTable(pts1, pts2, fit1, fit2) {
    function devCell(kFit, kMeas) {
        if (!isFinite(kFit) || !isFinite(kMeas) || kMeas === 0) return '<td>—</td>';
        const dev = ((kFit - kMeas) / kMeas) * 100;
        const col = Math.abs(dev) < 5 ? '#1a7a2a' : Math.abs(dev) < 15 ? '#b07000' : '#b00000';
        return `<td><span style="color:${col};font-weight:600">${dev >= 0 ? '+' : ''}${dev.toFixed(2)}\u202f%</span></td>`;
    }

    const allR = [...new Set([...pts1.map(p => p.r), ...pts2.map(p => p.r)])].sort((a, b) => a - b);
    const map1 = Object.fromEntries(pts1.map(p => [p.r, p]));
    const map2 = Object.fromEntries(pts2.map(p => [p.r, p]));

    let html = '<div class="table-scroll"><table class="fit-table" style="font-size:0.82rem"><thead>'
             + '<tr>'
             + `<th rowspan="2">${t('eval.col.r')}</th>`
             + '<th colspan="4" style="text-align:center;border-bottom:1px solid #c8d4e8">k\u2081/\u03A6</th>'
             + '<th colspan="4" style="text-align:center;border-bottom:1px solid #c8d4e8">k\u2082/\u03A6</th>'
             + '</tr><tr>'
             + `<th>${t('eval.col.data')}</th><th>${t('eval.col.fit')}</th><th>${t('eval.col.sigFit')}</th><th>${t('eval.col.dev')}</th>`
             + `<th>${t('eval.col.data')}</th><th>${t('eval.col.fit')}</th><th>${t('eval.col.sigFit')}</th><th>${t('eval.col.dev')}</th>`
             + '</tr></thead><tbody>';

    allR.forEach(r => {
        const p1 = map1[r], p2 = map2[r];

        let k1dat = '<td>—</td>', k1fit = '<td>—</td>', k1pct = '<td>—</td>', dev1 = '<td>—</td>';
        if (fit1 && p1) {
            const kf = fit1.A / ((r + fit1.r0) * (r + fit1.r0));
            const sg = propagateFitUnc(r, fit1.A, fit1.r0, fit1.cov);
            k1dat = `<td>${fmtPM(p1.k, p1.dk)}</td>`;
            k1fit = `<td>${fmtPM(kf, sg)}</td>`;
            k1pct = `<td>${kf > 0 ? ((sg / kf) * 100).toFixed(2) + '\u202f%' : '—'}</td>`;
            dev1  = devCell(kf, p1.k);
        }

        let k2dat = '<td>—</td>', k2fit = '<td>—</td>', k2pct = '<td>—</td>', dev2 = '<td>—</td>';
        if (fit2 && p2) {
            const kf = fit2.A / ((r + fit2.r0) * (r + fit2.r0));
            const sg = propagateFitUnc(r, fit2.A, fit2.r0, fit2.cov);
            k2dat = `<td>${fmtPM(p2.k, p2.dk)}</td>`;
            k2fit = `<td>${fmtPM(kf, sg)}</td>`;
            k2pct = `<td>${kf > 0 ? ((sg / kf) * 100).toFixed(2) + '\u202f%' : '—'}</td>`;
            dev2  = devCell(kf, p2.k);
        }

        html += `<tr><td>${r.toFixed(2)}</td>${k1dat}${k1fit}${k1pct}${dev1}${k2dat}${k2fit}${k2pct}${dev2}</tr>`;
    });

    html += '</tbody></table></div>';
    return html;
}

/** Description of the formula for fit uncertainty propagation. */
function buildFitUncNote() {
    return `<div class="info-msg" style="margin-top:1rem;font-size:0.88rem;line-height:1.7">${t('final.uncNote')}</div>`;
}

/* ----------------------------------------------------------
   Summary table of used data
   ---------------------------------------------------------- */

function buildFinalSummaryTable() {
    let html = '<div class="table-scroll"><table class="fit-table"><thead><tr>'
             + `<th>${t('summary.col.dist')}</th><th>${t('summary.col.datetime')}</th>`
             + `<th>${t('summary.col.bg')}</th><th>${t('summary.col.snr')}</th>`
             + `<th>${t('summary.col.k2Phi')}</th><th>${t('summary.col.dk2')}</th>`
             + `<th>${t('summary.col.bin')}</th><th>${t('summary.col.cut')}</th><th>${t('summary.col.method')}</th>`
             + '</tr></thead><tbody>';

    const methodLabels = {
        recommended: t('summary.method.recommended'),
        minChiSq:    t('summary.method.minChi'),
        minDk2:      t('summary.method.minDk'),
        manual:      t('summary.method.manual'),
    };

    multiState.files.forEach(f => {
        const p = f.proc;
        if (!p) {
            html += `<tr><td>${f.distance != null ? f.distance.toFixed(2) : 'N/A'}</td><td colspan="8"><em>${t('summary.notProcessed')}</em></td></tr>`;
            return;
        }
        /* SNR from trimmed data */
        let snrStr = '—';
        if (p.rawDataTrimmed && p.backgroundPPM > 0) {
            const pulses60 = p.rawDataTrimmed.filter(t => t < 60e6).length;
            const snr = pulses60 / p.backgroundPPM;
            const col = snr >= 10 ? '#1a7a2a' : snr >= 3 ? '#b07000' : '#b00000';
            snrStr = `<span style="color:${col};font-weight:600">${snr.toFixed(1)}</span>`;
        }
        const dk2pct = p.k2 && p.dk2 ? ((Math.abs(p.dk2 / p.k2)) * 100).toFixed(2) + '\u202f%' : '—';
        const methodLabel = methodLabels[p.selectedMethod ?? 'recommended'] ?? p.selectedMethod ?? '—';
        const rowOk = p.k2 != null;
        html += `<tr${rowOk ? '' : ' style="background:#fff8f8"'}>
            <td>${f.distance != null ? f.distance.toFixed(2) : 'N/A'}</td>
            <td>${f.date ?? 'N/A'}</td>
            <td>${p.backgroundPPM != null ? p.backgroundPPM.toFixed(2) : '—'}</td>
            <td>${snrStr}</td>
            <td>${p.k2 != null ? fmtValUnc(p.k2, p.dk2) : '<em>—</em>'}</td>
            <td>${dk2pct}</td>
            <td>${p.selectedBinSize ?? '—'}</td>
            <td>${p.cutTimeSec}</td>
            <td>${methodLabel}</td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    return html;
}

/* ----------------------------------------------------------
   Chart of ki/Φ vs r with error bars and fit curve
   ---------------------------------------------------------- */

function renderFinalFitChart(canvasId, points, fit, yLabel, title) {
    const ctxEl = document.getElementById(canvasId);
    if (!ctxEl) return;
    if (state.charts[canvasId]) { state.charts[canvasId].destroy(); delete state.charts[canvasId]; }

    const rVals = points.map(p => p.r);
    const rLo   = Math.min(...rVals) * 0.85;
    const rHi   = Math.max(...rVals) * 1.15;
    const nPts  = 300;

    /* Fit curve + ±3σ uncertainty band */
    const fitCurve = [], bandUp = [], bandDn = [];
    if (fit) {
        for (let i = 0; i <= nPts; i++) {
            const r = rLo + (rHi - rLo) * i / nPts;
            if (r + fit.r0 <= 0.002) continue;
            const kFit = fit.A / ((r + fit.r0) * (r + fit.r0));
            const unc  = propagateFitUnc(r, fit.A, fit.r0, fit.cov);
            fitCurve.push({ x: r, y: kFit });
            bandUp.push({ x: r, y: kFit + 3 * unc });
            bandDn.push({ x: r, y: Math.max(0, kFit - 3 * unc) });
        }
    }

    /* Y-axis scaling: exponent from the data maximum */
    const allY = [...points.map(p => p.k), ...fitCurve.map(p => p.y)].filter(v => isFinite(v) && v > 0);
    const maxY  = allY.length ? Math.max(...allY) : 1;
    const yExp  = Math.floor(Math.log10(maxY));
    const yScale = Math.pow(10, yExp);
    const supMap = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻' };
    const yExpStr    = String(yExp).split('').map(c => supMap[c] ?? c).join('');
    const _parenIdx  = yLabel.indexOf('(');
    const yLabelFull = _parenIdx >= 0
        ? `${yLabel.slice(0, _parenIdx).trimEnd()} \u00D710${yExpStr} ${yLabel.slice(_parenIdx)}`
        : `${yLabel} \u00D710${yExpStr}`;

    /* Inline plugin for error bars */
    const errBarsPlugin = {
        id: 'errBars_' + canvasId,
        afterDatasetsDraw(ch) {
            const ctx2 = ch.ctx;
            ch.data.datasets.forEach((ds, di) => {
                if (!ds._errors) return;
                const meta = ch.getDatasetMeta(di);
                ds.data.forEach((pt, pi) => {
                    const elem = meta.data[pi];
                    if (!elem || ds._errors[pi] == null || ds._errors[pi] <= 0) return;
                    const err  = ds._errors[pi];
                    const xPx  = elem.x;
                    const yTop = ch.scales.y.getPixelForValue(pt.y + err);
                    const yBot = ch.scales.y.getPixelForValue(pt.y - err);
                    const cap  = 5;
                    ctx2.save();
                    ctx2.strokeStyle = typeof ds.borderColor === 'string'
                        ? ds.borderColor : 'rgba(40,90,190,0.9)';
                    ctx2.lineWidth = 1.5;
                    ctx2.beginPath();
                    ctx2.moveTo(xPx, yTop); ctx2.lineTo(xPx, yBot);
                    ctx2.moveTo(xPx - cap, yTop); ctx2.lineTo(xPx + cap, yTop);
                    ctx2.moveTo(xPx - cap, yBot); ctx2.lineTo(xPx + cap, yBot);
                    ctx2.stroke();
                    ctx2.restore();
                });
            });
        },
    };

    const titleStr = fit
        ? [`${title}  –  A = ${fmtSci(fit.A)}, r\u2080 = ${fit.r0.toFixed(4)}\u202fm`,
           `Adj.\u202fR\u00B2 = ${fit.adjR2.toFixed(4)},  Red.\u202f\u03C7\u00B2 = ${fit.redChiSq.toFixed(3)},  p = ${isFinite(fit.pValue) ? fit.pValue.toFixed(3) : '—'}`]
        : [title, t('chart.noData')];

    const datasets = [
        /* Upper bound of the uncertainty band */
        {
            label:           '_band_upper',
            data:            bandUp,
            showLine:        true,
            borderColor:     'transparent',
            backgroundColor: 'transparent',
            fill:            false,
            pointRadius:     0,
            borderWidth:     0,
        },
        /* Lower bound + fill to upper */
        {
            label:           t('chart.bandLabel'),
            data:            bandDn,
            showLine:        true,
            borderColor:     'transparent',
            backgroundColor: 'rgba(210,40,40,0.12)',
            fill:            '-1',
            pointRadius:     0,
            borderWidth:     0,
        },
        /* Fit curve */
        {
            label:       t('chart.fitCurveGeom'),
            data:        fitCurve,
            showLine:    true,
            borderColor: 'rgba(210,40,40,0.85)',
            fill:        false,
            borderWidth: 2.5,
            pointRadius: 0,
        },
        /* Data points with error bars */
        {
            label:           t('chart.measData'),
            data:            points.map(p => ({ x: p.r, y: p.k })),
            _errors:         points.map(p => p.dk),
            showLine:        false,
            borderColor:     'rgba(40,90,190,0.9)',
            backgroundColor: 'rgba(40,90,190,0.85)',
            pointRadius:     6,
            pointStyle:      'circle',
            fill:            false,
        },
    ];

    state.charts[canvasId] = new Chart(ctxEl.getContext('2d'), {
        type: 'scatter',
        data: { datasets },
        options: {
            animation:           false,
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title:  { display: true, text: titleStr, font: { size: 12, weight: 'bold' }, padding: { bottom: 12 } },
                legend: {
                    display: true,
                    position: 'top',
                    labels: { filter: item => !item.text.startsWith('_') },
                },
            },
            scales: {
                x: { type: 'linear', title: { display: true, text: t('chart.axisDistR') } },
                y: {
                    min: 0,
                    title: { display: true, text: yLabelFull },
                    ticks: { callback: v => (v / yScale).toFixed(1) },
                },
            },
        },
        plugins: [errBarsPlugin],
    });
}

/* ----------------------------------------------------------
   YAML export for user-settings.yaml
   ---------------------------------------------------------- */

function generateMultiCalibYaml(fit1, fit2) {
    const files = multiState.files.filter(f => f.proc && f.proc.k2 != null);
    const distances = files.map(f => f.distance).filter(d => d != null).sort((a, b) => a - b);
    const distMin = distances.length ? distances[0].toFixed(2) : '???';
    const distMax = distances.length ? distances[distances.length - 1].toFixed(2) : '???';

    /* calibrationId from file dates */
    const dates = multiState.files.map(f => f.date).filter(Boolean).sort();
    const calId = dates.length ? dates[0].slice(0, 10) : new Date().toISOString().slice(0, 10);

    /* tubeConfiguration */
    const tubeConfig = multiState.commonTubeConfig ?? [];
    const tubeLines  = tubeConfig.length
        ? tubeConfig.map(id => `  - "${id}"`).join('\n')
        : '  - ""';

    const fmtCoef = (fit) => fit
        ? `[${fit.r0.toFixed(6)}, ${fit.A.toExponential(6).toUpperCase().replace(/E([+-])(\d)$/, 'E$1' + '0$2')}]`
        : '[???, ???]';
    const fmtUnc = (fit) => fit
        ? `[${fit.dr0.toFixed(6)}, ${fit.dA.toExponential(6).toUpperCase().replace(/E([+-])(\d)$/, 'E$1' + '0$2')}]`
        : '[???, ???]';

    return [
        `calibratedConfiguration:`,
        `- tubeConfiguration:`,
        tubeLines,
        `  calibrations:`,
        `  - calibrationType: fissionAmBeNeutron`,
        `    calibrationId: "${calId}"`,
        `    distanceMinM: ${distMin}`,
        `    distanceMaxM: ${distMax}`,
        `    fitType: geometricDecay`,
        `    fittings:`,
        `    - coefficients: ${fmtCoef(fit1)}   # k1(r) = A1/(r+r0_1)^2; [r0_1 [m], A1 [pulsy*s*m^2/n]]`,
        `      uncertainties: ${fmtUnc(fit1)}`,
        `    - coefficients: ${fmtCoef(fit2)}   # k2(r) = A2/(r+r0_2)^2; [r0_2 [m], A2 [pulsy*s*m^2/n]]`,
        `      uncertainties: ${fmtUnc(fit2)}`,
    ].join('\n');
}

/* ----------------------------------------------------------
   Excel export – Summary calibration results
   ---------------------------------------------------------- */

/**
 * Builds an array of rows (array of arrays) for SheetJS from the three result tables.
 * Numeric values are passed as numbers (not strings) for correct behaviour in Excel.
 */
function buildCalibExcelAoa(fit1, fit2, pts1, pts2) {
    const rows = [];
    const methodLabels = {
        recommended: 'dle doporuceni', minChiSq: 'min chi2',
        minDk2: 'min dk2/k2', manual: 'rucne',
    };

    /* ===== Table 1: Overview of used data ===== */
    rows.push(['Prehled pouzitych dat']);
    rows.push(['Vzdalenost (m)', 'Datum a cas', 'Pozadi (pulsu/min)', 'SNR',
               'k2/Phi', 'dk2/k2 (%)', 'Bin (s)', 'Orez (s)', 'Vyber prolozeni']);
    multiState.files.forEach(f => {
        const p = f.proc;
        if (!p) {
            rows.push([f.distance ?? '', '', '', '', '', '', '', '', 'Nezpracovano']);
            return;
        }
        let snr = '';
        if (p.rawDataTrimmed && p.backgroundPPM > 0) {
            snr = +(p.rawDataTrimmed.filter(t => t < 60e6).length / p.backgroundPPM).toFixed(3);
        }
        const dk2pct = (p.k2 && p.dk2) ? +(Math.abs(p.dk2 / p.k2) * 100).toFixed(4) : '';
        rows.push([
            f.distance ?? '',
            f.date ?? '',
            p.backgroundPPM != null ? +p.backgroundPPM.toFixed(4) : '',
            snr,
            p.k2 ?? '',
            dk2pct,
            p.selectedBinSize ?? '',
            p.cutTimeSec ?? '',
            methodLabels[p.selectedMethod ?? 'recommended'] ?? p.selectedMethod ?? '',
        ]);
    });

    rows.push([]); /* empty row */

    /* ===== Table 2: Final calibration coefficients ===== */
    rows.push(['Vysledne kalibracni koeficienty - prolozeni ki(r) = Ai / (r + r0i)^2']);
    rows.push(['Parametr', 'Koeficient k1/Phi', 'Koeficient k2/Phi']);
    rows.push(['A (pulsy s m2/n)',  fit1 ? fit1.A      : '', fit2 ? fit2.A      : '']);
    rows.push(['dA (pulsy s m2/n)', fit1 ? fit1.dA     : '', fit2 ? fit2.dA     : '']);
    rows.push(['r0 (m)',            fit1 ? fit1.r0     : '', fit2 ? fit2.r0     : '']);
    rows.push(['dr0 (m)',           fit1 ? fit1.dr0    : '', fit2 ? fit2.dr0    : '']);
    rows.push(['Adj. R2',           fit1 ? fit1.adjR2  : '', fit2 ? fit2.adjR2  : '']);
    rows.push(['Red. chi2',         fit1 ? fit1.redChiSq : '', fit2 ? fit2.redChiSq : '']);
    rows.push(['p-hodnota',         fit1 && isFinite(fit1.pValue) ? fit1.pValue : '',
                                    fit2 && isFinite(fit2.pValue) ? fit2.pValue : '']);
    rows.push(['n',                 fit1 ? fit1.n : '', fit2 ? fit2.n : '']);

    rows.push([]); /* empty row */

    /* ===== Table 3: Fit evaluation at measurement points ===== */
    rows.push(['Vyhodnoceni prolozeni v bodech mereni']);
    rows.push([
        'r (m)',
        'k1/Phi data', 'dk1/Phi data',
        'k1/Phi fit',  'dk1/Phi fit',  'sigma_fit1 (%)', 'Odch. k1 (%)',
        'k2/Phi data', 'dk2/Phi data',
        'k2/Phi fit',  'dk2/Phi fit',  'sigma_fit2 (%)', 'Odch. k2 (%)',
    ]);

    const allR = [...new Set([...pts1.map(p => p.r), ...pts2.map(p => p.r)])].sort((a, b) => a - b);
    const map1 = Object.fromEntries(pts1.map(p => [p.r, p]));
    const map2 = Object.fromEntries(pts2.map(p => [p.r, p]));

    allR.forEach(r => {
        const p1 = map1[r], p2 = map2[r];
        let k1d = '', dk1d = '', k1f = '', dk1f = '', s1 = '', d1 = '';
        if (fit1 && p1) {
            const kf = fit1.A / ((r + fit1.r0) * (r + fit1.r0));
            const sg = propagateFitUnc(r, fit1.A, fit1.r0, fit1.cov);
            k1d = p1.k; dk1d = p1.dk; k1f = kf; dk1f = sg;
            s1 = kf > 0 ? (sg / kf) * 100 : '';
            d1 = p1.k !== 0 ? (kf - p1.k) / p1.k * 100 : '';
        }
        let k2d = '', dk2d = '', k2f = '', dk2f = '', s2 = '', d2 = '';
        if (fit2 && p2) {
            const kf = fit2.A / ((r + fit2.r0) * (r + fit2.r0));
            const sg = propagateFitUnc(r, fit2.A, fit2.r0, fit2.cov);
            k2d = p2.k; dk2d = p2.dk; k2f = kf; dk2f = sg;
            s2 = kf > 0 ? (sg / kf) * 100 : '';
            d2 = p2.k !== 0 ? (kf - p2.k) / p2.k * 100 : '';
        }
        rows.push([r, k1d, dk1d, k1f, dk1f, s1, d1, k2d, dk2d, k2f, dk2f, s2, d2]);
    });

    return rows;
}

/** Downloads an Excel file with the summary calibration results. */
function downloadCalibExcel() {
    if (typeof XLSX === 'undefined') {
        alert(t('excel.missingLib'));
        return;
    }
    const { fit1, fit2, pts1, pts2 } = multiState.lastFit ?? {};
    if (!pts1) { alert(t('excel.noData')); return; }

    const aoa = buildCalibExcelAoa(fit1, fit2, pts1, pts2);
    const ws  = XLSX.utils.aoa_to_sheet(aoa);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calibration Summary');

    const dates  = multiState.files.map(f => f.date).filter(Boolean).sort();
    const dateStr = dates.length ? dates[0].slice(0, 10) : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `SAC_multi_calibration_${dateStr}.xlsx`);
}

function buildFinalYamlBlock(fit1, fit2) {
    const yamlText = generateMultiCalibYaml(fit1, fit2);
    const blockId  = 'mc-yaml-pre';
    const btnId    = 'mc-yaml-copy';
    let html = `<pre class="yaml-block" id="${blockId}">${escHtml(yamlText)}</pre>`;
    html += `<button type="button" id="${btnId}" class="btn-copy">${t('yaml.copyBtn')}</button>`;
    /* Listener added after inserting into the DOM */
    setTimeout(() => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(yamlText).then(() => {
                btn.textContent = t('yaml.copied');
                setTimeout(() => { btn.innerHTML = t('yaml.copyBtn'); }, 2000);
            }).catch(() => {
                alert(t('yaml.copyFail'));
            });
        });
    }, 0);
    return html;
}

/* ============================================================
   Language change hook – called by applyTranslations() in i18n.js
   via onLangChange() in app.js
   ============================================================ */

/**
 * Re-renders the multi-calibration UI after a language change.
 * Called from onLangChange() in app.js.
 */
function onMultiLangChange() {
    const multiSection = document.getElementById('section-multi-summary');
    if (!multiSection || multiSection.style.display === 'none') return;
    if (!multiState.files.length) return;

    /* Re-render the summary table and action buttons.
       This recreates #multi-individual-sections and #multi-batch-section as empty divs. */
    renderMultiSummary(multiState._errors || [], multiState._warnings || []);

    /* Re-populate per-file sections if processing has been done */
    const container = document.getElementById('multi-individual-sections');
    if (container && multiState.files.some(f => f.proc)) {
        container.innerHTML = multiState.files.map((_, i) => buildFileSection(i)).join('');
        multiState.files.forEach((f, i) => {
            if (!f.proc) return;
            if (i > 0) {
                const sec = document.getElementById(`f${i}-section`);
                if (sec) sec.removeAttribute('open');
            }
            renderFileBody(i);
        });
    }

    /* Re-render the final fit section if results are available */
    if (multiState.lastFit) refreshFinalFit();
}
