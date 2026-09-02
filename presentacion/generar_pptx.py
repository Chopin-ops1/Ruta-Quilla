# -*- coding: utf-8 -*-
"""
RutaQuilla — Generador de Presentación PowerPoint
Estética: Dark theme premium con acentos ámbar (#F59E0B) y cyan (#06B6D4)
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# ── Paleta de colores (idéntica al CSS de RutaQuilla) ──
BG_DARK = RGBColor(0x0B, 0x11, 0x20)
BG_SURFACE = RGBColor(0x11, 0x18, 0x27)
BG_CARD = RGBColor(0x1E, 0x29, 0x3B)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)
AMBER_LIGHT = RGBColor(0xFB, 0xBF, 0x24)
AMBER_DARK = RGBColor(0xD9, 0x77, 0x06)
CYAN = RGBColor(0x06, 0xB6, 0xD4)
CYAN_LIGHT = RGBColor(0x22, 0xD3, 0xEE)
TEXT_PRIMARY = RGBColor(0xF1, 0xF5, 0xF9)
TEXT_SECONDARY = RGBColor(0x94, 0xA3, 0xB8)
TEXT_MUTED = RGBColor(0x64, 0x74, 0x8B)
BORDER = RGBColor(0x33, 0x41, 0x55)
SUCCESS = RGBColor(0x10, 0xB9, 0x81)
DANGER = RGBColor(0xEF, 0x44, 0x44)
PURPLE = RGBColor(0x8B, 0x5C, 0xF6)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x00, 0x00, 0x00)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H

# ── Helper functions ──

def set_slide_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_shape(slide, left, top, width, height, fill_color, border_color=None, radius=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1)
    else:
        shape.line.fill.background()
    return shape

def add_text_box(slide, left, top, width, height):
    return slide.shapes.add_textbox(left, top, width, height)

def set_text(tf, text, size=18, color=TEXT_PRIMARY, bold=False, font_name='Calibri', align=PP_ALIGN.LEFT, spacing=1.2):
    tf.clear()
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = align
    p.space_after = Pt(size * 0.3)
    return p

def add_paragraph(tf, text, size=16, color=TEXT_PRIMARY, bold=False, font_name='Calibri', align=PP_ALIGN.LEFT, bullet=False):
    p = tf.add_paragraph()
    p.text = text
    p.font.size = Pt(size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = align
    p.space_after = Pt(size * 0.25)
    if bullet:
        p.level = 0
    return p

def add_accent_line(slide, left, top, width, color=AMBER):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, Pt(3))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape

def add_decorative_circle(slide, left, top, size, color, alpha=40):
    """Add a subtle decorative circle"""
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, left, top, size, size)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    # Transparency via XML
    from pptx.oxml.ns import qn
    from lxml import etree
    spPr = shape._element.spPr
    solidFill = spPr.find(qn('a:solidFill'))
    if solidFill is not None:
        srgb = solidFill.find(qn('a:srgbClr'))
        if srgb is not None:
            alpha_elem = etree.SubElement(srgb, qn('a:alpha'))
            alpha_elem.set('val', str(alpha * 1000))
    return shape

def slide_number_footer(slide, num, total):
    """Add slide number in bottom-right"""
    txBox = add_text_box(slide, Inches(11.5), Inches(7.0), Inches(1.5), Inches(0.4))
    set_text(txBox.text_frame, f"{num} / {total}", size=10, color=TEXT_MUTED, align=PP_ALIGN.RIGHT)

def slide_brand_footer(slide):
    """Add brand footer bottom-left"""
    txBox = add_text_box(slide, Inches(0.5), Inches(7.0), Inches(3), Inches(0.4))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    run1 = p.add_run()
    run1.text = "Ruta"
    run1.font.size = Pt(10)
    run1.font.color.rgb = TEXT_MUTED
    run1.font.bold = True
    run1.font.name = 'Calibri'
    run2 = p.add_run()
    run2.text = "Quilla"
    run2.font.size = Pt(10)
    run2.font.color.rgb = AMBER
    run2.font.bold = True
    run2.font.name = 'Calibri'
    run3 = p.add_run()
    run3.text = "  •  rutaquilla.me"
    run3.font.size = Pt(10)
    run3.font.color.rgb = TEXT_MUTED
    run3.font.name = 'Calibri'

TOTAL_SLIDES = 12
logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')

# ════════════════════════════════════════════════════════════
# SLIDE 1 — PORTADA
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
set_slide_bg(slide, BG_DARK)

# Decorative circles
add_decorative_circle(slide, Inches(-1), Inches(-1), Inches(5), AMBER, alpha=6)
add_decorative_circle(slide, Inches(10), Inches(4), Inches(5), CYAN, alpha=5)

# Logo
if os.path.exists(logo_path):
    slide.shapes.add_picture(logo_path, Inches(5.65), Inches(0.6), Inches(2), Inches(2))

# Title
txBox = add_text_box(slide, Inches(1), Inches(2.9), Inches(11.3), Inches(1.2))
tf = txBox.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
run1 = p.add_run()
run1.text = "Ruta"
run1.font.size = Pt(54)
run1.font.color.rgb = TEXT_PRIMARY
run1.font.bold = True
run1.font.name = 'Calibri'
run2 = p.add_run()
run2.text = "Quilla"
run2.font.size = Pt(54)
run2.font.color.rgb = AMBER
run2.font.bold = True
run2.font.name = 'Calibri'

# Accent line
add_accent_line(slide, Inches(5.2), Inches(4.15), Inches(2.9), AMBER)

# Subtitle
txBox = add_text_box(slide, Inches(2), Inches(4.4), Inches(9.3), Inches(0.8))
set_text(txBox.text_frame, "Plataforma de Mapeo Colaborativo del Transporte Público de Barranquilla",
         size=20, color=TEXT_SECONDARY, align=PP_ALIGN.CENTER)

# Plan de negocios tag
card = add_shape(slide, Inches(4.9), Inches(5.4), Inches(3.5), Inches(0.5), BG_CARD, BORDER)
txBox = add_text_box(slide, Inches(4.9), Inches(5.42), Inches(3.5), Inches(0.5))
set_text(txBox.text_frame, "📋  Plan de Negocios E-Commerce", size=13, color=AMBER_LIGHT, bold=True, align=PP_ALIGN.CENTER)

# Author info
txBox = add_text_box(slide, Inches(2), Inches(6.2), Inches(9.3), Inches(0.7))
tf = txBox.text_frame
set_text(tf, "Daniel Barraza Segura  •  Ingeniería Informática  •  Prof. Jonathan Quant  •  Mayo 2026",
         size=12, color=TEXT_MUTED, align=PP_ALIGN.CENTER)

slide_number_footer(slide, 1, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 2 — PROBLEMA Y SOLUCIÓN
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)
add_decorative_circle(slide, Inches(11), Inches(-2), Inches(4), DANGER, alpha=5)

# Title
txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(8), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
p.alignment = PP_ALIGN.LEFT
run = p.add_run()
run.text = "El Problema"
run.font.size = Pt(36)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
run.font.name = 'Calibri'
add_accent_line(slide, Inches(0.8), Inches(1.1), Inches(2), DANGER)

# Problem card
card = add_shape(slide, Inches(0.8), Inches(1.5), Inches(5.5), Inches(2.8), BG_CARD, BORDER)
txBox = add_text_box(slide, Inches(1.2), Inches(1.7), Inches(4.8), Inches(2.5))
tf = txBox.text_frame
set_text(tf, "🚌  Barranquilla: 1.2M+ habitantes sin solución digital", size=16, color=DANGER, bold=True)
add_paragraph(tf, "", size=6, color=TEXT_MUTED)
add_paragraph(tf, "▸  14+ cooperativas de buses sin información digital", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Sin paradas fijas ni rutas publicadas", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Google Maps solo cubre Transmetro (BRT)", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Usuarios pierden 20+ min esperando en la calle", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  ~600,000 viajes diarios sin guía digital", size=14, color=TEXT_SECONDARY)

# Solution title
txBox = add_text_box(slide, Inches(7), Inches(0.4), Inches(6), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
p.alignment = PP_ALIGN.LEFT
run = p.add_run()
run.text = "La Solución"
run.font.size = Pt(36)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
run.font.name = 'Calibri'
add_accent_line(slide, Inches(7), Inches(1.1), Inches(2), SUCCESS)

# Solution card
card = add_shape(slide, Inches(7), Inches(1.5), Inches(5.5), Inches(2.8), BG_CARD, BORDER)
txBox = add_text_box(slide, Inches(7.4), Inches(1.7), Inches(4.8), Inches(2.5))
tf = txBox.text_frame
set_text(tf, "🗺️  RutaQuilla — \"Waze para los buses\"", size=16, color=SUCCESS, bold=True)
add_paragraph(tf, "", size=6, color=TEXT_MUTED)
add_paragraph(tf, "▸  Mapa interactivo con navegación A → B en bus", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Datos construidos por la comunidad (crowdsourcing GPS)", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Gamificación: XP, niveles e insignias", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Reportes de incidentes en tiempo real", size=14, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Modelo freemium con Quilla-Pass premium", size=14, color=TEXT_SECONDARY)

# Propuesta de valor central
card = add_shape(slide, Inches(0.8), Inches(4.7), Inches(11.7), Inches(1.8), BG_SURFACE, AMBER)
txBox = add_text_box(slide, Inches(1.3), Inches(4.9), Inches(10.7), Inches(1.5))
tf = txBox.text_frame
set_text(tf, "💡 PROPUESTA DE VALOR", size=11, color=AMBER, bold=True, align=PP_ALIGN.CENTER)
add_paragraph(tf, "\"Conectamos a Barranquilla con su transporte: la primera solución comunitaria para navegar las rutas tradicionales de bus de forma inteligente y en tiempo real.\"",
              size=16, color=TEXT_PRIMARY, align=PP_ALIGN.CENTER)

slide_brand_footer(slide)
slide_number_footer(slide, 2, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 3 — UX / INTERFAZ
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)
add_decorative_circle(slide, Inches(-1), Inches(3), Inches(4), CYAN, alpha=5)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Interfaz & Experiencia de Usuario"
run.font.size = Pt(36)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.1), Inches(3), CYAN)

# Feature cards
features_data = [
    ("🎨", "Estética Caribe", "Dark theme premium (#0B1120)\nAcentos ámbar dorado + cyan\nGlassmorphism y micro-animaciones", AMBER),
    ("📱", "Mobile-First", "100% responsive, optimizado\npara uso en movimiento\nDiseño touch-friendly", CYAN),
    ("🗺️", "Mapa Interactivo", "Tiles CARTO Dark Matter\nNavegación A→B en bus\nPin-drop para marcar puntos", SUCCESS),
    ("🌗", "Modo Claro/Oscuro", "Toggle persistente que respeta\npreferencias del sistema\nTransiciones suaves", PURPLE),
]

for i, (icon, title, desc, accent) in enumerate(features_data):
    col = i % 4
    x = Inches(0.8 + col * 3.1)
    y = Inches(1.6)

    card = add_shape(slide, x, y, Inches(2.8), Inches(2.6), BG_CARD, BORDER)

    # Icon circle
    circle = add_shape(slide, x + Inches(0.9), y + Inches(0.25), Inches(1), Inches(1), BG_SURFACE, accent)

    txBox = add_text_box(slide, x + Inches(0.2), y + Inches(0.4), Inches(2.4), Inches(0.5))
    set_text(txBox.text_frame, icon, size=30, align=PP_ALIGN.CENTER)

    txBox = add_text_box(slide, x + Inches(0.2), y + Inches(1.35), Inches(2.4), Inches(0.35))
    set_text(txBox.text_frame, title, size=15, color=accent, bold=True, align=PP_ALIGN.CENTER)

    txBox = add_text_box(slide, x + Inches(0.2), y + Inches(1.7), Inches(2.4), Inches(0.8))
    set_text(txBox.text_frame, desc, size=11, color=TEXT_SECONDARY, align=PP_ALIGN.CENTER)

# Funcionalidades clave row
funcs = [
    ("⭐", "Rutas favoritas"),
    ("🕐", "Historial búsquedas"),
    ("📍", "GPS crowdsourcing"),
    ("🏆", "Gamificación (XP)"),
    ("⚠️", "Reportes incidentes"),
    ("👑", "Quilla-Pass Premium"),
]

y_row = Inches(4.6)
for i, (icon, label) in enumerate(funcs):
    x = Inches(0.8 + i * 2.05)
    card = add_shape(slide, x, y_row, Inches(1.85), Inches(1.0), BG_SURFACE, BORDER)
    txBox = add_text_box(slide, x, y_row + Inches(0.1), Inches(1.85), Inches(0.4))
    set_text(txBox.text_frame, icon, size=22, align=PP_ALIGN.CENTER)
    txBox = add_text_box(slide, x, y_row + Inches(0.55), Inches(1.85), Inches(0.4))
    set_text(txBox.text_frame, label, size=10, color=TEXT_SECONDARY, align=PP_ALIGN.CENTER)

# Tech pills at bottom
txBox = add_text_box(slide, Inches(0.8), Inches(5.9), Inches(11.7), Inches(0.5))
tf = txBox.text_frame
set_text(tf, "Fuentes: Inter + Outfit  •  Leaflet Maps  •  Animaciones CSS  •  Glassmorphism  •  Dark/Light themes",
         size=11, color=TEXT_MUTED, align=PP_ALIGN.CENTER)

slide_brand_footer(slide)
slide_number_footer(slide, 3, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 4 — BUSINESS MODEL CANVAS
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

txBox = add_text_box(slide, Inches(0.8), Inches(0.3), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Business Model Canvas"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(0.95), Inches(2.5), AMBER)

bmc_data = [
    ("Socios Clave", "Cooperativas de buses\n(Sobrusa, Coolitoral, +11)\nAMBQ\nNegocios locales\nDigitalOcean / MongoDB", AMBER, 0, 0, 2.6, 2.5),
    ("Actividades Clave", "Desarrollo plataforma web\nVerificación GPS tracks\nGestión de comunidad\nAlianzas cooperativas", CYAN, 2.7, 0, 2.6, 1.2),
    ("Propuesta de Valor", "Única app del TPC de BAQ\nNavegación A→B en bus\nDatos por la comunidad\nReportes tiempo real\nFreemium + Premium", SUCCESS, 5.4, 0, 2.6, 2.5),
    ("Relación Clientes", "Autoservicio digital\nComunidad gamificada\nLeaderboard + logros\nSoporte email", PURPLE, 8.1, 0, 2.6, 1.2),
    ("Recursos Clave", "Plataforma React+Node\nMongoDB Atlas (2dsphere)\nAlgoritmo navegación\nComunidad activa", CYAN, 2.7, 1.3, 2.6, 1.2),
    ("Canales", "rutaquilla.me\nRedes sociales\nBoca a boca\nPWA móvil", PURPLE, 8.1, 1.3, 2.6, 1.2),
    ("Segmentos", "Usuarios diarios TPC (~600K)\nEstudiantes universitarios\nTrabajadores en bus\nTuristas y visitantes\nNegocios (anunciantes)", AMBER, 10.8, 0, 1.85, 2.5),
]

y_base = Inches(1.3)
for title, content, accent, col, row, w, h in bmc_data:
    x = Inches(0.3 + col)
    y = y_base + Inches(row)
    card = add_shape(slide, x, y, Inches(w), Inches(h), BG_CARD, accent)
    txBox = add_text_box(slide, x + Inches(0.12), y + Inches(0.08), Inches(w - 0.24), Inches(0.3))
    set_text(txBox.text_frame, title, size=10, color=accent, bold=True)
    txBox = add_text_box(slide, x + Inches(0.12), y + Inches(0.35), Inches(w - 0.24), Inches(h - 0.4))
    set_text(txBox.text_frame, content, size=9, color=TEXT_SECONDARY)

# Bottom row: Costs + Revenue
card = add_shape(slide, Inches(0.3), y_base + Inches(2.7), Inches(6.15), Inches(1.1), BG_CARD, DANGER)
txBox = add_text_box(slide, Inches(0.45), y_base + Inches(2.78), Inches(5.8), Inches(0.25))
set_text(txBox.text_frame, "Estructura de Costos", size=10, color=DANGER, bold=True)
txBox = add_text_box(slide, Inches(0.45), y_base + Inches(3.05), Inches(5.8), Inches(0.7))
set_text(txBox.text_frame, "Hosting DigitalOcean (~$12 USD/mes)  •  Dominio (~$15/año)  •  MongoDB Atlas (free tier)  •  Email Zoho  •  Marketing digital",
         size=9, color=TEXT_SECONDARY)

card = add_shape(slide, Inches(6.55), y_base + Inches(2.7), Inches(6.1), Inches(1.1), BG_CARD, SUCCESS)
txBox = add_text_box(slide, Inches(6.7), y_base + Inches(2.78), Inches(5.8), Inches(0.25))
set_text(txBox.text_frame, "Fuentes de Ingreso", size=10, color=SUCCESS, bold=True)
txBox = add_text_box(slide, Inches(6.7), y_base + Inches(3.05), Inches(5.8), Inches(0.7))
set_text(txBox.text_frame, "Quilla-Pass Premium ($15,000/mes)  •  Sponsors en mapa ($100K/mes)  •  Datos B2G  •  Grants innovación cívica",
         size=9, color=TEXT_SECONDARY)

slide_brand_footer(slide)
slide_number_footer(slide, 4, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 5 — MERCADO Y BUYER PERSONA
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)
add_decorative_circle(slide, Inches(11), Inches(-1), Inches(4), AMBER, alpha=5)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Mercado & Buyer Persona"
run.font.size = Pt(36)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.1), Inches(2.5), AMBER)

# Persona Carlos
card = add_shape(slide, Inches(0.8), Inches(1.5), Inches(5.5), Inches(3.2), BG_CARD, CYAN)
txBox = add_text_box(slide, Inches(1.2), Inches(1.65), Inches(4.8), Inches(3.0))
tf = txBox.text_frame
set_text(tf, "👨‍🎓  Carlos — Persona Principal", size=16, color=CYAN_LIGHT, bold=True)
add_paragraph(tf, "", size=4, color=TEXT_MUTED)
add_paragraph(tf, "21 años  •  Estudiante Ing. Sistemas", size=13, color=TEXT_SECONDARY)
add_paragraph(tf, "📍 Barrio Simón Bolívar, Barranquilla", size=12, color=TEXT_MUTED)
add_paragraph(tf, "", size=4, color=TEXT_MUTED)
add_paragraph(tf, "😤  No sabe qué bus tomar. Pierde 20+ min.", size=12, color=DANGER)
add_paragraph(tf, "💰  Gasto diario: $3,700 COP (1 bus)", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "📱  Android gama media, 4G limitado", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "🎯  Quiere llegar a tiempo y ahorrar vs taxi", size=12, color=SUCCESS)

# Persona María
card = add_shape(slide, Inches(7), Inches(1.5), Inches(5.5), Inches(3.2), BG_CARD, PURPLE)
txBox = add_text_box(slide, Inches(7.4), Inches(1.65), Inches(4.8), Inches(3.0))
tf = txBox.text_frame
set_text(tf, "👩‍💼  María — Persona Secundaria", size=16, color=PURPLE, bold=True)
add_paragraph(tf, "", size=4, color=TEXT_MUTED)
add_paragraph(tf, "35 años  •  Auxiliar administrativa", size=13, color=TEXT_SECONDARY)
add_paragraph(tf, "📍 Soledad, Atlántico", size=12, color=TEXT_MUTED)
add_paragraph(tf, "", size=4, color=TEXT_MUTED)
add_paragraph(tf, "😤  Toma 2 buses, 1.5h de viaje diario", size=12, color=DANGER)
add_paragraph(tf, "💰  Gasto diario: $7,400 COP (2 buses)", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "📱  Android básico, WhatsApp", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "🎯  Reducir tiempo, encontrar rutas directas", size=12, color=SUCCESS)

# Market segments
segments = [
    ("Estudiantes (18-28)", "~120,000", "ALTA", SUCCESS),
    ("Trabajadores (25-55)", "~400,000", "ALTA", SUCCESS),
    ("Usuarios ocasionales", "~200,000", "MEDIA", AMBER),
    ("Turistas", "~50,000/año", "MEDIA", AMBER),
]

y_seg = Inches(5.1)
for i, (seg, tam, pri, color) in enumerate(segments):
    x = Inches(0.8 + i * 3.1)
    card = add_shape(slide, x, y_seg, Inches(2.8), Inches(1.0), BG_SURFACE, BORDER)
    txBox = add_text_box(slide, x + Inches(0.15), y_seg + Inches(0.1), Inches(2.5), Inches(0.35))
    set_text(txBox.text_frame, seg, size=12, color=TEXT_PRIMARY, bold=True, align=PP_ALIGN.CENTER)
    txBox = add_text_box(slide, x + Inches(0.15), y_seg + Inches(0.45), Inches(2.5), Inches(0.5))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = tam
    run.font.size = Pt(14)
    run.font.color.rgb = CYAN
    run.font.bold = True
    run2 = p.add_run()
    run2.text = f"  •  Prioridad "
    run2.font.size = Pt(10)
    run2.font.color.rgb = TEXT_MUTED
    run3 = p.add_run()
    run3.text = pri
    run3.font.size = Pt(10)
    run3.font.color.rgb = color
    run3.font.bold = True

slide_brand_footer(slide)
slide_number_footer(slide, 5, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 6 — COMPETENCIA + DOFA
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Competencia & Análisis DOFA"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5), CYAN)

# Competition cards
competitors = [
    ("Q'ruta", "Directa", "App genérica en varias ciudades.\nSin mapeo crowdsourced ni\ngamificación hiperlocal.", DANGER),
    ("Google Maps", "Indirecta", "Solo cubre Transmetro (BRT).\nIgnora los buses tradicionales\n(TPC) completamente.", AMBER),
    ("Moovit", "Indirecta", "Depende de datos de alcaldías.\nSin información útil para\nBarranquilla.", AMBER),
]

for i, (name, tipo, debilidad, color) in enumerate(competitors):
    x = Inches(0.8 + i * 2.9)
    card = add_shape(slide, x, Inches(1.4), Inches(2.6), Inches(2.2), BG_CARD, color)
    txBox = add_text_box(slide, x + Inches(0.15), Inches(1.55), Inches(2.3), Inches(0.3))
    set_text(txBox.text_frame, name, size=16, color=color, bold=True)
    txBox = add_text_box(slide, x + Inches(0.15), Inches(1.85), Inches(2.3), Inches(0.25))
    set_text(txBox.text_frame, f"Competencia {tipo}", size=10, color=TEXT_MUTED)
    txBox = add_text_box(slide, x + Inches(0.15), Inches(2.2), Inches(2.3), Inches(1.2))
    set_text(txBox.text_frame, debilidad, size=11, color=TEXT_SECONDARY)

# Ventaja competitiva pill
card = add_shape(slide, Inches(9.5), Inches(1.4), Inches(3.0), Inches(2.2), BG_SURFACE, SUCCESS)
txBox = add_text_box(slide, Inches(9.65), Inches(1.55), Inches(2.7), Inches(0.3))
set_text(txBox.text_frame, "🏆 Ventaja RutaQuilla", size=13, color=SUCCESS, bold=True)
txBox = add_text_box(slide, Inches(9.65), Inches(1.95), Inches(2.7), Inches(1.5))
set_text(txBox.text_frame, "OCÉANO AZUL\nCero competencia directa\nen TPC de Barranquilla.\nMonopolio de nicho con\nefecto de red.", size=12, color=TEXT_PRIMARY)

# DOFA 2x2
dofa = [
    ("FORTALEZAS", "• Monopolio de nicho\n• Costos ultra-bajos (~$100 USD/mes)\n• Efecto de red\n• Stack moderno y escalable", SUCCESS, 0, 0),
    ("OPORTUNIDADES", "• 1.2M habitantes sin solución\n• Tendencia Smart Cities\n• Expansión a otras ciudades\n• Monetización B2G", CYAN, 1, 0),
    ("DEBILIDADES", "• Sin app nativa (solo web)\n• Base de rutas en construcción\n• Equipo pequeño\n• Sin pasarela de pagos aún", AMBER, 0, 1),
    ("AMENAZAS", "• Google Maps podría agregar TPC\n• Baja penetración datos en barrios\n• Resistencia cooperativas\n• Riesgo de no alcanzar masa crítica", DANGER, 1, 1),
]

for title, content, color, col, row in dofa:
    x = Inches(0.8 + col * 6.15)
    y = Inches(3.95 + row * 1.65)
    card = add_shape(slide, x, y, Inches(5.9), Inches(1.5), BG_CARD, color)
    txBox = add_text_box(slide, x + Inches(0.15), y + Inches(0.08), Inches(5.5), Inches(0.25))
    set_text(txBox.text_frame, title, size=11, color=color, bold=True)
    txBox = add_text_box(slide, x + Inches(0.15), y + Inches(0.35), Inches(5.5), Inches(1.0))
    set_text(txBox.text_frame, content, size=11, color=TEXT_SECONDARY)

slide_brand_footer(slide)
slide_number_footer(slide, 6, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 7 — STACK TÉCNICO
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)
add_decorative_circle(slide, Inches(10), Inches(4), Inches(5), CYAN, alpha=4)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Arquitectura & Stack Técnico"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5), PURPLE)

# Stack table
stack_items = [
    ("Frontend", "React 19 + Vite 8 + Tailwind 4", "Rendimiento, componentes reutilizables", CYAN),
    ("Mapas", "Leaflet + CARTO Dark tiles", "Open source, ligero, customizable", SUCCESS),
    ("Backend", "Node.js + Express 4", "Async, ideal para APIs geoespaciales", AMBER),
    ("Base de Datos", "MongoDB Atlas (2dsphere)", "Índices geoespaciales nativos", PURPLE),
    ("Auth", "JWT + bcrypt (12 rounds)", "Seguro, stateless", DANGER),
    ("Routing", "OSRM (Open Source Routing)", "Snap to Roads + navegación A→B", CYAN),
    ("Email", "Nodemailer + Zoho SMTP", "Transaccional (verificación, logros)", TEXT_SECONDARY),
    ("Deploy", "DigitalOcean App Platform", "CI/CD desde GitHub, SSL incluido", SUCCESS),
]

for i, (layer, tech, justification, color) in enumerate(stack_items):
    y = Inches(1.4 + i * 0.62)
    # Layer badge
    card = add_shape(slide, Inches(0.8), y, Inches(2.2), Inches(0.5), BG_CARD, color)
    txBox = add_text_box(slide, Inches(0.9), y + Inches(0.05), Inches(2.0), Inches(0.4))
    set_text(txBox.text_frame, layer, size=12, color=color, bold=True, align=PP_ALIGN.CENTER)
    # Tech
    txBox = add_text_box(slide, Inches(3.2), y + Inches(0.05), Inches(4.5), Inches(0.4))
    set_text(txBox.text_frame, tech, size=13, color=TEXT_PRIMARY, bold=True)
    # Justification
    txBox = add_text_box(slide, Inches(7.8), y + Inches(0.05), Inches(5), Inches(0.4))
    set_text(txBox.text_frame, justification, size=11, color=TEXT_MUTED)

# Architecture diagram simplified
card = add_shape(slide, Inches(0.8), Inches(6.5), Inches(11.7), Inches(0.5), BG_SURFACE, BORDER)
txBox = add_text_box(slide, Inches(0.9), Inches(6.52), Inches(11.5), Inches(0.45))
set_text(txBox.text_frame,
         "React (Vite)  →  Express API  →  MongoDB Atlas  |  OSRM + Nominatim  |  Leaflet Maps  |  JWT Auth  |  DigitalOcean CI/CD",
         size=12, color=CYAN, align=PP_ALIGN.CENTER, bold=True)

slide_brand_footer(slide)
slide_number_footer(slide, 7, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 8 — SEGURIDAD Y LEGAL
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Seguridad & Marco Legal"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5), DANGER)

# Security measures
security_items = [
    ("🔐", "SSL/HTTPS", "Comunicación cifrada TLS — DigitalOcean"),
    ("🛡️", "Helmet.js", "CSP, HSTS, X-Frame-Options"),
    ("⏱️", "Rate Limiting", "60 req/15min, 10 para auth"),
    ("🚫", "Anti-Inyección", "Mongo sanitize + validación input"),
    ("🔑", "bcrypt (12 rounds)", "Contraseñas irrecuperables"),
    ("🎫", "JWT Tokens", "128-char secret, 7 días exp."),
]

for i, (icon, title, desc) in enumerate(security_items):
    col = i % 3
    row = i // 3
    x = Inches(0.8 + col * 4.1)
    y = Inches(1.4 + row * 1.6)
    card = add_shape(slide, x, y, Inches(3.8), Inches(1.3), BG_CARD, BORDER)
    txBox = add_text_box(slide, x + Inches(0.15), y + Inches(0.15), Inches(3.5), Inches(0.35))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = f"{icon}  {title}"
    run.font.size = Pt(14)
    run.font.color.rgb = DANGER
    run.font.bold = True
    txBox = add_text_box(slide, x + Inches(0.15), y + Inches(0.6), Inches(3.5), Inches(0.5))
    set_text(txBox.text_frame, desc, size=12, color=TEXT_SECONDARY)

# Legal section
card = add_shape(slide, Inches(0.8), Inches(4.8), Inches(5.8), Inches(1.8), BG_SURFACE, AMBER)
txBox = add_text_box(slide, Inches(1.2), Inches(4.95), Inches(5.0), Inches(1.6))
tf = txBox.text_frame
set_text(tf, "📜  Marco Legal", size=15, color=AMBER, bold=True)
add_paragraph(tf, "", size=4)
add_paragraph(tf, "▸  Habeas Data — Ley 1581 de 2012", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Términos y Condiciones implementados", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Política de privacidad completa", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Consentimiento de cookies (GDPR-style)", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Derechos ARCO vía noreply@rutaquilla.me", size=12, color=TEXT_SECONDARY)

# Data
card = add_shape(slide, Inches(6.9), Inches(4.8), Inches(5.6), Inches(1.8), BG_SURFACE, CYAN)
txBox = add_text_box(slide, Inches(7.3), Inches(4.95), Inches(4.8), Inches(1.6))
tf = txBox.text_frame
set_text(tf, "💾  Datos Almacenados", size=15, color=CYAN, bold=True)
add_paragraph(tf, "", size=4)
add_paragraph(tf, "▸  Nombre, email, contraseña (hash bcrypt)", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  NO almacena documentos ni datos financieros", size=12, color=SUCCESS)
add_paragraph(tf, "▸  Geolocalización: tracks GPS voluntarios", size=12, color=TEXT_SECONDARY)
add_paragraph(tf, "▸  Usuario puede suprimir/revocar en cualquier momento", size=12, color=TEXT_SECONDARY)

slide_brand_footer(slide)
slide_number_footer(slide, 8, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 9 — MARKETING Y EMBUDO
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)
add_decorative_circle(slide, Inches(-1), Inches(4), Inches(4), PURPLE, alpha=5)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Marketing & Embudo de Conversión"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5), PURPLE)

# Social media strategy
social = [
    ("📸", "Instagram", "5/sem", "Reels de rutas, tips,\nhistorias de usuarios"),
    ("🎵", "TikTok", "3-4/sem", "\"¿Sabes qué bus te\nlleva a...?\" POVs"),
    ("📘", "Facebook", "3/sem", "Posts informativos,\nencuestas, noticias"),
    ("💬", "WhatsApp", "Diario", "Canal noticias, grupo\nde contribuidores"),
]

for i, (icon, platform, freq, content) in enumerate(social):
    x = Inches(0.8 + i * 3.1)
    card = add_shape(slide, x, Inches(1.4), Inches(2.8), Inches(1.7), BG_CARD, BORDER)
    txBox = add_text_box(slide, x + Inches(0.15), Inches(1.5), Inches(2.5), Inches(0.35))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = f"{icon} {platform}"
    run.font.size = Pt(14)
    run.font.color.rgb = PURPLE
    run.font.bold = True
    run2 = p.add_run()
    run2.text = f"  ({freq})"
    run2.font.size = Pt(10)
    run2.font.color.rgb = TEXT_MUTED
    txBox = add_text_box(slide, x + Inches(0.15), Inches(2.0), Inches(2.5), Inches(0.9))
    set_text(txBox.text_frame, content, size=11, color=TEXT_SECONDARY)

# Funnel
funnel_steps = [
    ("1", "Descubrimiento", "SEO, redes, boca a boca", CYAN),
    ("2", "Prueba", "3 búsquedas gratis sin registro", AMBER),
    ("3", "Registro", "Cuenta gratuita para continuar", SUCCESS),
    ("4", "Contribución", "GPS, reportes, gana XP", PURPLE),
    ("5", "Premium", "500 XP → 30% dcto Quilla-Pass", AMBER),
    ("6", "Referidos", "Invita amigos, ciclo se repite", CYAN),
]

txBox = add_text_box(slide, Inches(0.8), Inches(3.4), Inches(5), Inches(0.4))
set_text(txBox.text_frame, "EMBUDO DE CONVERSIÓN", size=13, color=AMBER, bold=True)

for i, (num, step, desc, color) in enumerate(funnel_steps):
    y = Inches(3.9 + i * 0.52)
    # Number circle
    circle = add_shape(slide, Inches(0.8), y, Inches(0.4), Inches(0.4), color)
    txBox = add_text_box(slide, Inches(0.8), y + Inches(0.02), Inches(0.4), Inches(0.35))
    set_text(txBox.text_frame, num, size=12, color=BLACK, bold=True, align=PP_ALIGN.CENTER)
    # Step
    txBox = add_text_box(slide, Inches(1.35), y + Inches(0.02), Inches(2.2), Inches(0.35))
    set_text(txBox.text_frame, step, size=13, color=TEXT_PRIMARY, bold=True)
    txBox = add_text_box(slide, Inches(3.6), y + Inches(0.02), Inches(4), Inches(0.35))
    set_text(txBox.text_frame, desc, size=11, color=TEXT_MUTED)

# SEM budget
card = add_shape(slide, Inches(7.5), Inches(3.4), Inches(5.0), Inches(3.4), BG_CARD, BORDER)
txBox = add_text_box(slide, Inches(7.7), Inches(3.5), Inches(4.6), Inches(0.35))
set_text(txBox.text_frame, "💰  Presupuesto SEM Mensual", size=13, color=AMBER, bold=True)

sem_data = [
    ("Google Ads", "$100,000 COP", "Tráfico keywords BAQ"),
    ("Meta Ads", "$150,000 COP", "Registros de usuarios"),
    ("TikTok Ads", "$100,000 COP", "Viralidad + descargas"),
]

for i, (plat, budget, goal) in enumerate(sem_data):
    y = Inches(4.1 + i * 0.7)
    card2 = add_shape(slide, Inches(7.7), y, Inches(4.6), Inches(0.55), BG_SURFACE, BORDER)
    txBox = add_text_box(slide, Inches(7.85), y + Inches(0.05), Inches(1.5), Inches(0.25))
    set_text(txBox.text_frame, plat, size=11, color=TEXT_PRIMARY, bold=True)
    txBox = add_text_box(slide, Inches(9.4), y + Inches(0.05), Inches(1.5), Inches(0.25))
    set_text(txBox.text_frame, budget, size=11, color=AMBER, bold=True)
    txBox = add_text_box(slide, Inches(7.85), y + Inches(0.28), Inches(4.3), Inches(0.2))
    set_text(txBox.text_frame, goal, size=9, color=TEXT_MUTED)

# SEO note
txBox = add_text_box(slide, Inches(7.7), Inches(6.3), Inches(4.6), Inches(0.5))
tf = txBox.text_frame
set_text(tf, "SEO: Open Graph, Twitter Cards, JSON-LD\nimplementados en la plataforma", size=10, color=TEXT_MUTED, align=PP_ALIGN.CENTER)

slide_brand_footer(slide)
slide_number_footer(slide, 9, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 10 — FINANZAS
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)
add_decorative_circle(slide, Inches(11), Inches(5), Inches(4), SUCCESS, alpha=5)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Análisis Financiero"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5), SUCCESS)

# Inversión inicial
card = add_shape(slide, Inches(0.8), Inches(1.4), Inches(5.5), Inches(3.0), BG_CARD, AMBER)
txBox = add_text_box(slide, Inches(1.2), Inches(1.55), Inches(4.8), Inches(2.8))
tf = txBox.text_frame
set_text(tf, "📊  Inversión Inicial", size=16, color=AMBER, bold=True)
add_paragraph(tf, "", size=4)
items = [
    ("Dominio rutaquilla.me (1 año)", "$60,000"),
    ("Hosting DigitalOcean (1 año)", "$2,400,000"),
    ("MongoDB Atlas (M0 gratuito)", "$0"),
    ("Marketing lanzamiento", "$1,500,000"),
    ("Diseño gráfico (branding)", "$800,000"),
]
for item, cost in items:
    p = add_paragraph(tf, "", size=12, color=TEXT_SECONDARY)
    run1 = p.add_run()
    run1.text = f"▸  {item}"
    run1.font.size = Pt(12)
    run1.font.color.rgb = TEXT_SECONDARY
    run2 = p.add_run()
    run2.text = f"   {cost}"
    run2.font.size = Pt(12)
    run2.font.color.rgb = CYAN
    run2.font.bold = True

add_paragraph(tf, "", size=6)
p = add_paragraph(tf, "", size=16)
run = p.add_run()
run.text = "TOTAL: $2,960,000 COP (~$740 USD)"
run.font.size = Pt(15)
run.font.color.rgb = AMBER_LIGHT
run.font.bold = True

# Proyección ventas
card = add_shape(slide, Inches(6.9), Inches(1.4), Inches(5.6), Inches(3.0), BG_CARD, SUCCESS)
txBox = add_text_box(slide, Inches(7.3), Inches(1.55), Inches(4.8), Inches(2.8))
tf = txBox.text_frame
set_text(tf, "📈  Proyección 12 Meses", size=16, color=SUCCESS, bold=True)
add_paragraph(tf, "", size=4)

projections = [
    ("Mes 1-2", "500 usuarios", "$175K"),
    ("Mes 3-4", "2,500 usuarios", "$825K"),
    ("Mes 5-6", "6,000 usuarios", "$2.0M"),
    ("Mes 7-8", "11,000 usuarios", "$3.8M"),
    ("Mes 9-10", "17,500 usuarios", "$6.7M"),
    ("Mes 11-12", "25,000 usuarios", "$10.6M"),
]

for period, users, revenue in projections:
    p = add_paragraph(tf, "", size=11, color=TEXT_SECONDARY)
    run1 = p.add_run()
    run1.text = f"{period}: "
    run1.font.size = Pt(11)
    run1.font.color.rgb = TEXT_MUTED
    run1.font.bold = True
    run2 = p.add_run()
    run2.text = f"{users}  →  "
    run2.font.size = Pt(11)
    run2.font.color.rgb = TEXT_SECONDARY
    run3 = p.add_run()
    run3.text = revenue
    run3.font.size = Pt(12)
    run3.font.color.rgb = SUCCESS
    run3.font.bold = True

add_paragraph(tf, "", size=6)
p = add_paragraph(tf, "", size=15)
run = p.add_run()
run.text = "AÑO 1: ~$42,600,000 COP"
run.font.size = Pt(15)
run.font.color.rgb = SUCCESS
run.font.bold = True

# KPIs
kpis = [
    ("CAC", "$800-1,200 COP", "vs $12K-20K industria"),
    ("LTV", "$153,000 COP", "$15K × 12m × 85% ret."),
    ("LTV/CAC", "153x", "Saludable es >3x"),
    ("Break-even", "Mes 4-5", "57 suscriptores"),
    ("Costos/mes", "~$405,000 COP", "~$100 USD"),
]

y_kpi = Inches(4.8)
for i, (metric, value, note) in enumerate(kpis):
    x = Inches(0.8 + i * 2.45)
    card = add_shape(slide, x, y_kpi, Inches(2.2), Inches(1.5), BG_SURFACE, BORDER)
    txBox = add_text_box(slide, x + Inches(0.1), y_kpi + Inches(0.1), Inches(2.0), Inches(0.25))
    set_text(txBox.text_frame, metric, size=10, color=TEXT_MUTED, bold=True, align=PP_ALIGN.CENTER)
    txBox = add_text_box(slide, x + Inches(0.1), y_kpi + Inches(0.4), Inches(2.0), Inches(0.4))
    set_text(txBox.text_frame, value, size=16, color=AMBER_LIGHT, bold=True, align=PP_ALIGN.CENTER)
    txBox = add_text_box(slide, x + Inches(0.1), y_kpi + Inches(0.9), Inches(2.0), Inches(0.4))
    set_text(txBox.text_frame, note, size=9, color=TEXT_MUTED, align=PP_ALIGN.CENTER)

slide_brand_footer(slide)
slide_number_footer(slide, 10, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 11 — HOJA DE RUTA
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

txBox = add_text_box(slide, Inches(0.8), Inches(0.4), Inches(10), Inches(0.7))
tf = txBox.text_frame
p = tf.paragraphs[0]
run = p.add_run()
run.text = "Hoja de Ruta"
run.font.size = Pt(34)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True
add_accent_line(slide, Inches(0.8), Inches(1.0), Inches(2.5), AMBER)

# Timeline
phases = [
    ("0-3 MESES", "Lanzamiento", [
        "Pasarela de pagos (Wompi)",
        "Progressive Web App (PWA)",
        "Campaña en universidades de BAQ",
        "Primeros 500 usuarios activos",
    ], CYAN, "🚀"),
    ("3-6 MESES", "Crecimiento", [
        "10,000 usuarios registrados",
        "100+ rutas verificadas",
        "Alianzas con cooperativas de buses",
        "App nativa (React Native)",
    ], AMBER, "📈"),
    ("6-12 MESES", "Expansión", [
        "Expansión a Cartagena / Santa Marta",
        "Fondos de innovación cívica",
        "Monetización B2G (datos gobierno)",
        "25,000+ usuarios, comunidad activa",
    ], SUCCESS, "🌎"),
]

for i, (period, name, tasks, color, icon) in enumerate(phases):
    x = Inches(0.8 + i * 4.15)
    
    # Phase card
    card = add_shape(slide, x, Inches(1.5), Inches(3.85), Inches(4.2), BG_CARD, color)
    
    # Icon header
    header = add_shape(slide, x, Inches(1.5), Inches(3.85), Inches(0.9), color)
    txBox = add_text_box(slide, x + Inches(0.2), Inches(1.55), Inches(3.45), Inches(0.4))
    set_text(txBox.text_frame, f"{icon}  {period}", size=14, color=BLACK, bold=True, align=PP_ALIGN.CENTER)
    txBox = add_text_box(slide, x + Inches(0.2), Inches(1.95), Inches(3.45), Inches(0.35))
    set_text(txBox.text_frame, name, size=18, color=BLACK, bold=True, align=PP_ALIGN.CENTER)

    # Tasks
    txBox = add_text_box(slide, x + Inches(0.3), Inches(2.65), Inches(3.25), Inches(2.8))
    tf = txBox.text_frame
    set_text(tf, "", size=4)
    for task in tasks:
        add_paragraph(tf, f"✦  {task}", size=13, color=TEXT_SECONDARY)
        add_paragraph(tf, "", size=4)

# Retos
txBox = add_text_box(slide, Inches(0.8), Inches(5.9), Inches(11.7), Inches(0.35))
set_text(txBox.text_frame, "RETOS PRINCIPALES", size=12, color=AMBER, bold=True, align=PP_ALIGN.CENTER)

retos = [
    "Alcanzar masa crítica de capturas GPS",
    "Implementar pasarela de pagos Quilla-Pass",
    "Escalar equipo de desarrollo",
]

for i, reto in enumerate(retos):
    x = Inches(0.8 + i * 4.15)
    card = add_shape(slide, x, Inches(6.3), Inches(3.85), Inches(0.5), BG_SURFACE, BORDER)
    txBox = add_text_box(slide, x + Inches(0.15), Inches(6.32), Inches(3.55), Inches(0.45))
    set_text(txBox.text_frame, f"⚡ {reto}", size=11, color=TEXT_SECONDARY, align=PP_ALIGN.CENTER)

slide_brand_footer(slide)
slide_number_footer(slide, 11, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SLIDE 12 — CIERRE
# ════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BG_DARK)

# Decorative circles
add_decorative_circle(slide, Inches(-2), Inches(-1), Inches(6), AMBER, alpha=5)
add_decorative_circle(slide, Inches(10), Inches(4), Inches(5), CYAN, alpha=5)

# Conclusion title
txBox = add_text_box(slide, Inches(1), Inches(0.8), Inches(11.3), Inches(1))
tf = txBox.text_frame
p = tf.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
run = p.add_run()
run.text = "Conclusión & Viabilidad"
run.font.size = Pt(40)
run.font.color.rgb = TEXT_PRIMARY
run.font.bold = True

add_accent_line(slide, Inches(5.2), Inches(1.75), Inches(2.9), AMBER)

# Viability cards
viabilities = [
    ("✅", "Viabilidad Técnica", "Plataforma funcional con React 19,\nNode.js y MongoDB Atlas.\nAlgoritmo de navegación propietario.\nDesplegada en rutaquilla.me.", SUCCESS),
    ("💰", "Viabilidad Financiera", "Costos ~$405K COP/mes (~$100 USD).\nBreak-even mes 4-5.\nIngresos año 1: ~$42.6M COP.\nLTV/CAC de 153x.", AMBER),
    ("🌊", "Viabilidad de Mercado", "Océano azul: cero competencia.\n1.2M+ habitantes sin solución.\nNecesidad validada y urgente.\nEfecto de red exponencial.", CYAN),
]

for i, (icon, title, desc, color) in enumerate(viabilities):
    x = Inches(0.8 + i * 4.15)
    card = add_shape(slide, x, Inches(2.2), Inches(3.85), Inches(2.7), BG_CARD, color)
    txBox = add_text_box(slide, x + Inches(0.3), Inches(2.35), Inches(3.25), Inches(0.35))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = f"{icon}  {title}"
    run.font.size = Pt(16)
    run.font.color.rgb = color
    run.font.bold = True
    txBox = add_text_box(slide, x + Inches(0.3), Inches(2.85), Inches(3.25), Inches(1.8))
    set_text(txBox.text_frame, desc, size=13, color=TEXT_SECONDARY)

# Final quote
card = add_shape(slide, Inches(1.5), Inches(5.3), Inches(10.3), Inches(1.1), BG_SURFACE, AMBER)
txBox = add_text_box(slide, Inches(1.8), Inches(5.4), Inches(9.7), Inches(0.9))
tf = txBox.text_frame
set_text(tf, "\"RutaQuilla no es solo tecnología — es una herramienta de impacto social\nque democratiza la movilidad en Barranquilla, construida por y para su gente.\"",
         size=16, color=AMBER_LIGHT, bold=True, align=PP_ALIGN.CENTER)

# Contact info
txBox = add_text_box(slide, Inches(1), Inches(6.6), Inches(11.3), Inches(0.5))
tf = txBox.text_frame
p = tf.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
run = p.add_run()
run.text = "🌐 rutaquilla.me   •   📸 @ruta.quilla   •   ✉️ noreply@rutaquilla.me"
run.font.size = Pt(13)
run.font.color.rgb = TEXT_MUTED

# Logo at bottom
if os.path.exists(logo_path):
    slide.shapes.add_picture(logo_path, Inches(6.15), Inches(6.9), Inches(1), Inches(1))

slide_number_footer(slide, 12, TOTAL_SLIDES)


# ════════════════════════════════════════════════════════════
# SAVE
# ════════════════════════════════════════════════════════════
output_path = os.path.join(os.path.dirname(__file__), 'RutaQuilla_Presentacion.pptx')
prs.save(output_path)
print(f"✅ Presentación guardada en: {output_path}")
print(f"   Total slides: {TOTAL_SLIDES}")
