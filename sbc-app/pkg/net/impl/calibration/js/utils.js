/* utils.js – pure helper functions (math, statistics, formatting) */

'use strict';

/**
 * Complementary error function erfc(x) – approximation A&S 7.1.26, accuracy ~1.5×10⁻⁷.
 */
function erfcApprox(x) {
    if (x < 0) return 2 - erfcApprox(-x);
    const t = 1 / (1 + 0.3275911 * x);
    return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741
         + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
}

/**
 * p-value for χ² goodness-of-fit test: P(χ²(dof) ≥ chiSqObs).
 * Uses Wilson-Hilferty normal approximation (accurate enough for dof ≥ 3).
 * Returns NaN for invalid inputs.
 */
function chiSqPValue(chiSqObs, dof) {
    if (dof <= 0 || !isFinite(chiSqObs) || chiSqObs < 0) return NaN;
    const x = chiSqObs / dof;
    const z = (Math.cbrt(x) - (1 - 2 / (9 * dof))) / Math.sqrt(2 / (9 * dof));
    return 0.5 * erfcApprox(z / Math.SQRT2);
}

/**
 * Maps bin size (1–20) to a colour from blue (1 s) to red (20 s).
 */
function binSizeToColor(binSize) {
    const hue = Math.round(240 - (binSize - 1) * (240 / 19));
    return `hsl(${hue}, 70%, 45%)`;
}

function parseDateFromFilename(filename) {
    const m = filename.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}  ${m[4]}:${m[5]}:${m[6]}`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ----------------------------------------------------------
   Small helper functions for number formatting
   ---------------------------------------------------------- */
const fmt3 = v => (typeof v === 'number' ? v.toFixed(3) : 'N/A');
const fmt4 = v => (typeof v === 'number' ? v.toFixed(4) : 'N/A');

/**
 * Formats a number as scientific notation (5 decimal places, 2-digit exponent).
 * Example: 0.001234 → "1.23400E-03"
 */
function fmtSci(v) {
    const s = v.toExponential(5).toUpperCase();
    return s.replace(/E([+-])(\d)$/, 'E$10$2');
}

/**
 * Formats a (value, uncertainty) pair following proper scientific notation rules:
 *   – uncertainty rounded to sigFigs significant digits (default 2)
 *   – value and uncertainty share the same exponent and number of decimal places
 *   – if exponent ≠ 0: (val ± unc)·10^exp
 */
function fmtValUnc(val, unc, sigFigs = 2) {
    if (!isFinite(val) || !isFinite(unc) || unc <= 0) {
        return `${val} ± ${unc}`;
    }
    const expV      = Math.floor(Math.log10(Math.abs(val)));
    const expU      = Math.floor(Math.log10(Math.abs(unc)));
    const decPlaces = Math.max(0, expV - expU + sigFigs - 1);
    const scale     = Math.pow(10, expV);
    const valStr    = (val / scale).toFixed(decPlaces);
    const uncStr    = (unc / scale).toFixed(decPlaces);
    if (expV === 0) return `${valStr} ± ${uncStr}`;
    return `(${valStr} ± ${uncStr})&times;10<sup>${expV}</sup>`;
}

/**
 * Formats a single number as a nice HTML scientific notation: 1.2345×10⁶
 * @param {number} v         Value
 * @param {number} decPlaces Number of mantissa decimal places (default 4)
 */
function fmtSciNice(v, decPlaces = 4) {
    if (!isFinite(v)) return String(v);
    if (v === 0) return '0';
    const exp  = Math.floor(Math.log10(Math.abs(v)));
    const mant = v / Math.pow(10, exp);
    if (exp === 0) return mant.toFixed(decPlaces);
    return `${mant.toFixed(decPlaces)}&times;10<sup>${exp}</sup>`;
}

/**
 * Rounds a value up to the nearest multiple of a "nice" tick.
 * Tick step is chosen so that there are approx. 6 major divisions from 0 to max.
 * Result is always a multiple of the tick → y-axis max falls exactly on a grid line.
 * Example: 1234 → 1400 (tick=200), 87 → 90 (tick=10), 850 → 900 (tick=100).
 */
function niceMax(val) {
    if (val <= 0) return 1;
    const roughStep = val / 6;
    const exp  = Math.floor(Math.log10(roughStep));
    const p    = Math.pow(10, exp);
    const norm = roughStep / p;
    let step;
    if      (norm <= 1.5) step = 1;
    else if (norm <= 3)   step = 2;
    else if (norm <= 7)   step = 5;
    else                  step = 10;
    step *= p;
    return Math.ceil(val / step) * step;
}
