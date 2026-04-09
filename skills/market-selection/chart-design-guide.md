# Chart Design Guide

Use this file before generating charts for market-insight-product-selection.

## Core rules

- Prefer one clear comparison chart over many decorative charts.
- Use `seaborn` for grouped bars, box plots, and ranked comparisons.
- Use `matplotlib` for custom annotation when needed.
- Avoid pie charts unless the share split is simple and stable.
- Always label time window, unit, and source on the chart.

## Recommended chart types

- Trend over time -> line chart
- Price band comparison -> histogram or box plot
- Category comparison -> horizontal bar chart
- Supplier or competitor score -> sorted bar chart

## Styling

- Use consistent axis labels and plain-English titles.
- Start axes at zero unless there is a strong reason not to.
- Limit color count to 4-6 meaningful categories.
- Annotate key outliers directly instead of writing long captions.

## Output rule

If the dataset is too small for a meaningful chart, skip the chart and use a table instead.
