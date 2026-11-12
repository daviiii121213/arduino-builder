//! Gerador de PDF mínimo e sem dependências externas (fontes padrão Helvetica,
//! codificação WinAnsi). Suficiente para relatórios tabulares em português.

pub struct PdfTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    /// Alinhamento à direita por coluna (valores numéricos).
    pub right: Vec<bool>,
}

const W: f32 = 842.0;
const H: f32 = 595.0;
const M: f32 = 36.0;

fn winansi(s: &str) -> Vec<u8> {
    let mut out = Vec::new();
    for c in s.chars() {
        let b = match c {
            '\u{20}'..='\u{7e}' => c as u8,
            '\u{a0}'..='\u{ff}' => c as u32 as u8,
            '€' => 0x80, '‚' => 0x82, '„' => 0x84, '…' => 0x85, '‘' => 0x91, '’' => 0x92, '“' => 0x93, '”' => 0x94,
            '•' => 0x95, '–' => 0x96, '—' => 0x97, '™' => 0x99,
            '\t' | '\n' | '\r' => b' ',
            _ => b'?',
        };
        match b {
            b'(' | b')' | b'\\' => {
                out.push(b'\\');
                out.push(b);
            }
            _ => out.push(b),
        }
    }
    out
}

/// Largura aproximada de texto em Helvetica.
fn text_width(s: &str, size: f32) -> f32 {
    s.chars()
        .map(|c| match c {
            'i' | 'j' | 'l' | '.' | ',' | ':' | ';' | '\'' | '|' | '!' | 'í' | 'ì' | 'ï' | 'î' => 0.24,
            'f' | 't' | 'r' | ' ' | '(' | ')' | '-' | '/' => 0.32,
            'm' | 'w' | 'M' | 'W' | '@' => 0.82,
            'A'..='Z' | 'Á' | 'À' | 'Â' | 'Ã' | 'É' | 'Ê' | 'Í' | 'Ó' | 'Ô' | 'Õ' | 'Ú' | 'Ç' => 0.66,
            '0'..='9' => 0.556,
            _ => 0.52,
        })
        .sum::<f32>()
        * size
}

fn fit(s: &str, width: f32, size: f32) -> String {
    if text_width(s, size) <= width {
        return s.to_string();
    }
    let mut out = String::new();
    for c in s.chars() {
        let mut t = out.clone();
        t.push(c);
        t.push('…');
        if text_width(&t, size) > width {
            break;
        }
        out.push(c);
    }
    out.push('…');
    out
}

struct Page {
    content: Vec<u8>,
}

impl Page {
    fn text(&mut self, x: f32, y: f32, size: f32, bold: bool, s: &str) {
        self.content.extend_from_slice(format!("BT /{} {} Tf {:.2} {:.2} Td (", if bold { "F2" } else { "F1" }, size, x, y).as_bytes());
        self.content.extend_from_slice(&winansi(s));
        self.content.extend_from_slice(b") Tj ET\n");
    }
    fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, gray: f32) {
        self.content.extend_from_slice(format!("{gray:.3} g {x:.2} {y:.2} {w:.2} {h:.2} re f 0 g\n").as_bytes());
    }
    fn line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32) {
        self.content.extend_from_slice(format!("0.8 G 0.5 w {x1:.2} {y1:.2} m {x2:.2} {y2:.2} l S 0 G\n").as_bytes());
    }
}

