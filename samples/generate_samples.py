"""Sinh các tệp PDF văn bằng mẫu phục vụ demo (chạy: python samples/generate_samples.py).
Yêu cầu: pip install pymupdf. Dùng phông Times New Roman của Windows để hiển thị tiếng Việt."""
import json, os, fitz

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = r"C:\Windows\Fonts\times.ttf"
FONT_B = r"C:\Windows\Fonts\timesbd.ttf"
FONT_I = r"C:\Windows\Fonts\timesi.ttf"

TITLES = {0: "BẰNG KỸ SƯ", 1: "BẰNG THẠC SĨ", 2: "BẰNG TIẾN SĨ", 3: "CHỨNG CHỈ"}

def make(s):
    doc = fitz.open()
    W, H = 842, 595  # A4 ngang
    p = doc.new_page(width=W, height=H)
    for name, path in (("tr", FONT), ("tb", FONT_B), ("ti", FONT_I)):
        p.insert_font(fontname=name, fontfile=path)
    navy, gold, red = (0.04, 0.11, 0.23), (0.75, 0.56, 0.13), (0.6, 0.05, 0.05)
    p.draw_rect(fitz.Rect(18, 18, W - 18, H - 18), color=gold, width=4)
    p.draw_rect(fitz.Rect(28, 28, W - 28, H - 28), color=navy, width=1.2)

    def c(y, text, font="tr", size=13, color=navy):
        rect = fitz.Rect(40, y, W - 40, y + size * 1.8)
        p.insert_textbox(rect, text, fontname=font, fontsize=size, color=color, align=fitz.TEXT_ALIGN_CENTER)

    c(45, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "tb", 14)
    c(65, "Độc lập - Tự do - Hạnh phúc", "tb", 13)
    c(100, s["issuerName"].upper(), "tb", 15, red)
    c(125, "cấp", "ti", 13)
    c(150, TITLES[s["certType"]], "tb", 34, red)
    c(200, s["major"], "tb", 18)
    c(240, "Cho: " + s["name"], "tb", 20)
    c(275, f"Ngày sinh: {s['dobVN']}        Mã sinh viên: {s['studentId']}", "tr", 14)
    c(300, f"Xếp loại: {s['rank']}        Năm tốt nghiệp: {s['year']}", "tr", 14)
    c(325, f"Hình thức đào tạo: {s.get('mode', 'Chính quy')}", "tr", 14)
    p.insert_textbox(fitz.Rect(60, 420, 400, 520),
        f"Số hiệu: {s['serialNo']}\nSố vào sổ cấp văn bằng: {s['book']}",
        fontname="tr", fontsize=12, color=navy)
    p.insert_textbox(fitz.Rect(450, 380, 800, 540),
        f"Hải Phòng, {s['date']}\nHIỆU TRƯỞNG\n\n\n(Đã ký)",
        fontname="tb", fontsize=13, color=navy, align=fitz.TEXT_ALIGN_CENTER)
    doc.set_metadata({"title": f"{TITLES[s['certType']]} - {s['serialNo']}", "author": s["issuerName"],
                      "creationDate": "D:20260615000000", "modDate": "D:20260615000000", "producer": "CertChain sample"})
    doc.subset_fonts()
    doc.save(os.path.join(HERE, s["file"]), garbage=4, deflate=True, no_new_id=True)

if __name__ == "__main__":
    with open(os.path.join(HERE, "samples.json"), encoding="utf-8") as f:
        for s in json.load(f):
            make(s)
            print("created", s["file"])
