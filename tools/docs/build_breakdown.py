# Builds docs/TEAM-SHEEEEP-Project-Breakdown.docx: the end-to-end project breakdown, in the team's voice.
#   python tools/docs/build_breakdown.py        (needs: pip install python-docx pillow)
# Screenshots come from docs/img (converted to JPEG in tools/docs/.build); the architecture
# diagram is drawn here. Edit the text below and re-run after features change.
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')).replace(os.sep, '/') + '/'

# ---------- 1. images ----------
from PIL import Image, ImageDraw, ImageFont

SRC = ROOT + 'docs/img/'
BUILD = ROOT + 'tools/docs/.build/'
os.makedirs(BUILD, exist_ok=True)
for f in os.listdir(SRC):
    if f.endswith('.webp'):
        Image.open(SRC + f).convert('RGB').save(BUILD + f.replace('.webp', '.jpg'), quality=86, optimize=True, progressive=True)

# ---- architecture diagram
W, H = 1800, 1060
img = Image.new('RGB', (W, H), (251, 248, 241))
d = ImageDraw.Draw(img)
F = lambda size, bold=False: ImageFont.truetype('C:/Windows/Fonts/' + ('segoeuib.ttf' if bold else 'segoeui.ttf'), size)
INK, MUTED, OLIVE, CREAM, SAND, NASA, GOLD, TEAL = (55, 47, 42), (110, 100, 90), (150, 153, 101), (236, 228, 212), (231, 218, 193), (11, 61, 145), (207, 177, 115), (107, 167, 169)


def box(x, y, w, h, title, lines, fill=CREAM, edge=OLIVE, tcol=INK, lcol=MUTED):
    d.rounded_rectangle((x, y, x + w, y + h), 18, fill=fill, outline=edge, width=3)
    d.text((x + 18, y + 12), title, font=F(26, True), fill=tcol)
    for i, ln in enumerate(lines):
        d.text((x + 18, y + 52 + i * 30), ln, font=F(21), fill=lcol)


def arrow(x1, y1, x2, y2, col=MUTED, label=None):
    d.line((x1, y1, x2, y2), fill=col, width=4)
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    for s in (-0.45, 0.45):
        d.line((x2, y2, x2 - 18 * math.cos(a + s), y2 - 18 * math.sin(a + s)), fill=col, width=4)
    if label:
        d.text(((x1 + x2) / 2 + 8, (y1 + y2) / 2 - 30), label, font=F(19), fill=MUTED)


d.text((40, 24), 'How the app fits together', font=F(38, True), fill=INK)
d.text((40, 76), 'Everything runs in the farmer’s browser. No backend, no accounts, no API keys.', font=F(23), fill=MUTED)

# browser frame
d.rounded_rectangle((30, 130, 1080, 1030), 26, outline=INK, width=3)
d.text((56, 142), 'In the browser (React 19 + Vite)', font=F(26, True), fill=INK)
box(60, 195, 990, 165, 'Screens (src/screens)', ['Login · About you · Your farm · Outline paddocks · Soil check', 'Paddock details (history from space, priorities) · Planner · Dashboard', 'Leaflet map · season strip · time-lapse · Manami chat · loading screens'])
box(60, 400, 990, 200, 'Logic (src/logic): pure functions, testable in Node', ['rotation.js: scores every crop, every season   ·   cropSet.js: the farm’s crop list', 'phenology.js: crop from the greenness curve, canola flowering map', 'sowing.js: frost/heat risk by sowing date   ·   performance.js: did my rotation work?', 'geometry · snap · overlap · seasons · spacePlanning · manami'])
box(60, 640, 990, 165, 'Services (src/services): fetch, cache, retry', ['hls.js + space.js: NASA HLS search, layers, pure-pixel readings, 10 m pictures', 'weather.js + climate.js: NASA POWER   ·   soil.js: SoilGrids   ·   terrain.js: elevation', 'geocode.js: place search   ·   http.js: cached fetch with timeouts'])
box(60, 845, 470, 160, 'State', ['useReducer store → localStorage', '(paddocks, history, priorities,', 'crop list, satellite results)'], fill=SAND)
box(580, 845, 470, 160, 'Browser caches', ['Cache Storage: satellite images', 'and 30 years of daily weather', '(a farm is read once)'], fill=SAND)
arrow(555, 360, 555, 398)
arrow(555, 600, 555, 638)
arrow(300, 805, 300, 843)
arrow(815, 805, 815, 843)

# external data
d.text((1150, 142), 'Public data services', font=F(26, True), fill=INK)
box(1150, 195, 620, 150, 'NASA HLS v2.0', ['Landsat 8/9 + Sentinel-2, 30 m, every 2–3 days', 'via Microsoft Planetary Computer (STAC + data API)'], fill=(226, 233, 246), edge=NASA)
box(1150, 365, 620, 120, 'NASA POWER', ['Daily weather (30 years) + long-term climate'], fill=(226, 233, 246), edge=NASA)
box(1150, 505, 620, 120, 'Sentinel-2 L2A (ESA Copernicus)', ['10 m pictures for the time-lapse'], fill=(232, 240, 240), edge=TEAL)
box(1150, 645, 620, 120, 'ISRIC SoilGrids · Copernicus DEM', ['Soil texture, pH, carbon · slope (Open-Meteo)'], fill=(240, 236, 224), edge=GOLD)
box(1150, 785, 620, 120, 'Esri imagery · OpenStreetMap Nominatim', ['Map background · place search'], fill=(240, 236, 224), edge=GOLD)
box(1150, 925, 620, 95, 'USDA Cropland Data Layer', ['Ground truth, used only to validate accuracy'], fill=(245, 242, 236), edge=(190, 180, 165))
# every data source is reached through the services layer
for y, ty in ((270, 662), (425, 690), (565, 718), (705, 746), (845, 774)):
    arrow(1148, y, 1054, ty)
img.save(BUILD + 'architecture.png', optimize=True)



# ---------- 2. document ----------
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

IMG = ROOT + 'tools/docs/.build/'
OUT = ROOT + 'docs/TEAM-SHEEEEP-Project-Breakdown.docx'

INK = RGBColor(0x37, 0x2F, 0x2A)
OLIVE = RGBColor(0x5C, 0x5F, 0x33)
MUTED = RGBColor(0x6E, 0x64, 0x5A)
NASA = RGBColor(0x0B, 0x3D, 0x91)

doc = Document()

# ---------- page + styles ----------
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
for side in ('left_margin', 'right_margin'):
    setattr(sec, side, Cm(2.1))
sec.top_margin, sec.bottom_margin = Cm(2.0), Cm(2.0)


