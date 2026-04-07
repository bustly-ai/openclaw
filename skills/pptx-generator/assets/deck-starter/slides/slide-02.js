const slideConfig = {
  type: "content",
  index: 2,
  title: "Key Messages",
  bullets: [
    "Keep one major idea per slide.",
    "Vary layouts across the deck instead of repeating one template.",
    "Use the theme object rather than hard-coded colors."
  ]
};

function addPageBadge(slide, pres, theme, number) {
  const bodyFont = theme.fonts?.body || "Arial";
  const lang = theme.lang || "en-US";
  slide.addShape(pres.ShapeType.roundRect, {
    x: 9.05,
    y: 5.05,
    w: 0.55,
    h: 0.34,
    rectRadius: 0.08,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  });
  slide.addText(String(number).padStart(2, "0"), {
    x: 9.05,
    y: 5.05,
    w: 0.55,
    h: 0.34,
    fontFace: bodyFont,
    lang,
    fontSize: 10,
    bold: true,
    color: "FFFFFF",
    align: "center",
    valign: "mid",
    margin: 0
  });
}

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: "FFFFFF" };
  const displayFont = theme.fonts?.display || "Arial";
  const bodyFont = theme.fonts?.body || "Arial";
  const lang = theme.lang || "en-US";

  slide.addText(slideConfig.title, {
    x: 0.6,
    y: 0.55,
    w: 6.0,
    h: 0.55,
    fontFace: displayFont,
    lang,
    fontSize: 22,
    bold: true,
    color: theme.primary,
    margin: 0
  });

  slide.addShape(pres.ShapeType.line, {
    x: 0.6,
    y: 1.2,
    w: 2.4,
    h: 0,
    line: { color: theme.accent, width: 2 }
  });

  slideConfig.bullets.forEach((text, index) => {
    slide.addText(`• ${text}`, {
      x: 0.82,
      y: 1.65 + index * 0.72,
      w: 5.3,
      h: 0.42,
      fontFace: bodyFont,
      lang,
      fontSize: 14,
      color: theme.secondary,
      margin: 0
    });
  });

  slide.addShape(pres.ShapeType.roundRect, {
    x: 6.65,
    y: 1.45,
    w: 2.45,
    h: 2.1,
    rectRadius: 0.08,
    line: { color: theme.light, transparency: 100 },
    fill: { color: theme.bg }
  });

  slide.addText("Replace this side panel with a chart, image, or short data callout.", {
    x: 6.95,
    y: 1.8,
    w: 1.85,
    h: 1.4,
    fontFace: bodyFont,
    lang,
    fontSize: 12,
    color: theme.secondary,
    align: "left",
    valign: "mid",
    margin: 0
  });

  addPageBadge(slide, pres, theme, slideConfig.index);
  return slide;
}

module.exports = { createSlide, slideConfig };
