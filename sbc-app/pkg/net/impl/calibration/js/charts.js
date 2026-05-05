/* charts.js – chart rendering (Chart.js) */

'use strict';

/* ----------------------------------------------------------
   Rendering functions (Chart.js)
   ---------------------------------------------------------- */

/**
 * Renders the initial 1 s histogram (full data) with jump highlighting.
 */
function renderHist1sChart(canvasId, hist1s, cutTimeSec) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const maxY   = hist1s.reduce((m, v) => Math.max(m, v), 0) * 1.15;
    const cutRef = { value: cutTimeSec };   // mutable reference – updated by the slider

    /* Inline plugin: red dashed rectangle showing the cut region (0 → cutTimeSec) */
    const cutZonePlugin = {
        id: 'cutZone',
        beforeDatasetsDraw(ch) {
            if (cutRef.value <= 0) return;
            const c  = ch.ctx;
            const xs = ch.scales.x;
            const ys = ch.scales.y;
            const x0 = xs.getPixelForValue(0);
            const x1 = xs.getPixelForValue(cutRef.value);
            const y1 = ys.getPixelForValue(ys.max);
            const y0 = ys.getPixelForValue(0);
            c.save();
            c.fillStyle = 'rgba(210, 40, 40, 0.09)';
            c.fillRect(x0, y1, x1 - x0, y0 - y1);
            c.strokeStyle = 'rgba(210, 40, 40, 0.85)';
            c.lineWidth   = 2;
            c.setLineDash([6, 4]);
            c.strokeRect(x0, y1, x1 - x0, y0 - y1);
            c.restore();
        },
    };

    const chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label:           'bin = 1 s',
                data:            hist1s.map((v, i) => ({ x: i, y: v })),
                showLine:        true,
                stepped:         'before',
                borderColor:     'rgba(40, 90, 190, 0.85)',
                backgroundColor: 'rgba(40, 90, 190, 0.10)',
                fill:            'origin',
                borderWidth:     1.5,
                pointRadius:     0,
            }],
        },
        options: {
            animation:           false,
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    t('chart.hist1sTitle'),
                    font:    { size: 14, weight: 'bold' },
                    padding: { bottom: 12 },
                },
                legend: { display: false },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    title: { display: true, text: t('chart.axisTime') },
                },
                y: {
                    min: 0,
                    max: maxY,
                    title: { display: true, text: t('chart.axisDndt') },
                },
            },
        },
        plugins: [cutZonePlugin],
    });

    state.charts[canvasId] = chart;
    chart._cutRef = cutRef;   // exposes reference to the slider for live updates
}

/**
 * Renders all 15 histograms (trimmed data) on a single chart.
 */
function renderAllHistogramsChart(canvasId, histograms) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const datasets = histograms.map(h => ({
        label:           `${h.binSize} s`,
        data:            h.points,
        showLine:        true,
        stepped:         'before',
        borderColor:     binSizeToColor(h.binSize),
        backgroundColor: 'transparent',
        fill:            false,
        borderWidth:     1.2,
        pointRadius:     0,
    }));

    state.charts[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            animation:  false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    t('chart.allHistTitle'),
                    font:    { size: 14, weight: 'bold' },
                    padding: { bottom: 12 },
                },
                legend: { display: false },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    title: { display: true, text: t('chart.axisTime') },
                },
                y: {
                    min:   0,
                    title: { display: true, text: t('chart.axisDndt') },
                },
            },
        },
    });

    /* Custom HTML legend in two columns (1–10 s | 11–20 s) */
    const legendEl = document.getElementById('legend-all-hist');
    if (legendEl) legendEl.innerHTML = buildHistLegendHtml(histograms);
}

/**
 * Builds the HTML histogram legend in two columns.
 */
