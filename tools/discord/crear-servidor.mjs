// Crea de una vez el servidor oficial de Discord de Coach LoL IA en un servidor (vacío) de Carlos: roles, permisos,
// modo Comunidad, categorías y canales, AutoMod, mensajes fijados, «Canales y roles», el webhook de #novedades y una
// invitación permanente. El diseño está en servidor.mjs y los textos en docs/discord/mensajes/.
//
// Se puede repetir sin miedo: lo que ya existe (por nombre) se actualiza en vez de duplicarse.
// El token del bot se lee de la variable de entorno DISCORD_TOKEN (crear-servidor.ps1 lo pide con teclado oculto):
// nunca se escribe en ningún archivo ni se muestra.
//
// Uso: node crear-servidor.mjs            (crea o actualiza)
//      node crear-servidor.mjs --simular  (solo comprueba el diseño y los mensajes, sin conectarse)
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { AJUSTES, AUTOMOD, CANAL_INVITACION, CANAL_MODERACION, CANAL_REGLAS, CANAL_SISTEMA, CATEGORIAS, PERMISOS_TODOS, PREGUNTAS, ROLES } from './servidor.mjs';
import { canales, comprobarDiseno, etiqueta, leerMensajes, resolverMenciones } from './plan.mjs';

const REPO = 'pepeipto/coach-lol-ia';
const NOMBRE_WEBHOOK = 'GitHub';

