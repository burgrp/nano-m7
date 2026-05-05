/* i18n.js – CZ/EN language toggle
   Must be loaded BEFORE any JS file that calls t().
   Script load order: js-yaml → chart → i18n → utils → fitting → charts → app → xlsx → multi-calib
*/

'use strict';

/* ---------- Translation dictionary ---------- */

const translations = {
    cs: {
        /* ---- index.html ---- */
        'page.title':       'Zpracování kalibračních dat pro detektor Silver Activation Counter (SAC)',
        'form.heading':     'Vstupní parametry',
        'form.fileLabel':   'Výběr experimentů:',
        'form.loadBtn':     '↺ Obnovit seznam',
        'form.loadingList': '⟳ Načítám seznam\u2026',
        'form.listLoaded':  '{n} experimentů',
        'form.noExperiments': 'Žádné experimenty.',
        'form.loadError':   'Chyba načítání',
        'form.selectedCount': '{n} vybraných',
        'form.fluenceLabel':'Fluence neutronového zdroje použitého při kalibraci (n/s):',
        'form.hideTimeLabel':'Čas na uložení zářiče (s):',
        'form.bgLabel':     'Radiační pozadí (pulsů/min):',
        'form.bgYaml':      'Ze souboru YAML (<code>backgroundPulsesPerMinute</code>)',
        'form.bgFree':      'Zanechat parametr pozadí (y<sub>0</sub>) jako volný parametr fitu',
        'form.bgManual':    'Zadat ručně:',
        'form.bgManualPlaceholder': 'pulsů/min',
        'form.submitBtn':   '▶ Zpracovat data',
        'step1.heading':    'Krok 1 – Načtená data',
        'step2.heading':    'Krok 2 – Histogramy',
        'step3.heading':    'Krok 3 – Proložení dvojitou exponenciálou',
        'multi.heading':    'Zpracování kalibrace pro více vzdáleností – Přehled souborů',

        /* ---- buttons / status ---- */
        'btn.processing':   '⟳ Zpracovávám…',
        'btn.submit':       '▶ Zpracovat data',
        'btn.loadingFiles': '⟳ Načítám soubory…',
        'err.noFile':       'Vyberte datový soubor.',
        'err.yamlParse':    'Chyba při parsování YAML:',
        'err.fileRead':     'Nelze přečíst soubor.',

        /* ---- background (y₀) ---- */
        'bg.freeParam':     'y₀ bude určeno jako volný parametr proložení',
        'bg.missingYaml':   'N/A – v YAML chybí backgroundPulsesPerMinute',
        'bg.fromYaml':      '(ze souboru YAML)',
        'bg.manual':        '(zadáno ručně)',
        'bg.unitPpm':       'pulsů/min',

        /* ---- SNR ---- */
        'snr.pulsesBg':     '{n} pulsů / {bg} pozadí',
        'snr.ok':           '&#10003;&nbsp;OK',
        'snr.acceptable':   '&#9888;&nbsp;přijatelné',
        'snr.tooLow':       '&#10007;&nbsp;příliš nízké!',

        /* ---- Step 1 – info table ---- */
        'step1.basicInfo':  'Základní informace',
        'step1.datetime':   'Datum a čas měření',
        'step1.datetimeUnknown': 'Nelze určit z názvu souboru',
        'step1.filename':   'Název souboru',
        'step1.detector':   'Detektor',
        'step1.expDesc':    'Popis experimentu',
        'step1.distance':   'Vzdálenost detektoru od zdroje',
        'step1.samplingTime':'Délka měření',
        'step1.background': 'Radiační pozadí',
        'step1.totalPulses':'Počet všech pulsů (rawData)',
        'step1.snrRow':     'Pulsy za 1.\u202fmin exp. poklesu\u202f/\u202fpozadí',
        'step1.computing':  'počítám\u2026',
        'step1.fluence':    'Fluence neutronového zdroje (zadaná)',
        'step1.tubes':      'GM trubice v detektoru',
        'step1.rawPreview': 'Náhled rawData – časy pulsů (µs)',
        'step1.rawRange':   'Celkem {n} hodnot. Časový rozsah: 0\u202f–\u202f{t}\u202fs',

        /* ---- Tubes table ---- */
        'tubes.empty':      'Žádné trubky nenalezeny.',
        'tubes.col.num':    '#',
        'tubes.col.id':     'ID',
        'tubes.col.type':   'Typ',
        'tubes.col.material':'Materiál',
        'tubes.col.weight': 'Hmotnost (g)',

        /* ---- Step 2 – histograms ---- */
        'step2.noRawData':  'Chybí rawData – nelze vytvořit histogramy.',
        'step2.hist1sTitle':'Histogram (bin\u202f=\u202f1\u202fs) – původní data',
        'step2.jumpDetect': 'Detekce ořezu (schování/vypnutí zářiče)',
        'step2.jumpFoundTitle': 'Detekován skok',
        'step2.jumpFoundPart1': 'data ořezána o',
        'step2.jumpFoundPart2': 's od začátku (detekce pomocí p-hodnoty, bin 2–3\u202fs).',
        'step2.jumpFoundPart3': 'Nový čas t\u202f=\u202f0 odpovídá',
        'step2.jumpFoundPart4': 's od začátku měření.',
        'step2.noJump':     'Žádný skok nenalezen.',
        'step2.noJumpDesc': 'Měření začíná exponenciálním poklesem – data nejsou ořezána.',
        'step2.cutLabel':   'Ořez dat od začátku:',
        'step2.cutUnit':    's',
        'step2.cutAuto':    '(auto:\u202f{t}\u202fs)',
        'step2.cutAutoNone':'(auto: bez ořezu)',
        'step2.allHistTitle':'Přehled histogramů (biny 1–20\u202fs) – ořezaná data, normováno na dN/dt',

        /* ---- Step 3 – fitting ---- */
        'step3.noHistograms':'Nejprve zpracujte histogramy (Krok 2).',
        'step3.methodDesc': 'Vážená lineární metoda nejmenších čtverců (<em>Weighted OLS</em>) s Poissonovskými vahami\n        (w<sub>i</sub>\u202f=\u202fB/y<sub>i</sub>\u202f=\u202f1/Var(y<sub>i</sub>)).<br>\n        Řešení je přesné – žádná iterace.<br>\n        Funkce: <code>f(t)\u202f=\u202fk<sub>1</sub>·exp(−t/t<sub>1</sub>)\n              +\u202fk<sub>2</sub>·exp(−t/t<sub>2</sub>)\u202f+\u202fy<sub>0</sub></code>',
        'step3.methodFixed':'kde t<sub>1</sub>\u202f=\u202f{T1}\u202fs,&ensp;t<sub>2</sub>\u202f=\u202f{T2}\u202fs &ensp;(oba fixní, tabulkové hodnoty)',
        'step3.y0Fixed':    'y<sub>0</sub>\u202f=\u202f{v}\u202fpulsů/s (fixní – zadáno jako pozadí {bg}\u202fpulsů/min)',
        'step3.y0Free':     'y<sub>0</sub> = volný parametr fitu',
        'step3.tableTitle': 'Výsledky proložení pro všechny histogramy s různou délkou binu',
        'step3.selectorHeading': 'Výběr proložení',
        'step3.selectorDesc':'<strong>Dle doporučení</strong> (optimalizace přesnosti k<sub>2</sub>):\n            vybere proložení s p-hodnotou χ² v přijatelném intervalu (0,05–0,95)\n            a nejmenší relativní nejistotou δk<sub>2</sub>/k<sub>2</sub>;\n            není-li žádné přijatelné, použije proložení s χ²<sub>red</sub> nejbližším hodnotě 1.',
        'step3.modeRecommended': 'Automaticky: dle doporučení',
        'step3.modeMinChi': 'Automaticky: χ²<sub>red</sub> nejbližší 1',
        'step3.modeMinDk':  'Automaticky: nejmenší δk₂/k₂',
        'step3.modeManual': 'Ručně: délka binu:',

        /* ---- Fit result – coefficient table ---- */
        'fit.chartTitle':   'Graf zvoleného proložení (bin\u202f=\u202f{b}\u202fs)',
        'fit.coeffHeading': 'Kalibrační koeficienty (bin\u202f=\u202f{b}\u202fs)',
        'fit.k1':           'k<sub>1</sub>\u202f(pulsů/s)',
        'fit.k2':           'k<sub>2</sub>\u202f(pulsů/s)',
        'fit.y0':           'y<sub>0</sub>\u202f(pulsů/s)',
        'fit.y0Fixed':      '(fixní – zadáno jako pozadí)',
        'fit.uncertainty':  'nejistota {pct}\u202f%',
        'fit.k1Phi':        'k<sub>1</sub>\u202f/\u202fΦ\u202f(pulsů\u202fs/n)',
        'fit.k2Phi':        'k<sub>2</sub>\u202f/\u202fΦ\u202f(pulsů\u202fs/n)',
        'fit.fluence':      'Φ, fluence neutronového zdroje (n/s)',

        /* ---- Fit table ---- */
        'fitTable.bin':     'Bin<br>(s)',
        'fitTable.adjR2':   'Adj.\u202fR²',
        'fitTable.redChi':  'Red.\u202fχ²',
        'fitTable.pVal':    'p-hodnota',
        'fitTable.n':       'n',
        'fitTable.noData':  'Nedostatek dat nebo singulární matice',
        'fitTable.fixed':   'fixní',
        'fitTable.note':    'Zvýrazněný řádek\u202f=\u202fvybraná možnost podle Výběru proložení (viz níže). Hodnoty k₁, k₂, y₀, δ… jsou v [pulsů/s].',
        'fitTable.y0Fixed': 'y₀ je fixní (zadáno jako pozadí) – není volný parametr.',
        'fitTable.y0Free':  'y₀ je volný parametr fitu.',

        /* ---- YAML export ---- */
        'yaml.heading':     'Export kalibrace pro user-settings.yaml',
        'yaml.distLabel':   'Vzdálenost kalibrace (m):',
        'yaml.distPlaceholder': 'např. 0.500',
        'yaml.typeLabel':   'Typ kalibrace:',
        'yaml.typeAmBe':    'fissionAmBeNeutron (AmBe)',
        'yaml.typeDd':      'fusionDdNeutron (D-D generátor)',
        'yaml.noteCoeff':   'Kalibrace v jedné vzdálenosti\u202f→\u202f<strong>jeden koeficient</strong> na každý fitting:\n            <code>[k<sub>i</sub>/Φ]</code> a <code>[δk<sub>i</sub>/Φ]</code>.<br>\n            <code>distanceMinM = distanceMaxM</code> = zadaná vzdálenost kalibrace.',
        'yaml.noFit':       'Nejprve zvolte platné proložení.',
        'yaml.copyBtn':     '&#128203;&ensp;Kopírovat do schránky',
        'yaml.copied':      '\u2713 Zkopírováno!',
        'yaml.copyFail':    'Kopírování selhalo – vyberte text ručně a stiskněte Ctrl+C.',
        'yaml.saveBtn':     '&#10003;&ensp;Uložit jako novou kalibraci',
        'yaml.saved':       '\u2713 Uloženo!',
        'yaml.saveFail':    'Uložení selhalo: ',

        /* ---- charts.js ---- */
        'chart.hist1sTitle':'Histogram počtu pulsů – bin\u202f=\u202f1\u202fs (původní data)',
        'chart.axisTime':   'Čas (s)',
        'chart.axisDndt':   'dN/dt (pulsů/s)',
        'chart.allHistTitle':'Histogramy dN/dt – biny 1–20\u202fs (ořezaná data)',
        'chart.selected':   'Zvoleno',
        'chart.bestFitTitle':'Vybrané proložení – bin\u202f=\u202f{b}\u202fs',
        'chart.histDataset':'Histogram (bin\u202f=\u202f{b}\u202fs)',
        'chart.fitCurve':   'Fit: k₁·e⁻ᵗ/ᵀ¹ + k₂·e⁻ᵗ/ᵀ² + y₀',
        'chart.dkTitle':    'Relativní nejistota δk₂/k₂ vs. délka binu',
        'chart.axisBinSize':'Délka binu (s)',
        'chart.axisDkPct':  'δk₂/k₂ (%)',
        'chart.adjR2Title': 'Adj.\u202fR² vs. délka binu',
        'chart.axisAdjR2':  'Adj.\u202fR²',
        'chart.chi2Title':  'Redukovaný χ²_red vs. délka binu',
        'chart.axisChi2':   'χ²_red',
        'chart.pValTitle':  'p-hodnota χ² testu vs. délka binu',
        'chart.labelPVal':  'p-hodnota',
        'chart.axisPVal':   'p-hodnota',

        /* ---- multi-calib.js – loading & validation ---- */
        'multi.errReadFile':'Nelze přečíst soubor: {name}',
        'multi.errTubeConfig':'Soubory mají různé konfigurace GM trubic (tubeConfiguration). Nelze je zpracovávat dohromady.',
        'multi.errMissingDist':'Soubory bez definované vzdálenosti (detectorDistanceM): {files}.',
        'multi.errDupDist': 'Duplicitní vzdálenosti: {vals}. Každá vzdálenost musí být unikátní.',
        'multi.warnMinFiles':'Pro hromadné zpracování je třeba alespoň {n} soubory (načteno: {m}). Lze zpracovávat soubory samostatně.',
        'multi.errLoading': 'Chyba při načítání souborů: {msg}',
        'multi.errHeader':  '&#9888; Chyby při načítání dat:',
        'multi.warnHeader': '&#9888; Upozornění:',

        /* ---- multi-calib.js – summary UI ---- */
        'multi.summaryHeading': 'Souhrnné informace',
        'multi.fileCount':  'Počet načtených souborů',
        'multi.distances':  'Vzdálenosti (seřazeny)',
        'multi.tubeConfig': 'Konfigurace GM trubic',
        'multi.tubeConfigVarious': 'různé – viz tabulka níže',
        'multi.fluence':    'Fluence zdroje',
        'multi.detailHeading': 'Detailní přehled souborů',
        'multi.col.num':    '#',
        'multi.col.file':   'Soubor',
        'multi.col.datetime':'Datum a čas',
        'multi.col.dist':   'Vzdálenost (m)',
        'multi.col.pulses': 'Počet pulsů',
        'multi.col.tubeConfig':'Konfigurace GM trubic',
        'multi.btnBatch':   '&#9654;&nbsp; Zpracovat hromadně ({n} souborů)',
        'multi.btnIndividual':'&#9654;&nbsp; Zpracovat každý soubor samostatně',

        /* ---- per-file sections ---- */
        'file.sectionTitle':'Soubor {i}: vzdálenost: {d}',
        'file.badgeProcessing':'zpracovávám\u2026',
        'file.loading':     '&#9203; Zpracovávám data souboru\u2026',
        'file.badgeNoResult':'&#10007; Bez výsledku',
        'file.errNoRawData':'&#9888; Soubor neobsahuje rawData.',
        'file.badgeMissingData':'&#10007; Chybí data',
        'file.step1heading':'Načtená data',
        'file.step3heading':'Proložení dvojitou exponenciálou',
        'file.col.file':    'Soubor',
        'file.col.datetime':'Datum a čas',
        'file.col.dist':    'Vzdálenost',
        'file.col.bg':      'Radiační pozadí',
        'file.col.totalPulses':'Celkem pulsů (rawData)',
        'file.col.snr':     'Pulsy za 1.\u202fmin exp. poklesu\u202f/\u202fpozadí',
        'file.bgFromYaml':  'ze souboru YAML',
        'file.bgManual':    'zadáno ručně',
        'file.bgFree':      'volný parametr fitu',
        'file.computing':   'počítám\u2026',
        'file.snrTooLow':   'příliš nízké!',
        'file.fitChartTitle':'Graf zvoleného proložení (bin\u202f=\u202f{b}\u202fs)',
        'file.fitCoeffHeading':'Kalibrační koeficienty (bin\u202f=\u202f{b}\u202fs)',
        'file.k1':          'k<sub>1</sub>\u202f(pulsů/s)',
        'file.k2':          'k<sub>2</sub>\u202f(pulsů/s)',
        'file.y0':          'y<sub>0</sub>\u202f(pulsů/s)',
        'file.y0Fixed':     '(fixní)',
        'file.k1Phi':       'k<sub>1</sub>/Φ\u202f(pulsů\u202fs/n)',
        'file.k2Phi':       'k<sub>2</sub>/Φ\u202f(pulsů\u202fs/n)',
        'file.uncertainty': 'nejistota {pct}\u202f%',
        'file.noFit':       'Nepodařilo se najít platné proložení (k₂\u202f>\u202f0).',
        'file.yamlExportHeading':'Export kalibrace pro user-settings.yaml',
        'file.methodDesc':  'Vážená lineární MNČ, t<sub>1</sub>\u202f=\u202f{T1}\u202fs, t<sub>2</sub>\u202f=\u202f{T2}\u202fs (oba fixní), {y0info}.',
        'file.y0FixedShort':'y₀\u202f=\u202f{v}\u202fpulsů/s (fixní)',
        'file.y0FreeShort': 'y₀\u202f=\u202fvolný parametr fitu',

        /* ---- Block 3 – final fit ---- */
        'final.heading':    'Souhrnné výsledky kalibrace',
        'final.errInsufficient':'&#9888; Nedostatek dat pro souhrnné proložení (potřeba ≥\u202f3 soubory s výsledky, dostupné: {n}).',
        'final.usedDataHeading':'Přehled použitých dat',
        'final.coeffHeading':'Výsledné kalibrační koeficienty – proložení k<sub>i</sub>(r)\u202f=\u202fA<sub>i</sub>\u202f/\u202f(r\u202f+\u202fr<sub>0i</sub>)²',
        'final.param':      'Parametr',
        'final.coeff.k1':   'Koeficient k<sub>1</sub>',
        'final.coeff.k2':   'Koeficient k<sub>2</sub>',
        'final.row.A':      'A\u202f(pulsů\u202fs\u202fm²/n)',
        'final.row.r0':     'r<sub>0</sub>\u202f(m)',
        'final.row.stats':  'Adj.\u202fR², Red.\u202fχ², p-hodnota, n',
        'final.fitsHeading':'Grafy proložení',
        'final.evalHeading':'Vyhodnocení proložení v bodech měření',
        'final.downloadHeading':'Stažení výsledků kalibrace',
        'final.downloadBtn':'&#11015;&nbsp; Stáhnout výsledky jako Excel (.xlsx)',
        'final.yamlHeading':'Export kalibrace pro user-settings.yaml',
        'final.uncNote':    '<strong>Výpočet nejistoty proložení:</strong>&ensp;σ²<sub>fit</sub>(r)\u202f=\u202f(∂k/∂A·σ<sub>A</sub>)²\u202f+\u202f(∂k/∂r<sub>0</sub>·σ<sub>r₀</sub>)²\u202f+\u202f2·Cov(A,\u202fr<sub>0</sub>)·(∂k/∂A)·(∂k/∂r<sub>0</sub>),\u202fkde\u202f∂k/∂A\u202f=\u202f1/(r+r<sub>0</sub>)²,\u202f∂k/∂r<sub>0</sub>\u202f=\u202f−2A/(r+r<sub>0</sub>)³.',

        /* ---- eval table ---- */
        'eval.col.r':       'r\u202f(m)',
        'eval.col.data':    'data\u202f±\u202fσ',
        'eval.col.fit':     'fit\u202f±\u202fσ',
        'eval.col.sigFit':  'σ<sub>fit</sub>\u202f(%)',
        'eval.col.dev':     'Odch.\u202f(%)',

        /* ---- summary table ---- */
        'summary.col.dist': 'Vzdálenost (m)',
        'summary.col.datetime':'Datum a čas',
        'summary.col.bg':   'Pozadí (pulsů/min)',
        'summary.col.snr':  'SNR',
        'summary.col.k2Phi':'k₂/Φ',
        'summary.col.dk2':  'δk₂/k₂',
        'summary.col.bin':  'Bin (s)',
        'summary.col.cut':  'Ořez (s)',
        'summary.col.method':'Výběr proložení',
        'summary.notProcessed':'Nezpracováno',
        'summary.method.recommended':'dle doporučení',
        'summary.method.minChi':'min\u202fχ²',
        'summary.method.minDk': 'min\u202fδk₂/k₂',
        'summary.method.manual':'ručně',

        /* ---- optimise cuts ---- */
        'opt.btn':          '&#9881;&nbsp;Optimalizovat ořezy',
        'opt.btnProcessing':'&#x29D7;&nbsp;Optimalizuji\u2026',
        'opt.note':         'Použít pouze tehdy, když si nejsme jisti relativními posuny mezi soubory\n            (např. při různé době skrývání zářiče).<br>\n            Koordinovaný sestup: testuje posuny od 0 do +5\u202fs od auto-ořezu,\n            optimalizuje metriku 3·χ²<sub>red</sub>(k₂)\u202f+\u202fχ²<sub>red</sub>(k₁).',
        'opt.col.dist':     'Vzdálenost (m)',
        'opt.col.autoCut':  'Auto-ořez (s)',
        'opt.col.finalCut': 'Výsledný ořez (s)',
        'opt.col.shift':    'Posun (s)',
        'opt.autoLabel':    '(auto:\u202f{a}\u202fs)',
        'opt.autoLabelPlus':'(auto:\u202f{a}\u202fs\u202f+\u202f{s}\u202fs\u202fopt.)',
        'opt.autoLabelMinus':'(auto:\u202f{a}\u202fs\u202f−\u202f{s}\u202fs\u202fopt.)',

        /* ---- final fit buttons ---- */
        'final.btnRun':     '&#9654;&nbsp; Spustit výsledné souhrnné proložení',
        'final.btnRunPartial':'&#9654;&nbsp; Spustit výsledné proložení (z dostupných souborů)',
        'final.warnPartial':'&#9888; Některé soubory nemají platný výsledek (k₂\u202f>\u202f0). Zkontrolujte per-file zpracování.',

        /* ---- final fit chart labels ---- */
        'chart.k1vsr':      'k₁/Φ vs.\u202fr',
        'chart.k2vsr':      'k₂/Φ vs.\u202fr',
        'chart.yLabelK1':   'k₁/Φ (pulsů\u202fs/n)',
        'chart.yLabelK2':   'k₂/Φ (pulsů\u202fs/n)',
        'chart.axisDistR':  'Vzdálenost r (m)',
        'chart.bandLabel':  '±3σ proložení',
        'chart.fitCurveGeom':'Fit: A\u202f/\u202f(r\u202f+\u202fr₀)²',
        'chart.measData':   'Naměřená data',
        'chart.noData':     'Nedostatek dat',

        /* ---- Excel export ---- */
        'excel.missingLib': 'Knihovna SheetJS (xlsx.min.js) není načtena. Umístěte soubor xlsx.min.js do složky js/.',
        'excel.noData':     'Nejsou dostupná data pro export.',
    },

    en: {
        /* ---- index.html ---- */
        'page.title':       'Processing calibration data for Silver Activation Counter (SAC) detector',
        'form.heading':     'Input parameters',
        'form.fileLabel':   'Select experiments:',
        'form.loadBtn':     '↺ Refresh list',
        'form.loadingList': '⟳ Loading list\u2026',
        'form.listLoaded':  '{n} experiments',
        'form.noExperiments': 'No experiments.',
        'form.loadError':   'Error loading',
        'form.selectedCount': '{n} selected',
        'form.fluenceLabel':'Neutron source fluence used for calibration (n/s):',
        'form.hideTimeLabel':'Neutron source hiding time (s):',
        'form.bgLabel':     'Radiation background (pulses/min):',
        'form.bgYaml':      'From YAML file (<code>backgroundPulsesPerMinute</code>)',
        'form.bgFree':      'Keep background parameter (y<sub>0</sub>) as free fit parameter',
        'form.bgManual':    'Enter manually:',
        'form.bgManualPlaceholder': 'pulses/min',
        'form.submitBtn':   '▶ Process data',
        'step1.heading':    'Step 1 – Loaded data',
        'step2.heading':    'Step 2 – Histograms',
        'step3.heading':    'Step 3 – Double exponential fit',
        'multi.heading':    'Multi-distance calibration – File overview',

        /* ---- buttons / status ---- */
        'btn.processing':   '⟳ Processing\u2026',
        'btn.submit':       '▶ Process data',
        'btn.loadingFiles': '⟳ Loading files\u2026',
        'err.noFile':       'Please select a data file.',
        'err.yamlParse':    'Error parsing YAML:',
        'err.fileRead':     'Cannot read file.',

        /* ---- background (y₀) ---- */
        'bg.freeParam':     'y₀ will be determined as a free fit parameter',
        'bg.missingYaml':   'N/A – backgroundPulsesPerMinute missing in YAML',
        'bg.fromYaml':      '(from YAML file)',
        'bg.manual':        '(entered manually)',
        'bg.unitPpm':       'pulses/min',

        /* ---- SNR ---- */
        'snr.pulsesBg':     '{n} pulses / {bg} background',
        'snr.ok':           '&#10003;&nbsp;OK',
        'snr.acceptable':   '&#9888;&nbsp;acceptable',
        'snr.tooLow':       '&#10007;&nbsp;too low!',

        /* ---- Step 1 – info table ---- */
        'step1.basicInfo':  'Basic information',
        'step1.datetime':   'Measurement date and time',
        'step1.datetimeUnknown': 'Cannot be determined from filename',
        'step1.filename':   'File name',
        'step1.detector':   'Detector',
        'step1.expDesc':    'Experiment description',
        'step1.distance':   'Detector distance from source',
        'step1.samplingTime':'Measurement duration',
        'step1.background': 'Radiation background',
        'step1.totalPulses':'Total pulse count (rawData)',
        'step1.snrRow':     'Pulses in 1st\u202fmin of exp.\u202fdecay\u202f/\u202fbackground',
        'step1.computing':  'computing\u2026',
        'step1.fluence':    'Neutron source fluence (entered)',
        'step1.tubes':      'GM tubes in detector',
        'step1.rawPreview': 'rawData preview – pulse timestamps (µs)',
        'step1.rawRange':   'Total {n} values. Time range: 0\u202f–\u202f{t}\u202fs',

        /* ---- Tubes table ---- */
        'tubes.empty':      'No tubes found.',
        'tubes.col.num':    '#',
        'tubes.col.id':     'ID',
        'tubes.col.type':   'Type',
        'tubes.col.material':'Material',
        'tubes.col.weight': 'Weight (g)',

        /* ---- Step 2 – histograms ---- */
        'step2.noRawData':  'rawData missing – cannot build histograms.',
        'step2.hist1sTitle':'Histogram (bin\u202f=\u202f1\u202fs) – original data',
        'step2.jumpDetect': 'Cut detection (hiding/switching off source)',
        'step2.jumpFoundTitle': 'Jump detected',
        'step2.jumpFoundPart1': 'data trimmed by',
        'step2.jumpFoundPart2': 's from start (detection via p-value, bin 2–3\u202fs).',
        'step2.jumpFoundPart3': 'New t\u202f=\u202f0 corresponds to',
        'step2.jumpFoundPart4': 's from measurement start.',
        'step2.noJump':     'No jump detected.',
        'step2.noJumpDesc': 'Measurement starts with exponential decay – data not trimmed.',
        'step2.cutLabel':   'Trim data from start:',
        'step2.cutUnit':    's',
        'step2.cutAuto':    '(auto:\u202f{t}\u202fs)',
        'step2.cutAutoNone':'(auto: no trim)',
        'step2.allHistTitle':'Histogram overview (bins 1–20\u202fs) – trimmed data, normalised to dN/dt',

        /* ---- Step 3 – fitting ---- */
        'step3.noHistograms':'Please process histograms first (Step 2).',
        'step3.methodDesc': 'Weighted linear least squares (<em>Weighted OLS</em>) with Poissonian weights\n        (w<sub>i</sub>\u202f=\u202fB/y<sub>i</sub>\u202f=\u202f1/Var(y<sub>i</sub>)).<br>\n        Solution is exact – no iteration.<br>\n        Function: <code>f(t)\u202f=\u202fk<sub>1</sub>·exp(−t/t<sub>1</sub>)\n              +\u202fk<sub>2</sub>·exp(−t/t<sub>2</sub>)\u202f+\u202fy<sub>0</sub></code>',
        'step3.methodFixed':'where t<sub>1</sub>\u202f=\u202f{T1}\u202fs,&ensp;t<sub>2</sub>\u202f=\u202f{T2}\u202fs &ensp;(both fixed, tabulated values)',
        'step3.y0Fixed':    'y<sub>0</sub>\u202f=\u202f{v}\u202fpulses/s (fixed – set as background {bg}\u202fpulses/min)',
        'step3.y0Free':     'y<sub>0</sub> = free fit parameter',
        'step3.tableTitle': 'Fit results for all histograms with varying bin size',
        'step3.selectorHeading': 'Fit selection',
        'step3.selectorDesc':'<strong>By recommendation</strong> (optimising k<sub>2</sub> precision):\n            selects fit with χ² p-value in acceptable range (0.05–0.95)\n            and smallest relative uncertainty δk<sub>2</sub>/k<sub>2</sub>;\n            if none acceptable, uses fit with χ²<sub>red</sub> closest to 1.',
        'step3.modeRecommended': 'Automatically: by recommendation',
        'step3.modeMinChi': 'Automatically: χ²<sub>red</sub> closest to 1',
        'step3.modeMinDk':  'Automatically: smallest δk₂/k₂',
        'step3.modeManual': 'Manual: bin size:',

        /* ---- Fit result – coefficient table ---- */
        'fit.chartTitle':   'Selected fit chart (bin\u202f=\u202f{b}\u202fs)',
        'fit.coeffHeading': 'Calibration coefficients (bin\u202f=\u202f{b}\u202fs)',
        'fit.k1':           'k<sub>1</sub>\u202f(pulses/s)',
        'fit.k2':           'k<sub>2</sub>\u202f(pulses/s)',
        'fit.y0':           'y<sub>0</sub>\u202f(pulses/s)',
        'fit.y0Fixed':      '(fixed – set as background)',
        'fit.uncertainty':  'uncertainty {pct}\u202f%',
        'fit.k1Phi':        'k<sub>1</sub>\u202f/\u202fΦ\u202f(pulses·s/n)',
        'fit.k2Phi':        'k<sub>2</sub>\u202f/\u202fΦ\u202f(pulses·s/n)',
        'fit.fluence':      'Φ, neutron source fluence (n/s)',

        /* ---- Fit table ---- */
        'fitTable.bin':     'Bin<br>(s)',
        'fitTable.adjR2':   'Adj.\u202fR²',
        'fitTable.redChi':  'Red.\u202fχ²',
        'fitTable.pVal':    'p-value',
        'fitTable.n':       'n',
        'fitTable.noData':  'Insufficient data or singular matrix',
        'fitTable.fixed':   'fixed',
        'fitTable.note':    'Highlighted row\u202f=\u202fselected option according to Fit selection (see below). Values k₁, k₂, y₀, δ… are in [pulses/s].',
        'fitTable.y0Fixed': 'y₀ is fixed (set as background) – not a free parameter.',
        'fitTable.y0Free':  'y₀ is a free fit parameter.',

        /* ---- YAML export ---- */
        'yaml.heading':     'Calibration export for user-settings.yaml',
        'yaml.distLabel':   'Calibration distance (m):',
        'yaml.distPlaceholder': 'e.g. 0.500',
        'yaml.typeLabel':   'Calibration type:',
        'yaml.typeAmBe':    'fissionAmBeNeutron (AmBe)',
        'yaml.typeDd':      'fusionDdNeutron (D-D generator)',
        'yaml.noteCoeff':   'Single-distance calibration\u202f→\u202f<strong>one coefficient</strong> per fitting:\n            <code>[k<sub>i</sub>/Φ]</code> and <code>[δk<sub>i</sub>/Φ]</code>.<br>\n            <code>distanceMinM = distanceMaxM</code> = entered calibration distance.',
        'yaml.noFit':       'Please select a valid fit first.',
        'yaml.copyBtn':     '&#128203;&ensp;Copy to clipboard',
        'yaml.copied':      '\u2713 Copied!',
        'yaml.copyFail':    'Copy failed – please select the text manually and press Ctrl+C.',
        'yaml.saveBtn':     '&#10003;&ensp;Save as new calibration',
        'yaml.saved':       '\u2713 Saved!',
        'yaml.saveFail':    'Save failed: ',

        /* ---- charts.js ---- */
        'chart.hist1sTitle':'Pulse count histogram – bin\u202f=\u202f1\u202fs (original data)',
        'chart.axisTime':   'Time (s)',
        'chart.axisDndt':   'dN/dt (pulses/s)',
        'chart.allHistTitle':'dN/dt histograms – bins 1–20\u202fs (trimmed data)',
        'chart.selected':   'Selected',
        'chart.bestFitTitle':'Selected fit – bin\u202f=\u202f{b}\u202fs',
        'chart.histDataset':'Histogram (bin\u202f=\u202f{b}\u202fs)',
        'chart.fitCurve':   'Fit: k₁·e⁻ᵗ/ᵀ¹ + k₂·e⁻ᵗ/ᵀ² + y₀',
        'chart.dkTitle':    'Relative uncertainty δk₂/k₂ vs. bin size',
        'chart.axisBinSize':'Bin size (s)',
        'chart.axisDkPct':  'δk₂/k₂ (%)',
        'chart.adjR2Title': 'Adj.\u202fR² vs. bin size',
        'chart.axisAdjR2':  'Adj.\u202fR²',
        'chart.chi2Title':  'Reduced χ²_red vs. bin size',
        'chart.axisChi2':   'χ²_red',
        'chart.pValTitle':  'p-value of χ² test vs. bin size',
        'chart.labelPVal':  'p-value',
        'chart.axisPVal':   'p-value',

        /* ---- multi-calib.js – loading & validation ---- */
        'multi.errReadFile':'Cannot read file: {name}',
        'multi.errTubeConfig':'Files have different GM tube configurations (tubeConfiguration). They cannot be processed together.',
        'multi.errMissingDist':'Files without defined distance (detectorDistanceM): {files}.',
        'multi.errDupDist': 'Duplicate distances: {vals}. Each distance must be unique.',
        'multi.warnMinFiles':'Batch processing requires at least {n} files (loaded: {m}). Files can be processed individually.',
        'multi.errLoading': 'Error loading files: {msg}',
        'multi.errHeader':  '&#9888; Errors loading data:',
        'multi.warnHeader': '&#9888; Warnings:',

        /* ---- multi-calib.js – summary UI ---- */
        'multi.summaryHeading': 'Summary information',
        'multi.fileCount':  'Number of loaded files',
        'multi.distances':  'Distances (sorted)',
        'multi.tubeConfig': 'GM tube configuration',
        'multi.tubeConfigVarious': 'various – see table below',
        'multi.fluence':    'Source fluence',
        'multi.detailHeading': 'Detailed file overview',
        'multi.col.num':    '#',
        'multi.col.file':   'File',
        'multi.col.datetime':'Date and time',
        'multi.col.dist':   'Distance (m)',
        'multi.col.pulses': 'Pulse count',
        'multi.col.tubeConfig':'GM tube configuration',
        'multi.btnBatch':   '&#9654;&nbsp; Process batch ({n} files)',
        'multi.btnIndividual':'&#9654;&nbsp; Process each file individually',

        /* ---- per-file sections ---- */
        'file.sectionTitle':'File {i}: distance: {d}',
        'file.badgeProcessing':'processing\u2026',
        'file.loading':     '&#9203; Processing file data\u2026',
        'file.badgeNoResult':'&#10007; No result',
        'file.errNoRawData':'&#9888; File contains no rawData.',
        'file.badgeMissingData':'&#10007; Data missing',
        'file.step1heading':'Loaded data',
        'file.step3heading':'Double exponential fit',
        'file.col.file':    'File',
        'file.col.datetime':'Date and time',
        'file.col.dist':    'Distance',
        'file.col.bg':      'Radiation background',
        'file.col.totalPulses':'Total pulses (rawData)',
        'file.col.snr':     'Pulses in 1st\u202fmin of exp.\u202fdecay\u202f/\u202fbackground',
        'file.bgFromYaml':  'from YAML file',
        'file.bgManual':    'entered manually',
        'file.bgFree':      'free fit parameter',
        'file.computing':   'computing\u2026',
        'file.snrTooLow':   'too low!',
        'file.fitChartTitle':'Selected fit chart (bin\u202f=\u202f{b}\u202fs)',
        'file.fitCoeffHeading':'Calibration coefficients (bin\u202f=\u202f{b}\u202fs)',
        'file.k1':          'k<sub>1</sub>\u202f(pulses/s)',
        'file.k2':          'k<sub>2</sub>\u202f(pulses/s)',
        'file.y0':          'y<sub>0</sub>\u202f(pulses/s)',
        'file.y0Fixed':     '(fixed)',
        'file.k1Phi':       'k<sub>1</sub>/Φ\u202f(pulses·s/n)',
        'file.k2Phi':       'k<sub>2</sub>/Φ\u202f(pulses·s/n)',
        'file.uncertainty': 'uncertainty {pct}\u202f%',
        'file.noFit':       'No valid fit found (k₂\u202f>\u202f0).',
        'file.yamlExportHeading':'Calibration export for user-settings.yaml',
        'file.methodDesc':  'Weighted linear LSQ, t<sub>1</sub>\u202f=\u202f{T1}\u202fs, t<sub>2</sub>\u202f=\u202f{T2}\u202fs (both fixed), {y0info}.',
        'file.y0FixedShort':'y₀\u202f=\u202f{v}\u202fpulses/s (fixed)',
        'file.y0FreeShort': 'y₀\u202f=\u202ffree fit parameter',

        /* ---- Block 3 – final fit ---- */
        'final.heading':    'Summary calibration results',
        'final.errInsufficient':'&#9888; Insufficient data for summary fit (need ≥\u202f3 files with results, available: {n}).',
        'final.usedDataHeading':'Overview of used data',
        'final.coeffHeading':'Resulting calibration coefficients – fit k<sub>i</sub>(r)\u202f=\u202fA<sub>i</sub>\u202f/\u202f(r\u202f+\u202fr<sub>0i</sub>)²',
        'final.param':      'Parameter',
        'final.coeff.k1':   'Coefficient k<sub>1</sub>',
        'final.coeff.k2':   'Coefficient k<sub>2</sub>',
        'final.row.A':      'A\u202f(pulses·s·m²/n)',
        'final.row.r0':     'r<sub>0</sub>\u202f(m)',
        'final.row.stats':  'Adj.\u202fR², Red.\u202fχ², p-value, n',
        'final.fitsHeading':'Fit charts',
        'final.evalHeading':'Fit evaluation at measurement points',
        'final.downloadHeading':'Download calibration results',
        'final.downloadBtn':'&#11015;&nbsp; Download results as Excel (.xlsx)',
        'final.yamlHeading':'Calibration export for user-settings.yaml',
        'final.uncNote':    '<strong>Fit uncertainty calculation:</strong>&ensp;σ²<sub>fit</sub>(r)\u202f=\u202f(∂k/∂A·σ<sub>A</sub>)²\u202f+\u202f(∂k/∂r<sub>0</sub>·σ<sub>r₀</sub>)²\u202f+\u202f2·Cov(A,\u202fr<sub>0</sub>)·(∂k/∂A)·(∂k/∂r<sub>0</sub>),\u202fwhere\u202f∂k/∂A\u202f=\u202f1/(r+r<sub>0</sub>)²,\u202f∂k/∂r<sub>0</sub>\u202f=\u202f−2A/(r+r<sub>0</sub>)³.',

        /* ---- eval table ---- */
        'eval.col.r':       'r\u202f(m)',
        'eval.col.data':    'data\u202f±\u202fσ',
        'eval.col.fit':     'fit\u202f±\u202fσ',
        'eval.col.sigFit':  'σ<sub>fit</sub>\u202f(%)',
        'eval.col.dev':     'Dev.\u202f(%)',

        /* ---- summary table ---- */
        'summary.col.dist': 'Distance (m)',
        'summary.col.datetime':'Date and time',
        'summary.col.bg':   'Background (pulses/min)',
        'summary.col.snr':  'SNR',
        'summary.col.k2Phi':'k₂/Φ',
        'summary.col.dk2':  'δk₂/k₂',
        'summary.col.bin':  'Bin (s)',
        'summary.col.cut':  'Trim (s)',
        'summary.col.method':'Fit selection',
        'summary.notProcessed':'Not processed',
        'summary.method.recommended':'by recommendation',
        'summary.method.minChi':'min\u202fχ²',
        'summary.method.minDk': 'min\u202fδk₂/k₂',
        'summary.method.manual':'manual',

        /* ---- optimise cuts ---- */
        'opt.btn':          '&#9881;&nbsp;Optimise cuts',
        'opt.btnProcessing':'&#x29D7;&nbsp;Optimising\u2026',
        'opt.note':         'Use only when relative offsets between files are uncertain\n            (e.g., due to varying source-hiding duration).<br>\n            Coordinated descent: tests shifts 0 to +5\u202fs from auto-cut,\n            optimises metric 3·χ²<sub>red</sub>(k₂)\u202f+\u202fχ²<sub>red</sub>(k₁).',
        'opt.col.dist':     'Distance (m)',
        'opt.col.autoCut':  'Auto-cut (s)',
        'opt.col.finalCut': 'Final cut (s)',
        'opt.col.shift':    'Shift (s)',
        'opt.autoLabel':    '(auto:\u202f{a}\u202fs)',
        'opt.autoLabelPlus':'(auto:\u202f{a}\u202fs\u202f+\u202f{s}\u202fs opt.)',
        'opt.autoLabelMinus':'(auto:\u202f{a}\u202fs\u202f−\u202f{s}\u202fs opt.)',

        /* ---- final fit buttons ---- */
        'final.btnRun':     '&#9654;&nbsp; Run final summary fit',
        'final.btnRunPartial':'&#9654;&nbsp; Run final fit (from available files)',
        'final.warnPartial':'&#9888; Some files have no valid result (k₂\u202f>\u202f0). Check per-file processing.',

        /* ---- final fit chart labels ---- */
        'chart.k1vsr':      'k₁/Φ vs.\u202fr',
        'chart.k2vsr':      'k₂/Φ vs.\u202fr',
        'chart.yLabelK1':   'k₁/Φ (pulses·s/n)',
        'chart.yLabelK2':   'k₂/Φ (pulses·s/n)',
        'chart.axisDistR':  'Distance r (m)',
        'chart.bandLabel':  '±3σ fit',
        'chart.fitCurveGeom':'Fit: A\u202f/\u202f(r\u202f+\u202fr₀)²',
        'chart.measData':   'Measured data',
        'chart.noData':     'Insufficient data',

        /* ---- Excel export ---- */
        'excel.missingLib': 'SheetJS library (xlsx.min.js) is not loaded. Place the xlsx.min.js file in the js/ folder.',
        'excel.noData':     'No data available for export.',
    },
};

