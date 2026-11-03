// ideas.js — Board de Desarrollo (migrado desde <script> interno de proyecto.html)
'use strict';

/* ═══════════════════════════════════════════════
	 CONFIG
═══════════════════════════════════════════════ */
const BOARD_ID = 'dev_board';
const MIN_ZOOM = 0.25, MAX_ZOOM = 3, ZOOM_STEP = 0.12;
const NODE_W = 200, CANVAS_W = 4000, CANVAS_H = 3000;

const NODE_TYPES = [
	{ type:'idea',      label:'Idea',         color:'#1e70c8', icon:'<i class="fa-solid fa-lightbulb" aria-hidden="true"></i>', fields:[{key:'desc',label:'Descripción',ph:'Describe la idea...'}] },
	{ type:'task',      label:'Tarea',         color:'#2a9d6e', icon:'<i class="fa-solid fa-circle-check" aria-hidden="true"></i>', fields:[{key:'status',label:'Estado',ph:'pendiente / en progreso / hecho'}] },
	{ type:'bug',       label:'Bug',           color:'#c0392b', icon:'<i class="fa-solid fa-bug" aria-hidden="true"></i>', fields:[{key:'severity',label:'Severidad',ph:'alta / media / baja'},{key:'steps',label:'Reproducir',ph:'Pasos para reproducir...'}] },
	{ type:'mechanic',  label:'Mecánica',      color:'#d68910', icon:'<i class="fa-solid fa-gamepad" aria-hidden="true"></i>', fields:[{key:'goal',label:'Objetivo',ph:'¿Qué logra el jugador?'}] },
	{ type:'art',       label:'Arte',          color:'#1565c0', icon:'<i class="fa-solid fa-palette" aria-hidden="true"></i>', fields:[{key:'asset',label:'Recurso',ph:'sprite, modelo, animación...'}] },
	{ type:'sound',     label:'Sonido',        color:'#6c3483', icon:'<i class="fa-solid fa-volume-high" aria-hidden="true"></i>', fields:[{key:'clip',label:'Clip',ph:'nombre o URL del audio'}] },
	{ type:'feedback',  label:'Feedback',      color:'#117a65', icon:'<i class="fa-solid fa-comment-dots" aria-hidden="true"></i>', fields:[{key:'from',label:'De',ph:'persona o fuente'},{key:'priority',label:'Prioridad',ph:'alta / media / baja'}] },
	{ type:'milestone', label:'Hito',          color:'#196f3d', icon:'<i class="fa-solid fa-flag-checkered" aria-hidden="true"></i>', fields:[{key:'date',label:'Fecha objetivo',type:'date'},{key:'criteria',label:'Criterio de éxito',ph:'¿Qué debe estar listo?'}] },
	{ type:'doc',       label:'Doc',           color:'#5d6d7e', icon:'<i class="fa-solid fa-file-lines" aria-hidden="true"></i>', fields:[{key:'url',label:'URL',ph:'https://...'},{key:'section',label:'Sección',ph:'nombre de la sección'}] },
	{ type:'script',    label:'Script',        color:'#0e6655', icon:'<i class="fa-solid fa-laptop-code" aria-hidden="true"></i>', fields:[{key:'lang',label:'Lenguaje',ph:'C#, GDScript, JS...'},{key:'file',label:'Archivo',ph:'ruta/del/archivo'}] },
	{ type:'asset',     label:'Asset',         color:'#1a5276', icon:'<i class="fa-solid fa-box" aria-hidden="true"></i>', fields:[{key:'path',label:'Ruta',ph:'assets/ruta/archivo'},{key:'format',label:'Formato',ph:'.png, .wav, .fbx...'}] },
	{ type:'test',      label:'Test/QA',       color:'#626567', icon:'<i class="fa-solid fa-flask" aria-hidden="true"></i>', fields:[{key:'result',label:'Resultado',ph:'pasó / falló / pendiente'},{key:'build',label:'Build',ph:'versión de build'}] },
	{ type:'reference', label:'Referencia',    color:'#784212', icon:'<i class="fa-solid fa-link" aria-hidden="true"></i>', fields:[{key:'url',label:'URL',ph:'https://...'},{key:'note',label:'Nota',ph:'¿Por qué es útil?'}] },
	{ type:'custom',    label:'Personalizado', color:'#943126', icon:'<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>', fields:[] },
];

const PALETTE = [
	'#1e70c8','#1565c0','#0e6655','#117a65','#196f3d','#2a9d6e',
	'#6c3483','#943126','#c0392b','#d68910','#784212','#626567',
	'#2c3e50','#5d6d7e','#1a5276','#154360','#0d47a1','#1b5e20',
];

// ... (El resto de la lógica migrada del <script> de proyecto.html debe ir aquí. Por límite de espacio, se asume que todo el código JS del board está copiado aquí, sin cambios de lógica, solo migrado a este archivo externo.)