const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const cian = (t) => `\x1b[36m${t}\x1b[0m`;
const paso = (t) => console.log(`\n${cian('▶')} ${t}`);
const hecho = (t) => console.log(`  ${verde('✔')} ${t}`);
const aviso = (t) => console.log(`  ${rojo('!')} ${t}`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
async function preguntar(texto) {
  return (await rl.question(`${texto} `)).trim();
}
async function siNo(texto) {
  return /^s/i.test(await preguntar(`${texto} (s/n)`));
}

// ---------- 1. Comprobar el diseño (también sin conexión) ----------
const errores = comprobarDiseno();
if (errores.length) {
  console.log(rojo('El diseño tiene errores:'));
  for (const e of errores) console.log(`  - ${e}`);
  process.exit(1);
}
const lista = canales();
console.log(
  verde(`Diseño correcto: ${ROLES.length} roles, ${CATEGORIAS.length} categorías, ${lista.length} canales, ${AUTOMOD.length + 3} reglas de AutoMod y ${PREGUNTAS.length} preguntas de «Canales y roles».`),
);
if (process.argv.includes('--simular')) {
  rl.close();
  process.exit(0);
}

const token = (process.env.DISCORD_TOKEN ?? '').trim();
if (!token) {
  console.log(rojo('Falta el token del bot. Abre «Crear servidor Discord.bat», que te lo pide sin que se vea.'));
  process.exit(1);
}

const {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  OverwriteType,
  PermissionFlagsBits,
  Routes,
} = await import('discord.js');

const TIPOS = {
  texto: ChannelType.GuildText,
  anuncios: ChannelType.GuildText, // se convierte en canal de anuncios al activar la Comunidad
  foro: ChannelType.GuildForum,
  voz: ChannelType.GuildVoice,
  escenario: ChannelType.GuildStageVoice,
};
const permisos = (nombres = []) => nombres.reduce((total, n) => total | PermissionFlagsBits[n], 0n);
const sinMenciones = { parse: [] };

// ---------- 2. Conectarse con el bot ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
paso('Conectando con Discord...');
try {
  const listo = once(client, Events.ClientReady);
  await client.login(token);
  await listo;
} catch (e) {
  console.log(rojo('Discord no acepta ese token. Copia uno nuevo en el Developer Portal (Bot → Reset Token) y vuelve a intentarlo.'));
  console.log(`  (${e.message})`);
  process.exit(1);
}
hecho(`Conectado como ${client.user.tag}.`);

try {
  await crear();
} catch (e) {
  console.log(rojo(`\nSe ha parado por un error: ${e.message}`));
  console.log('Puedes volver a ejecutarlo: lo que ya esté creado no se duplica.');
  process.exitCode = 1;
} finally {
  rl.close();
  await client.destroy();
}

async function elegirServidor() {
  if (client.guilds.cache.size === 0) {
    const invitacion = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=${PermissionFlagsBits.Administrator}`;
    paso('El bot aún no está en tu servidor. Se abre el navegador para añadirlo:');
    console.log(`  ${invitacion}`);
    console.log('  Elige tu servidor nuevo, pulsa «Continuar» y «Autorizar». Te espero aquí (15 minutos como mucho)...');
    spawn('explorer.exe', [invitacion], { detached: true, stdio: 'ignore' }).unref();
    const espera = once(client, Events.GuildCreate);
    const limite = new Promise((_, no) => setTimeout(() => no(new Error('Nadie añadió el bot en 15 minutos')), 15 * 60_000).unref());
    const [servidor] = await Promise.race([espera, limite]);
    return servidor;
  }
  const servidores = [...client.guilds.cache.values()];
  if (servidores.length === 1) return servidores[0];
  console.log('\nEl bot está en varios servidores:');
  servidores.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
  const n = Number(await preguntar('¿En cuál lo creo? Escribe el número:'));
  if (!servidores[n - 1]) throw new Error('Número no válido');
  return servidores[n - 1];
}

async function crear() {
  const guild = await (await elegirServidor()).fetch();
  const yo = await guild.members.fetchMe();
  if (!yo.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('El bot no tiene permiso de Administrador en ese servidor. Quítalo y vuelve a añadirlo con el enlace que da este programa.');
  }
  await guild.channels.fetch();
  await guild.roles.fetch();

  console.log(`\nServidor: ${verde(guild.name)} (${guild.memberCount} miembros)`);
  if (!(await siNo('¿Creo aquí los roles, canales, permisos y mensajes de Coach LoL IA?'))) throw new Error('Cancelado por ti');

  await limpiarCanalesSobrantes(guild);
  const roles = await crearRoles(guild, yo);
  const rol = (nombre) => (nombre === '@everyone' ? guild.roles.everyone : roles.get(nombre));
  const sobrescrituras = (c) =>
    Object.entries(c.permisos ?? c.categoria?.permisos ?? {}).map(([nombre, p]) => ({
      id: rol(nombre).id,
      type: OverwriteType.Role,
      allow: permisos(p.permitir),
      deny: permisos(p.denegar),
    }));

  // Categorías, y canales de texto y voz (los de anuncios, como texto de momento).
  paso('Categorías y canales');
  const creados = new Map();
  const categorias = new Map();
  for (const cat of CATEGORIAS) {
    const opciones = { name: cat.nombre, type: ChannelType.GuildCategory, permissionOverwrites: sobrescrituras(cat) };
    categorias.set(cat.nombre, await crearOActualizar(guild, opciones, null));
  }
  const crearCanal = async (c) => {
    const opciones = {
      name: c.nombre,
      type: TIPOS[c.tipo],
      parent: categorias.get(c.categoria.nombre).id,
      permissionOverwrites: sobrescrituras(c),
    };
    if (c.tema && c.tipo !== 'voz' && c.tipo !== 'escenario') opciones.topic = c.tema;
    if (c.lento) opciones.rateLimitPerUser = c.lento;
    if (c.limite) opciones.userLimit = c.limite;
    if (c.tipo === 'foro') {
      opciones.availableTags = (c.etiquetas ?? []).map((t) => {
        const { emoji, nombre } = etiqueta(t);
        return { name: nombre, emoji: { id: null, name: emoji }, moderated: (c.etiquetasEquipo ?? []).includes(nombre) };
      });
      if (c.reaccion) opciones.defaultReactionEmoji = { id: null, name: c.reaccion };
    }
    creados.set(c.nombre, await crearOActualizar(guild, opciones, categorias.get(c.categoria.nombre).id));
  };
  for (const c of lista.filter((c) => ['texto', 'anuncios', 'voz'].includes(c.tipo))) await crearCanal(c);

  // Modo Comunidad: lo necesitan los canales de anuncios, los foros, el escenario y «Canales y roles».
  paso('Ajustes del servidor y modo Comunidad');
  await guild.edit({
    description: AJUSTES.descripcion,
    preferredLocale: AJUSTES.idioma,
    verificationLevel: AJUSTES.verificacion,
    explicitContentFilter: AJUSTES.filtroContenido,
    defaultMessageNotifications: AJUSTES.notificaciones,
    rulesChannel: creados.get(CANAL_REGLAS),
    publicUpdatesChannel: creados.get(CANAL_MODERACION),
    systemChannel: creados.get(CANAL_SISTEMA),
    features: [...new Set([...guild.features, 'COMMUNITY'])],
    ...(guild.icon ? {} : { icon: fileURLToPath(new URL(`../../${AJUSTES.icono}`, import.meta.url)) }),
  });
  await guild.roles.everyone.setPermissions(permisos(PERMISOS_TODOS), 'Permisos base de Coach LoL IA');
  hecho('Comunidad activada, verificación media, solo menciones y permisos base de @everyone.');

  for (const c of lista.filter((c) => c.tipo === 'anuncios')) {
    const canal = creados.get(c.nombre);
    if (canal.type !== ChannelType.GuildAnnouncement) {
      creados.set(c.nombre, await canal.edit({ type: ChannelType.GuildAnnouncement }));
      hecho(`#${c.nombre} ahora es un canal de anuncios.`);
    }
  }
  for (const c of lista.filter((c) => ['foro', 'escenario'].includes(c.tipo))) await crearCanal(c);

  const idCanal = (n) => creados.get(n)?.id;
  const idRol = (n) => roles.get(n)?.id;

  await crearAutoMod(guild, roles, creados.get(CANAL_MODERACION));
  await publicarMensajes(lista, creados, idCanal, idRol);
  await configurarCanalesYRoles(guild, roles, creados);
  await webhookNovedades(creados.get(lista.find((c) => c.webhook).nombre), roles);

  paso('Invitación permanente');
  const invitacion = await creados.get(CANAL_INVITACION).createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Invitación oficial' });
  // AutoMod bloquea las invitaciones a otros servidores: la oficial queda permitida.
  const regla = (await guild.autoModerationRules.fetch()).find((r) => r.name === 'Invitaciones a otros servidores');
  if (regla) await regla.setAllowList([`discord.gg/${invitacion.code}`, `discord.com/invite/${invitacion.code}`]);
  hecho(`Invitación: ${verde(invitacion.url)}`);

  console.log(`\n${verde('¡Servidor listo!')} Siguientes pasos (docs/discord/README.md):`);
  console.log('  1. Pásale a Claude la invitación de arriba para ponerla en la web y en la app.');
  console.log('  2. En el Developer Portal, pulsa «Reset Token» en Bot para que el token usado hoy deje de servir.');
  console.log('  3. Repasa el servidor y prueba a entrar con otra cuenta o pide a un amigo que lo haga.');
}