function buildHistLegendHtml(histograms) {
    const numCols  = 4;
    const colSize  = Math.ceil(histograms.length / numCols);
    const makeCol  = (arr) => arr.map(h => {
        const color = binSizeToColor(h.binSize);
        return `<span class="hlgnd__item">`
             + `<span class="hlgnd__swatch" style="background:${color}"></span>`
             + `${h.binSize}&thinsp;s</span>`;
    }).join('');
    const cols = Array.from({ length: numCols }, (_, ci) =>
        `<div class="hlgnd__col">${makeCol(histograms.slice(ci * colSize, (ci + 1) * colSize))}</div>`
    ).join('');
    return `<div class="hlgnd">${cols}</div>`;
}

/**
 * Adds/updates a highlighted point in an existing chart (dataset index 1).
 * @param {string} canvasId  Canvas element ID
 * @param {number|null} x    X coordinate of the point (null = remove highlight)
 * @param {number|null} y    Y coordinate of the point
 */
function highlightPointInChart(canvasId, x, y) {
    const chart = state.charts[canvasId];
    if (!chart) return;
    /* Remove previous highlight (identified by _isHighlight flag) */
    const hiIdx = chart.data.datasets.findIndex(d => d._isHighlight);
    if (hiIdx !== -1) chart.data.datasets.splice(hiIdx, 1);
    if (x !== null && y !== null) {
        /* unshift → index 0 → drawn first (behind all other datasets) = below the data */
        chart.data.datasets.unshift({
            _isHighlight:     true,
            label:            t('chart.selected'),
            data:             [{ x, y }],
            showLine:         false,
            pointRadius:      10,
            pointHoverRadius: 12,
            borderColor:      'rgba(230, 150, 0, 1)',
            backgroundColor:  'rgba(255, 200, 0, 0.75)',
            borderWidth:      2,
        });
    }
    chart.update('none');
}

/* ----------------------------------------------------------
   Selected fit chart
   ---------------------------------------------------------- */

function renderBestFitChart(canvasId, histogram, fit, axisXMax = null, axisYMax = null) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const B    = histogram.binSize;
    const tMax = (histogram.points.at(-1)?.x ?? 0) + B;

    /* Smooth fit curve (step 0.5 s or B/10, max 2 s) */
    const dt      = Math.min(2, Math.max(0.5, B / 10));
    const fitPts  = [];
    for (let t = 0; t <= tMax + dt; t += dt) {
        fitPts.push({ x: t, y: fit.k1 * Math.exp(-t/T1)
                               + fit.k2 * Math.exp(-t/T2) + fit.y0 });
    }

    /* Parameter labels in the chart title */
    const titleLine2 = `k₁ = ${fmt3(fit.k1)} ± ${fmt3(fit.dk1)},  `
                     + `k₂ = ${fmt3(fit.k2)} ± ${fmt3(fit.dk2)},  `
                     + `y₀ = ${fmt3(fit.y0)} ± ${fmt3(fit.dy0)}`;
    const titleLine3 = `R = ${fit.R.toFixed(6)},  `
                     + `Adj.R² = ${fit.adjR2.toFixed(6)},  `
                     + `Red.χ² = ${fit.redChiSq.toFixed(4)}`;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label:           t('chart.histDataset', { b: B }),
                    data:            histogram.points,
                    showLine:        true,
                    stepped:         'before',
                    borderColor:     'rgba(40, 90, 190, 0.7)',
                    backgroundColor: 'rgba(40, 90, 190, 0.08)',
                    fill:            'origin',
                    borderWidth:     1.5,
                    pointRadius:     0,
                    order:           2,
                },
                {
                    label:       t('chart.fitCurve'),
                    data:        fitPts,
                    showLine:    true,
                    stepped:     false,
                    borderColor: 'rgba(210, 40, 40, 0.9)',
                    fill:        false,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    order:       1,
                },
            ],
        },
        options: {
            animation:  false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: [
                        t('chart.bestFitTitle', { b: B }),
                        titleLine2,
                        titleLine3,
                    ],
                    font:    { size: 13, weight: 'bold' },
                    padding: { bottom: 14 },
                },
                legend: { display: true },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    max:   axisXMax ?? state.fitAxisXMax ?? 600,
                    ticks: {
                        stepSize:     15,
                        callback:     (v) => v % 60 === 0 ? v : null,
                        maxTicksLimit: 200,
                    },
                    grid: {
                        color: (ctx) => ctx.tick.value % 60 === 0
                            ? 'rgba(0,0,0,0.18)'
                            : 'rgba(0,0,0,0.06)',
                    },
                    title: { display: true, text: t('chart.axisTime') },
                },
                y: {
                    min:   0,
                    max:   axisYMax ?? state.fitAxisYMax ?? undefined,
                    title: { display: true, text: t('chart.axisDndt') },
                },
            },
        },
    });
}

