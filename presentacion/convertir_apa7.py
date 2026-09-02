# -*- coding: utf-8 -*-
"""
Convierte RutaQuilla_ProyectoFinal_v3_Conciso.docx a formato APA 7ma edicion.
"""

import os
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

# --- PATHS ---
INPUT_PATH = r"C:\Users\USER\Pictures\Nueva carpeta\RutaQuilla_ProyectoFinal_v3_Conciso.docx"
OUTPUT_PATH = r"C:\Users\USER\Pictures\Nueva carpeta\RutaQuilla_ProyectoFinal_APA7.docx"

# --- APA 7 CONSTANTS ---
FONT_NAME = "Times New Roman"
FONT_SIZE = Pt(12)
FONT_COLOR = RGBColor(0, 0, 0)
MARGIN = Inches(1)
FIRST_LINE_INDENT = Inches(0.5)

# --- TITLE PAGE INFO ---
TITLE_TEXT = "RutaQuilla: Plataforma de Mapeo Colaborativo del Transporte Publico de Barranquilla"
AUTHOR = "Daniel Barraza Segura"
DEPARTMENT = "Programa de Ingenieria Informatica"
COURSE = "Plan de Negocios E-Commerce"
INSTRUCTOR = "Prof. Jonathan Quant"
DATE_TEXT = "25 de mayo de 2026"

# --- TABLE TITLES ---
TABLE_TITLES = {
    0: "Business Model Canvas de RutaQuilla",
    1: "Buyer Personas del Proyecto RutaQuilla",
    2: "Segmentacion del Mercado Objetivo",
    3: "Analisis de Competencia Directa e Indirecta",
    4: "Analisis DOFA de RutaQuilla",
    5: "Estrategia de Redes Sociales",
    6: "Presupuesto de Publicidad Digital (SEM)",
    7: "Stack Tecnologico de la Plataforma",
    8: "Pasarela de Pagos Recomendada",
    9: "Medidas de Seguridad Implementadas",
    10: "Inversion Inicial del Proyecto",
    11: "Proyeccion de Ventas a 12 Meses",
    12: "Indicadores Financieros Clave",
}

HEADING_REMAP = {
    "1. Presentacion de la Propuesta": "Presentacion de la Propuesta",
    "2. Business Model Canvas (BMC)": "Business Model Canvas",
    "3. Informacion Ejecutiva": "Informacion Ejecutiva",
    "3. Información Ejecutiva": "Informacion Ejecutiva",
    "4. Mercado y Competencia": "Mercado y Competencia",
    "5. Marketing y Ventas": "Marketing y Ventas",
    "6. Operaciones, Legal y Finanzas": "Operaciones, Legal y Finanzas",
    "Marco Legal y Seguridad": "Marco Legal y Seguridad",
    "Analisis Financiero": "Analisis Financiero",
    "7. Conclusiones y Viabilidad": "Conclusiones y Viabilidad",
}

NORMAL_SUBHEADINGS = {
    "Propuesta de Valor Central",
    "Viabilidad Tecnica",
    "Viabilidad Financiera",
    "Viabilidad de Mercado",
    "Retos Principales",
    "Hoja de Ruta",
    "Objetivos Especificos:",
    "SEO (Organico):",
    "SEM (Pauta):",
    "Descripcion del Proyecto",
    "Descripción del Proyecto",
}

NORMAL_AS_HEADING1 = {
    "7. Conclusiones y Viabilidad",
    "Analisis Financiero",
    "Marco Legal y Seguridad",
}


def set_run_font(run, bold=False, italic=False, size=FONT_SIZE):
    """Set all font properties on a run."""
    run.font.name = FONT_NAME
    run.font.size = size
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = FONT_COLOR
    # Ensure font applies to all scripts
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    attrs = {'w:ascii': FONT_NAME, 'w:hAnsi': FONT_NAME,
             'w:eastAsia': FONT_NAME, 'w:cs': FONT_NAME}
    if rFonts is None:
        rFonts = parse_xml(
            f'<w:rFonts {nsdecls("w")} '
            + ' '.join(f'w:{k.split(":")[1]}="{v}"' for k, v in attrs.items())
            + '/>'
        )
        rPr.insert(0, rFonts)
    else:
        for attr, val in attrs.items():
            rFonts.set(qn(attr), val)