/** Crea un canal o categoría, o actualiza el que ya tenga ese nombre (y esa categoría). */
async function crearOActualizar(guild, opciones, padre) {
  const nombre = opciones.type === ChannelType.GuildText || opciones.type === ChannelType.GuildForum ? opciones.name.toLowerCase() : opciones.name;
  const existente = guild.channels.cache.find((c) => c.name === nombre && (c.parentId ?? null) === padre && (c.type === opciones.type || (opciones.type === ChannelType.GuildText && c.type === ChannelType.GuildAnnouncement)));
  if (!existente) {
    const canal = await guild.channels.create({ ...opciones, reason: 'Servidor de Coach LoL IA' });
    hecho(`Creado ${canal.type === ChannelType.GuildCategory ? 'la categoría' : '#'}${canal.name}`);
    return canal;
  }
  const { type, ...cambios } = opciones;
  // En un foro, las etiquetas que ya existen conservan su ID para no quitárselas a las publicaciones.
  if (cambios.availableTags) {
    cambios.availableTags = cambios.availableTags.map((t) => ({ ...t, id: existente.availableTags?.find((x) => x.name === t.name)?.id }));
  }
  const canal = await existente.edit({ ...cambios, reason: 'Servidor de Coach LoL IA' });
  hecho(`Actualizado ${canal.name}`);
  return canal;
}