/* ----------------------------------------------------------
   Chart: relative uncertainty δk2/k2 [%] vs bin size
   ---------------------------------------------------------- */

function renderDkPctChart(canvasId, fits) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const valid  = fits.filter(r => r.fit && r.fit.k2 > 0);
    const bins   = valid.map(r => r.binSize);
    const dk2pct = valid.map(r => (r.fit.dk2 / r.fit.k2) * 100);
    const maxBin = fits.length > 0 ? fits[fits.length - 1].binSize + 2 : 22;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label:           'δk₂/k₂ (%)',
                data:            bins.map((x, i) => ({ x, y: dk2pct[i] })),
                showLine:        true,
                borderColor:     'rgba(210, 40, 40, 0.85)',
                backgroundColor: 'rgba(210, 40, 40, 0.85)',
                pointRadius:     4,
                borderWidth:     1.5,
            }],
        },
        options: {
            animation:  false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    t('chart.dkTitle'),
                    font:    { size: 12, weight: 'bold' },
                    padding: { bottom: 8 },
                },
                legend: { display: false },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    max:   maxBin,
                    title: { display: true, text: t('chart.axisBinSize'), font: { size: 11 } },
                    ticks: { stepSize: 2 },
                },
                y: {
                    title: { display: true, text: t('chart.axisDkPct'), font: { size: 11 } },
                    afterDataLimits(scale) {
                        const range = Math.abs(scale.max - scale.min) || 0.1;
                        const pad = range * 0.10;
                        scale.min -= pad;
                        scale.max += pad;
                    },
                },
            },
        },
    });
}

/* ----------------------------------------------------------
   Chart: Adj. R² vs bin size
   ---------------------------------------------------------- */

function renderAdjR2Chart(canvasId, fits) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const valid   = fits.filter(r => r.fit);
    const bins    = valid.map(r => r.binSize);
    const adjR2s  = valid.map(r => r.fit.adjR2);
    const maxBin  = fits.length > 0 ? fits[fits.length - 1].binSize + 2 : 22;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label:           'Adj. R²',
                data:            bins.map((x, i) => ({ x, y: adjR2s[i] })),
                showLine:        true,
                borderColor:     'rgba(30, 30, 30, 0.85)',
                backgroundColor: 'rgba(30, 30, 30, 0.85)',
                pointRadius:     4,
                borderWidth:     1.5,
            }],
        },
        options: {
            animation:           false,
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    t('chart.adjR2Title'),
                    font:    { size: 12, weight: 'bold' },
                    padding: { bottom: 8 },
                },
                legend: { display: false },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    max:   maxBin,
                    title: { display: true, text: t('chart.axisBinSize'), font: { size: 11 } },
                    ticks: { stepSize: 2 },
                },
                y: {
                    title: { display: true, text: t('chart.axisAdjR2'), font: { size: 11 } },
                    afterDataLimits(scale) {
                        const range = Math.abs(scale.max - scale.min) || 0.01;
                        const pad   = range * 0.10;
                        scale.min  -= pad;
                        scale.max  += pad;
                    },
                },
            },
        },
    });
}

/* ----------------------------------------------------------
   Chart: reduced χ²_red vs bin size
   ---------------------------------------------------------- */

