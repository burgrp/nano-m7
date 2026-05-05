/* fitting.js – physics constants, histogram building, fitting algorithm, linear algebra */

'use strict';

/* ---------- Physics constants (fixed fit parameters) ---------- */
const T1 = 206.19;  // [s] decay time constant of 107Ag (half-life 24.6 d, but t1 for fit = 206.19 s)
const T2 = 35.49;   // [s] decay time constant of 109Ag

/* ----------------------------------------------------------
   Histogram computation functions
   ---------------------------------------------------------- */

/**
 * Builds a 1 s histogram from rawData [µs].
 * Returns an array counts[], where counts[i] = number of pulses in [i, i+1) s.
 */
function buildHistogram1s(rawDataUs) {
    if (!rawDataUs || rawDataUs.length === 0) return [];
    const maxBin = Math.floor(rawDataUs[rawDataUs.length - 1] / 1e6) + 1;
    const counts = new Array(maxBin).fill(0);
    for (const t of rawDataUs) {
        const bin = Math.floor(t / 1e6);
        if (bin >= 0 && bin < maxBin) counts[bin]++;
    }
    return counts;
}

/**
 * Searches for the first large downward jump in the 1 s histogram.
 * Returns { found, jumpBin, cutTimeSec, relDrop }.
 *
 * jumpBin = first bin AFTER the jump (hist[jumpBin] << hist[jumpBin-1]), time in seconds.
 * cutTimeSec = jumpBin + 1 (we also discard the first "mixed" bin after the jump).
 */
function detectJump(hist1s, backgroundPPM) {
    const n      = hist1s.length;
    const bgPerS = (backgroundPPM ?? 0) / 60;

    /* Natural relative drop per 1 s at t=0 for the dual-Ag decay,
       derived from the activation ratio k₁/k₂ = T₂/T₁ (same number of activated atoms):
         relDrop_nat = [(T₂/T₁)·(1−exp(−1/T₁)) + (1−exp(−1/T₂))] / (T₂/T₁ + 1)  ≈ 2.47 %
       Threshold = N × relDrop_nat  (N = 10  →  ≈ 24.4 %)
       We scan FORWARD – looking for the FIRST large jump.
       MIN_RATE prevents false detection in the low-count tail (where relative changes are large). */
    const ratio          = T2 / T1;
    const naturalDrop1s  = (ratio * (1 - Math.exp(-1 / T1)) + (1 - Math.exp(-1 / T2))) / (ratio + 1);
    const THRESH         = 10 * naturalDrop1s;

    const MIN_RATE = Math.max(10, bgPerS * 5);     // minimum rate for detection

    /* Scan forward: prev = previous bin, curr = current bin.
       Look for a place where prev >> curr → large drop = jump (source was hidden). */
    for (let i = 1; i < n - 1; i++) {
        const prev = hist1s[i - 1];
        const curr = hist1s[i];
        if (prev < MIN_RATE) continue;
        const relDrop = (prev - curr) / prev;
        if (relDrop > THRESH) {
            return { found: true, jumpBin: i, cutTimeSec: i + 1, relDrop };
        }
    }
    return { found: false, jumpBin: -1, cutTimeSec: 0, relDrop: 0 };
}

/**
 * Automatic cut-point detection by scanning p-values from t = 0 forward.
 *
 * For each candidate tCut (0, 1, 2, … [s]) fits the double exponential to the
 * remaining data [tCut, end] with bin sizes 2 s and 3 s. Returns the smallest
 * tCut for which AT LEAST ONE bin (2 s OR 3 s) yields p > pThreshold.
 *
 * Behaviour:
 *   – Data without a jump  → condition met immediately (returns 0)
 *   – Data with a jump     → returns the time just past the end of the jump
 *   – Jump not found within maxScanSec → returns 0
 *
 * @param {number[]}    rawDataUs  Raw data [µs]
 * @param {number|null} y0PerSec   Fixed background [pulses/s] or null (free parameter)
 * @param {number}      pThreshold p-value threshold (default 0.05)
 * @param {number}      maxScanSec Maximum scan length from the start [s] (default 600)
 * @returns {number}               Recommended cut time [s]
 */