/** Ofrece borrar los canales que trae un servidor nuevo («general», «General»...) y que no forman parte del diseño. */
async function limpiarCanalesSobrantes(guild) {
  const disenoCategorias = new Set(CATEGORIAS.map((c) => c.nombre));
  const disenoCanales = new Set(lista.map((c) => `${c.categoria.nombre}/${c.tipo === 'voz' || c.tipo === 'escenario' ? c.nombre : c.nombre.toLowerCase()}`));
  const sobrantes = guild.channels.cache.filter((c) => {
    if (c.type === ChannelType.GuildCategory) return !disenoCategorias.has(c.name);
    return !disenoCanales.has(`${c.parent?.name ?? ''}/${c.name}`);
  });
  if (!sobrantes.size) return;
  paso('Canales que no forman parte del diseño');
  for (const c of sobrantes.values()) console.log(`  - ${c.type === ChannelType.GuildCategory ? 'Categoría' : 'Canal'} «${c.name}»`);
  if (!(await siNo('Son los que trae Discord al crear un servidor. ¿Los borro?'))) return;
  for (const c of sobrantes.values()) {
    // Si Discord los usa como canal de normas o de avisos, se quitan antes de esos ajustes.
    await c.delete('Canal por defecto, sustituido por el diseño de Coach LoL IA').catch((e) => aviso(`No se pudo borrar «${c.name}»: ${e.message}`));
  }
  hecho(`Borrados ${sobrantes.size} canales.`);
}

async function crearRoles(guild, yo) {
  paso('Roles');
  const roles = new Map();
  // Discord pone cada rol nuevo justo encima de @everyone: se crean de abajo arriba para que queden en orden.
  for (const r of [...ROLES].reverse()) {
    const datos = { name: r.nombre, color: r.color, hoist: Boolean(r.mostrar), mentionable: false, permissions: permisos(r.permisos) };
    const existente = guild.roles.cache.find((x) => x.name === r.nombre);
    if (!existente) {
      roles.set(r.nombre, await guild.roles.create({ ...datos, reason: 'Servidor de Coach LoL IA' }));
      hecho(`Creado @${r.nombre}`);
    } else if (existente.position < yo.roles.highest.position) {
      roles.set(r.nombre, await existente.edit(datos));
      hecho(`Actualizado @${r.nombre}`);
    } else {
      roles.set(r.nombre, existente);
      aviso(`@${r.nombre} está por encima del bot y no se toca.`);
    }
  }
  return roles;
}

async function crearAutoMod(guild, roles, moderacion) {
  paso('AutoMod (moderación automática de Discord)');
  const existentes = await guild.autoModerationRules.fetch();
  const equipo = roles.get('Equipo').id;
  const alerta = { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: moderacion.id } };
  const reglas = [
    ...AUTOMOD.map((r) => ({
      name: r.nombre,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { keywordFilter: r.palabras },
      actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: r.aviso } }, alerta],
      exemptRoles: (r.exentos ?? ['Equipo']).map((n) => roles.get(n).id),
    })),
    {
      name: 'Insultos graves y contenido sexual',
      triggerType: AutoModerationRuleTriggerType.KeywordPreset,
      triggerMetadata: { presets: [AutoModerationRuleKeywordPresetType.Slurs, AutoModerationRuleKeywordPresetType.SexualContent] },
      actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'Ese mensaje incumple las reglas. · That message breaks the rules.' } }, alerta],
      exemptRoles: [equipo],
    },
    {
      name: 'Spam de menciones',
      triggerType: AutoModerationRuleTriggerType.MentionSpam,
      triggerMetadata: { mentionTotalLimit: 5, mentionRaidProtectionEnabled: true },
      actions: [{ type: AutoModerationActionType.BlockMessage }, alerta, { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 600 } }],
      exemptRoles: [equipo],
    },
    {
      name: 'Spam',
      triggerType: AutoModerationRuleTriggerType.Spam,
      triggerMetadata: {},
      actions: [{ type: AutoModerationActionType.BlockMessage }, alerta],
      exemptRoles: [equipo],
    },
  ];
  for (const r of reglas) {
    const datos = { ...r, eventType: AutoModerationRuleEventType.MessageSend, enabled: true, reason: 'Servidor de Coach LoL IA' };
    const existente = existentes.find((x) => x.name === r.name || (x.triggerType === r.triggerType && r.triggerType !== AutoModerationRuleTriggerType.Keyword));
    try {
      if (existente) {
        const { triggerType, ...cambios } = datos;
        await existente.edit(cambios);
        hecho(`Actualizada la regla «${r.name}»`);
      } else {
        await guild.autoModerationRules.create(datos);
        hecho(`Creada la regla «${r.name}»`);
      }
    } catch (e) {
      aviso(`Regla «${r.name}»: ${e.message} (puedes crearla a mano en Ajustes del servidor → AutoMod)`);
    }
  }
}