/* ---------- Runtime state ---------- */

let currentLang = localStorage.getItem('sac-lang') ?? 'en';

/* ---------- Core functions ---------- */

/**
 * Returns the translated string for the given key.
 * {param} placeholders are replaced with values from the params object.
 * Falls back to Czech if key is missing in the selected language.
 */
function t(key, params = {}) {
    let s = translations[currentLang]?.[key] ?? translations.cs[key] ?? key;
    for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
}

/**
 * Sets the active language, persists it, and updates the UI.
 * @param {'cs'|'en'} lang
 */
function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('sac-lang', lang);
    applyTranslations();
}

/**
 * Updates all translated elements in the DOM and re-renders dynamic sections.
 * Called by setLang() and once on DOMContentLoaded.
 */
function applyTranslations() {
    /* <html lang> attribute */
    document.documentElement.lang = currentLang;

    /* Toggle button: shows the opposite language */
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = currentLang === 'cs' ? 'EN' : 'CZ';

    /* Static elements: data-i18n → textContent, data-i18n-html → innerHTML */
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });
    /* Placeholder attributes */
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    /* Re-render dynamic sections (defined in app.js, loaded after i18n.js) */
    if (typeof onLangChange === 'function') onLangChange();
}

/* Apply translations once the DOM is ready */
document.addEventListener('DOMContentLoaded', applyTranslations);
