const slideConfig = {
  type: "cover",
  index: 1,
  title: "Presentation Title",
  subtitle: "One-line description of the deck"
};

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };
  const displayFont = theme.fonts?.display || "Arial";
  const bodyFont = theme.fonts?.body || "Arial";
  const lang = theme.lang || "en-US";

  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    line: { color: theme.bg, transparency: 100 },
    fill: { color: theme.bg }
  });

  slide.addShape(pres.ShapeType.rect, {
    x: 0.45,
    y: 0.55,
    w: 0.22,
    h: 4.45,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent }
  });

  slide.addText(slideConfig.title, {
    x: 0.95,
    y: 1.05,
    w: 7.6,
    h: 1.2,
    fontFace: displayFont,
    lang,
    fontSize: 28,
    bold: true,
    color: theme.primary,
    margin: 0
  });

  slide.addText(slideConfig.subtitle, {
    x: 0.98,
    y: 2.35,
    w: 6.8,
    h: 0.7,
    fontFace: bodyFont,
    lang,
    fontSize: 14,
    color: theme.secondary,
    margin: 0
  });

  slide.addText("Replace this starter slide with your real opening narrative.", {
    x: 0.98,
    y: 3.25,
    w: 5.8,
    h: 0.9,
    fontFace: bodyFont,
    lang,
    fontSize: 11,
    color: theme.secondary,
    margin: 0
  });

  return slide;
}

module.exports = { createSlide, slideConfig };