function renderChi2vsBinChart(canvasId, fits) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const valid  = fits.filter(r => r.fit && r.fit.k2 > 0);
    const bins   = valid.map(r => r.binSize);
    const chi2s  = valid.map(r => r.fit.redChiSq);
    const maxBin = fits.length > 0 ? fits[fits.length - 1].binSize + 2 : 22;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label:           'χ²_red',
                    data:            bins.map((x, i) => ({ x, y: chi2s[i] })),
                    showLine:        true,
                    borderColor:     'rgba(20, 150, 80, 0.85)',
                    backgroundColor: 'rgba(20, 150, 80, 0.85)',
                    pointRadius:     4,
                    borderWidth:     1.5,
                    order:           2,
                },
                {
                    label:       'χ²_red = 1',
                    data:        [{ x: 0, y: 1 }, { x: maxBin, y: 1 }],
                    showLine:    true,
                    borderColor: 'rgba(0, 150, 0, 0.7)',
                    borderWidth: 1.5,
                    borderDash:  [5, 4],
                    pointRadius: 0,
                    fill:        false,
                    order:       1,
                },
            ],
        },
        options: {
            animation:  false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    t('chart.chi2Title'),
                    font:    { size: 12, weight: 'bold' },
                    padding: { bottom: 8 },
                },
                legend: { display: false },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    max:   maxBin,
                    title: { display: true, text: t('chart.axisBinSize'), font: { size: 11 } },
                    ticks: { stepSize: 2 },
                },
                y: {
                    min:   0.8,
                    max:   2.0,
                    ticks: { stepSize: 0.1 },
                    title: { display: true, text: t('chart.axisChi2'), font: { size: 11 } },
                },
            },
        },
    });
}

/* ----------------------------------------------------------
   Chart: p-value vs bin size
   ---------------------------------------------------------- */

function renderPValueChart(canvasId, fits) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const valid  = fits.filter(r => r.fit && r.fit.k2 > 0 && isFinite(r.fit.pValue));
    const bins   = valid.map(r => r.binSize);
    const pVals  = valid.map(r => r.fit.pValue);
    const maxBin = fits.length > 0 ? fits[fits.length - 1].binSize + 2 : 22;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label:           t('chart.labelPVal'),
                    data:            bins.map((x, i) => ({ x, y: pVals[i] })),
                    showLine:        true,
                    borderColor:     'rgba(0, 130, 180, 0.85)',
                    backgroundColor: 'rgba(0, 130, 180, 0.85)',
                    pointRadius:     4,
                    borderWidth:     1.5,
                    order:           2,
                },
                {
                    label:       'p = 0.05',
                    data:        [{ x: 0, y: 0.05 }, { x: maxBin, y: 0.05 }],
                    showLine:    true,
                    borderColor: 'rgba(0, 130, 180, 0.65)',
                    borderWidth: 1.5,
                    borderDash:  [5, 4],
                    pointRadius: 0,
                    fill:        false,
                    order:       1,
                },
                {
                    label:       'p = 0.95',
                    data:        [{ x: 0, y: 0.95 }, { x: maxBin, y: 0.95 }],
                    showLine:    true,
                    borderColor: 'rgba(0, 130, 180, 0.65)',
                    borderWidth: 1.5,
                    borderDash:  [5, 4],
                    pointRadius: 0,
                    fill:        false,
                    order:       1,
                },
            ],
        },
        options: {
            animation:           false,
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text:    t('chart.pValTitle'),
                    font:    { size: 12, weight: 'bold' },
                    padding: { bottom: 8 },
                },
                legend: { display: false },
            },
            scales: {
                x: {
                    type:  'linear',
                    min:   0,
                    max:   maxBin,
                    title: { display: true, text: t('chart.axisBinSize'), font: { size: 11 } },
                    ticks: { stepSize: 2 },
                },
                y: {
                    min:   -0.2,
                    max:   1,
                    ticks: { stepSize: 0.2 },
                    title: { display: true, text: t('chart.axisPVal'), font: { size: 11 } },
                },
            },
        },
    });
}
