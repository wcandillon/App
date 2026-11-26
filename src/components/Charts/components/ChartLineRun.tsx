/**
 * One run of a series' line: consecutive segments drawn the same way, solid or dashed.
 */
import VictoryTheme, {DASH_INTERVALS} from '@components/Charts/VictoryTheme';

import type {PointsArray} from 'victory-native';

import React from 'react';
import {DashPathEffect} from 'react-native-skia';
import {Line} from 'victory-native';

type ChartLineRunProps = {
    /** Every data point of the series the run belongs to */
    points: PointsArray;

    /** Index of the run's first point */
    start: number;

    /** Index of the run's last point, inclusive */
    end: number;

    color: string;
    isDashed: boolean;
};

function ChartLineRun({points, start, end, color, isDashed}: ChartLineRunProps) {
    // Sliced here rather than by the chart's render callback, which runs on every render of the chart.
    // Victory rebuilds the path whenever it is given a new points array, and this one is only new when the series or the run change.
    const runPoints = points.slice(start, end + 1);

    return (
        <Line
            points={runPoints}
            color={color}
            strokeWidth={VictoryTheme.line.strokeWidth}
            strokeCap="round"
            strokeJoin="round"
            curveType="linear"
        >
            {isDashed && <DashPathEffect intervals={DASH_INTERVALS} />}
        </Line>
    );
}

export default ChartLineRun;
