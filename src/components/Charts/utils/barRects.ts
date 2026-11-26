/**
 * Rectangles of a vertical bar chart's bars, laid out the way victory-native's Bar and StackedBar lay them out,
 * so the chart can draw all the bars sharing a color as one path instead of one path per bar.
 */
import {BAR_GROUP_INNER_GAP} from '@components/Charts/barChartConstants';
import type {ChartDataPoint, ChartSeries} from '@components/Charts/types';
import VictoryTheme from '@components/Charts/VictoryTheme';

import type {PointsArray} from 'victory-native';

type ChartScale = (value: number) => number;

type BarRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type GroupedBar = BarRect & {
    /** The plotted value, whose sign tells which end of the bar is its far end */
    value: number;
};

type BarsOfColor = {
    color: string;
    bars: GroupedBar[];
};

type GetBarsByColorParams = {
    /** Canvas points of every series, keyed by the series' key */
    points: Partial<Record<string, PointsArray>>;

    /** The series drawn as bars, in slot order from the left */
    series: readonly ChartSeries[];

    data: ChartDataPoint[];
    yScale: ChartScale;

    /** Width of one bar, in px */
    barWidth: number;

    /** Width of the bars sharing a point together with the gaps between them, in px */
    groupWidth: number;
};

type GetStackOutlineRectsParams = {
    /** The points holding each stack's total, as returned by `getStackTotalsData` */
    data: ChartDataPoint[];

    /** Key of the stack's total in every point's `values` */
    totalKey: string | undefined;

    xScale: ChartScale;
    yScale: ChartScale;

    /** Width of the stack's bars, in px */
    barWidth: number;

    /** Distance from a point's x to the middle of the stack's bar there, in px */
    offset: number;
};

/** Returns how far a bar's middle is from the middle of its group, counted from the group's left edge, so the series or stacks sit side by side. */
function getBarSlotOffset(slot: number, groupWidth: number, barWidth: number): number {
    return -groupWidth / 2 + slot * (barWidth + BAR_GROUP_INNER_GAP) + barWidth / 2;
}

/**
 * Returns the bars of series sitting side by side, grouped by the color they are filled with, in the order each color first appears.
 * A bar below zero has a negative height, which is how victory-native's Bar measures it.
 */
function getBarsByColor({points, series, data, yScale, barWidth, groupWidth}: GetBarsByColorParams): BarsOfColor[] {
    const baselineY = yScale(0);
    const barsByColor = new Map<string, GroupedBar[]>();

    for (const [seriesIndex, seriesItem] of series.entries()) {
        const slotOffset = getBarSlotOffset(seriesIndex, groupWidth, barWidth);
        for (const point of points[seriesItem.key] ?? []) {
            const dataPoint = data.at(Number(point.xValue));
            const x = point.x + slotOffset;
            if (!dataPoint || typeof point.y !== 'number' || !Number.isFinite(x) || !Number.isFinite(point.y)) {
                continue;
            }

            const pointColor = seriesIndex === 0 ? dataPoint.color : undefined;
            const color = dataPoint.seriesColors?.[seriesItem.key] ?? pointColor ?? seriesItem.color ?? VictoryTheme.colors.default;
            const bars = barsByColor.get(color) ?? [];
            bars.push({x: x - barWidth / 2, y: point.y, width: barWidth, height: baselineY - point.y, value: Number(point.yValue)});
            barsByColor.set(color, bars);
        }
    }

    return [...barsByColor.entries()].map(([color, bars]) => ({color, bars}));
}

/**
 * Returns the rectangles of a stack's segments, one list per series, each segment starting where the previous series' segment at that point ended.
 * Segments above zero and segments below zero pile up separately, as they do in victory-native's StackedBar.
 */
function getStackSegmentRects(seriesPoints: PointsArray[], yScale: ChartScale, barWidth: number, offset: number): BarRect[][] {
    const positiveTotals = new Map<PointsArray[number]['xValue'], number>();
    const negativeTotals = new Map<PointsArray[number]['xValue'], number>();

    return seriesPoints.map((points) => {
        const rects: BarRect[] = [];
        for (const point of points) {
            const x = point.x + offset;
            const value = typeof point.yValue === 'number' && Number.isFinite(point.yValue) ? point.yValue : 0;
            // A segment worth zero has no height to draw and leaves the next segment where it was
            if (typeof point.y !== 'number' || !Number.isFinite(x) || !Number.isFinite(point.y) || value === 0) {
                continue;
            }

            const totals = value > 0 ? positiveTotals : negativeTotals;
            const startValue = totals.get(point.xValue) ?? 0;
            const endValue = startValue + value;
            totals.set(point.xValue, endValue);

            const startY = yScale(startValue);
            const endY = yScale(endValue);
            if (!Number.isFinite(startY) || !Number.isFinite(endY)) {
                continue;
            }
            rects.push({x: x - barWidth / 2, y: Math.min(startY, endY), width: barWidth, height: Math.abs(startY - endY)});
        }
        return rects;
    });
}

/** Returns the rectangle of each of a stack's bars as a whole, from zero to the bar's total. A point whose stack is empty has none. */
function getStackOutlineRects({data, totalKey, xScale, yScale, barWidth, offset}: GetStackOutlineRectsParams): BarRect[] {
    const baselineY = yScale(0);
    const rects: BarRect[] = [];

    for (const [index, point] of data.entries()) {
        const total = totalKey ? point.values[totalKey] : undefined;
        if (!total) {
            continue;
        }
        const totalY = yScale(total);
        rects.push({x: xScale(index) + offset - barWidth / 2, y: Math.min(totalY, baselineY), width: barWidth, height: Math.abs(totalY - baselineY)});
    }
    return rects;
}

export {getBarSlotOffset, getBarsByColor, getStackSegmentRects, getStackOutlineRects};
export type {BarRect, GroupedBar, BarsOfColor};