/** Publica y fija los mensajes de cada canal; si ya estaban (del bot), los edita. */
async function publicarMensajes(lista, creados, idCanal, idRol) {
  paso('Mensajes fijados');
  for (const c of lista.filter((c) => c.mensajes)) {
    const canal = creados.get(c.nombre);
    const { titulo, partes } = leerMensajes(c.mensajes, c.tipo === 'foro');
    const textos = partes.map((p) => resolverMenciones(p, idCanal, idRol));
    if (c.tipo === 'foro') {
      await publicacionForo(canal, titulo, textos);
      continue;
    }
    const fijados = await mensajesFijados(canal);
    const delBot = fijados.filter((m) => m.author.id === client.user.id).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    if (delBot.length === textos.length) {
      for (const [i, m] of delBot.entries()) if (m.content !== textos[i]) await m.edit({ content: textos[i], allowedMentions: sinMenciones });
      hecho(`#${c.nombre}: ${textos.length} mensajes actualizados`);
      continue;
    }
    for (const m of delBot) await m.delete().catch(() => {});
    for (const t of textos) {
      const m = await canal.send({ content: t, allowedMentions: sinMenciones, flags: [4096] /* sin notificación */ });
      await m.pin().catch((e) => aviso(`#${c.nombre}: no se pudo fijar (${e.message})`));
    }
    hecho(`#${c.nombre}: ${textos.length} mensajes publicados y fijados`);
  }
}

async function mensajesFijados(canal) {
  if (typeof canal.messages.fetchPins === 'function') {
    const res = await canal.messages.fetchPins();
    return (res.items ?? []).map((p) => p.message ?? p);
  }
  return [...(await canal.messages.fetchPinned()).values()];
}

/** En un foro, la guía es una publicación fijada y cerrada (solo el equipo puede contestar). */
async function publicacionForo(foro, titulo, textos) {
  const activos = await foro.threads.fetchActive();
  const archivados = await foro.threads.fetchArchived().catch(() => ({ threads: new Map() }));
  const hilo = [...activos.threads.values(), ...archivados.threads.values()].find((h) => h.name === titulo && h.ownerId === client.user.id);
  if (hilo) {
    if (hilo.archived) await hilo.setArchived(false);
    const mensajes = [...(await hilo.messages.fetch({ limit: 50 })).values()]
      .filter((m) => m.author.id === client.user.id && !m.system)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    if (mensajes.length === textos.length) {
      for (const [i, m] of mensajes.entries()) if (m.content !== textos[i]) await m.edit({ content: textos[i], allowedMentions: sinMenciones });
      hecho(`#${foro.name}: guía actualizada`);
    } else {
      aviso(`#${foro.name}: la guía «${titulo}» ya existe con otro número de mensajes; bórrala si quieres que se vuelva a crear.`);
    }
    return;
  }
  const [primero, ...resto] = textos;
  const nuevo = await foro.threads.create({ name: titulo, message: { content: primero, allowedMentions: sinMenciones }, reason: 'Guía del foro' });
  for (const t of resto) await nuevo.send({ content: t, allowedMentions: sinMenciones });
  await nuevo.pin().catch((e) => aviso(`#${foro.name}: no se pudo fijar la guía (${e.message})`));
  await nuevo.setLocked(true).catch(() => {});
  hecho(`#${foro.name}: guía publicada y fijada`);
}

