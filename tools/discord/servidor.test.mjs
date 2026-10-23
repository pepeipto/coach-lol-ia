// Tests del creador del servidor de Discord (sin conexión): diseño coherente, mensajes dentro de los límites de
// Discord, reglas que cumplen las políticas de Riot y métodos de discord.js que usa crear-servidor.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { canales, CARPETA_MENSAJES, comprobarDiseno, leerMensajes, resolverMenciones } from './plan.mjs';
import { AUTOMOD, CANAL_INVITACION, CANAL_MODERACION, CANAL_REGLAS, CANAL_SISTEMA, PERMISOS_TODOS, ROLES } from './servidor.mjs';

const AVISO_RIOT =
  "Coach LoL IA isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

test('el diseño no tiene errores', () => {
  assert.deepEqual(comprobarDiseno(), []);
});

test('tiene los canales y roles pedidos', () => {
  const nombres = canales().map((c) => c.nombre);
  for (const c of ['bienvenida', 'reglas', 'anuncios', 'novedades', 'descargas-y-faq', 'soporte-y-bugs', 'sugerencias', 'builds-y-runas', 'clips', 'retos-de-la-semana', 'buscar-duo', 'off-topic']) {
    assert.ok(nombres.includes(c), `falta #${c}`);
  }
  assert.ok(canales().some((c) => c.tipo === 'voz'));
  for (const c of [CANAL_REGLAS, CANAL_MODERACION, CANAL_SISTEMA, CANAL_INVITACION]) assert.ok(nombres.includes(c));
  const roles = ROLES.map((r) => r.nombre);
  for (const r of ['Equipo', 'Beta tester', 'Streamer', 'ES', 'EN', 'EUW', 'LAN', 'LAS', 'Esmeralda']) assert.ok(roles.includes(r), `falta @${r}`);
  assert.equal(canales().filter((c) => c.webhook).map((c) => c.nombre).join(), 'novedades');
});

test('todos los archivos de mensajes se usan y todos los usados existen', () => {
  const usados = new Set(canales().filter((c) => c.mensajes).map((c) => c.mensajes));
  const archivos = readdirSync(CARPETA_MENSAJES).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  assert.deepEqual([...usados].sort(), archivos.sort());
});

test('las reglas incluyen el aviso legal literal de Riot y prohíben trampas, cuentas, apuestas y MMR', () => {
  const reglas = leerMensajes('reglas').partes.join('\n');
  assert.ok(reglas.includes(AVISO_RIOT));
  for (const tema of [/scripts, hacks/, /elo boost/i, /apuestas/, /MMR/, /no promete que subas de rango/]) assert.match(reglas, tema);
  for (const tema of [/cheating/, /boosting/, /gambling/, /MMR/, /does not promise/]) assert.match(reglas, tema);
});

test('ningún mensaje promete subir de rango ni habla de ventajas ocultas', () => {
  for (const f of readdirSync(CARPETA_MENSAJES)) {
    const texto = readFileSync(join(CARPETA_MENSAJES, f), 'utf8');
    assert.doesNotMatch(texto, /(sube|subirás|garantiza\w*|guaranteed?) (de )?(elo|rango|rank)/i, f);
    assert.doesNotMatch(texto, /indetectable|undetectable|100 ?% seguro/i, f);
  }
});

test('cada mensaje tiene versión en español y en inglés', () => {
  for (const c of canales().filter((c) => c.mensajes)) {
    const texto = leerMensajes(c.mensajes, c.tipo === 'foro').partes.join('\n');
    assert.match(texto, /[áéíóúñ¿¡]/, `${c.mensajes}: sin español`);
    assert.match(texto, /🇬🇧|\b(the|your|and)\b/, `${c.mensajes}: sin inglés`);
  }
});

test('las menciones se resuelven a IDs y una mención a un canal inexistente falla', () => {
  assert.equal(resolverMenciones('Lee <#reglas> y avisa a <@&Equipo>', () => '1', () => '2'), 'Lee <#1> y avisa a <@&2>');
  assert.throws(() => resolverMenciones('<#no-existe>', () => null, () => null), /no existe/);
});

test('AutoMod bloquea elo boost, apuestas e invitaciones ajenas', () => {
  const palabras = AUTOMOD.flatMap((r) => r.palabras);
  for (const p of ['elo boost*', 'vendo cuenta*', 'apuesta*', 'discord.gg/*']) assert.ok(palabras.includes(p), p);
});

test('discord.js tiene todo lo que usa el script', async () => {
  const d = await import('discord.js');
  for (const p of PERMISOS_TODOS) assert.ok(p in d.PermissionFlagsBits, p);
  for (const r of ROLES) for (const p of r.permisos ?? []) assert.ok(p in d.PermissionFlagsBits, p);
  assert.equal(typeof d.Routes.guildOnboarding, 'function');
  assert.equal(typeof d.ThreadChannel.prototype.pin, 'function');
  assert.equal(typeof d.ThreadChannel.prototype.setLocked, 'function');
  assert.equal(typeof d.Message.prototype.pin, 'function');
  assert.equal(typeof d.AutoModerationRule.prototype.setAllowList, 'function');
  assert.ok(d.AutoModerationRuleKeywordPresetType.Slurs && d.AutoModerationRuleKeywordPresetType.SexualContent);
  assert.ok(d.ChannelType.GuildForum && d.ChannelType.GuildStageVoice && d.ChannelType.GuildAnnouncement);
});

test('el icono del servidor existe', async () => {
  const { AJUSTES } = await import('./servidor.mjs');
  const { existsSync } = await import('node:fs');
  assert.ok(existsSync(new URL(`../../${AJUSTES.icono}`, import.meta.url)));
});
