export const DASHBOARD_HTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Athlete Intelligence</title>
  <link rel="stylesheet" href="/dashboard.css">
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">A</span>
        <div><strong>Athlete Intelligence</strong><span>Training dashboard</span></div>
      </div>
      <div class="toolbar">
        <label for="history">Historique</label>
        <select id="history"><option value="14">14 jours</option><option value="28">28 jours</option><option value="42" selected>42 jours</option></select>
        <button id="refresh" type="button">Actualiser</button>
      </div>
    </header>

    <main>
      <section class="hero">
        <div><p class="eyebrow">Vue consolidée</p><h1>Comprendre la charge.<br><em>Préserver la progression.</em></h1></div>
        <div class="status"><span id="statusDot"></span><div><strong id="statusText">Chargement…</strong><small id="freshness">Connexion aux données</small></div></div>
      </section>

      <div id="error" class="error" hidden></div>

      <section class="kpis" aria-label="Indicateurs principaux">
        <article class="kpi accent"><span>Charge · 7 jours <button class="metric-info" type="button" aria-label="Définition de la charge sur sept jours" data-tip="Somme des charges d’entraînement calculées par Intervals.icu sur les sept derniers jours.">i</button></span><strong id="weeklyLoad">—</strong><small id="weeklyLoadDelta">En attente</small></article>
        <article class="kpi"><span>Charge chronique <button class="metric-info" type="button" aria-label="Définition de la charge chronique" data-tip="Évolution du CTL sur la période sélectionnée. Le CTL est une moyenne exponentielle lente des charges, généralement sur environ 42 jours ; ce n’est pas une note sur 100.">i</button></span><strong id="fitness">—</strong><small id="fitnessDelta">Tendance du CTL</small></article>
        <article class="kpi"><span>Fatigue · ATL <button class="metric-info" type="button" aria-label="Définition de la fatigue ATL" data-tip="Charge aiguë : moyenne exponentielle rapide des charges récentes, généralement sur environ 7 jours.">i</button></span><strong id="fatigue">—</strong><small id="fatigueDelta">Charge aiguë</small></article>
        <article class="kpi"><span>Forme · TSB <button class="metric-info" type="button" aria-label="Définition de la forme TSB" data-tip="Différence fitness moins fatigue. Une valeur plus élevée indique mathématiquement davantage de fraîcheur, sans constituer un diagnostic.">i</button></span><strong id="form">—</strong><small id="loadRatio">Fitness − fatigue</small></article>
      </section>

      <section class="panel chart-panel">
        <div class="panel-head"><div><p class="eyebrow">Dynamique de charge</p><h2>Fitness, fatigue et forme</h2></div><div class="chart-legend"><span class="fitness-key">Fitness</span><span class="fatigue-key">Fatigue</span><span class="form-key">Forme / récupération</span></div></div>
        <div id="loadChartEmpty" class="empty" hidden>Historique de charge insuffisant.</div>
        <svg id="loadChart" class="load-chart" viewBox="0 0 1100 270" role="img" aria-label="Évolution quotidienne de la fitness, de la fatigue et de la forme"></svg>
        <p class="chart-note">La forme correspond à fitness − fatigue. C’est un indicateur mathématique de fraîcheur, pas un score médical de récupération.</p>
      </section>

      <section class="panel advanced-panel">
        <div class="panel-head"><div><p class="eyebrow">Physiologie & performance</p><h2>Métriques avancées</h2></div><span class="pill">Selon disponibilité Intervals.icu</span></div>
        <div id="advancedMetrics" class="advanced-grid"></div>
      </section>

      <section class="grid main-grid">
        <article class="panel span-2">
          <div class="panel-head"><div><p class="eyebrow">Progression</p><h2>7 derniers jours vs précédents</h2></div><span class="pill" id="comparisonBadge">—</span></div>
          <div id="comparison" class="comparison"></div>
          <div><p class="mini-title">Tendance hebdomadaire</p><div id="weeklyTrend" class="weekly-trend"></div></div>
        </article>
        <article class="panel quality-panel">
          <div class="panel-head"><div><p class="eyebrow">Fiabilité</p><h2>Qualité des données</h2></div></div>
          <div class="quality-wrap"><div id="qualityRing" class="quality-ring"><strong id="qualityScore">—</strong><span>couverture</span></div></div>
          <div id="qualityDetails" class="quality-details"></div>
        </article>
      </section>

      <section class="grid lower-grid">
        <article class="panel">
          <div class="panel-head"><div><p class="eyebrow">Récupération</p><h2>Signaux physiologiques</h2></div></div>
          <div id="recovery" class="recovery-grid"></div>
          <div id="signals" class="signals"></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><p class="eyebrow">Répartition</p><h2>Mix sportif</h2></div><span class="pill" id="sessionsRate">—</span></div>
          <div id="sportMix" class="sport-mix"></div>
        </article>
      </section>

      <section class="grid lower-grid">
        <article class="panel">
          <div class="panel-head"><div><p class="eyebrow">Activité</p><h2>Dernières séances</h2></div><span class="pill" id="activeDays">—</span></div>
          <div class="table-wrap"><table><thead><tr><th>Date</th><th>Sport</th><th>Durée</th><th>Charge</th><th>Intensité</th></tr></thead><tbody id="activities"></tbody></table></div>
        </article>
        <article class="panel">
          <div class="panel-head"><div><p class="eyebrow">À venir</p><h2>Calendrier</h2></div></div>
          <div id="calendar" class="calendar"></div>
        </article>
      </section>
    </main>
    <footer>Données factuelles d’entraînement · Aucun diagnostic médical · <a href="/mcp">MCP endpoint</a></footer>
  </div>
  <script src="/dashboard.js" defer></script>