def set_font(style, name='Calibri', size=None, bold=None, color=None):
    style.font.name = name
    rpr = style.element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = OxmlElement('w:rFonts')
        rpr.append(fonts)
    for k in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        fonts.set(qn(k), name)
    if size:
        style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    if color:
        style.font.color.rgb = color


st = doc.styles
set_font(st['Normal'], size=10.5, color=INK)
st['Normal'].paragraph_format.space_after = Pt(6)
st['Normal'].paragraph_format.line_spacing = 1.15
set_font(st['Title'], size=30, bold=True, color=INK)
set_font(st['Heading 1'], size=20, bold=True, color=OLIVE)
set_font(st['Heading 2'], size=14, bold=True, color=INK)
set_font(st['Heading 3'], size=11.5, bold=True, color=OLIVE)
for h, before, after in (('Heading 1', 6, 8), ('Heading 2', 14, 4), ('Heading 3', 10, 2)):
    st[h].paragraph_format.space_before = Pt(before)
    st[h].paragraph_format.space_after = Pt(after)
    st[h].paragraph_format.keep_with_next = True
st['Heading 1'].paragraph_format.page_break_before = True
set_font(st['Footer'], size=8.5, color=MUTED)  # Word redraws the page-number field in this style
for name in ('List Bullet', 'List Number'):
    set_font(st[name], size=10.5, color=INK)
    st[name].paragraph_format.space_after = Pt(3)


def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_fill)
    tcPr.append(shd)


def cell_margins(table, cm=0.18):
    tblPr = table._tbl.tblPr
    mar = OxmlElement('w:tblCellMar')
    for side in ('top', 'left', 'bottom', 'right'):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:w'), str(int(cm * 567)))
        el.set(qn('w:type'), 'dxa')
        mar.append(el)
    tblPr.append(mar)


def runs(p, text, size=None, color=None, italic=False):
    """Adds text to a paragraph; **double stars** mark bold."""
    for i, part in enumerate(text.split('**')):
        if not part:
            continue
        r = p.add_run(part)
        r.bold = i % 2 == 1
        r.italic = italic
        if size:
            r.font.size = Pt(size)
        if color:
            r.font.color.rgb = color
    return p


def P(text, **kw):
    return runs(doc.add_paragraph(), text, **kw)


def H1(text):
    doc.add_heading(text, level=1)


def H2(text):
    doc.add_heading(text, level=2)


def H3(text):
    doc.add_heading(text, level=3)


def bullets(items, style='List Bullet'):
    for it in items:
        runs(doc.add_paragraph(style=style), it)


def row_props(row, header=False):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(OxmlElement('w:cantSplit'))
    if header:
        trPr.append(OxmlElement('w:tblHeader'))


def table(headers, rows, widths=None, size=9.5, header_fill='ECE4D4', first_bold=False):
    ncols = len(headers) if headers else len(rows[0])
    t = doc.add_table(rows=1 if headers else 0, cols=ncols)
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell_margins(t)
    if headers:
        row_props(t.rows[0], header=True)
        for i, h in enumerate(headers):
            c = t.rows[0].cells[i]
            c.text = ''
            runs(c.paragraphs[0], f'**{h}**', size=size)
            shade(c, header_fill)
    for row in rows:
        new = t.add_row()
        row_props(new)
        cells = new.cells
        for i, v in enumerate(row):
            cells[i].text = ''
            runs(cells[i].paragraphs[0], f'**{v}**' if (first_bold and i == 0 and '**' not in v) else v, size=size)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    keep = len(t.rows) <= 9  # small tables stay on one page
    for k, row in enumerate(t.rows):
        for c in row.cells:
            for p in c.paragraphs:
                p.paragraph_format.space_after = Pt(1)
                p.paragraph_format.keep_with_next = keep and k < len(t.rows) - 1
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def img_path(name):
    # screenshots as JPEG keep the file small; the diagram stays PNG for crisp text
    return IMG + (name if name == 'architecture.png' else name.replace('.png', '.jpg'))