function autoDetectCut(rawDataUs, y0PerSec, pThreshold = 0.05, maxScanSec = 600) {
    const hist1s   = buildHistogram1s(rawDataUs);
    const totalSec = hist1s.length;
    if (totalSec < 15) return 0;

    const scanEnd   = Math.min(totalSec - 10, maxScanSec);
    const BIN_SIZES = [2, 3];

    for (let tCut = 0; tCut <= scanEnd; tCut++) {
        const remaining = totalSec - tCut;

        /* It is sufficient for AT LEAST ONE bin size (2 s or 3 s) to give p > pThreshold */
        const anyOk = BIN_SIZES.some(B => {
            const numBins = Math.ceil(remaining / B);
            if (numBins < 5) return false;

            const points = [];
            for (let i = 0; i < numBins; i++) {
                let count = 0;
                const jStart = tCut + i * B;
                const jEnd   = Math.min(tCut + (i + 1) * B, totalSec);
                for (let j = jStart; j < jEnd; j++) count += hist1s[j];
                points.push({ x: i * B, y: count / B });
            }

            const res = fitHistogram(B, points, y0PerSec);
            return res !== null && res.pValue > pThreshold;
        });

        if (anyOk) return tCut;
    }

    /* Jump not found within the scan window → recommend no cut */
    return 0;
}

/**
 * Trims rawData: discards everything before cutTimeSec [s] and shifts to t = 0.
 */
function trimRawData(rawDataUs, cutTimeSec) {
    if (cutTimeSec <= 0) return rawDataUs.slice();
    const cutUs = cutTimeSec * 1e6;
    const out = [];
    for (const t of rawDataUs) {
        if (t >= cutUs) out.push(t - cutUs);
    }
    return out;
}

/**
 * Builds histograms for bin sizes 1–maxBinS s from trimmed data.
 * Basis: 1 s histogram (aggregated for larger bins).
 * Normalisation: dN/dt = count / binSize  [pulses/s].
 * Returns [{binSize, points:[{x,y}]}].
 */
function buildAllHistograms(rawDataUs, maxBinS = 20) {
    if (!rawDataUs || rawDataUs.length === 0) return [];
    const hist1s = buildHistogram1s(rawDataUs);
    const n      = hist1s.length;
    const result = [];

    for (let B = 1; B <= maxBinS; B++) {
        const numBins = Math.ceil(n / B);
        const points  = [];
        for (let i = 0; i < numBins; i++) {
            let count = 0;
            const jEnd = Math.min((i + 1) * B, n);
            for (let j = i * B; j < jEnd; j++) count += hist1s[j];
            points.push({ x: i * B, y: count / B }); // x = left edge of bin [s]
        }
        result.push({ binSize: B, points });
    }
    return result;
}

/* ----------------------------------------------------------
   Core computation: weighted linear LSQ for a single histogram
   ---------------------------------------------------------- */

/**
 * Fits a histogram with the double exponential plus a constant:
 *   f(t) = k1·exp(-t/T1) + k2·exp(-t/T2) + y0
 *
 * y0fixed [pulses/s]: if not null, y0 is fixed (2-parameter fit for k1, k2).
 *                     If null, y0 is a free parameter (3-parameter fit).
 *
 * @param {number} binSize  Bin width [s]
 * @param {Array}  points   [{x: left edge [s], y: dN/dt [pulses/s]}]
 * @returns {Object|null}   Fit result or null (failure)
 */