</body>
</html>`;

export const DASHBOARD_CSS = `
:root{--bg:#0b0e0d;--surface:#121715;--surface2:#181e1b;--line:#29312d;--text:#f2f5f3;--muted:#8f9b95;--lime:#b8f34a;--green:#43d39e;--orange:#ff9d5c;--red:#ff6b6b;--blue:#69a7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 85% 0,#1b2b1e 0,transparent 30%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1480px;margin:auto;padding:0 32px}.topbar{height:84px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:13px}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--lime);color:#10140f;font-weight:900;font-size:20px;transform:rotate(-5deg)}.brand div{display:flex;flex-direction:column}.brand strong{font-size:15px;letter-spacing:.01em}.brand span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.13em;margin-top:2px}.toolbar{display:flex;align-items:center;gap:10px}.toolbar label{color:var(--muted);font-size:12px}.toolbar select,.toolbar button{height:38px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);padding:0 13px}.toolbar button{background:var(--lime);color:#11160f;border-color:var(--lime);font-weight:750;cursor:pointer}.toolbar button:disabled{opacity:.55;cursor:wait}.hero{display:flex;align-items:end;justify-content:space-between;padding:56px 0 38px}.eyebrow{margin:0 0 9px;color:var(--lime);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.19em}.hero h1{font-size:clamp(35px,5vw,64px);line-height:.98;letter-spacing:-.055em;margin:0;font-weight:760}.hero h1 em{font-style:normal;color:var(--muted);font-weight:500}.status{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);padding:12px 15px;border-radius:12px;min-width:210px}.status>span{width:9px;height:9px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 4px #ff9d5c18}.status div{display:flex;flex-direction:column}.status strong{font-size:12px}.status small{font-size:10px;color:var(--muted);margin-top:2px}.error{background:#341a1a;border:1px solid #713434;color:#ffb3b3;border-radius:12px;padding:14px 16px;margin-bottom:20px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}.kpi{min-height:152px;padding:22px;border:1px solid var(--line);background:linear-gradient(145deg,var(--surface2),var(--surface));border-radius:16px;display:flex;flex-direction:column}.kpi.accent{background:var(--lime);color:#12160f;border-color:var(--lime)}.kpi>span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:750}.kpi.accent>span,.kpi.accent small{color:#344224}.kpi strong{font-size:48px;line-height:1;margin:auto 0 8px;letter-spacing:-.05em}.kpi small{color:var(--muted);font-size:11px}.positive{color:var(--green)!important}.negative{color:var(--red)!important}.grid{display:grid;gap:12px;margin-bottom:12px}.main-grid{grid-template-columns:2fr 1fr}.lower-grid{grid-template-columns:1.35fr 1fr}.panel{border:1px solid var(--line);background:linear-gradient(145deg,var(--surface),#101412);border-radius:16px;padding:22px;min-width:0}.panel-head{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:22px}.panel h2{font-size:18px;margin:0;letter-spacing:-.02em}.pill{border:1px solid var(--line);border-radius:99px;padding:6px 9px;color:var(--muted);font-size:10px;white-space:nowrap}.comparison{display:grid;gap:18px}.comparison-row{display:grid;grid-template-columns:120px 1fr 70px;align-items:center;gap:14px}.comparison-label strong{display:block;font-size:12px}.comparison-label span{font-size:10px;color:var(--muted)}.bars{display:grid;gap:5px}.bar-track{height:8px;background:#252c29;border-radius:9px;overflow:hidden}.bar{height:100%;border-radius:9px;min-width:2px}.bar.current{background:var(--lime)}.bar.previous{background:#59635e}.delta{text-align:right;font-size:12px;font-weight:700}.quality-wrap{display:grid;place-items:center;padding:3px 0 20px}.quality-ring{--score:0;position:relative;width:145px;height:145px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--lime) calc(var(--score)*1%),#28302c 0)}.quality-ring:after{content:"";position:absolute;inset:10px;border-radius:50%;background:var(--surface)}.quality-ring strong,.quality-ring span{z-index:1;position:absolute}.quality-ring strong{font-size:36px;letter-spacing:-.05em;transform:translateY(-8px)}.quality-ring span{font-size:10px;color:var(--muted);transform:translateY(20px)}.quality-details{display:grid;gap:8px}.quality-line{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}.quality-line strong{color:var(--text)}.recovery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.recovery-item{padding:15px;background:var(--surface2);border:1px solid var(--line);border-radius:12px}.recovery-item span{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.recovery-item strong{display:block;font-size:25px;margin:8px 0 5px}.trend{font-size:10px}.signals{margin-top:14px;display:grid;gap:6px}.signal{font-size:11px;color:#ffc2a2;padding:9px 11px;background:#ff9d5c10;border-left:2px solid var(--orange)}.empty{color:var(--muted);font-size:12px;padding:18px 0}.sport-mix{display:grid;gap:15px}.sport-row-head{display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px}.sport-row-head span:last-child{color:var(--muted)}.sport-track{height:6px;background:#252c29;border-radius:9px;overflow:hidden}.sport-bar{height:100%;background:linear-gradient(90deg,var(--lime),var(--green));border-radius:9px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:11px}th{text-align:left;color:var(--muted);font-weight:600;padding:0 10px 10px 0}td{padding:11px 10px 11px 0;border-top:1px solid var(--line);white-space:nowrap}.sport-name{text-transform:capitalize}.calendar{display:grid;gap:9px}.event{display:grid;grid-template-columns:54px 1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2)}.event-date{text-align:center;border-right:1px solid var(--line);padding-right:12px}.event-date strong{display:block;font-size:17px}.event-date span{font-size:9px;color:var(--muted);text-transform:uppercase}.event-main strong{font-size:12px;text-transform:capitalize}.event-main span{display:block;font-size:10px;color:var(--muted);margin-top:3px}.event-load{font-size:11px;color:var(--lime)}footer{display:flex;justify-content:space-between;color:var(--muted);font-size:10px;padding:22px 0 30px}footer a{color:var(--lime)}@media(max-width:900px){.shell{padding:0 18px}.hero{align-items:start;gap:25px;flex-direction:column}.kpis{grid-template-columns:repeat(2,1fr)}.main-grid,.lower-grid{grid-template-columns:1fr}.toolbar label{display:none}}@media(max-width:560px){.topbar{height:auto;padding:15px 0;align-items:flex-start;gap:15px}.toolbar{flex-wrap:wrap;justify-content:flex-end}.brand span{display:none}.hero{padding:38px 0 28px}.kpis{grid-template-columns:1fr 1fr}.kpi{min-height:125px;padding:16px}.kpi strong{font-size:36px}.panel{padding:17px}.comparison-row{grid-template-columns:88px 1fr 54px}.recovery-grid{grid-template-columns:1fr}footer{display:block;line-height:1.7}}
`;

export const DASHBOARD_CSS_EXTRA = `
.metric-info{position:relative;display:inline-grid;place-items:center;width:16px;height:16px;margin-left:4px;padding:0;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;font:700 10px/1 ui-sans-serif,system-ui;cursor:help;vertical-align:middle;opacity:.72}.metric-info:hover,.metric-info:focus-visible{opacity:1;outline:2px solid var(--lime);outline-offset:2px}.metric-info:after{content:attr(data-tip);position:absolute;z-index:30;left:50%;bottom:calc(100% + 9px);width:245px;padding:10px 11px;border:1px solid var(--line);border-radius:9px;background:#202724;color:var(--text);font:500 11px/1.4 ui-sans-serif,system-ui;text-align:left;text-transform:none;letter-spacing:0;box-shadow:0 10px 30px #0008;transform:translate(-50%,5px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s,transform .15s}.metric-info:hover:after,.metric-info:focus-visible:after{opacity:1;visibility:visible;transform:translate(-50%,0)}.kpi:first-child .metric-info:after{left:0;transform:translate(0,5px)}.kpi:first-child .metric-info:hover:after,.kpi:first-child .metric-info:focus-visible:after{transform:translate(0,0)}@media(max-width:560px){.metric-info:after{position:fixed;left:16px;right:16px;bottom:16px;width:auto;transform:translateY(5px)!important}.metric-info:hover:after,.metric-info:focus-visible:after{transform:none!important}}
.chart-panel{margin-bottom:12px}.chart-legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:10px}.chart-legend span:before{content:"";display:inline-block;width:18px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}.fitness-key:before{background:var(--lime)}.fatigue-key:before{background:var(--orange)}.form-key:before{background:var(--blue)}.load-chart{display:block;width:100%;height:auto;min-height:220px;overflow:visible}.chart-note{margin:8px 0 0;color:var(--muted);font-size:9px}.chart-grid{stroke:#29312d;stroke-width:1}.chart-zero{stroke:#59635e;stroke-width:1.5}.chart-axis-label{fill:#7e8984;font-size:9px}.chart-line{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.chart-dot{stroke:#111613;stroke-width:3}@media(max-width:700px){.chart-legend{gap:9px}.load-chart{min-height:175px}.chart-panel .panel-head{display:block}.chart-legend{margin-top:12px}}
.advanced-panel{margin-bottom:12px}.advanced-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.advanced-card{min-height:108px;padding:15px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);display:flex;flex-direction:column}.advanced-card>span{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.09em}.advanced-card strong{font-size:27px;letter-spacing:-.03em;margin:auto 0 5px}.advanced-card small{color:var(--muted);font-size:9px;line-height:1.35}@media(max-width:950px){.advanced-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:560px){.advanced-grid{grid-template-columns:repeat(2,1fr)}}
.mini-title{margin:25px 0 10px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em}
.weekly-trend{height:110px;display:flex;align-items:end;gap:8px;border-bottom:1px solid var(--line);padding:0 5px}
.week-column{height:100%;flex:1;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:5px}
.week-column strong{font-size:9px;color:var(--muted)}
.week-bar{width:min(36px,70%);min-height:2px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--lime),#5e852a)}
.week-column span{font-size:8px;color:var(--muted);height:14px}
`;

export const DASHBOARD_JS = `
(function(){
  var byId=function(id){return document.getElementById(id)};
  var history=byId('history');
  var refresh=byId('refresh');
  var nf=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  function escapeHtml(text){return String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
  function info(label,tip){return '<button class="metric-info" type="button" aria-label="Définition de '+label+'" data-tip="'+tip+'">i</button>'}
  function value(v,suffix){return v===undefined||v===null?'—':nf.format(v)+(suffix||'')}
  function percent(v){return v===undefined||v===null?'—':(v>0?'+':'')+nf.format(v)+' %'}
  function trendLabel(v){return v==='improving'?'En amélioration':v==='declining'?'En baisse':v==='stable'?'Stable':'Indéterminé'}
  function trendClass(v){return v==='improving'?'positive':v==='declining'?'negative':''}
  function setDelta(id,v,label){var el=byId(id);el.textContent=v===undefined?label:percent(v)+' vs 7 j préc.';el.className=v>0?'positive':v<0?'negative':''}
  function setPointChange(id,v,label){var el=byId(id);el.textContent=v===undefined?label:(v>0?'+':'')+value(v)+' pts vs 7 j préc.';el.className=''}
  function fitnessProgress(loadDynamics){
    var history=loadDynamics&&loadDynamics.history||[];if(history.length<2)return undefined;var first=history[0].fitness;var last=history[history.length-1].fitness;if(!first)return undefined;return ((last-first)/Math.abs(first))*100
  }
  function comparisonRow(label,unit,current,previous,delta,tip){
    var max=Math.max(current||0,previous||0,1);var cw=Math.round((current||0)/max*100);var pw=Math.round((previous||0)/max*100);
    return '<div class="comparison-row"><div class="comparison-label"><strong>'+label+' '+info(label,tip)+'</strong><span>'+value(current,unit)+' / '+value(previous,unit)+'</span></div><div class="bars"><div class="bar-track"><div class="bar current" style="width:'+cw+'%"></div></div><div class="bar-track"><div class="bar previous" style="width:'+pw+'%"></div></div></div><div class="delta '+(delta>0?'positive':delta<0?'negative':'')+'">'+percent(delta)+'</div></div>'
  }
  function renderWeeklyTrend(weeks){
    var max=Math.max.apply(null,weeks.map(function(week){return week.trainingLoad||0}).concat([1]));
    byId('weeklyTrend').innerHTML=weeks.map(function(week){var load=week.trainingLoad||0;var height=Math.max(2,Math.round(load/max*82));var label=week.period.endDate.slice(5);return '<div class="week-column"><strong>'+value(week.trainingLoad)+'</strong><div class="week-bar" style="height:'+height+'px"></div><span>'+label+'</span></div>'}).join('')||'<p class="empty">Historique insuffisant</p>';
  }
  function renderLoadChart(points){
    var svg=byId('loadChart');var empty=byId('loadChartEmpty');
    if(!points||points.length<2){svg.innerHTML='';svg.hidden=true;empty.hidden=false;return}
    svg.hidden=false;empty.hidden=true;
    var width=1100,height=270,left=44,right=18,top=18,bottom=34;var plotWidth=width-left-right,plotHeight=height-top-bottom;
    var all=[];points.forEach(function(p){all.push(p.fitness,p.fatigue,p.form)});var min=Math.floor(Math.min.apply(null,all.concat([0]))-2);var max=Math.ceil(Math.max.apply(null,all.concat([0]))+2);if(max===min)max=min+1;
    function x(i){return left+(points.length===1?0:(i/(points.length-1))*plotWidth)}
    function y(v){return top+((max-v)/(max-min))*plotHeight}
    function path(key){return points.map(function(p,i){return(i?'L':'M')+x(i).toFixed(1)+' '+y(p[key]).toFixed(1)}).join(' ')}
    var html='';
    for(var i=0;i<=4;i++){var val=max-((max-min)*i/4);var yy=y(val);html+='<line class="chart-grid" x1="'+left+'" y1="'+yy+'" x2="'+(width-right)+'" y2="'+yy+'"></line><text class="chart-axis-label" x="'+(left-8)+'" y="'+(yy+3)+'" text-anchor="end">'+nf.format(val)+'</text>'}
    if(min<0&&max>0)html+='<line class="chart-zero" x1="'+left+'" y1="'+y(0)+'" x2="'+(width-right)+'" y2="'+y(0)+'"></line>';
    var labelIndexes=[0,Math.floor((points.length-1)/2),points.length-1].filter(function(v,i,a){return a.indexOf(v)===i});labelIndexes.forEach(function(index){html+='<text class="chart-axis-label" x="'+x(index)+'" y="'+(height-8)+'" text-anchor="middle">'+points[index].date.slice(5)+'</text>'});
    html+='<path class="chart-line" stroke="#b8f34a" d="'+path('fitness')+'"></path><path class="chart-line" stroke="#ff9d5c" d="'+path('fatigue')+'"></path><path class="chart-line" stroke="#69a7ff" d="'+path('form')+'"></path>';
    var last=points.length-1;[['fitness','#b8f34a'],['fatigue','#ff9d5c'],['form','#69a7ff']].forEach(function(series){html+='<circle class="chart-dot" fill="'+series[1]+'" cx="'+x(last)+'" cy="'+y(points[last][series[0]])+'" r="5"></circle>'});svg.innerHTML=html;
  }
  function advancedCard(label,metric,detail,tip){return '<div class="advanced-card"><span>'+label+' '+info(label,tip)+'</span><strong>'+metric+'</strong><small>'+detail+'</small></div>'}
  function renderAdvanced(data){
    var aerobic=data.recovery.aerobicFitness&&data.recovery.aerobicFitness.vo2Max;var advanced=data.activities.advancedMetrics||{};var quality=data.activities.dataQuality;var current=data.performance.rolling7Days.current;
    var vo2Detail=aerobic?(aerobic.latestDate+' · '+Math.round(data.recovery.dataQuality.vo2MaxCoverage*100)+'% de jours couverts'):'Non transmis par la source';
    var ftp=advanced.latestModeledFtp;var ftpDetail=ftp?(ftp.sport.replaceAll('_',' ')+' · '+ftp.date+' · '+Math.round(quality.modeledFtpCoverage*100)+'% des séances'):'Aucun modèle disponible';
    var efficiencyAvailable=advanced.averageEfficiencyFactor!==undefined&&quality.efficiencyFactorCoverage>=0.2;
    byId('advancedMetrics').innerHTML=[advancedCard('VO₂ max',value(aerobic&&aerobic.latest,' ml/kg/min'),vo2Detail,'Estimation du volume maximal d’oxygène utilisable par kilogramme et par minute, transmise par Garmin via Intervals.icu.'),advancedCard('FTP modélisée',value(ftp&&ftp.watts,' W'),ftpDetail,'Estimation de la puissance soutenable environ une heure. Elle dépend des efforts enregistrés et ne remplace pas un test dédié.'),advancedCard('TRIMP · 7 jours',value(current.trimp),Math.round(quality.trimpCoverage*100)+'% des séances couvertes','Training Impulse : charge interne calculée à partir de la durée et de la fréquence cardiaque.'),advancedCard('Charge FC · 7 jours',value(current.heartRateLoad),Math.round(quality.heartRateLoadCoverage*100)+'% des séances couvertes','Charge normalisée par Intervals.icu à partir de la réponse cardiaque de chaque activité.'),advancedCard('Efficacité puissance / FC',efficiencyAvailable?value(advanced.averageEfficiencyFactor):'—',efficiencyAvailable?'Moyenne sur la période':'Couverture insuffisante · '+Math.round(quality.efficiencyFactorCoverage*100)+'%','Rapport entre production mécanique et réponse cardiaque. Il est surtout pertinent à intensité et conditions comparables.')].join('');
  }
  function render(data){
    var perf=data.performance;var rolling=perf.rolling7Days;var load=data.recovery.loadDynamics&&data.recovery.loadDynamics.current;var change=data.recovery.loadDynamics&&data.recovery.loadDynamics.change7Days;
    renderWeeklyTrend(perf.weeklyTrend||[]);
    renderLoadChart(data.recovery.loadDynamics&&data.recovery.loadDynamics.history||[]);
    renderAdvanced(data);
    byId('weeklyLoad').textContent=value(rolling.current.trainingLoad);setDelta('weeklyLoadDelta',rolling.changePercent&&rolling.changePercent.trainingLoadPercent,'Comparaison indisponible');
    var fitnessChange=fitnessProgress(data.recovery.loadDynamics);byId('fitness').textContent=fitnessChange===undefined?'—':percent(fitnessChange);byId('fitness').className=fitnessChange>0?'positive':fitnessChange<0?'negative':'';byId('fitnessDelta').textContent=load?'CTL actuel '+value(load.fitness)+(change?' · '+(change.fitness>0?'+':'')+value(change.fitness)+' pts / 7 j':''):'CTL indisponible';byId('fitnessDelta').className='';
    byId('fatigue').textContent=value(load&&load.fatigue);setPointChange('fatigueDelta',change&&change.fatigue,'Charge aiguë');
    byId('form').textContent=value(load&&load.form);byId('loadRatio').textContent=load&&load.acuteToChronicRatio!==undefined?'Ratio aiguë/chronique '+value(load.acuteToChronicRatio):'Fitness − fatigue';
    var p=rolling.previous;var c=rolling.changePercent||{};byId('comparisonBadge').textContent=p?'Actuel / précédent':'14 jours requis';
    byId('comparison').innerHTML=p?[comparisonRow('Durée',' min',rolling.current.durationMinutes,p.durationMinutes,c.durationPercent,'Temps cumulé des activités sur chaque période de sept jours.'),comparisonRow('Charge','',rolling.current.trainingLoad,p.trainingLoad,c.trainingLoadPercent,'Somme des charges Intervals.icu des activités sur la semaine.'),comparisonRow('Distance',' m',rolling.current.distanceMeters,p.distanceMeters,c.distancePercent,'Distance totale enregistrée, tous sports compatibles confondus.'),comparisonRow('Dénivelé',' m',rolling.current.elevationGainMeters,p.elevationGainMeters,c.elevationPercent,'Cumul du dénivelé positif enregistré sur la période.')].join(''):'<p class="empty">Sélectionnez au moins 14 jours pour comparer deux semaines.</p>';
    var score=Math.round(data.dataQuality.score*100);byId('qualityScore').textContent=score+'%';byId('qualityRing').style.setProperty('--score',score);
    var q=data.recovery.dataQuality;byId('qualityDetails').innerHTML=[['Sommeil',q.sleepCoverage],['Fréquence au repos',q.restingHeartRateCoverage],['VFC',q.hrvCoverage],['Modèle de charge',q.loadDynamicsCoverage],['Charge activités',data.activities.dataQuality.trainingLoadCoverage]].map(function(x){return '<div class="quality-line"><span>'+x[0]+'</span><strong>'+Math.round(x[1]*100)+'%</strong></div>'}).join('');
    var rec=data.recovery;var items=[['Sommeil',value(rec.sleep.averageDurationMinutes,' min'),trendLabel(rec.sleep.trend),trendClass(rec.sleep.trend),'Durée moyenne de sommeil sur la période sélectionnée.'],['VFC',value(rec.hrv.average,' ms'),trendLabel(rec.hrv.trend),trendClass(rec.hrv.trend),'Variabilité de la fréquence cardiaque. La tendance est comparée à la fenêtre précédente de même durée.'],['FC au repos',value(rec.restingHeartRate.average,' bpm'),trendLabel(rec.restingHeartRate.trend),trendClass(rec.restingHeartRate.trend),'Fréquence cardiaque moyenne au repos, comparée à la période précédente.']];if(rec.todayCheckIn&&rec.todayCheckIn.fatigue!==undefined)items.unshift(['Fatigue ressentie',value(rec.todayCheckIn.fatigue,' / 10'),'Déclarée aujourd’hui','', 'Ressenti subjectif enregistré aujourd’hui dans Intervals.icu après ta confirmation.']);
    byId('recovery').innerHTML=items.map(function(x){return '<div class="recovery-item"><span>'+x[0]+' '+info(x[0],x[4])+'</span><strong>'+x[1]+'</strong><small class="trend '+x[3]+'">'+x[2]+'</small></div>'}).join('');
    byId('signals').innerHTML=rec.fatigueSignals.length?rec.fatigueSignals.map(function(x){return '<div class="signal">'+x+'</div>'}).join(''):'<p class="empty">Aucun signal de fatigue détecté par les règles factuelles.</p>';
    var sports=Object.entries(perf.sportMix).sort(function(a,b){return b[1].durationSharePercent-a[1].durationSharePercent});byId('sportMix').innerHTML=sports.length?sports.map(function(entry){var name=entry[0].replaceAll('_',' ');var s=entry[1];return '<div class="sport-row"><div class="sport-row-head"><span class="sport-name">'+name+'</span><span>'+value(s.durationMinutes,' min')+' · '+value(s.durationSharePercent,'%')+'</span></div><div class="sport-track"><div class="sport-bar" style="width:'+s.durationSharePercent+'%"></div></div></div>'}).join(''):'<p class="empty">Aucune activité sur la période.</p>';
    byId('sessionsRate').textContent=value(perf.consistency.sessionsPerWeek)+' séances / sem.';byId('activeDays').textContent=perf.consistency.activeDays+' jours actifs';
    byId('activities').innerHTML=data.activities.activities.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).slice(0,8).map(function(a){return '<tr><td>'+a.date+'</td><td class="sport-name">'+a.sport.replaceAll('_',' ')+'</td><td>'+value(Math.round(a.durationSeconds/60),' min')+'</td><td>'+value(a.trainingLoad)+'</td><td>'+value(a.intensity)+'</td></tr>'}).join('')||'<tr><td colspan="5" class="empty">Aucune séance</td></tr>';
    var events=data.upcomingCalendar&&data.upcomingCalendar.events||[];byId('calendar').innerHTML=events.length?events.map(function(e){var d=new Date(e.date+'T12:00:00');var eventLabel=escapeHtml((e.label||e.sport||e.category).replaceAll('_',' '));return '<div class="event"><div class="event-date"><strong>'+d.getDate()+'</strong><span>'+d.toLocaleDateString('fr-FR',{month:'short'})+'</span></div><div class="event-main"><strong>'+eventLabel+'</strong><span>'+value(e.durationMinutes,' min')+(e.managedId?' · plan IA':'')+'</span></div><div class="event-load">'+(e.trainingLoad===undefined?'':'Charge '+value(e.trainingLoad))+'</div></div>'}).join(''):'<p class="empty">Aucune séance planifiée sur les quatre prochaines semaines.</p>';
    byId('statusDot').style.background=data.runtime&&data.runtime.demo?'var(--orange)':'var(--green)';byId('statusText').textContent=data.runtime&&data.runtime.demo?'Données de démonstration':'Données synchronisées';var fresh=data.freshness.latestActivityDate||data.freshness.latestRecoveryDate;byId('freshness').textContent=fresh?'Dernière donnée · '+fresh:'Aucune donnée récente';
  }
  async function load(){
    refresh.disabled=true;byId('error').hidden=true;byId('statusText').textContent='Actualisation…';
    try{var response=await fetch('/api/dashboard?historyDays='+encodeURIComponent(history.value),{headers:{Accept:'application/json'}});var body=await response.json();if(!response.ok)throw new Error(body.message||'Chargement impossible');render(body)}catch(error){byId('error').textContent=error instanceof Error?error.message:'Chargement impossible';byId('error').hidden=false;byId('statusDot').style.background='var(--red)';byId('statusText').textContent='Données indisponibles'}finally{refresh.disabled=false}
  }
  refresh.addEventListener('click',load);history.addEventListener('change',load);document.addEventListener('visibilitychange',function(){if(!document.hidden)load()});setInterval(function(){if(!document.hidden)load()},60000);load();
})();
`;