pub fn render(title: &str, subtitle: &str, summary: &[(String, String)], table: &PdfTable) -> Vec<u8> {
    let mut pages: Vec<Page> = Vec::new();
    let usable = W - 2.0 * M;
    let ncol = table.headers.len().max(1);
    // larguras proporcionais ao conteúdo (limitadas)
    let mut weights: Vec<f32> = table.headers.iter().map(|h| text_width(h, 9.0).max(40.0)).collect();
    for r in table.rows.iter().take(200) {
        for (i, c) in r.iter().enumerate().take(ncol) {
            weights[i] = weights[i].max(text_width(c, 9.0).min(260.0));
        }
    }
    let total: f32 = weights.iter().sum();
    let widths: Vec<f32> = weights.iter().map(|w| w / total * usable).collect();

    let row_h = 16.0;
    let mut page = Page { content: Vec::new() };
    let mut y = H - M;
    page.text(M, y - 14.0, 16.0, true, title);
    y -= 32.0;
    page.text(M, y, 9.0, false, subtitle);
    y -= 18.0;
    for (k, v) in summary {
        page.text(M, y, 10.0, true, k);
        page.text(M + text_width(k, 10.0) + 8.0, y, 10.0, false, v);
        y -= 14.0;
    }
    y -= 6.0;
    let header = |page: &mut Page, y: f32| {
        page.rect(M, y - 4.0, usable, row_h, 0.88);
        let mut x = M;
        for (i, h) in table.headers.iter().enumerate() {
            page.text(x + 3.0, y + 1.0, 9.0, true, &fit(h, widths[i] - 6.0, 9.0));
            x += widths[i];
        }
    };
    header(&mut page, y);
    y -= row_h;
    if table.rows.is_empty() {
        page.text(M + 3.0, y + 1.0, 9.0, false, "Nenhum registro encontrado para os filtros selecionados.");
    }
    for (ri, r) in table.rows.iter().enumerate() {
        if y < M + 24.0 {
            pages.push(page);
            page = Page { content: Vec::new() };
            y = H - M - 10.0;
            header(&mut page, y);
            y -= row_h;
        }
        if ri % 2 == 1 {
            page.rect(M, y - 4.0, usable, row_h, 0.965);
        }
        let mut x = M;
        for (i, c) in r.iter().enumerate().take(ncol) {
            let t = fit(c, widths[i] - 6.0, 9.0);
            let tx = if table.right.get(i).copied().unwrap_or(false) { x + widths[i] - 3.0 - text_width(&t, 9.0) } else { x + 3.0 };
            page.text(tx, y + 1.0, 9.0, false, &t);
            x += widths[i];
        }
        page.line(M, y - 4.0, M + usable, y - 4.0);
        y -= row_h;
    }
    pages.push(page);
    let n = pages.len();
    for (i, p) in pages.iter_mut().enumerate() {
        p.text(M, 18.0, 8.0, false, "PERSONAL LIFE ULTRA — relatório gerado localmente");
        let s = format!("Página {} de {}", i + 1, n);
        p.text(W - M - text_width(&s, 8.0), 18.0, 8.0, false, &s);
    }

    // montagem dos objetos
    let mut objs: Vec<Vec<u8>> = Vec::new();
    objs.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec()); // 1
    let kids: Vec<String> = (0..n).map(|i| format!("{} 0 R", 5 + i * 2)).collect();
    objs.push(format!("<< /Type /Pages /Kids [{}] /Count {} >>", kids.join(" "), n).into_bytes()); // 2
    objs.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".to_vec()); // 3
    objs.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>".to_vec()); // 4
    for (i, p) in pages.iter().enumerate() {
        let content_id = 6 + i * 2;
        objs.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_id} 0 R >>").into_bytes());
        let mut c = format!("<< /Length {} >>\nstream\n", p.content.len()).into_bytes();
        c.extend_from_slice(&p.content);
        c.extend_from_slice(b"\nendstream");
        objs.push(c);
    }
    let info_id = objs.len() + 1;
    let mut info = b"<< /Title (".to_vec();
    info.extend_from_slice(&winansi(title));
    info.extend_from_slice(b") /Producer (PERSONAL LIFE ULTRA) >>");
    objs.push(info);

    let mut out = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n".to_vec();
    let mut offsets = Vec::new();
    for (i, o) in objs.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n", i + 1).as_bytes());
        out.extend_from_slice(o);
        out.extend_from_slice(b"\nendobj\n");
    }
    let xref = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1).as_bytes());
    for off in offsets {
        out.extend_from_slice(format!("{off:010} 00000 n \n").as_bytes());
    }
    out.extend_from_slice(format!("trailer\n<< /Size {} /Root 1 0 R /Info {} 0 R >>\nstartxref\n{}\n%%EOF\n", objs.len() + 1, info_id, xref).as_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn renders_multi_page_pdf() {
        let rows: Vec<Vec<String>> = (0..120).map(|i| vec![format!("Tarefa nº {i} — ação"), "R$ 1.234,56".into()]).collect();
        let pdf = render("Relatório de teste", "Período: 01/01/2026 a 31/01/2026", &[("Total:".into(), "120".into())],
            &PdfTable { headers: vec!["Título".into(), "Valor".into()], rows, right: vec![false, true] });
        let s = String::from_utf8_lossy(&pdf);
        assert!(s.starts_with("%PDF-1.4"));
        assert!(s.contains("/Count 4") || s.contains("/Count 5"));
        assert!(s.trim_end().ends_with("%%EOF"));
    }
}
