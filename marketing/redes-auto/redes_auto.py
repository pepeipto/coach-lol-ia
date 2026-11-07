"""Coach LoL IA - genera los Shorts de la semana (guion -> voz -> montaje).

Uso (desde esta carpeta):
    python redes_auto.py              # todos los vídeos de guiones.json
    python redes_auto.py 03           # solo el vídeo 03
    python redes_auto.py --sin-voz    # prueba sin ElevenLabs (voz muda)

Necesita: Python 3 con Pillow, ffmpeg y la clave ELEVENLABS_API_KEY
(se lee de E:\\jarvis\\.env o de la variable de entorno).
Salida: salida\\NN-fecha.mp4 y salida\\textos.txt (títulos y descripciones).
Hecho con ayuda de IA.
"""
import base64, glob, json, os, re, shutil, subprocess, sys, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "salida")
TMP = os.path.join(SALIDA, "tmp")
W, H = 1080, 1920
ORO, BLANCO, GRIS, FONDO = (240, 196, 90), (245, 247, 252), (160, 170, 195), (10, 14, 26)

from PIL import Image, ImageDraw, ImageFont, ImageFilter


def fuente(tam, negrita=True):
    cands = (["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf",
              "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"] if negrita else
             ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf",
              "/usr/share/fonts/opentype/inter/Inter-Regular.otf"])
    for c in cands:
        if os.path.exists(c):
            return ImageFont.truetype(c, tam)
    return ImageFont.load_default()