def set_para_spacing_double(paragraph, space_before=0, space_after=0):
    """Set double spacing via XML to avoid python-docx quirks."""
    pPr = paragraph._element.get_or_add_pPr()
    spacing = pPr.find(qn('w:spacing'))
    if spacing is None:
        spacing = parse_xml(f'<w:spacing {nsdecls("w")}/>')
        pPr.append(spacing)
    spacing.set(qn('w:line'), '480')  # 480 twips = double
    spacing.set(qn('w:lineRule'), 'auto')
    spacing.set(qn('w:before'), str(space_before))
    spacing.set(qn('w:after'), str(space_after))


def set_para_alignment(paragraph, align_val):
    """Set alignment via XML: 'left', 'center', 'right', 'both'."""
    pPr = paragraph._element.get_or_add_pPr()
    jc = pPr.find(qn('w:jc'))
    if jc is None:
        jc = parse_xml(f'<w:jc {nsdecls("w")} w:val="{align_val}"/>')
        pPr.append(jc)
    else:
        jc.set(qn('w:val'), align_val)


def set_para_indent(paragraph, first_line=None, left=None, hanging=None):
    """Set indentation via XML."""
    pPr = paragraph._element.get_or_add_pPr()
    ind = pPr.find(qn('w:ind'))
    if ind is None:
        ind = parse_xml(f'<w:ind {nsdecls("w")}/>')
        pPr.append(ind)
    if first_line is not None:
        ind.set(qn('w:firstLine'), str(first_line))
        # Remove hanging if setting firstLine
        if ind.get(qn('w:hanging')) is not None:
            del ind.attrib[qn('w:hanging')]
    if hanging is not None:
        ind.set(qn('w:hanging'), str(hanging))
        if ind.get(qn('w:firstLine')) is not None:
            del ind.attrib[qn('w:firstLine')]
    if left is not None:
        ind.set(qn('w:left'), str(left))


def clear_para_indent(paragraph):
    """Remove all indentation."""
    pPr = paragraph._element.find(qn('w:pPr'))
    if pPr is not None:
        ind = pPr.find(qn('w:ind'))
        if ind is not None:
            pPr.remove(ind)


def format_as_apa_body(paragraph):
    """Body paragraph: left-aligned, 0.5" first-line indent, double-spaced."""
    set_para_alignment(paragraph, 'left')
    set_para_spacing_double(paragraph)
    set_para_indent(paragraph, first_line=720)  # 720 twips = 0.5"
    for run in paragraph.runs:
        set_run_font(run)


def format_as_apa_heading1(paragraph):
    """APA Level 1: Centered, Bold."""
    paragraph.style = paragraph.part.document.styles['Normal']
    set_para_alignment(paragraph, 'center')
    set_para_spacing_double(paragraph, space_before=240)  # 12pt before
    clear_para_indent(paragraph)
    for run in paragraph.runs:
        set_run_font(run, bold=True)


def format_as_apa_heading2(paragraph):
    """APA Level 2: Left-Aligned, Bold."""
    paragraph.style = paragraph.part.document.styles['Normal']
    set_para_alignment(paragraph, 'left')
    set_para_spacing_double(paragraph, space_before=240)
    clear_para_indent(paragraph)
    for run in paragraph.runs:
        set_run_font(run, bold=True)


def format_as_apa_list(paragraph):
    """List item: left indent 0.5", hanging 0.25"."""
    paragraph.style = paragraph.part.document.styles['Normal']
    set_para_alignment(paragraph, 'left')
    set_para_spacing_double(paragraph)
    set_para_indent(paragraph, left=720, hanging=360)  # 0.5" left, 0.25" hanging
    for run in paragraph.runs:
        set_run_font(run)


