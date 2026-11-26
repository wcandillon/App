/**
 * One stack of a stacked vertical bar chart. Each series' segments are drawn as one path, clipped to the rounded outline of the whole bars.
 * The paths and the outline are rebuilt only when the points, the scales or the bar layout change.
 */
import {BAR_CORNER_RADIUS} from '@components/Charts/barChartConstants';
import type {ChartDataPoint, ChartSeries} from '@components/Charts/types';
import {getStackOutlineRects, getStackSegmentRects} from '@components/Charts/utils/barRects';
import VictoryTheme from '@components/Charts/VictoryTheme';

import type {PointsArray, Scale} from 'victory-native';

import React from 'react';
import {Group, Path, Skia} from 'react-native-skia';

type ChartStackedBarsProps = {
    /** The stack's segments, bottom first */
    stack: ChartSeries[];

    /** Canvas points of every series, keyed by the series' key, as victory-native's CartesianChart passes them to its children */
    points: Record<string, PointsArray>;

    /** The points holding each stack's total, as returned by `getStackTotalsData` */
    totalsData: ChartDataPoint[];

    /** Key of this stack's total in every point's `values` */
    totalKey: string | undefined;

    xScale: Scale;
    yScale: Scale;

    /** Width of the stack's bars, in px */
    barWidth: number;

    /** Distance from a point's x to the middle of the stack's bar there, in px */
    offset: number;
};

function ChartStackedBars({stack, points, totalsData, totalKey, xScale, yScale, barWidth, offset}: ChartStackedBarsProps) {
    // The segments are clipped to the rounded outline of the stack's bars, from zero to each bar's total.
    // Rounding the end segments instead fails when an end segment is too short to show its corners, like a stage that took minutes in a chart of days.
    const outline = Skia.PathBuilder.Make();
    for (const rect of getStackOutlineRects({data: totalsData, totalKey, xScale, yScale, barWidth, offset})) {
        outline.addRRect(Skia.RRectXY(Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height), BAR_CORNER_RADIUS, BAR_CORNER_RADIUS));
    }

    const segmentRects = getStackSegmentRects(
        stack.map((seriesItem) => points[seriesItem.key] ?? []),
        yScale,
        barWidth,
        offset,
    );

    return (
        <Group clip={outline.build()}>
            {stack.map((seriesItem, seriesIndex) => {
                const builder = Skia.PathBuilder.Make();
                for (const rect of segmentRects.at(seriesIndex) ?? []) {
                    builder.addRect(Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height));
                }
                return (
                    <Path
                        key={seriesItem.key}
                        path={builder.build()}
                        color={seriesItem.color ?? VictoryTheme.colors.default}
                        // eslint-disable-next-line react/style-prop-object -- this is a valid Skia style prop value
                        style="fill"
                    />
                );
            })}
        </Group>
    );
}

export default ChartStackedBars;