function fitHistogram(binSize, points, y0fixed = null) {
    /* Use only bins with y > 0 (Poisson weight would be infinite for y = 0) */
    const usable = points.filter(p => p.y > 0);
    const n      = usable.length;
    const nPar   = y0fixed !== null ? 2 : 3;
    if (n < nPar + 1) return null;

    const y = usable.map(p => p.y);               // [pulses/s]

    /* Poisson weight: w_i = B / y_i  (= 1 / Var(y_i)) */
    const w = y.map(yi => binSize / yi);

    /* Basis functions: exact integral of exp over bin / bin width */
    const g1 = usable.map(p => {
        const tL = p.x, tR = p.x + binSize;
        return (T1 / binSize) * (Math.exp(-tL / T1) - Math.exp(-tR / T1));
    });
    const g2 = usable.map(p => {
        const tL = p.x, tR = p.x + binSize;
        return (T2 / binSize) * (Math.exp(-tL / T2) - Math.exp(-tR / T2));
    });

    let k1, k2, y0, dk1, dk2, dy0;

    if (y0fixed !== null) {
        /* 2-parameter fit: y0 is fixed → subtract from right-hand side */
        const A2 = [[0, 0], [0, 0]];
        const b2 = [0, 0];

        for (let i = 0; i < n; i++) {
            const y_adj = y[i] - y0fixed;
            const gi    = [g1[i], g2[i]];
            const wi    = w[i];
            for (let r = 0; r < 2; r++) {
                b2[r] += wi * gi[r] * y_adj;
                for (let c = 0; c < 2; c++) A2[r][c] += wi * gi[r] * gi[c];
            }
        }

        const A2inv = inv2x2(A2);
        if (!A2inv) return null;
        [k1, k2] = matvec2(A2inv, b2);
        y0  = y0fixed;
        dk1 = Math.sqrt(Math.abs(A2inv[0][0]));
        dk2 = Math.sqrt(Math.abs(A2inv[1][1]));
        dy0 = 0;                                   // fixed – no uncertainty from fit
    } else {
        /* 3-parameter fit: k1, k2, y0 all free */
        const A3 = [[0,0,0],[0,0,0],[0,0,0]];
        const b3 = [0, 0, 0];

        for (let i = 0; i < n; i++) {
            const gi = [g1[i], g2[i], 1.0];
            const wi = w[i], yi = y[i];
            for (let r = 0; r < 3; r++) {
                b3[r] += wi * gi[r] * yi;
                for (let c = 0; c < 3; c++) A3[r][c] += wi * gi[r] * gi[c];
            }
        }

        const A3inv = inv3x3(A3);
        if (!A3inv) return null;
        [k1, k2, y0] = matvec3(A3inv, b3);
        dk1 = Math.sqrt(Math.abs(A3inv[0][0]));
        dk2 = Math.sqrt(Math.abs(A3inv[1][1]));
        dy0 = Math.sqrt(Math.abs(A3inv[2][2]));
    }

    /* Predictions and residuals */
    const yPred = usable.map((_, i) => k1 * g1[i] + k2 * g2[i] + y0);
    let chiSq = 0, RSS = 0;
    for (let i = 0; i < n; i++) {
        const res = y[i] - yPred[i];
        chiSq += w[i] * res * res;
        RSS   += res * res;
    }
    const dof      = n - nPar;
    const redChiSq = chiSq / dof;
    const pValue   = chiSqPValue(chiSq, dof);

    /* R², adj. R² */
    const yMean = y.reduce((s, v) => s + v, 0) / n;
    const SStot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
    const R2    = SStot > 0 ? 1 - RSS / SStot : 0;
    const adjR2 = 1 - (1 - R2) * (n - 1) / dof;

    /* Pearson correlation coefficient R */
    const yPredMean = yPred.reduce((s, v) => s + v, 0) / n;
    let cov = 0, varO = 0, varP = 0;
    for (let i = 0; i < n; i++) {
        cov  += (y[i] - yMean) * (yPred[i] - yPredMean);
        varO += (y[i] - yMean) ** 2;
        varP += (yPred[i] - yPredMean) ** 2;
    }
    const R = (varO > 0 && varP > 0) ? cov / Math.sqrt(varO * varP) : 0;

    return { k1, k2, y0, dk1, dk2, dy0, chiSq, redChiSq, pValue, RSS, R2, adjR2, R, n,
             y0IsFixed: y0fixed !== null };
}

/* ----------------------------------------------------------
   3×3 matrix operations (analytical)
   ---------------------------------------------------------- */

function inv2x2(M) {
    const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    if (Math.abs(det) < 1e-20) return null;
    const d = 1 / det;
    return [
        [ M[1][1] * d, -M[0][1] * d],
        [-M[1][0] * d,  M[0][0] * d],
    ];
}

function matvec2(M, v) {
    return [
        M[0][0] * v[0] + M[0][1] * v[1],
        M[1][0] * v[0] + M[1][1] * v[1],
    ];
}

function det3x3(M) {
    return (
        M[0][0] * (M[1][1]*M[2][2] - M[1][2]*M[2][1]) -
        M[0][1] * (M[1][0]*M[2][2] - M[1][2]*M[2][0]) +
        M[0][2] * (M[1][0]*M[2][1] - M[1][1]*M[2][0])
    );
}

function inv3x3(M) {
    const det = det3x3(M);
    if (Math.abs(det) < 1e-20) return null;   // singular matrix
    const d = 1 / det;
    return [
        [ (M[1][1]*M[2][2] - M[1][2]*M[2][1])*d,
          (M[0][2]*M[2][1] - M[0][1]*M[2][2])*d,
          (M[0][1]*M[1][2] - M[0][2]*M[1][1])*d ],
        [ (M[1][2]*M[2][0] - M[1][0]*M[2][2])*d,
          (M[0][0]*M[2][2] - M[0][2]*M[2][0])*d,
          (M[0][2]*M[1][0] - M[0][0]*M[1][2])*d ],
        [ (M[1][0]*M[2][1] - M[1][1]*M[2][0])*d,
          (M[0][1]*M[2][0] - M[0][0]*M[2][1])*d,
          (M[0][0]*M[1][1] - M[0][1]*M[1][0])*d ],
    ];
}

function matvec3(M, v) {
    return [
        M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
        M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
        M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
    ];
}
