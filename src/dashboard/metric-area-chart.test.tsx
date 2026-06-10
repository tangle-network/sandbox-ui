import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricAreaChart, type MetricChartPoint } from "./metric-area-chart";

const fmtPercent = (v: number) => `${Math.round(v)}%`;

function points(values: Array<number | null>): MetricChartPoint[] {
  return values.map((value, i) => ({ at: 1_000_000 + i * 3_000, value }));
}

describe("MetricAreaChart", () => {
  it("shows the latest value in the header", () => {
    render(
      <MetricAreaChart
        points={points([10, 20, 35])}
        label="CPU"
        formatValue={fmtPercent}
        maxValue={100}
      />,
    );
    expect(screen.getByText("35%")).toBeInTheDocument();
  });

  it("renders an em dash and empty state when every sample is null", () => {
    render(
      <MetricAreaChart
        points={points([null, null])}
        label="CPU"
        formatValue={fmtPercent}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Waiting for samples…")).toBeInTheDocument();
  });

  it("splits the series into separate path segments at null gaps", () => {
    const { container } = render(
      <MetricAreaChart
        points={points([10, 20, null, 30, 40])}
        label="CPU"
        formatValue={fmtPercent}
        maxValue={100}
      />,
    );
    // Two runs of data → two line paths + two area fills.
    const paths = container.querySelectorAll("svg path");
    expect(paths).toHaveLength(4);
  });

  it("renders the y-axis maximum from maxValue, not the data max", () => {
    render(
      <MetricAreaChart
        points={points([10])}
        label="CPU"
        formatValue={fmtPercent}
        maxValue={100}
      />,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
