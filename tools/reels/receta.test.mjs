// Pruebas de la receta de los reels (sin ffmpeg). Hecho con ayuda de IA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { argsReel, envolverTexto, filtroReel, ganchoDeNombre, leerTiempo, nombreArchivo, pendientesDeCola, textoPublicacion } from './receta.mjs';

test('parte el gancho en líneas cortas y corta con «…» si no cabe', () => {
  assert.deepEqual(envolverTexto('Un streamer prueba mi app de LoL y pasa esto'), ['Un streamer prueba', 'mi app de LoL y pasa', 'esto']);
  const largo = envolverTexto('uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis', 10);
  assert.equal(largo.length, 3);
  assert.ok(largo[2].endsWith('…'));
  assert.deepEqual(envolverTexto(''), []);
});

test('lee tiempos en segundos o con dos puntos', () => {
  assert.equal(leerTiempo('80'), 80);
  assert.equal(leerTiempo('1:20'), 80);
  assert.equal(leerTiempo('01:02:03'), 3723);
  assert.equal(leerTiempo('mañana'), null);
  assert.equal(leerTiempo(undefined), null);
});

test('nombres de archivo seguros y ganchos a partir del nombre', () => {
  assert.equal(nombreArchivo('¡Pentakill de Jinx!'), 'pentakill-de-jinx');
  assert.equal(nombreArchivo('***'), 'reel');
  assert.equal(ganchoDeNombre('Replay 2026-11-05 20-31-07.mp4'), '');
  assert.equal(ganchoDeNombre('2026-11-05 20-31-07.mkv'), '');
  assert.equal(ganchoDeNombre('el coach me salva del baron.mp4'), 'el coach me salva del baron');
});

test('el filtro solo incluye lo que hay y termina en la última etiqueta', () => {
  const solo = filtroReel({ conGancho: false, conSubtitulos: false, familia: 'Arial' });
  assert.ok(!solo.filtro.includes('gancho.txt'));
  assert.ok(!solo.filtro.includes('subtitles'));
  assert.ok(solo.filtro.includes('coachlolia.com'));
  const todo = filtroReel({ conGancho: true, conSubtitulos: true, conCredito: true, familia: 'Arial' });
  assert.ok(todo.filtro.includes('textfile=gancho.txt'));
  assert.ok(todo.filtro.includes('textfile=credito.txt'));
  assert.ok(todo.filtro.includes("subtitles=subs.srt:fontsdir=.:force_style='FontName=Arial"));
  assert.ok(todo.filtro.endsWith(`[${todo.salida}]`));
});

test('argumentos de ffmpeg: recorte, vertical y audio opcional', () => {
  const a = argsReel({ entrada: 'C:\\x\\in.mp4', salida: 'C:\\x\\out.mp4', inicio: 80, duracion: 30, conGancho: true, conSubtitulos: false, familia: 'Arial' });
  assert.deepEqual(a.slice(a.indexOf('-ss'), a.indexOf('-ss') + 2), ['-ss', '80']);
  assert.ok(a.includes('0:a?'));
  assert.equal(a.at(-1), 'C:\\x\\out.mp4');
  assert.ok(!argsReel({ entrada: 'a', salida: 'b', conGancho: false, conSubtitulos: false, familia: 'Arial' }).includes('-ss'));
});

test('caption con mención y hashtags por defecto', () => {
  assert.equal(textoPublicacion({ gancho: 'Hola', credito: 'Vídeo de @x' }), 'Hola\n\n🎥 Vídeo de @x\n\n#leagueoflegends #lol #coachlol #ia\n');
  assert.equal(textoPublicacion({ gancho: 'G', texto: 'Caption', hashtags: '#lol' }), 'Caption\n\n#lol\n');
});

test('de la cola solo coge las aprobadas con clip de Twitch y sin vídeo hecho', () => {
  const base = { estado: 'aprobado', origen: 'https://clips.twitch.tv/Abc', nota: '' };
  const lista = [
    { id: 1, ...base },
    { id: 2, ...base, estado: 'idea' },
    { id: 3, ...base, origen: 'https://www.youtube.com/watch?v=1' },
    { id: 4, ...base, nota: 'Vídeo listo: x.mp4' },
    { id: 5, ...base, origen: 'https://www.twitch.tv/crazylovers/clip/Abc' },
    { id: 6, ...base, origen: null },
  ];
  assert.deepEqual(pendientesDeCola(lista).map((p) => p.id), [1, 5]);
});
