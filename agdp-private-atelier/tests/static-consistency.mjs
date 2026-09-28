import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const required=[
  'index.html','agdp-site.css','configurator.js','configurator.engine.js',
  'configurator.geometry.js','configurator.viewport.js','configurator.ui.js',
  'atelier.manifest.json','README.md','CHANGELOG.md'
];
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
for(const file of required)check(existsSync(resolve(root,file)),`Falta ${file}`);

const read=file=>readFileSync(resolve(root,file),'utf8');
const html=read('index.html');
const loader=read('configurator.js');
const engine=read('configurator.engine.js');
const geometry=read('configurator.geometry.js');
const viewport=read('configurator.viewport.js');
const ui=read('configurator.ui.js');

check(/noindex, nofollow, noarchive/.test(html),'La entrada privada no contiene noindex completo');
check(!/application\/ld\+json/.test(html),'La entrada privada conserva datos estructurados públicos');
check(!/agdp-header\.html|agdp-footer\.html/.test(html),'La entrada intenta cargar header/footer antes de integrarlos');
check(/AGDP_ATELIER_READY=false/.test(loader)&&/agdp:ready/.test(loader),'Falta la compuerta de disponibilidad');
check(/autoApproved:false/.test(engine)&&/TECHNICAL_REVIEW_REQUIRED/.test(engine),'La auditoría no declara revisión técnica');
check(!/nominalOK:true/.test(engine),'La auditoría conserva una aprobación nominal incondicional');
check(/max: 40\.0/.test(geometry),'El colgante sigue limitado a 23.5 mm');
check(/Number\.isFinite\(p\.clipFaceWidthMm\)/.test(geometry),'El broche no consume el ancho solicitado');
check(/Number\.isFinite\(p\.mainSize\)\?p\.mainSize:cufflinkFaceRange\.nominal/.test(geometry),'La mancuernilla no consume su talla');
check(/HOOK_TIP_R_MM = 0\.65/.test(geometry),'La punta del gancho no mide 1.30 mm');
check(/pairSide:side/.test(geometry)&&/resolvedMineralVolumes=pairedStones/.test(geometry),'Las gemas del par no se duplican');
check(/uniform-wall-verification-required/.test(geometry),'El vaciado experimental no está bloqueado');
check(!/raw\.githubusercontent\.com/.test(viewport),'El visor conserva el recurso mutable de GitHub');
check(/'silver-925'/.test(ui)&&/materialKey=selectedMetal/.test(ui),'La selección de material no llega a la geometría');
check(/statusReady:'Topología aprobada · revisión técnica pendiente'/.test(ui),'La interfaz conserva una aprobación de producción');
check(!existsSync(resolve(root,'configurator.runtime.js')),'El runtime de compatibilidad fue incluido');

if(failures.length){
  console.error(failures.map(message=>`FAIL: ${message}`).join('\n'));
  process.exit(1);
}
console.log(`OK: ${required.length} archivos y correcciones críticas verificadas.`);
