const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { createDeckTheme } = require("./theme");

const pres = new PptxGenJS();
pres.layout = "LAYOUT_16x9";
pres.author = "OpenClaw";
pres.company = "Bustly";
pres.subject = "Generated presentation";
pres.title = "Generated presentation";

const baseTheme = {
  primary: "1F2937",
  secondary: "334155",
  accent: "EA580C",
  light: "FED7AA",
  bg: "FFF7ED"
};

const slidesDir = path.join(__dirname, "slides");
const outputDir = path.join(__dirname, "output");
fs.mkdirSync(outputDir, { recursive: true });

const slideFiles = fs
  .readdirSync(slidesDir)
  .filter((name) => /^slide-\d+\.js$/.test(name))
  .sort();

const slideModules = slideFiles.map((file) => {
  const modulePath = path.join(slidesDir, file);
  const slideModule = require(modulePath);
  if (typeof slideModule.createSlide !== "function") {
    throw new Error(`${file} does not export createSlide(pres, theme)`);
  }
  return { file, slideModule };
});

const theme = createDeckTheme(baseTheme, slideModules.map(({ slideModule }) => slideModule));
pres.lang = theme.lang;

for (const { slideModule } of slideModules) {
  slideModule.createSlide(pres, theme);
}

const outputFile = process.argv[2] || path.join(outputDir, "presentation.pptx");
pres
  .writeFile({ fileName: outputFile })
  .then(() => {
    console.log(`Wrote ${outputFile}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