def ffmpeg_bin():
    p = shutil.which("ffmpeg")
    if p:
        return p
    for pat in [r"C:\ffmpeg\bin\ffmpeg.exe", r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
                os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\*\*\bin\ffmpeg.exe"),
                r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"]:
        g = glob.glob(pat)
        if g:
            return g[0]
    sys.exit("No encuentro ffmpeg. Instálalo con: winget install Gyan.FFmpeg")


FF = ffmpeg_bin()


def clave_eleven():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if k:
        return k
    for ruta in [r"E:\jarvis\.env", os.path.join(AQUI, ".env")]:
        if os.path.exists(ruta):
            for linea in open(ruta, encoding="utf-8", errors="ignore"):
                if linea.startswith("ELEVENLABS_API_KEY="):
                    return linea.split("=", 1)[1].strip().strip('"')
    sys.exit("Falta ELEVENLABS_API_KEY")


def voz(texto, voz_id, destino):
    """Devuelve lista de palabras con (inicio, fin) usando la alineación de ElevenLabs."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voz_id}/with-timestamps?output_format=mp3_44100_128"
    cuerpo = json.dumps({"text": texto, "model_id": "eleven_multilingual_v2",
                         "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}).encode()
    req = urllib.request.Request(url, cuerpo, {"xi-api-key": clave_eleven(),
                                               "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.load(r)
    open(destino, "wb").write(base64.b64decode(d["audio_base64"]))
    al = d["alignment"]
    return palabras_desde(al["characters"], al["character_start_times_seconds"],
                          al["character_end_times_seconds"])


def voz_muda(texto, destino):
    chars = list(texto)
    t = [i * 0.065 for i in range(len(chars) + 1)]
    subprocess.run([FF, "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                    "-t", f"{t[-1] + 0.3:.2f}", "-c:a", "libmp3lame", destino], check=True)
    return palabras_desde(chars, t[:-1], t[1:])


def palabras_desde(chars, ini, fin):
    out, cur, a = [], "", None
    for c, s, e in zip(chars, ini, fin):
        if c.isspace():
            if cur:
                out.append((cur, a, b))
            cur, a = "", None
        else:
            if a is None:
                a = s
            cur += c
            b = e
    if cur:
        out.append((cur, a, b))
    return out


def trozos(palabras, maxw=3):
    """Agrupa palabras en subtítulos cortos; corta tras puntuación."""
    res, g = [], []
    for p in palabras:
        g.append(p)
        if g[-1][0] == "punto" or (len(g) >= 2 and g[-2][0] == "punto"):
            continue
        if len(g) >= maxw or re.search(r"[.,:;?!]$", p[0]):
            res.append(g); g = []
    if g:
        res.append(g)
    salida = []
    for i, g in enumerate(res):
        ini = g[0][1]
        fin = res[i + 1][0][1] if i + 1 < len(res) else g[-1][2] + 0.4
        txt = " ".join(x[0] for x in g).replace("coachlolia punto com", "coachlolia.com")
        salida.append((txt, ini, fin))
    return salida


def texto_rico(d, cx, y, linea, f):
    partes = linea.split("*")
    total = sum(d.textlength(p, font=f) for p in partes)
    x = cx - total / 2
    for i, p in enumerate(partes):
        d.text((x + 4, y + 4), p, font=f, fill=(0, 0, 0))
        d.text((x, y), p, font=f, fill=ORO if i % 2 else BLANCO)
        x += d.textlength(p, font=f)


def envolver(d, texto, f, maxw):
    ws, lineas, cur = texto.split(), [], ""
    for w in ws:
        t = (cur + " " + w).strip()
        if d.textlength(t.replace("*", ""), font=f) <= maxw:
            cur = t
        else:
            lineas.append(cur); cur = w
    lineas.append(cur)
    # cerrar/abrir asteriscos por línea para que el color no se rompa
    res, abierto = [], False
    for l in lineas:
        l2 = ("*" if abierto else "") + l
        if l.count("*") % 2:
            abierto = not abierto
        if abierto:
            l2 += "*"
        res.append(l2)
    return res


def capa_fija(titulo, ruta):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = fuente(84)
    y = 170
    for l in envolver(d, titulo, f, 980):
        texto_rico(d, W / 2, y, l, f); y += 100
    d.text((W / 2, 445), "COACH LOL IA", font=fuente(38), fill=ORO, anchor="mm")
    ic = Image.open(os.path.join(AQUI, "icono.png")).convert("RGBA").resize((84, 84))
    im.paste(ic, (W // 2 - 250, 1665), ic)
    d.text((W // 2 - 145, 1672), "coachlolia.com", font=fuente(56), fill=BLANCO)
    peq = fuente(28, False)
    for i, s in enumerate(["Gratis · Solo Windows · Proyecto independiente, no respaldado por Riot Games",
                           "Voz generada con IA · Hecho con ayuda de IA"]):
        d.text((W / 2, 1790 + i * 40), s, font=peq, fill=GRIS, anchor="mm")
    im.save(ruta)


def capa_gancho(texto, ruta):
    im = Image.new("RGBA", (W, 420), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = fuente(112)
    lineas = envolver(d, texto, f, 1000)
    y = 210 - len(lineas) * 65
    for l in lineas:
        partes = l.split("*"); total = sum(d.textlength(p, font=f) for p in partes)
        x = (W - total) / 2
        for i, p in enumerate(partes):
            d.text((x, y), p, font=f, fill=ORO if i % 2 else BLANCO, stroke_width=8, stroke_fill=(0, 0, 0))
            x += d.textlength(p, font=f)
        y += 130
    im.save(ruta)


def capa_sub(texto, ruta):
    im = Image.new("RGBA", (W, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = fuente(76)
    lineas = envolver(d, texto, f, 960)
    y = 130 - len(lineas) * 46
    for l in lineas:
        tw = d.textlength(l, font=f)
        x = (W - tw) / 2
        d.rounded_rectangle([x - 22, y - 6, x + tw + 22, y + 88], 18, fill=(0, 0, 0, 170))
        d.text((x, y), l, font=f, fill=BLANCO, stroke_width=3, stroke_fill=(0, 0, 0))
        y += 96
    im.save(ruta)


def imagen_cuadrada(fuente_cfg, ruta):
    src = Image.open(os.path.join(AQUI, fuente_cfg["archivo"])).convert("RGB")
    z = fuente_cfg.get("zoom")
    if z:
        src = src.crop(tuple(z))
    k = min(1080 / src.width, 1080 / src.height)
    src = src.resize((int(src.width * k), int(src.height * k)), Image.LANCZOS)
    lienzo = Image.new("RGB", (1080, 1080), FONDO)
    lienzo.paste(src, ((1080 - src.width) // 2, (1080 - src.height) // 2))
    lienzo.save(ruta)


def montar(v, cfg, sin_voz):
    os.makedirs(TMP, exist_ok=True)
    vid = v["id"]
    cierre = v.get("cierre", cfg["cierre"])
    texto = (v["texto"] + " " + cierre).strip()
    mp3 = os.path.join(TMP, f"{vid}.mp3")
    palabras = voz_muda(texto, mp3) if sin_voz else voz(texto, cfg["voz_id"], mp3)
    dur = palabras[-1][2] + 0.8
    fija = os.path.join(TMP, f"{vid}-fija.png")
    capa_fija(v["titulo"], fija)
    subs = trozos(palabras)
    entradas = ["-f", "lavfi", "-t", f"{dur:.2f}", "-i", f"color=c=0x0a0e1a:s={W}x{H}:r=30"]
    fu = v["fuente"]
    ga = v.get("gancho")  # {"archivo","ss","dur","texto"}: arranque con la jugada más vistosa
    gdur = ga.get("dur", 2.2) if ga else 0
    if fu["tipo"] == "clip":
        entradas += ["-stream_loop", "-1", "-ss", str(fu.get("ss", 0)), "-i",
                     os.path.join(AQUI, fu["archivo"])]
        visual = "[1:v]crop=ih:ih:(iw-ih)/2:0,scale=1080:1080,setsar=1,fps=30[g]"
        if ga:
            visual = ("[1:v]crop=ih:ih:(iw-ih)/2:0,scale=1080:1080,setsar=1,fps=30[gm];"
                      "[GA:v]crop=ih*0.8:ih*0.8:(iw-ih*0.8)/2:ih*0.1,scale=1080:1080,setsar=1,fps=30,"
                      f"trim=0:{gdur},setpts=PTS-STARTPTS[gh];[gh][gm]concat=n=2:v=1:a=0[g]")
    else:
        cuad = os.path.join(TMP, f"{vid}-img.png")
        imagen_cuadrada(fu, cuad)
        entradas += ["-loop", "1", "-framerate", "30", "-i", cuad]
        nf = int(dur * 30) + 30
        visual = (f"[1:v]scale=2160:2160,zoompan=z='1+0.25*on/{nf}':x='iw/2-(iw/zoom/2)':"
                  f"y='ih/2-(ih/zoom/2)':d=1:s=1080x1080:fps=30,setsar=1[g]")
    entradas += ["-i", mp3, "-loop", "1", "-i", fija]
    n_ga = None
    if ga and fu["tipo"] == "clip":
        entradas += ["-ss", str(ga["ss"]), "-t", f"{gdur + 0.5:.2f}", "-i", os.path.join(AQUI, ga["archivo"])]
        n_ga = 4
        visual = visual.replace("[GA:v]", "[4:v]")
    filtros = [visual, "[0:v][g]overlay=0:520:shortest=1[b0]", "[b0][3:v]overlay=0:0[b1]"]
    ult = "b1"
    n = 5 if n_ga else 4
    if ga and ga.get("texto"):
        pg = os.path.join(TMP, f"{vid}-gancho.png")
        capa_gancho(ga["texto"], pg)
        entradas += ["-loop", "1", "-i", pg]
        filtros.append(f"[{ult}][{n}:v]overlay=0:820:enable='lt(t,{gdur})'[gk]")
        ult = "gk"; n += 1
    # paneles de la app superpuestos al gameplay (recortes de una captura real)
    for j, pa in enumerate(v.get("paneles", [])):
        rec = Image.open(os.path.join(AQUI, pa["img"])).convert("RGB").crop(tuple(pa["caja"]))
        e = pa.get("escala", 2.0)
        rec = rec.resize((int(rec.width * e), int(rec.height * e)), Image.LANCZOS)
        pp = os.path.join(TMP, f"{vid}-p{j}.png")
        rec.save(pp)
        entradas += ["-loop", "1", "-i", pp]
        filtros.append(f"[{ult}][{n}:v]overlay={pa['x']}:{520 + pa['y']}:enable='gte(t,{pa['desde']})'[p{j}]")
        ult = f"p{j}"
        n += 1
    for i, (t, a, b) in enumerate(subs):
        p = os.path.join(TMP, f"{vid}-s{i:02d}.png")
        capa_sub(t, p)
        entradas += ["-i", p]
        filtros.append(f"[{ult}][{n}:v]overlay=0:1330:enable='between(t,{a:.3f},{b:.3f})'[c{i}]")
        ult = f"c{i}"
        n += 1
    os.makedirs(SALIDA, exist_ok=True)
    out = os.path.join(SALIDA, f"{vid}-{v['fecha']}.mp4")
    cmd = [FF, "-y", "-v", "error"] + entradas + [
        "-filter_complex", ";".join(filtros), "-map", f"[{ult}]", "-map", "2:a",
        "-t", f"{dur:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-maxrate", "2800k", "-bufsize", "5600k",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    return out, dur


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sin_voz = "--sin-voz" in sys.argv
    cfg = json.load(open(os.path.join(AQUI, "guiones.json"), encoding="utf-8"))
    textos = []
    for v in cfg["videos"]:
        if args and v["id"] not in args:
            continue
        out, dur = montar(v, cfg, sin_voz)
        print(f"OK {out} ({dur:.1f} s)")
        desc = (v["titulo_red"] + "\n\n" + v["texto"] +
                "\n\nApp gratis de coach de LoL en español (estoy empezando, se aceptan opiniones): "
                "https://coachlolia.com/?utm_source=youtube\nDiscord: https://discord.gg/wNrW7tREPJ\n"
                "Hecho con ayuda de IA · Proyecto independiente, no respaldado por Riot Games.\n\n" +
                cfg["hashtags"])
        tiktok = (v["titulo_red"] + " ¿Qué opináis? App gratis en coachlolia.com · Hecho con ayuda de IA "
                  "#zed #lol #leagueoflegends #lolespañol #coachlolia")
        textos.append(f"=== {v['id']} · {v['fecha']} 17:00 ===\nTÍTULO: {v['titulo_red']}\n"
                      f"--- YouTube (descripción) ---\n{desc}\n--- TikTok ---\n{tiktok}\n")
    if textos:
        open(os.path.join(SALIDA, "textos.txt"), "w", encoding="utf-8").write("\n".join(textos))


if __name__ == "__main__":
    main()