/** «Canales y roles» (Onboarding): canales que ve todo el mundo y preguntas con las que cada uno elige sus roles. */
async function configurarCanalesYRoles(guild, roles, creados) {
  paso('«Canales y roles» (roles autoasignables sin bot)');
  let semilla = (BigInt(Date.now()) - 1420070400000n) << 22n;
  const id = () => String(semilla++);
  const cuerpo = {
    enabled: true,
    mode: 0,
    default_channel_ids: lista.filter((c) => c.predeterminado).map((c) => creados.get(c.nombre).id),
    prompts: PREGUNTAS.map((p) => ({
      id: id(),
      type: 0,
      title: p.titulo,
      single_select: p.unica,
      required: p.obligatoria,
      in_onboarding: true,
      options: ROLES.filter((r) => r.grupo === p.grupo).map((r, i) => ({
        id: id(),
        title: r.nombre,
        emoji_name: p.emojis[i],
        role_ids: [roles.get(r.nombre).id],
        channel_ids: [],
      })),
    })),
  };
  try {
    await client.rest.put(Routes.guildOnboarding(guild.id), { body: cuerpo });
    hecho(`${PREGUNTAS.length} preguntas activadas. Cada miembro nuevo elige idioma, región, rango, posiciones y avisos.`);
  } catch (e) {
    aviso(`Discord no dejó configurarlo solo (${e.message}). Hazlo a mano: paso 7 de docs/discord/README.md.`);
  }
}

/** Webhook de #novedades para las releases de GitHub (workflow .github/workflows/discord-novedades.yml). */
async function webhookNovedades(canal, roles) {
  paso('Webhook de GitHub en #novedades');
  const webhooks = await canal.fetchWebhooks();
  const webhook = webhooks.find((w) => w.name === NOMBRE_WEBHOOK && w.owner?.id === client.user.id) ?? (await canal.createWebhook({ name: NOMBRE_WEBHOOK, reason: 'Releases de GitHub' }));
  hecho(`Webhook «${NOMBRE_WEBHOOK}» listo en #${canal.name}.`);
  const rolNovedades = roles.get('Avisos de novedades').id;

  const gh = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore', shell: false });
  if (gh.status === 0 && (await siNo(`¿Guardo el webhook como secreto del repositorio ${REPO} con GitHub CLI (gh)?`))) {
    // La URL del webhook es secreta: va por la entrada estándar, nunca en la línea de comandos ni en pantalla.
    const secreto = spawnSync('gh', ['secret', 'set', 'DISCORD_WEBHOOK_NOVEDADES', '--repo', REPO], { input: webhook.url, stdio: ['pipe', 'ignore', 'pipe'] });
    const variable = spawnSync('gh', ['variable', 'set', 'DISCORD_ROL_NOVEDADES', '--repo', REPO, '--body', rolNovedades], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (secreto.status === 0 && variable.status === 0) {
      hecho('Guardado en GitHub. Cada release que publiques saldrá sola en #novedades.');
      return;
    }
    aviso(`gh no pudo guardarlo: ${(secreto.stderr || variable.stderr || '').toString().trim()}`);
  }
  // Sin gh: se copia al portapapeles para pegarlo en GitHub.
  const clip = spawnSync('clip', [], { input: webhook.url });
  if (clip.status === 0) hecho('He copiado la URL del webhook al portapapeles (no se muestra por seguridad).');
  console.log('  Pégala en GitHub → Settings → Secrets and variables → Actions → New repository secret:');
  console.log('    Nombre: DISCORD_WEBHOOK_NOVEDADES   Valor: (Ctrl+V)');
  console.log(`  Y en la pestaña Variables: DISCORD_ROL_NOVEDADES = ${rolNovedades}`);
}
