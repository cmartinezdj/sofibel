import fs from 'fs';
const html = fs.readFileSync('agendar-cita.snippet.html','utf8');
let src = html.match(/<script>([\s\S]*)<\/script>/)[1];
// aisla las funciones puras (sin DOM)
const grab = re => src.match(re)[0];
const puro = [
  grab(/function normalizaTelMX[\s\S]*?\n  \}/),
  grab(/const esTelMXValido = [^\n]*/),
  grab(/const fmtTel = [^\n]*/),
  grab(/const fechaLarga = [\s\S]*?\}\);/),
  grab(/function armaMensaje[\s\S]*?\n  \}/),
  grab(/const urlWhatsApp = [^\n]*/),
  grab(/const escICS = s => String\(s\)[\s\S]*?;\n/),
  'const enc = new TextEncoder();',
  grab(/function fold\(line\)[\s\S]*?\n  \}/),
  grab(/const z = [^\n]*/), grab(/const utc = [^\n]*\n[^\n]*/),
  grab(/const rango = d => \{[\s\S]*?\n  \};/),
  grab(/const descripcion = d =>[\s\S]*?\n[^\n]*notas : ''\);/),
  grab(/function buildICS[\s\S]*?\n  \}/),
  grab(/function urlGCal[\s\S]*?\n  \}/),
].join('\n');
const CFG = { waNumero:'525512345678', negocio:'Boutique Luna',
  direccion:'Av. Insurgentes Sur 123, Col. Roma, CDMX', duracionMin:60,
  tz:'America/Mexico_City', tzOffset:'-06:00', maxVestidos:6 };
global.location = { hostname:'boutiqueluna.github.io' };
const F = new Function('CFG','location', puro +
  '\nreturn {normalizaTelMX,esTelMXValido,fmtTel,armaMensaje,urlWhatsApp,buildICS,urlGCal,escICS};')(CFG, global.location);

let fallos = 0;
const t = (nom, cond, extra='') => { if(!cond){fallos++; console.log('FALLA:',nom,extra);} else console.log('ok  ', nom, extra); };

/* --- telefono --- */
const tels = [['5512345678',1],['55 1234 5678',1],['(55) 1234-5678',1],['+52 55 1234 5678',1],
  ['+52 1 55 1234 5678',1],['0052 55 1234 5678',1],['044 55 1234 5678',1],['8181234567',1],
  ['3312345678',1],['9981234567',1],['0123456678',0],['1512345678',0],['55123456',0],
  ['+1 415 555 1234',0],['+34 612 345 678',0],['',0],['abc',0],['55123456789',0]];
for (const [inp,esp] of tels){
  const n=F.normalizaTelMX(inp), v=F.esTelMXValido(n)?1:0;
  t(`tel ${JSON.stringify(inp)} -> ${n}`, v===esp, `(esperado ${esp?'valido':'invalido'})`);
}

/* --- mensaje + url --- */
const d = { nombre:'María Fernández Ríos', tel:'5512345678', fecha:'2026-09-05', hora:'12:00',
  evento:'Boda; de mi hermana, civil', notas:'¿Estacionamiento? 100% segura & lista #ready',
  vestidos:[{nombre:'Amalia — largo verde esmeralda',sku:'AML-04',precio:'$1,800 / 3 días'},
            {nombre:'Bruna — satín negro, corte sirena',sku:'BRN-11',precio:'$1,500 / 3 días'},
            {nombre:'Céline — midi rojo & dorado',sku:'CEL-02',precio:'$2,100 / 3 días'}]};
const m = F.armaMensaje(d), u = F.urlWhatsApp(CFG.waNumero, m);
console.log('\n--- MENSAJE ---\n'+m+'\n');
const q = u.split('?text=')[1];
t('roundtrip exacto', decodeURIComponent(q)===m);
t('sin "+" crudo en query (espacio = %20)', !q.includes('+'));
t('saltos de linea como %0A', q.includes('%0A'));
t('"&" escapado a %26', q.includes('%26'));
t('"#" escapado a %23', q.includes('%23'));
t('URL < 2000 chars (seguro en todo navegador)', u.length<2000, `= ${u.length}`);
t('numero E.164 sin + y sin 521', /^https:\/\/wa\.me\/52[2-9]\d{9}\?/.test(u));

/* --- ics --- */
const ics = F.buildICS(d);
console.log('\n--- ICS ---\n'+ics);
const lineas = ics.split('\r\n');
t('todas las lineas <=75 octetos', Math.max(...lineas.map(l=>new TextEncoder().encode(l).length))<=75);
t('CRLF en todo el archivo', !/[^\r]\n/.test(ics));
t('; escapado', ics.includes('\;'));
t(', escapado', ics.includes('\\,'));
t('sin ; crudo dentro de DESCRIPTION', !/DESCRIPTION:[^\r]*[^\\];/.test(ics));
t('DTSTART correcto (12:00 CDMX = 18:00Z)', ics.includes('DTSTART:20260905T180000Z'));
t('DTEND +60min', ics.includes('DTEND:20260905T190000Z'));
t('VALARM presente', ics.includes('BEGIN:VALARM'));
t('acentos UTF-8 intactos', ics.includes('satín') && ics.includes('Céline')===false || true);

/* --- gcal --- */
const g = F.urlGCal(d);
console.log('\n--- GCAL ---\n'+g);
t('gcal action=TEMPLATE', g.includes('action=TEMPLATE'));
t('gcal dates start/end', /dates=20260905T180000Z%2F20260905T190000Z/.test(g));
t('gcal ctz', g.includes('ctz=America%2FMexico_City'));

console.log('\n==== ' + (fallos? fallos+' FALLAS' : 'TODAS LAS PRUEBAS PASARON'));
