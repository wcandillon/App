import type {PointsArray} from 'victory-native';

import React from 'react';
import {LinearGradient, Path, vec} from 'react-native-skia';
import {useAreaPath} from 'victory-native';

type AreaGradientProps = {
    /** Every data point of the series the area belongs to */
    points: PointsArray;

    /** Index of the first point of the area to fill */
    start: number;

    /** Index of the last point of the area to fill, inclusive */
    end: number;

    /** Baseline y-coordinate where the gradient fades to its faint end (typically the chart's bottom) */
    baselineY: number;

    /** Hex color string used as the base for the gradient fill */
    color: string;
};

function AreaGradient({points, start, end, baselineY, color}: AreaGradientProps) {
    // Sliced here rather than by the chart's render callback, which runs on every render of the chart.
    // Victory rebuilds the path whenever it is given a new points array, and this one is only new when the series or the range change.
    const areaPoints = points.slice(start, end + 1);
    const {path} = useAreaPath(areaPoints, baselineY, {curveType: 'linear'});

    const topY = Math.min(baselineY, ...areaPoints.flatMap((p) => (typeof p.y === 'number' ? [p.y] : [])));

    return (
        <Path
            path={path}
            // eslint-disable-next-line react/style-prop-object -- this is a valid Skia style prop value
            style="fill"
        >
            <LinearGradient
                start={vec(0, baselineY)}
                end={vec(0, topY)}
                colors={[`${color}05`, `${color}33`]}
            />
        </Path>
    );
}

export default AreaGradient;