def main():
    print("Cargando documento original...")
    doc = Document(INPUT_PATH)

    # --- 1. Margins & page setup ---
    print("Configurando margenes (1 pulgada)...")
    for section in doc.sections:
        section.top_margin = MARGIN
        section.bottom_margin = MARGIN
        section.left_margin = MARGIN
        section.right_margin = MARGIN
        section.page_width = Inches(8.5)
        section.page_height = Inches(11)
        section.orientation = WD_ORIENT.PORTRAIT

    # --- 2. Default style ---
    print("Configurando estilo base (Times New Roman 12pt)...")
    style = doc.styles['Normal']
    style.font.name = FONT_NAME
    style.font.size = FONT_SIZE
    style.font.color.rgb = FONT_COLOR
    pf = style.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.DOUBLE
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT

    # --- 3. Title page ---
    print("Creando portada APA 7...")
    body = doc.element.body

    # Remove existing title page (paragraphs 0-11)
    all_paras = body.findall(qn('w:p'))
    for i in range(min(12, len(all_paras))):
        body.remove(all_paras[i])

    # Build new title page by adding paragraphs at the start
    first_content = body.find(qn('w:p'))
    if first_content is None:
        first_content = body.find(qn('w:tbl'))

    # Title page content: (text, bold)
    title_items = [
        ("", False),           # blank line 1
        ("", False),           # blank line 2  
        ("", False),           # blank line 3
        (TITLE_TEXT, True),    # Title - BOLD
        ("", False),           # blank
        (AUTHOR, False),       # Author
        (DEPARTMENT, False),   # Department
        (COURSE, False),       # Course
        (INSTRUCTOR, False),   # Instructor
        (DATE_TEXT, False),    # Date
    ]

    title_page_indices = set()
    # Get fixed insertion position
    insert_pos = list(body).index(first_content)
    
    # Insert in order (each gets placed at insert_pos + offset)
    for offset, (text, bold) in enumerate(title_items):
        new_p_elem = parse_xml(f'<w:p {nsdecls("w")}><w:pPr><w:jc {nsdecls("w")} w:val="center"/><w:spacing {nsdecls("w")} w:line="480" w:lineRule="auto" w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts {nsdecls("w")} w:ascii="{FONT_NAME}" w:hAnsi="{FONT_NAME}" w:eastAsia="{FONT_NAME}" w:cs="{FONT_NAME}"/><w:sz {nsdecls("w")} w:val="24"/><w:szCs {nsdecls("w")} w:val="24"/><w:color {nsdecls("w")} w:val="000000"/>{f"<w:b {nsdecls('w')}/>" if bold else f"<w:b {nsdecls('w')} w:val='0'/>"}</w:rPr><w:t xml:space="preserve">{text}</w:t></w:r></w:p>')
        body.insert(insert_pos + offset, new_p_elem)

    # Add page break after all title items
    pb_elem = parse_xml(f'<w:p {nsdecls("w")}><w:r><w:br {nsdecls("w")} w:type="page"/></w:r></w:p>')
    body.insert(insert_pos + len(title_items), pb_elem)

    # Track which elements are title page (first 11 paragraphs)
    all_paras_new = body.findall(qn('w:p'))
    for i in range(11):  # 10 title items + 1 page break
        title_page_indices.add(id(all_paras_new[i]))

    # --- 4. Page numbers ---
    print("Agregando numeros de pagina...")
    for section in doc.sections:
        header = section.header
        header.is_linked_to_previous = False
        for p in header.paragraphs:
            p.clear()
        p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)

        run = p.add_run()
        set_run_font(run)
        run._element.append(parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>'))
        run2 = p.add_run()
        set_run_font(run2)
        run2._element.append(parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> PAGE </w:instrText>'))
        run3 = p.add_run()
        set_run_font(run3)
        run3._element.append(parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>'))

    # --- 5. Format paragraphs ---
    print("Formateando parrafos y encabezados...")
    for i, paragraph in enumerate(doc.paragraphs):
        # Skip title page paragraphs
        if id(paragraph._element) in title_page_indices:
            continue

        text = paragraph.text.strip()
        style_name = paragraph.style.name if paragraph.style else ""

        if not text:
            set_para_alignment(paragraph, 'left')
            set_para_spacing_double(paragraph)
            clear_para_indent(paragraph)
            for run in paragraph.runs:
                set_run_font(run)
            continue

        # Detect heading level
        is_h1 = style_name.startswith("Heading 1")
        is_h2 = style_name.startswith("Heading 2")
        is_list = style_name.startswith("List")

        # Remap numbered headings
        if text in HEADING_REMAP:
            new_text = HEADING_REMAP[text]
            if paragraph.runs:
                for run in paragraph.runs:
                    run.text = ""
                paragraph.runs[0].text = new_text
            is_h1 = True

        # Normal paragraphs that should be H1
        if text in NORMAL_AS_HEADING1 or text.rstrip(":") in NORMAL_AS_HEADING1:
            is_h1 = True
            cleaned = HEADING_REMAP.get(text, text)
            if cleaned and cleaned[0].isdigit() and ". " in cleaned:
                cleaned = cleaned.split(". ", 1)[1]
            if paragraph.runs:
                for run in paragraph.runs:
                    run.text = ""
                paragraph.runs[0].text = cleaned

        # Normal paragraphs that should be H2
        if text in NORMAL_SUBHEADINGS or text.rstrip(":") in NORMAL_SUBHEADINGS:
            is_h2 = True

        # Apply formatting
        if is_h1:
            format_as_apa_heading1(paragraph)
        elif is_h2:
            format_as_apa_heading2(paragraph)
        elif is_list:
            format_as_apa_list(paragraph)
        else:
            format_as_apa_body(paragraph)

    # --- 6. Format tables ---
    print("Formateando tablas (APA 7)...")
    for i, table in enumerate(doc.tables):
        table.alignment = WD_TABLE_ALIGNMENT.LEFT
        tbl = table._tbl
        tblPr = tbl.tblPr
        if tblPr is None:
            tblPr = parse_xml(f'<w:tblPr {nsdecls("w")}/>')
            tbl.insert(0, tblPr)

        # Remove existing borders
        old_borders = tblPr.find(qn('w:tblBorders'))
        if old_borders is not None:
            tblPr.remove(old_borders)

        # APA: horizontal lines only (top, bottom, header)
        tblPr.append(parse_xml(
            f'<w:tblBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
            f'<w:insideH w:val="none" w:sz="0" w:space="0" w:color="000000"/>'
            f'<w:insideV w:val="none" w:sz="0" w:space="0" w:color="000000"/>'
            f'<w:left w:val="none" w:sz="0" w:space="0" w:color="000000"/>'
            f'<w:right w:val="none" w:sz="0" w:space="0" w:color="000000"/>'
            f'</w:tblBorders>'
        ))

        # Header row bottom border
        if table.rows:
            for cell in table.rows[0].cells:
                tcPr = cell._element.get_or_add_tcPr()
                old_tc = tcPr.find(qn('w:tcBorders'))
                if old_tc is not None:
                    tcPr.remove(old_tc)
                tcPr.append(parse_xml(
                    f'<w:tcBorders {nsdecls("w")}>'
                    f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
                    f'</w:tcBorders>'
                ))

        # Format all cells
        for row in table.rows:
            for cell in row.cells:
                tcPr = cell._element.get_or_add_tcPr()
                shd = tcPr.find(qn('w:shd'))
                if shd is not None:
                    tcPr.remove(shd)
                for para in cell.paragraphs:
                    para.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    para.paragraph_format.space_before = Pt(2)
                    para.paragraph_format.space_after = Pt(2)
                    para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
                    para.paragraph_format.first_line_indent = None
                    for run in para.runs:
                        set_run_font(run, size=Pt(11))
                        if row == table.rows[0]:
                            run.bold = True

    # --- 7. Add table labels ---
    print("Agregando etiquetas de tablas...")
    from docx.text.paragraph import Paragraph as Para
    for i, table in enumerate(doc.tables):
        tbl_elem = table._tbl
        parent = tbl_elem.getparent()
        tbl_idx = list(parent).index(tbl_elem)
        title_text = TABLE_TITLES.get(i, f"Datos {i+1}")

        # "Tabla X" - bold, left
        num_xml = (
            f'<w:p {nsdecls("w")}>'
            f'<w:pPr><w:jc {nsdecls("w")} w:val="left"/>'
            f'<w:spacing {nsdecls("w")} w:line="480" w:lineRule="auto" w:before="240" w:after="0"/>'
            f'</w:pPr>'
            f'<w:r><w:rPr>'
            f'<w:rFonts {nsdecls("w")} w:ascii="{FONT_NAME}" w:hAnsi="{FONT_NAME}"/>'
            f'<w:b {nsdecls("w")}/>'
            f'<w:sz {nsdecls("w")} w:val="24"/><w:szCs {nsdecls("w")} w:val="24"/>'
            f'<w:color {nsdecls("w")} w:val="000000"/>'
            f'</w:rPr><w:t>Tabla {i+1}</w:t></w:r></w:p>'
        )
        parent.insert(tbl_idx, parse_xml(num_xml))

        # Title - italic, left
        ttl_xml = (
            f'<w:p {nsdecls("w")}>'
            f'<w:pPr><w:jc {nsdecls("w")} w:val="left"/>'
            f'<w:spacing {nsdecls("w")} w:line="480" w:lineRule="auto" w:before="0" w:after="120"/>'
            f'</w:pPr>'
            f'<w:r><w:rPr>'
            f'<w:rFonts {nsdecls("w")} w:ascii="{FONT_NAME}" w:hAnsi="{FONT_NAME}"/>'
            f'<w:i {nsdecls("w")}/>'
            f'<w:sz {nsdecls("w")} w:val="24"/><w:szCs {nsdecls("w")} w:val="24"/>'
            f'<w:color {nsdecls("w")} w:val="000000"/>'
            f'</w:rPr><w:t>{title_text}</w:t></w:r></w:p>'
        )
        parent.insert(tbl_idx + 1, parse_xml(ttl_xml))

    # --- 8. References section ---
    print("Agregando seccion de Referencias...")
    # Page break
    body.append(parse_xml(
        f'<w:p {nsdecls("w")}><w:r><w:br {nsdecls("w")} w:type="page"/></w:r></w:p>'
    ))

    # "Referencias" heading
    body.append(parse_xml(
        f'<w:p {nsdecls("w")}>'
        f'<w:pPr><w:jc {nsdecls("w")} w:val="center"/>'
        f'<w:spacing {nsdecls("w")} w:line="480" w:lineRule="auto" w:before="0" w:after="0"/>'
        f'</w:pPr>'
        f'<w:r><w:rPr>'
        f'<w:rFonts {nsdecls("w")} w:ascii="{FONT_NAME}" w:hAnsi="{FONT_NAME}"/>'
        f'<w:b {nsdecls("w")}/>'
        f'<w:sz {nsdecls("w")} w:val="24"/><w:szCs {nsdecls("w")} w:val="24"/>'
        f'<w:color {nsdecls("w")} w:val="000000"/>'
        f'</w:rPr><w:t>Referencias</w:t></w:r></w:p>'
    ))

    # Reference entries with hanging indent (0.5" left, 0.5" hanging)
    references = [
        "Alcaldia de Barranquilla. (2024). Plan de movilidad urbana sostenible. https://www.barranquilla.gov.co/movilidad",
        "Area Metropolitana de Barranquilla. (2023). Informe de transporte publico colectivo del area metropolitana de Barranquilla.",
        "Leaflet. (s.f.). An open-source JavaScript library for mobile-friendly interactive maps. https://leafletjs.com/",
        "Meta Platforms. (2024). React: A JavaScript library for building user interfaces (Version 19) [Software]. https://react.dev/",
        "MongoDB, Inc. (2024). MongoDB Atlas: Cloud database service. https://www.mongodb.com/atlas",
        "OpenStreetMap contributors. (2024). OpenStreetMap [Base de datos geoespacial]. https://www.openstreetmap.org/",
    ]

    for ref in references:
        body.append(parse_xml(
            f'<w:p {nsdecls("w")}>'
            f'<w:pPr><w:jc {nsdecls("w")} w:val="left"/>'
            f'<w:spacing {nsdecls("w")} w:line="480" w:lineRule="auto" w:before="0" w:after="0"/>'
            f'<w:ind {nsdecls("w")} w:left="720" w:hanging="720"/>'
            f'</w:pPr>'
            f'<w:r><w:rPr>'
            f'<w:rFonts {nsdecls("w")} w:ascii="{FONT_NAME}" w:hAnsi="{FONT_NAME}"/>'
            f'<w:sz {nsdecls("w")} w:val="24"/><w:szCs {nsdecls("w")} w:val="24"/>'
            f'<w:color {nsdecls("w")} w:val="000000"/>'
            f'</w:rPr><w:t xml:space="preserve">{ref}</w:t></w:r></w:p>'
        ))

    # --- Save ---
    print(f"Guardando en: {OUTPUT_PATH}")
    doc.save(OUTPUT_PATH)
    print(f"Completado! Tamano: {os.path.getsize(OUTPUT_PATH):,} bytes")


if __name__ == "__main__":
    main()
