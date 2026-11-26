/**
 * The bars of a vertical bar chart whose series sit side by side. All the bars sharing a color are drawn as one path,
 * which is rebuilt only when the points, the scale or the bar layout change.
 */
import {BAR_CORNER_RADIUS} from '@components/Charts/barChartConstants';
import type {ChartDataPoint, ChartSeries} from '@components/Charts/types';
import {getBarsByColor} from '@components/Charts/utils/barRects';

import type {PointsArray, Scale} from 'victory-native';

import React from 'react';
import {Path, Skia} from 'react-native-skia';
import {createRoundedRectPath} from 'victory-native';

type ChartBarsProps = {
    /** Canvas points of every series, keyed by the series' key, as victory-native's CartesianChart passes them to its children */
    points: Record<string, PointsArray>;

    /** The series drawn as bars, in slot order from the left */
    series: readonly ChartSeries[];

    data: ChartDataPoint[];
    yScale: Scale;

    /** Width of one bar, in px */
    barWidth: number;

    /** Width of the bars sharing a point together with the gaps between them, in px */
    groupWidth: number;
};

const BAR_ROUNDED_CORNERS = {topLeft: BAR_CORNER_RADIUS, topRight: BAR_CORNER_RADIUS, bottomLeft: BAR_CORNER_RADIUS, bottomRight: BAR_CORNER_RADIUS};

function ChartBars({points, series, data, yScale, barWidth, groupWidth}: ChartBarsProps) {
    const barsByColor = getBarsByColor({points, series, data, yScale, barWidth, groupWidth});

    return (
        <>
            {barsByColor.map(({color, bars}) => {
                const builder = Skia.PathBuilder.Make();
                for (const bar of bars) {
                    // victory-native's own helper, so the corners are capped on short bars exactly as its Bar caps them
                    builder.addRRect(createRoundedRectPath(bar.x, bar.y, bar.width, bar.height, BAR_ROUNDED_CORNERS, bar.value));
                }
                return (
                    <Path
                        key={color}
                        path={builder.build()}
                        color={color}
                        // eslint-disable-next-line react/style-prop-object -- this is a valid Skia style prop value
                        style="fill"
                    />
                );
            })}
        </>
    );
}

export default ChartBars;
