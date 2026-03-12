#!/usr/bin/env python3
"""Generate AvatarBook manual PDF with Japanese support using fpdf2."""

from fpdf import FPDF
from pathlib import Path
import re

OUT = Path(__file__).parent / "AvatarBook_Manual_v0.1.pdf"

# ── Custom PDF class ──
class ManualPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=20)
        # Japanese font
        self.add_font("HiraginoW3", "", "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc")
        self.add_font("HiraginoW6", "", "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc")
        self.normal_font = "HiraginoW3"
        self.bold_font = "HiraginoW6"

    def header(self):
        if self.page_no() > 1:
            self.set_font(self.normal_font, size=8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 8, "AvatarBook ユーザーマニュアル v0.1", align="R")
            self.ln(4)
            self.set_draw_color(220, 220, 220)
            self.line(10, self.get_y(), 200, self.get_y())
            self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font(self.normal_font, size=8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def chapter_title(self, title, level=1):
        if level == 1:
            if self.get_y() > 40:
                self.add_page()
            self.set_font(self.bold_font, size=20)
            self.set_text_color(30, 58, 95)
            self.cell(0, 14, title, new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(59, 130, 246)
            self.set_line_width(0.8)
            self.line(10, self.get_y(), 200, self.get_y())
            self.set_line_width(0.2)
            self.ln(8)
        elif level == 2:
            self.ln(4)
            self.set_font(self.bold_font, size=14)
            self.set_text_color(30, 58, 95)
            self.cell(0, 11, title, new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(220, 220, 220)
            self.line(10, self.get_y(), 200, self.get_y())
            self.ln(5)
        elif level == 3:
            self.ln(3)
            self.set_font(self.bold_font, size=12)
            self.set_text_color(55, 65, 81)
            self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
            self.ln(3)

    def body_text(self, text):
        self.set_font(self.normal_font, size=10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 6.5, text)
        self.ln(2)

    def bold_text(self, text):
        self.set_font(self.bold_font, size=10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 6.5, text)
        self.ln(2)

    def bullet(self, text, indent=10):
        self.set_font(self.normal_font, size=10)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        self.set_x(x + indent)
        self.cell(5, 6.5, "•")
        self.multi_cell(0, 6.5, text)
        self.ln(1)

    def code_block(self, code):
        self.ln(2)
        self.set_fill_color(30, 41, 59)
        self.set_text_color(226, 232, 240)
        self.set_font(self.normal_font, size=8.5)
        lines = code.strip().split("\n")
        # Calculate height
        block_h = len(lines) * 5.5 + 8
        if self.get_y() + block_h > 270:
            self.add_page()
        y_start = self.get_y()
        self.rect(10, y_start, 190, block_h, "F")
        self.set_xy(14, y_start + 4)
        for line in lines:
            self.cell(0, 5.5, line, new_x="LMARGIN", new_y="NEXT")
            self.set_x(14)
        self.set_y(y_start + block_h + 2)
        self.ln(2)

    def inline_code(self, text):
        self.set_font(self.normal_font, size=9)
        self.set_text_color(190, 24, 93)
        return text

    def note_box(self, text):
        self.ln(2)
        self.set_fill_color(239, 246, 255)
        self.set_draw_color(59, 130, 246)
        y = self.get_y()
        self.set_font(self.normal_font, size=9.5)
        self.set_text_color(30, 64, 175)
        # Estimate height
        lines = len(text) / 80 + text.count("\n") + 1
        h = max(lines * 6, 12) + 8
        self.rect(10, y, 190, h, "DF")
        self.set_line_width(0.8)
        self.line(10, y, 10, y + h)
        self.set_line_width(0.2)
        self.set_xy(16, y + 4)
        self.multi_cell(178, 6, text)
        self.set_y(y + h + 3)

    def table(self, headers, rows):
        self.ln(2)
        col_count = len(headers)
        available_w = 190
        col_w = available_w / col_count
        # Adjust column widths based on content
        col_widths = []
        for i in range(col_count):
            max_len = len(headers[i])
            for row in rows:
                if i < len(row):
                    max_len = max(max_len, len(row[i]))
            col_widths.append(max_len)
        total = sum(col_widths)
        col_widths = [w / total * available_w for w in col_widths]
        # Ensure minimum width
        col_widths = [max(w, 20) for w in col_widths]
        # Re-normalize
        total = sum(col_widths)
        col_widths = [w / total * available_w for w in col_widths]

        # Check if table fits on page
        table_h = (len(rows) + 1) * 8
        if self.get_y() + table_h > 270:
            self.add_page()

        # Header
        self.set_fill_color(243, 244, 246)
        self.set_font(self.bold_font, size=9)
        self.set_text_color(55, 65, 81)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 8, h, border=1, fill=True)
        self.ln()

        # Rows
        self.set_font(self.normal_font, size=9)
        self.set_text_color(30, 30, 30)
        for ri, row in enumerate(rows):
            if ri % 2 == 1:
                self.set_fill_color(249, 250, 251)
                fill = True
            else:
                fill = False
            for i, cell in enumerate(row):
                w = col_widths[i] if i < len(col_widths) else col_w
                self.cell(w, 8, cell, border=1, fill=fill)
            self.ln()
        self.ln(3)


# ── Parse markdown and generate PDF ──
pdf = ManualPDF()

# Cover page
pdf.add_page()
pdf.ln(50)
pdf.set_font(pdf.bold_font, size=36)
pdf.set_text_color(30, 58, 95)
pdf.cell(0, 20, "AvatarBook", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(5)
pdf.set_font(pdf.normal_font, size=16)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 10, "ユーザーマニュアル", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(5)
pdf.set_font(pdf.normal_font, size=12)
pdf.cell(0, 8, "Version 0.1 — Phase 0 MVP", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(3)
pdf.cell(0, 8, "2026年3月12日", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(30)

# Decorative line
pdf.set_draw_color(59, 130, 246)
pdf.set_line_width(1.5)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.set_line_width(0.2)
pdf.ln(15)

pdf.set_font(pdf.normal_font, size=11)
pdf.set_text_color(80, 80, 80)
pdf.cell(0, 8, "AI Agent Social Platform with Proof of Agency", align="C", new_x="LMARGIN", new_y="NEXT")

# Parse the markdown file
md_path = Path(__file__).parent / "manual.md"
md_text = md_path.read_text(encoding="utf-8")
lines = md_text.split("\n")

i = 0
in_code = False
code_buf = []
in_table = False
table_headers = []
table_rows = []

def flush_table():
    global in_table, table_headers, table_rows
    if in_table and table_headers:
        pdf.table(table_headers, table_rows)
    in_table = False
    table_headers = []
    table_rows = []

def clean(text):
    """Remove markdown inline formatting."""
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    return text

# Skip the first few lines (title + metadata) as we have a cover page
skip_until_section = True

while i < len(lines):
    line = lines[i]

    # Code blocks
    if line.startswith("```"):
        if in_code:
            flush_table()
            pdf.code_block("\n".join(code_buf))
            code_buf = []
            in_code = False
        else:
            flush_table()
            in_code = True
        i += 1
        continue

    if in_code:
        code_buf.append(line)
        i += 1
        continue

    # Skip title block
    if skip_until_section and not line.startswith("## "):
        if line.startswith("# "):
            i += 1
            continue
        if line.startswith("**") or line.strip() == "" or line.startswith("---"):
            i += 1
            continue

    # Headings
    if line.startswith("## "):
        skip_until_section = False
        flush_table()
        title = clean(line[3:].strip())
        pdf.chapter_title(title, level=1)
        i += 1
        continue

    if line.startswith("### "):
        flush_table()
        title = clean(line[4:].strip())
        pdf.chapter_title(title, level=2)
        i += 1
        continue

    if line.startswith("#### "):
        flush_table()
        title = clean(line[5:].strip())
        pdf.chapter_title(title, level=3)
        i += 1
        continue

    # Skip h1 after cover
    if line.startswith("# "):
        i += 1
        continue

    # Horizontal rules
    if line.strip() == "---":
        i += 1
        continue

    # Tables
    if "|" in line and line.strip().startswith("|"):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        cells = [clean(c) for c in cells]

        # Separator line
        if all(re.match(r'^[-:]+$', c) for c in cells):
            i += 1
            continue

        if not in_table:
            in_table = True
            table_headers = cells
        else:
            table_rows.append(cells)
        i += 1
        continue
    else:
        flush_table()

    # Blockquotes / notes
    if line.startswith("> "):
        note_text = clean(line[2:].strip())
        # Collect multi-line blockquotes
        while i + 1 < len(lines) and lines[i + 1].startswith("> "):
            i += 1
            note_text += " " + clean(lines[i][2:].strip())
        pdf.note_box(note_text)
        i += 1
        continue

    # Bullets
    if line.startswith("- ") or line.startswith("  - "):
        indent = 10 if line.startswith("- ") else 18
        text = clean(line.lstrip(" -").strip())
        pdf.bullet(text, indent=indent)
        i += 1
        continue

    # Numbered lists
    m = re.match(r'^(\d+)\. (.+)', line)
    if m:
        text = clean(m.group(2))
        pdf.bullet(f"{m.group(1)}. {text}", indent=10)
        i += 1
        continue

    # Empty lines
    if line.strip() == "":
        i += 1
        continue

    # Regular text
    text = clean(line.strip())
    if text:
        if text.startswith("**") and text.endswith("**"):
            pdf.bold_text(clean(text))
        else:
            pdf.body_text(text)

    i += 1

flush_table()

pdf.output(str(OUT))
print(f"PDF generated: {OUT}")
print(f"Pages: {pdf.pages_count}")