def figure(name, caption, width=16.5):
    doc.add_picture(img_path(name), width=Cm(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.paragraphs[-1].paragraph_format.keep_with_next = True
    cap = runs(doc.add_paragraph(), caption, size=9, color=MUTED, italic=True)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER


def two_figures(a, b, caption, width=8.1):
    t = doc.add_table(rows=1, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for cell, name in zip(t.rows[0].cells, (a, b)):
        cell.paragraphs[0].add_run().add_picture(img_path(name), width=Cm(width))
        cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        cell.paragraphs[0].paragraph_format.keep_with_next = True
    row_props(t.rows[0])
    cap = runs(doc.add_paragraph(), caption, size=9, color=MUTED, italic=True)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER


def callout(text, fill='F3EAD3', bar='CFB173'):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.rows[0].cells[0]
    shade(c, fill)
    # coloured left border only
    tcPr = c._tc.get_or_add_tcPr()
    borders = OxmlElement('w:tcBorders')
    for side, val, sz, col in (('left', 'single', '24', bar), ('top', 'nil', '0', 'auto'), ('bottom', 'nil', '0', 'auto'), ('right', 'nil', '0', 'auto')):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:val'), val)
        el.set(qn('w:sz'), sz)
        el.set(qn('w:color'), col)
        borders.append(el)
    tcPr.append(borders)
    cell_margins(t, 0.3)
    c.text = ''
    runs(c.paragraphs[0], text, size=10)
    c.paragraphs[0].paragraph_format.space_after = Pt(0)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def page_break():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# footer: project name + page number
footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
runs(footer, 'TEAM SHEEEEP · Project breakdown · page ', size=8.5, color=MUTED)
fld = OxmlElement('w:fldSimple')
fld.set(qn('w:instr'), 'PAGE')
r = OxmlElement('w:r')
rpr = OxmlElement('w:rPr')
for tag, val in (('w:sz', '17'), ('w:color', '6E645A')):
    el = OxmlElement(tag)
    el.set(qn('w:val'), val)
    rpr.append(el)
r.append(rpr)
t_ = OxmlElement('w:t')
t_.text = '1'
r.append(t_)
fld.append(r)
footer._p.append(fld)

# =====================================================================================
# COVER
# =====================================================================================
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(40)
runs(p, 'TEAM SHEEEEP', size=13, color=OLIVE)
doc.add_paragraph('Paddock & Crop-Rotation Planner', style='Title')
P('An end-to-end breakdown of what we built, how it works, the technology behind it, and how well it works.', size=13, color=MUTED)
doc.add_picture(img_path('space-history.png'), width=Cm(16.5))
doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
P('Prepared for our NASA challenge submission · October 2026', size=10, color=MUTED)
P('Working app name: “Webapp Name” (placeholder from the design, still to be chosen). Mascot and guide: Manami the sheep.', size=10, color=MUTED)

# =====================================================================================
# CONTENTS
# =====================================================================================
H1('Contents')
for line in [
    '1. The project at a glance',
    '2. The problem we set out to solve',
    '3. The farmer’s journey, screen by screen',
    '4. What the app can do, in depth',
    '5. Where the data comes from',
    '6. How accurate it is: testing and validation',
    '7. Technology stack and architecture',
    '8. Design: from Figma to a working app',
    '9. How we keep it working: quality checks',
    '10. How we got here',
    '11. Running it and giving the demo',
    '12. Limits, open questions and what’s next',
    '13. The next stage: accounts, a smarter Manami, daily weather',
    'Appendix: glossary',
]:
    P(line)

# =====================================================================================
# 1. AT A GLANCE
# =====================================================================================
H1('1. The project at a glance')
P('We built a web app that helps a farmer decide **which crop goes in which paddock for the next ten seasons**. The farmer outlines their paddocks on a satellite map. The app then works out each paddock’s soil, slope and climate, reads **what actually grew there over the last five seasons from NASA satellite images**, and recommends a rotation that fits the farmer’s own priorities, crops and livestock. Manami, a friendly sheep, guides them through every step.')
P('Most rotation tools ask the farmer to type in their history and then apply generic rules. Ours fills in the history from space, spots risks the farmer can’t see from the ground, and shows evidence of what worked on their own farm.')
table(None, [
    ['What it is', 'A web app that runs entirely in the browser: nothing to install, no account, no API keys.'],
    ['Who it’s for', 'Grain and mixed (crop + livestock) farmers. Built around Australia’s wheat-sheep belt; the demo farm is in the NSW Riverina near Wagga Wagga.'],
    ['What it plans', '10 seasons ahead for every paddock, choosing from 11 crops plus fallow, limited to the crops the farmer can actually grow.'],
    ['NASA data', 'NASA HLS v2.0 (Landsat 8/9 + Sentinel-2) for five seasons of crop history; NASA POWER for 30 years of daily weather and long-term climate.'],
    ['Other data', 'ISRIC SoilGrids (soil), Copernicus elevation via Open-Meteo (slope), original Sentinel-2 10 m images (sharper pictures), Esri imagery and OpenStreetMap (maps, place search). USDA crop maps are used only to test accuracy.'],
    ['How accurate', 'Checked against USDA crop maps for two seasons: canola found 85–96% of the time and right 89–94% of the time it is called; overall crop type right 78–88%.'],
    ['Built with', 'React 19, Vite 8, Leaflet 1.9 and our own satellite, geometry and planning code. About 5,400 lines of app code.'],
    ['Quality', '9 automated browser checks and 3 accuracy-test scripts, all passing.'],
], widths=[3.6, 13.2], first_bold=True)

H2('What makes it different')
table(['Feature', 'The farmer’s problem', 'What our app does'], [
    ['**Paddock Memory from Space**', 'Crop records are missing, especially on newly bought or leased land, and a plan is only as good as its history.', 'Reads about 100 satellite images per farm over 5 seasons, works out each paddock’s crop each season with a confidence level and the evidence, and fills in the history with one click. A time-lapse shows the real images.'],
    ['**Neighbour canola → blackleg warning**', 'Blackleg spores blow from last year’s canola stubble, including the neighbour’s, which the farmer can’t see on paper. Growers try to keep new canola about 500 m away.', 'Finds canola flowering in every field around the farm, shows it on the map, and when a paddock is within 500 m steers next season’s canola elsewhere and says why.'],
    ['**Safest sowing window**', 'Sow too early and frost hits at flowering; too late and heat hits during grain fill.', 'Replays 30 years of the farm’s own daily temperatures for every sowing date and crop, and shows the lowest-risk window.'],
    ['**“Did my rotation work?”**', 'Farmers rarely see evidence that their rotation pays off on their own farm.', 'Compares cereals grown after a break crop with cereals after cereals, using satellite crop vigour, with rainfall for context.'],
], widths=[3.8, 6.0, 7.0])

# =====================================================================================
# 2. THE PROBLEM
# =====================================================================================
H1('2. The problem we set out to solve')
P('Choosing what to grow where is one of the biggest decisions on a grain farm, and it compounds over years. Getting the rotation wrong costs yield and money, and slowly degrades the soil.')
bullets([
    '**Disease and weeds build up** when the same crop family follows itself. Cereal after cereal breeds root diseases; a “break crop” (canola, a legume or pasture) starves them out.',
    '**Nitrogen runs down** unless legumes put it back. Every cereal after a legume needs less fertiliser.',
    '**History is patchy.** Rotation advice depends on what grew in each paddock in past seasons, but records are often missing, especially for newly bought or leased land.',
    '**Some risks are invisible from the farm gate.** Blackleg, canola’s most damaging disease, spreads from stubble on neighbouring farms.',
    '**Timing is a gamble.** The same crop can be ruined by frost at flowering if sown too early, or by heat during grain fill if sown too late, and the right date depends on the farm’s own climate.',
    '**There is no feedback loop.** After years of rotating, few farmers can see whether it actually paid off in their paddocks.',
])
callout('**Our idea:** use NASA Earth observation to fill these gaps automatically, so the farmer gets real history, real local risks and real evidence, inside a friendly, guided planner that a new farmer can use without training.')

# =====================================================================================
# 3. JOURNEY
# =====================================================================================
H1('3. The farmer’s journey, screen by screen')
P('The flow follows our Figma prototype: five steps, shown under each screen’s title. Everything the farmer enters is saved in their browser, so they can leave and come back.')

H2('3.1 Login and “About you”')
two_figures('login.png', 'experience.png', 'Login (left) and “About you” (right).')
P('The login names the farmer’s profile (it is front-end only for now). Anyone can press **“Try the demo farm”** to load four example paddocks. On “About you”, a **new farmer** gets a tip from Manami on every screen; an **experienced farmer** goes straight to the tools.')

H2('3.2 Your farm: crops and livestock')
figure('your-farm.png', 'The “Your Farm” step: livestock or crops only, then a tick for every crop the farm can grow and sell.', 14.5)
P('Two quick questions: **Do you keep livestock?** (“Crops only” removes grazed pasture from the plan) and **Which crops can you grow and sell?**, grouped as cereals, oilseeds, legumes and hay, pasture and fallow. The planner only ever picks from what is ticked. If the list has no break crop or no legume, the app says what that will cost (disease, nitrogen, soil health) but still lets the farmer decide. The list can be changed any time from the Planner or the menu.')

H2('3.3 Outline your paddocks')
two_figures('outline.png', 'snapping.png', 'The satellite map with the demo farm (left) and a new paddock snapping to its neighbour (right).')
P('The farmer searches for their farm and clicks the corners of each paddock. Corners **snap** to a neighbouring paddock’s corner or edge when the mouse is close on screen, so paddocks share boundaries exactly, yet a real gap can still be drawn by zooming in or holding Alt. Two clicks on a neighbour’s border trace along it. Overlaps are trimmed automatically, crossed outlines and mis-clicks are rejected, and finished paddocks can be reshaped by dragging corners.')

H2('3.4 Soil check')
figure('soil-check.png', 'The soil check suggests splitting a paddock whose two ends have different soils.', 14.5)
P('The app samples the soil at both ends of each paddock. If they really differ (a change in texture class backed by at least 4% more clay or 6% more sand, a pH difference of 0.5, or 8% more clay), it suggests splitting the paddock so each part can be managed for its own soil. The farmer can accept, or keep the old paddocks and say why.')

H2('3.5 Paddock details: history from space')
two_figures('space-history.png', 'timelapse.png', '“Seen from space” (left): the crop in each of the last five seasons, with a blackleg warning. Time-lapse (right): real satellite pictures, with the paddock outlined.')
P('For each paddock, the **“Seen from space”** card lists the last five seasons: the crop family, how sure we are (sure, likely or best guess), the evidence (“greened up 23 July, peaked at NDVI 0.74 on 23 Sept, dried off 2 Nov”) and a small greenness curve. One click, **“Use as crop history”**, fills in the paddock’s history. The **time-lapse** plays real satellite pictures of the farm, one per season plus the canola-flowering picture. The map shows canola that flowered around the farm, and a **blackleg alert** appears when it was within 500 m. Below the card are the paddock’s soil and slope and any known issues (salinity, waterlogging, herbicide-resistant weeds and so on).')

H2('3.6 Paddock details: priorities')
figure('priorities.png', 'Priority sliders with a live preview of the next seasons.', 14.5)
P('Four sliders (soil health, water saving, profit, low risk) run from “Not important” to “Top priority”. The farmer also ticks their reasons for rotating (disease break, nitrogen, weed control, erosion, spreading risk, profit). A live preview shows the next four seasons with these settings, and indicative prices are shown for the crops the plan leans towards.')

H2('3.7 Your plan')
two_figures('planner.png', 'sowing.png', 'The Planner (left) and the Sowing window card (right).')
P('Across the top, a **season strip** shows all ten seasons; each has a dot per paddock in its crop’s colour, so the whole rotation reads at a glance, and a click jumps to any season. The map is coloured by the planned crop. **Crops to Grow** says what to plant in each paddock and why (“breaks the cereal disease cycle”, “uses nitrogen left by the legume”), including blackleg notes. The **Sowing window** card gives the safest sowing dates for the crops planned that season, from 30 years of NASA weather. **Soil Health** shows how each paddock’s soil index changes. A button opens the crop list so the farmer can change it and watch the plan update.')

H2('3.8 Dashboard')
figure('dashboard.png', 'The dashboard, with “Did my rotation work?”.', 14.5)
P('A summary of the farm (paddocks and hectares), the coming season’s crop mix, soil health now and after ten seasons, and the **“Did my rotation work?”** report, with each season’s rainfall and the rainfall-limited wheat yield for context.')

H2('3.9 Manami, the guide')
figure('manami.png', 'Asking Manami a question on the Planner.', 14.5)
P('Manami sits in the corner of every screen. New farmers get a tip for each screen, and anyone can ask questions in plain words: soil, slope, rainfall, legumes and nitrogen, weeds, satellites, blackleg, sowing dates, livestock and crop lists, or what a screen does. The answers run offline from a built-in knowledge base, and the design lets us plug in a full AI assistant later without changing the chat window.')

H2('3.10 Fits any screen')
P('Every screen is drawn at the Figma frame size and **zoomed to fit the window**: out on laptops (a typical 1280 × 665 window shows it at 0.8×), slightly in on large monitors (up to 1.2×), and it adjusts live when the window is resized. Windows 960 px wide or narrower switch to a stacked layout, with phone-sized type below 720 px. In testing, no screen makes the page scroll at any window size from 1000 × 700 up to 2560 × 1300.')

# =====================================================================================
# 4. CAPABILITIES IN DEPTH
# =====================================================================================
H1('4. What the app can do, in depth')

H2('4.1 Paddock mapping')
bullets([
    '**Accurate areas.** Areas are computed on the WGS84 ellipsoid and match a reference geodesic library to within 0.001%, from 1 ha to 40,000 ha.',
    '**Snapping that respects real gaps.** Snap distances are measured on screen (14 px to corners, 10 px to edges), so zooming in lets the farmer draw a genuine gap between paddocks. Alt or the Snap switch turns it off.',
    '**Tracing and trimming.** Two clicks on a neighbour’s border follow its outline; any overlap with existing paddocks is cut away with polygon clipping, so paddocks share an edge exactly.',
    '**Editing.** Drag a corner, click a mid-point to add one, right-click to remove one. Keyboard: Enter finishes, Backspace undoes a corner, Esc cancels.',
    '**Safety checks.** Self-crossing outlines and tiny mis-click shapes are rejected with a plain explanation.',
])

H2('4.2 Site data for every paddock')
table(['What', 'Source', 'How we use it'], [
    ['Soil texture, pH, organic carbon', 'ISRIC SoilGrids 2.0 (250 m)', 'Average of 0–30 cm, at a point guaranteed to be inside the paddock (even U-shaped ones). Sand, silt and clay give the USDA texture class. Drives acid/alkaline crop choices and the soil-health index.'],
    ['Slope, aspect, elevation', 'Copernicus 90 m elevation via Open-Meteo', 'A plane fitted (least squares) to elevation points across the whole paddock gives its average slope and the direction it faces.'],
    ['Rainfall, temperature, soil wetness', 'NASA POWER climatology', 'Long-term averages for the paddock. Dry farms (under 400 mm a year) favour low-water crops.'],
], widths=[3.8, 4.0, 9.0])
P('Requests are spaced to respect each service’s fair-use limits, cached for 30 days, time out cleanly, and show “Try again” if a service is down.')

H2('4.3 Paddock Memory from Space')
P('This is the heart of the project. For the whole farm plus a 1.2 km border, the app:')
bullets([
    '**Finds the images.** It searches NASA’s HLS catalogue (Landsat 8/9 and Sentinel-2, harmonised to look alike) over five seasons, and keeps the clearest image in every 8-day window around flowering and every 16-day window otherwise: about 100 images per farm.',
    '**Fetches only what it needs.** For each image, a small picture of the farm holding three layers: greenness (NDVI), a yellow-flower index (NDYI) and NASA’s cloud mask. The first read takes about 30 seconds; after that everything is cached in the browser.',
    '**Reads each paddock from clean pixels.** Only pixels lying wholly inside the paddock are used (when there are at least six), so fence lines, tracks and the neighbour’s crop don’t leak in. Testing showed this raises accuracy (section 6).',
    '**Builds a greenness curve per season.** Season windows are set by latitude (April–January in the south). From the curve: when the crop greened up, when it peaked and when it dried off.',
    '**Names the crop family.** Canola: flowers show as a yellow signal well above the other green crops in the same image, on at least two dates, while the crop is near peak green. Pasture: green all season with little swing. Cereal or pulse: from how high and how long the season peaks. Fallow: never really greens up. Each call gets a confidence level and plain-language evidence.',
    '**Stays honest.** “Best guess” seasons are never filled in automatically; the farmer chooses.',
])
figure('resolution-compare.png', 'Same paddocks, same satellite pass: NASA HLS at 30 m used for the analysis (left), and the original Sentinel-2 10 m image used for the pictures (right).', 16.5)
P('**Sharp pictures.** The analysis runs on 30 m NASA HLS, but the pictures a farmer looks at use the original 10 m Sentinel-2 image of the same satellite pass: three times sharper, nine times the detail. For dates that only have a Landsat image, the app finds the nearest Sentinel-2 pass that is cloud-free over the farm itself. The canola-flowering picture is chosen by how yellow the canola actually looks.')

H2('4.4 Neighbour canola and the blackleg warning')
bullets([
    'Every pixel around the farm is checked for canola flowering on the flowering-season images; patches smaller than 1.35 ha are ignored as noise.',
    'Canola in the paddock itself is excluded, so it can’t raise an alarm about itself.',
    'For each paddock we work out the distance to the nearest neighbouring canola and how many hectares flowered within 1 km.',
    'If canola flowered within **500 m** last season, the planner strongly avoids canola there next season and adds a note such as “Canola would suit, but canola flowered 52 m away in 2026 (seen from space). Its stubble spreads blackleg, so Lupins is safer this year.” If canola is still the best choice, it warns to use a resistant variety and treated seed.',
    'The canola is shown in yellow on the paddock maps.',
])

H2('4.5 The rotation planner')
P('For every paddock and every one of the next ten seasons, the planner scores each crop on the farm’s list and picks the best. The score combines:')
table(['Input', 'Effect on the choice'], [
    ['Priorities (sliders)', 'Weight soil benefit, water use, margin and risk. Tuned so each slider moves the plan steadily across its whole range without overriding agronomy.'],
    ['Rotation rules', 'No same crop or family back to back; cereals score well after a break crop and use the nitrogen a legume left; break crops score well after a run of cereals (more so with disease history); pasture phases last at most two years; the rotation is kept varied; fallow only when nothing else fits.'],
    ['Issues and goals', 'Salinity favours barley; waterlogging favours faba beans and oats; herbicide-resistant weeds favour pasture and hay; erosion favours crops that keep the ground covered.'],
    ['Site data', 'Acidic soil favours lupins and oats; alkaline soil favours barley and chickpeas; dry climates favour low-water crops.'],
    ['From space', 'Blank history is filled from confident satellite readings; nearby canola stubble steers canola away.'],
    ['Crop list', 'Only crops the farmer ticked are scored; “Crops only” removes grazed pasture.'],
], widths=[3.6, 13.2], first_bold=True)
P('A **soil-health index** starts from organic carbon, pH and known issues, and each season’s crop nudges it up or down. Every screen that shows a plan (Priorities preview, Planner, Dashboard) uses the same engine and the same crop list.')

H2('4.6 The safest sowing window')
P('From 30 years of NASA POWER daily minimum and maximum temperatures at the farm, for each candidate sowing date (weekly, April to June) and each crop:')
bullets([
    'Add up daily warmth (thermal time) from sowing until the crop’s flowering requirement is met, giving that year’s flowering date.',
    'Count it as a **frost year** if the minimum reached 1 °C or below during flowering, and a **heat year** if the maximum passed the crop’s limit (32 °C for cereals, 30 °C for canola and pulses) on at least two days during grain fill.',
    'Risk = share of the 30 years with either problem. The recommended window is every date within 8 percentage points of the lowest risk.',
])
P('On the demo farm this suggests wheat around 29 April, barley around 6 May, and canola and lupins 6–13 May, in line with local guides. The card shows the frost and heat curves so the farmer can see the trade-off.')

H2('4.7 “Did my rotation work?”')
P('Each paddock’s crop **vigour** in each past season is the area under its greenness curve, compared with the farm’s other cropped paddocks that same season (1.00× = farm average), which takes out good and bad years. The report compares cereals grown after a break crop with cereals grown after cereals. On the demo farm, cereals after a break crop were **27% more vigorous**. With five seasons this is a first hint, and the card says so until there are enough cases. Each season’s April–October rainfall and the matching rainfall-limited wheat yield (French & Schultz benchmark) are shown alongside.')

H2('4.8 Farm crop list and livestock')
P('Asked once during set-up and editable any time. Livestock only controls grazed pasture: vetch can be cut for hay and oats sold as grain or hay without animals. Everything is ticked by default, so existing plans and the demo behave as before.')

# =====================================================================================
# 5. DATA SOURCES
# =====================================================================================
H1('5. Where the data comes from')
P('All data comes from free public services, straight from the farmer’s browser. Nothing is sent anywhere except the map locations needed to look data up.')
table(['Data', 'Provider', 'Used for', 'Detail'], [
    ['**NASA HLS v2.0** (HLSL30 + HLSS30)', 'NASA, via Microsoft Planetary Computer', 'Crop history, canola map, crop vigour', '30 m, a look every 2–3 days. Planetary Computer serves it to browsers without a login.'],
    ['**NASA POWER daily**', 'NASA Langley', 'Sowing window, season rainfall', 'Daily min/max temperature and rainfall, last 30 complete years, one request per farm.'],
    ['**NASA POWER climatology**', 'NASA Langley', 'Paddock climate', 'Long-term rainfall, temperature, root-zone wetness.'],
    ['Sentinel-2 L2A', 'ESA Copernicus, via Planetary Computer', 'Time-lapse pictures', '10 m original images of the same passes HLS uses, plus scene classification to check cloud over the farm.'],
    ['SoilGrids 2.0', 'ISRIC', 'Soil card, split suggestions, planner', '250 m soil maps, 0–30 cm.'],
    ['Copernicus DEM', 'via Open-Meteo', 'Slope and aspect', '90 m elevation.'],
    ['World Imagery / Topo', 'Esri', 'Map background', 'Basemap tiles.'],
    ['Nominatim', 'OpenStreetMap', 'Place search', 'One request per search.'],
    ['Cropland Data Layer', 'USDA', 'Accuracy testing only', 'Crop grown in every 30 m pixel of the US; our ground truth.'],
    ['Crop prices', 'Our own table', 'Indicative prices', 'Example values only, not live market data.'],
], widths=[3.6, 3.6, 3.6, 6.0], size=9)

# =====================================================================================
# 6. ACCURACY
# =====================================================================================
H1('6. How accurate it is: testing and validation')
P('We didn’t want to claim accuracy we couldn’t show. The crop-from-space engine was tested against an independent ground truth: the **USDA Cropland Data Layer**, which records the crop in every 30 m pixel of the United States. We used canola country in Cavalier County, North Dakota. The 2021 season was used while developing; **2020 was held out** and only checked at the end. Every test can be re-run from the project.')

H2('6.1 Crop from space')
table(['Measure', '2021 (development)', '2020 (held out)'], [
    ['Canola found (recall)', '85.3%', '95.7%'],
    ['Canola right when called (precision)', '94.1%', '89.2%'],
    ['Crop family right (cereal / canola / pulse / pasture / fallow)', '78.3%', '87.7%'],
    ['Neighbour-canola map, per pixel (precision / recall)', '83.7% / 64.6%', '79.7% / 86.7%'],
], widths=[9.0, 3.9, 3.9])
P('About 5,500 uniform 150 m blocks per season, classified by the app’s own code. Re-run with **npm run validate:phenology**.', size=9.5, color=MUTED)

H2('6.2 Choosing the best analysis by test')
P('Rather than guess, we tested the options and kept what won.')
H3('Adopted: reading paddocks from pixels wholly inside them')
table(['Field size', '2021: all pixels → pure pixels', '2020: all pixels → pure pixels'], [
    ['5–20 ha', '57.4% → 67.6%', '48.5% → 51.5%'],
    ['20–60 ha', '62.3% → 79.2%', '72.5% → 77.5%'],
    ['over 60 ha', '68.1% → 84.7%', '88.0% → 92.8%'],
], widths=[3.8, 6.5, 6.5])
P('Crop type right on whole USDA fields. Re-run with **npm run validate:pixels**.', size=9.5, color=MUTED)
H3('Tested and not adopted: a 10 m canola map from Sentinel-2')
table(['Canola map (field interiors)', '2021 precision / recall', '2020 precision / recall'], [
    ['NASA HLS, 30 m (kept)', '98.7% / 73.4%', '90.5% / 91.9%'],
    ['Sentinel-2, 10 m', '99.9% / 45.7%', '80.8% / 58.5%'],
], widths=[6.0, 5.4, 5.4])
P('Same detector, same 8 × 8 km area. NASA HLS found far more of the canola, so it stays for the analysis; 10 m is used for pictures only. Re-run with **npm run validate:canola10m**.', size=9.5, color=MUTED)

H2('6.3 Other checks')
bullets([
    '**Paddock area:** within 0.001% of a reference geodesic library, 1 ha to 40,000 ha, including at 60° latitude.',
    '**Soil sample point:** always inside the paddock, including U-shaped and crescent paddocks and their split halves.',
    '**Soil texture class:** 22 of 22 USDA reference cases; SoilGrids units checked against the live service.',
    '**Slope:** recovers known slopes to ±0.02% and the right facing direction.',
    '**Priority sliders:** each one moves the plan the right way across its whole range.',
])

H2('6.4 Where it is weaker')
bullets([
    '**Cereal vs pulse** is the hardest call from greenness alone, so these seasons are usually marked “best guess” and left to the farmer.',
    '**Sunflower** also flowers yellow and can be read as canola (rare in Australian winter cropping).',
    '**Fallow** is sometimes read as a weedy pulse.',
    'The validation is in **North Dakota**, a different climate from Australia; Australian ground truth would strengthen it.',
    'SoilGrids is a 250 m model, NASA POWER climate is regional (about 50 km), and the elevation model is 90 m. Sowing-window crop timings assume mid-maturity varieties.',
])

# =====================================================================================
# 7. STACK & ARCHITECTURE
# =====================================================================================
H1('7. Technology stack and architecture')
figure('architecture.png', 'How the app fits together: screens on top of pure logic, with services fetching and caching public data. No backend.', 17)
H2('7.1 Stack')
table(['Layer', 'Technology', 'Why we chose it'], [
    ['User interface', 'React 19 (function components, hooks, lazy-loaded screens)', 'Fast, familiar, and each screen loads only when needed.'],
    ['Routing', 'React Router 7 (hash routes)', 'Works from any static host with no server set-up.'],
    ['Build and dev server', 'Vite 8 with the React plugin', 'Instant reloads while building; small production build (main bundle about 340 kB, 103 kB compressed; the map code loads only with the map screens).'],
    ['Maps and drawing', 'Leaflet 1.9 with our own drawing, snapping and editing tools', 'Lightweight, reliable, and easy to extend with custom controls.'],
    ['Geometry', 'Our own WGS84 geometry + polygon-clipping 0.15', 'Accurate areas, inside-point and overlap trimming.'],
    ['Satellite processing', 'Our own code on NASA HLS layers (NDVI, flower index, cloud mask)', 'Runs in the browser on small per-farm images: no servers, no keys.'],
    ['Styling and artwork', 'Plain CSS with design tokens; SVG artwork exported from the Figma file', 'Pixel-faithful to the design and easy to change.'],
    ['Storage', 'Browser localStorage (farm data) and Cache Storage (images, weather)', 'Private by default; a farm’s satellite record is downloaded once.'],
    ['Testing', 'Puppeteer + Chrome (browser checks), pngjs (accuracy scripts)', 'Tests drive the real app like a user would.'],
    ['Tooling', 'Node.js 22.15+, our Figma exporter (Kiwi schema + zstd)', 'Re-exports all artwork when the design changes.'],
], widths=[3.2, 6.2, 7.4], size=9)

H2('7.2 How the code is organised')
table(['Folder', 'What lives there'], [
    ['src/screens', 'One file per screen in the design: Login, Experience, YourFarm, OutlinePaddocks, ReviewPaddocks, PaddockHistory, PaddockPriorities, Planner, Dashboard.'],
    ['src/components', 'Reusable pieces: the Leaflet map, season strip, time-lapse, crop picker, sowing and report cards, Manami’s chat, loading screens, UI kit.'],
    ['src/logic', 'Pure decision code, testable without a browser: rotation planner, crop-from-space classifier, sowing risk, rotation report, crop list, geometry, snapping, overlap, Manami’s answers.'],
    ['src/services', 'Talking to data services, with caching and retries: NASA HLS and the farm analysis, NASA POWER, SoilGrids, elevation, place search.'],
    ['src/state', 'The app’s saved state and data-loading hooks.'],
    ['src/data', 'The crop knowledge base (11 crops + fallow, editable by agronomists) and the demo farm.'],
    ['tools/', 'Figma exporter, accuracy-test scripts (validation) and browser checks (e2e).'],
    ['docs/', 'Visual README, build plan, project tracker and this document.'],
], widths=[3.2, 13.6], size=9)
P('**Design choice:** there is deliberately no backend. Everything a farmer enters stays in their own browser, the app can be hosted as static files anywhere, and there are no keys or accounts to manage during judging. Adding accounts later only means adding a sync service; the screens and logic don’t change.')

# =====================================================================================
# 8. DESIGN
# =====================================================================================
H1('8. Design: from Figma to a working app')
bullets([
    '**Straight from the design file.** We wrote an exporter that decodes the Figma file itself (Kiwi schema + zstd compression) and renders every scene, sheep, Manami and icon to SVG using Figma’s own vector geometry, so the art matches the editor exactly.',
    '**Design tokens.** Colours, corner radii, shadows and type sizes come from the Figma components. Button colours are kept exactly as designed.',
    '**A living world.** The exporter tags sheep, eyes and grass so the sheep bob and blink, the grass sways, the background shifts gently with the mouse, and a clicked sheep hops and says “Baa!”. Loading screens show sheep running across a field. All motion switches off for people who prefer reduced motion.',
    '**Guidance built in.** A five-step progress bar under every title, Manami’s tips for new farmers, plain-language explanations on every recommendation.',
    '**Accessible.** Everything works with the keyboard (including the map drawing and the season strip), with visible focus outlines and screen-reader labels.',
    '**Fits any window**, as described in section 3.10.',
])
two_figures('mobile-outline.png', 'mobile-planner.png', 'The same app on a phone: outlining paddocks and the plan.', 5.0)

# =====================================================================================
# 9. QUALITY
# =====================================================================================
H1('9. How we keep it working: quality checks')
P('Every change is checked by automated tests that drive the real app in Chrome, at both a laptop-sized window and the design size.')
table(['Check', 'What it proves'], [
    ['Drawing', 'Selecting paddocks, undo, double-click finish, rejecting crossed and tiny shapes, dragging and adding corners.'],
    ['Snapping', 'Corners lock onto neighbours exactly, gaps survive zooming in, border tracing, Alt to place freely, overlap trimming.'],
    ['Whole flow', 'Every screen from login to dashboard, the season strip (keyboard, clicking the last season), Manami’s chat.'],
    ['Soil split + mobile', 'The soil-based split suggestion and the phone layouts.'],
    ['Sliders (UI)', 'Click, drag and keyboard values, and the labels from “Not important” to “Top priority”.'],
    ['Sliders (plan)', 'Each priority moves the plan in the right direction across its range.'],
    ['Crop list', '“Crops only” removes pasture; the Planner, Priorities preview and Dashboard use only ticked crops; editing from the Planner updates the plan.'],
    ['NASA flow', 'Satellite history, “Use as crop history”, sowing windows and the rotation report, with no errors.'],
    ['Fit', 'No screen makes the page scroll in a laptop-sized window.'],
], widths=[3.6, 13.2], size=9.5, first_bold=True)
P('Plus the three accuracy scripts in section 6. Run everything with **npm run test:e2e** (dev server running) and **npm run validate:phenology / validate:pixels / validate:canola10m**.')

# =====================================================================================
# 10. HOW WE GOT HERE
# =====================================================================================
H1('10. How we got here')
table(['Stage', 'What we did'], [
    ['1. Design to app', 'Decoded our Figma file, exported all artwork and built the eight screens with a real satellite map, soil, slope and climate data, the rotation planner and Manami’s chat.'],
    ['2. Polish', 'Animations, a clearer flow with a step indicator, better spacing, sheep-running loading screens, a better map toolbar.'],
    ['3. Accuracy checks', 'Checked paddock areas, soil sampling, soil units, slope and slider behaviour against references, and fixed what didn’t hold up.'],
    ['4. Drawing next to neighbours', 'Screen-based snapping that still allows real gaps, border tracing and automatic overlap trimming.'],
    ['5. The NASA features', 'Paddock Memory from Space, neighbour canola and blackleg, the safest sowing window and “Did my rotation work?”, each validated or benchmarked.'],
    ['6. Works on every screen', 'Fit-to-window zoom so nothing needs scrolling on a laptop, and a clickable season strip in place of a drag ruler.'],
    ['7. The farmer’s own crops', 'The crop list and livestock choice, so plans only use what the farm can grow.'],
    ['8. Sharper and more accurate', 'Pure-pixel paddock readings (tested: +5 to +17 points on real fields) and 10 m pictures.'],
], widths=[4.2, 12.6], size=9.5, first_bold=True)

# =====================================================================================
# 11. RUN & DEMO
# =====================================================================================
H1('11. Running it and giving the demo')
H2('Running it')
bullets([
    'Install Node.js 22.15 or newer.',
    'In the project folder: **npm install**, then **npm run dev**, then open http://localhost:5173.',
    'On the login screen press **“Try the demo farm”**.',
    '**npm run build** produces a static site in the dist folder that can be hosted anywhere.',
], style='List Number')
H2('A three-minute demo')
table(['Time', 'Show', 'Say'], [
    ['0:00', 'Login → “Try the demo farm”', 'A real farm in the NSW Riverina: four paddocks, 122 ha.'],
    ['0:20', 'Paddock details → “Seen from space”', 'We read about 100 NASA images over five seasons and know what grew here, with the evidence. One click fills the history.'],
    ['0:50', 'Time-lapse → flowering picture; the yellow map', 'Canola flowered 52 m from this paddock. Its stubble spreads blackleg: something you can’t see from the farm gate.'],
    ['1:20', 'Planner → season strip, Crops to Grow', 'The plan steers canola away from that paddock and explains why. Every dot is a paddock’s crop, ten seasons ahead.'],
    ['1:50', 'Sowing window card', 'Thirty years of NASA weather: sow canola 6–13 May to dodge frost at flowering and heat in grain fill.'],
    ['2:15', 'Your crops → Crops only', 'No livestock? Pasture disappears and the plan updates instantly.'],
    ['2:35', 'Dashboard → Did my rotation work?', 'Proof from space: cereals after a break crop were 27% more vigorous on this farm.'],
    ['2:50', 'Accuracy slide', 'Checked against USDA crop maps: canola found 85–96% of the time.'],
], widths=[1.4, 5.2, 10.2], size=9)
P('Tip: open the demo farm once before presenting so the satellite images and weather are already cached.', size=9.5, color=MUTED)

# =====================================================================================
# 12. LIMITS & NEXT
# =====================================================================================
H1('12. Limits, open questions and what’s next')
H2('Known limits')
bullets([
    'Login is front-end only and data lives in one browser; there are no shared accounts yet (planned: section 13).',
    'Crop prices are example values, not a live market feed.',
    'Each paddock is planned on its own, so a short crop list can put the whole farm into one crop in a season.',
    'Very short windows (under about 515 px tall) still scroll, to keep text readable.',
    'Cereal vs pulse from space is the weakest call (section 6.4).',
])
H2('Questions we are still deciding')
bullets([
    'Which challenge statement wording we lead with, and how we pitch it (our plan: lead with Paddock Memory from Space).',
    'The app’s final name (the design still says “Webapp Name”).',
    'Australia-first or global, and whether to add Australian ground truth to the validation.',
    'Whether the planner should keep some crop variety across the whole farm each season.',
])
H2('What’s next')
bullets([
    'A bundled snapshot of the demo farm so the demo loads instantly even on slow Wi-Fi.',
    'Better cereal vs pulse calls, e.g. adding Sentinel-1 radar or Australian training data.',
    'Letting farmers choose early, mid or late-maturity varieties in the sowing window.',
    'Per-paddock crop limits (e.g. “no canola next to the creek”).',
    'Live crop prices.',
    'Accounts and cloud storage, a smarter Manami, daily weather with actions and a richer dashboard: see section 13.',
])

# =====================================================================================
# 13. NEXT STAGE
# =====================================================================================
H1('13. The next stage: accounts, a smarter Manami, daily weather')
P('The first version proves the idea with no backend. The next stage turns it into something a farmer can rely on season after season: their farm saved to an account, a guide that can answer anything, and a daily view of what the weather means for their paddocks. Our rule stays the same: **free to run and simple to maintain**, so every piece below fits in free tiers.')
table(['Phase', 'What we add', 'Why it matters to a farmer', 'Built with'], [
    ['**1. Accounts and saved farms**', 'Sign in (email link or Google). The farm, paddocks, history, priorities, crop list and satellite results are saved to the cloud and appear on any device.', 'Their records build up year after year and are never lost with a browser.', 'Supabase Auth + Supabase database'],
    ['**2. A farm diary**', 'Record what actually happened: sowing date and crop, sprays, fertiliser, harvest and yield, notes.', 'The history becomes their own record, and the “Did my rotation work?” report can use real yields, not only satellite vigour.', 'Supabase database'],
    ['**3. Manami with AI**', 'Manami answers any farming question in plain words, knows the farmer’s own paddocks and plan, and still gives her screen-by-screen tips and guides new farmers through each step.', 'Help that fits their farm, not generic answers.', 'OpenRouter (free models), called through a small Supabase function so no key is exposed'],
    ['**4. Daily weather and actions**', 'A 7-day forecast for the farm and plain actions: frost tonight, good spray window tomorrow, rain coming (sowing or fertiliser opportunity), heat stress, waterlogging risk, plus how the season’s rain compares with normal.', 'Turns the plan into day-to-day decisions.', 'Open-Meteo forecast (free, no key) + NASA POWER for the long-term normal'],
    ['**5. A better dashboard**', 'Today’s weather and actions first; this season’s crop and stage for every paddock; alerts (frost, blackleg, overdue jobs); the rotation timeline; season rainfall vs normal; recent diary entries.', 'One screen to open every morning.', 'Existing app + phases 1–4'],
], widths=[3.2, 5.6, 4.6, 3.4], size=9)
H2('How the backend will work')
bullets([
    '**Supabase** gives us sign-in, a Postgres database and small server functions in one free project. Each farmer can only ever read and write their own rows (row-level security).',
    '**The app stays fast and works offline.** It keeps its local copy and syncs with the cloud when signed in; the demo farm still works without an account.',
    '**Manami’s AI** runs through a Supabase function that holds the OpenRouter key, adds the farm’s context, and limits how many questions each user can ask per day. If the AI is busy or the limit is reached, Manami falls back to her built-in answers.',
    '**Weather** comes straight from Open-Meteo’s free forecast in the browser and is cached for a few hours; a later step can run a nightly check that emails frost alerts.',
])
H2('Things to keep in mind')
bullets([
    'Free Supabase projects pause after a week without use, so we’ll open it before demos (or upgrade later).',
    'Free AI models have daily limits and can be slower; the built-in answers are the safety net.',
    'Farm data becomes personal data in the cloud, so we’ll add a short privacy note and a “download / delete my data” option.',
])

# =====================================================================================
# GLOSSARY
# =====================================================================================
H1('Appendix: glossary')
table(['Term', 'Meaning'], [
    ['Paddock', 'A fenced field on a farm.'],
    ['Rotation', 'The sequence of crops grown in a paddock over the years.'],
    ['Break crop', 'A non-cereal crop (canola, a legume or pasture) that breaks cereal disease and weed cycles.'],
    ['Legume / pulse', 'Crops such as lupins, peas, beans, chickpeas and lentils that take nitrogen from the air and leave it in the soil.'],
    ['Fallow', 'Leaving a paddock unplanted for a season.'],
    ['Blackleg', 'Canola’s most damaging fungal disease; spores spread from old canola stubble.'],
    ['NASA HLS', 'Harmonized Landsat Sentinel-2: NASA’s product that combines Landsat 8/9 and Sentinel-2 into one consistent 30 m record, a look every 2–3 days.'],
    ['NASA POWER', 'NASA’s service for weather and climate at any point on Earth, from satellites and models.'],
    ['NDVI', 'A greenness index from red and near-infrared light; high for healthy crops.'],
    ['NDYI', 'A yellowness index from green and blue light; rises when canola flowers.'],
    ['Cloud mask (Fmask, SCL)', 'Per-pixel flags marking cloud, shadow and other unusable pixels.'],
    ['Phenology', 'The timing of a crop’s life cycle: green-up, peak, flowering, dry-off.'],
    ['Thermal time', 'Accumulated daily warmth (°C days) a crop needs to reach a stage such as flowering.'],
    ['Water-limited yield', 'The yield the season’s rainfall could support (French & Schultz: (rain − 110 mm) × 20 kg/ha per mm).'],
    ['Precision / recall', 'Of what we called canola, how much really was (precision); of the real canola, how much we found (recall).'],
    ['Pure pixel', 'A satellite pixel lying wholly inside a paddock, with no fence line or neighbouring crop mixed in.'],
], widths=[3.8, 13.0], size=9.5, first_bold=True)

doc.core_properties.title = 'TEAM SHEEEEP: project breakdown'
doc.core_properties.subject = 'Paddock and crop-rotation planner using NASA Earth data'
doc.core_properties.author = 'TEAM SHEEEEP'
doc.save(OUT)
print('saved', OUT, os.path.getsize(OUT) // 1024, 'KB')
