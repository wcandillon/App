import {BAR_GROUP_INNER_GAP} from '@components/Charts/barChartConstants';
import type {ChartDataPoint} from '@components/Charts/types';
import {getBarsByColor, getBarSlotOffset, getStackOutlineRects, getStackSegmentRects} from '@components/Charts/utils/barRects';
import VictoryTheme from '@components/Charts/VictoryTheme';

import type {PointsArray} from 'victory-native';

const CHART_HEIGHT = 200;

/** A y scale mapping 0 to the bottom of a 200px tall plot and 100 to its top, like victory-native's inverted scales */
function yScale(value: number): number {
    return CHART_HEIGHT - value * 2;
}

/** An x scale placing the points 50px apart, the first one at 25px */
function xScale(index: number): number {
    return 25 + index * 50;
}

function buildPoints(values: Array<number | undefined>): PointsArray {
    return values.map((value, index) => ({
        x: xScale(index),
        xValue: index,
        y: value === undefined ? undefined : yScale(value),
        yValue: value,
    }));
}

/** Builds one data point per entry, each entry holding what that point sets besides its label */
function buildData(points: Array<Partial<ChartDataPoint>>): ChartDataPoint[] {
    return points.map((point, index) => ({label: `Point ${index}`, values: {}, ...point}));
}

describe('getBarSlotOffset', () => {
    it('keeps a lone bar on its point', () => {
        // Given a group made of a single bar, so the bar is as wide as the group
        const barWidth = 40;

        // When the offset of its only slot is computed
        const offset = getBarSlotOffset(0, barWidth, barWidth);

        // Then the bar stays centered on the point, since there is no other bar to make room for
        expect(offset).toBe(0);
    });

    it('spreads the slots around the middle of the group', () => {
        // Given a group of two bars separated by the inner gap
        const barWidth = 18;
        const groupWidth = 2 * barWidth + BAR_GROUP_INNER_GAP;

        // When the offsets of both slots are computed
        const first = getBarSlotOffset(0, groupWidth, barWidth);
        const second = getBarSlotOffset(1, groupWidth, barWidth);

        // Then the bars sit on either side of the point, one bar and one gap apart, so the group as a whole is centered on it
        expect(first).toBe(-second);
        expect(second - first).toBe(barWidth + BAR_GROUP_INNER_GAP);
    });
});

describe('getBarsByColor', () => {
    it('lays a bar out the way victory-native Bar does', () => {
        // Given one series with a bar above zero and a bar below zero
        const points = {amount: buildPoints([40, -10])};

        // When the bars are laid out
        const [{bars}] = getBarsByColor({points, series: [{key: 'amount'}], data: buildData([{}, {}]), yScale, barWidth: 20, groupWidth: 20});

        // Then each bar is centered on its point and runs from its value to zero, with a negative height below zero,
        // which is what victory-native's Bar hands to its rounded rectangle helper
        expect(bars).toEqual([
            {x: 15, y: 120, width: 20, height: 80, value: 40},
            {x: 65, y: 220, width: 20, height: -20, value: -10},
        ]);
    });

    it('puts each series in its own slot', () => {
        // Given two series at the same point, drawn as two bars with the inner gap between them
        const points = {current: buildPoints([40]), previous: buildPoints([30])};
        const barWidth = 18;
        const groupWidth = 2 * barWidth + BAR_GROUP_INNER_GAP;

        // When the bars are laid out
        const barsByColor = getBarsByColor({
            points,
            series: [
                {key: 'current', color: '#111111'},
                {key: 'previous', color: '#222222'},
            ],
            data: buildData([{}]),
            yScale,
            barWidth,
            groupWidth,
        });

        // Then the first series takes the left slot and the second the right one, so the bars don't overlap
        expect(barsByColor.map(({color, bars}) => ({color, x: bars.at(0)?.x}))).toEqual([
            {color: '#111111', x: 25 - groupWidth / 2},
            {color: '#222222', x: 25 - groupWidth / 2 + barWidth + BAR_GROUP_INNER_GAP},
        ]);
    });

    it('groups the bars by the color they are filled with', () => {
        // Given two series where a point overrides the first series' color, and another one overrides the second series' color
        const points = {current: buildPoints([10, 20, 30]), previous: buildPoints([5, 15, 25])};
        const data = buildData([{}, {color: '#aaaaaa'}, {seriesColors: {previous: '#bbbbbb'}}]);

        // When the bars are laid out
        const barsByColor = getBarsByColor({
            points,
            series: [{key: 'current', color: '#111111'}, {key: 'previous'}],
            data,
            yScale,
            barWidth: 10,
            groupWidth: 24,
        });

        // Then every color gets one group holding all its bars, so each color is drawn as a single path.
        // A point's own color only applies to the first series, and a series without a color falls back to the default one.
        expect(barsByColor.map(({color, bars}) => ({color, values: bars.map((bar) => bar.value)}))).toEqual([
            {color: '#111111', values: [10, 30]},
            {color: '#aaaaaa', values: [20]},
            {color: VictoryTheme.colors.default, values: [5, 15]},
            {color: '#bbbbbb', values: [25]},
        ]);
    });

    it('leaves out the points that have no bar to draw', () => {
        // Given a series with a missing value, and a point victory-native reports that the chart has no data for
        const points = {amount: buildPoints([10, undefined, 30])};

        // When the bars are laid out against data that only covers the first two points
        const barsByColor = getBarsByColor({points, series: [{key: 'amount'}], data: buildData([{}, {}]), yScale, barWidth: 10, groupWidth: 10});

        // Then only the point with both a value and data gets a bar
        expect(barsByColor.flatMap(({bars}) => bars.map((bar) => bar.value))).toEqual([10]);
    });
});

describe('getStackSegmentRects', () => {
    it('piles each series on top of the previous one', () => {
        // Given a stack of two series over two points
        const seriesPoints = [buildPoints([10, 20]), buildPoints([30, 5])];

        // When the segments are laid out, shifted 6px to the right of their points
        const rects = getStackSegmentRects(seriesPoints, yScale, 20, 6);

        // Then the first series starts at zero and the second one starts where the first ended, as in victory-native's StackedBar
        expect(rects).toEqual([
            [
                {x: 21, y: 180, width: 20, height: 20},
                {x: 71, y: 160, width: 20, height: 40},
            ],
            [
                {x: 21, y: 120, width: 20, height: 60},
                {x: 71, y: 150, width: 20, height: 10},
            ],
        ]);
    });

    it('piles the segments below zero separately from the ones above', () => {
        // Given a point where the series go above, below, then above zero again
        const seriesPoints = [buildPoints([10]), buildPoints([-20]), buildPoints([5])];

        // When the segments are laid out
        const rects = getStackSegmentRects(seriesPoints, yScale, 20, 0);

        // Then the negative segment hangs from zero, and the last segment continues from the first one rather than from the negative one
        expect(rects).toEqual([[{x: 15, y: 180, width: 20, height: 20}], [{x: 15, y: 200, width: 20, height: 40}], [{x: 15, y: 170, width: 20, height: 10}]]);
    });

    it('skips the segments that have nothing to draw without moving the ones above them', () => {
        // Given a stack whose middle series is worth zero at the first point and missing at the second
        const seriesPoints = [buildPoints([10, 10]), buildPoints([0, undefined]), buildPoints([20, 20])];

        // When the segments are laid out
        const rects = getStackSegmentRects(seriesPoints, yScale, 20, 0);

        // Then the middle series has no segment, and the top one sits directly on the bottom one
        expect(rects.at(1)).toEqual([]);
        expect(rects.at(2)).toEqual([
            {x: 15, y: 140, width: 20, height: 40},
            {x: 65, y: 140, width: 20, height: 40},
        ]);
    });
});

describe('getStackOutlineRects', () => {
    it('spans each bar from zero to its total', () => {
        // Given the totals of a stack, one above zero, one below, and a point where the stack is empty
        const data = buildData([{values: {stack0: 60}}, {values: {stack0: -10}}, {values: {}}]);

        // When the outline is laid out, shifted 6px to the right of the points
        const rects = getStackOutlineRects({data, totalKey: 'stack0', xScale, yScale, barWidth: 20, offset: 6});

        // Then each bar is covered from zero to its total whichever side of zero it is on, and the empty point has no outline
        expect(rects).toEqual([
            {x: 21, y: 80, width: 20, height: 120},
            {x: 71, y: 200, width: 20, height: 20},
        ]);
    });

    it('returns nothing when the stack has no total series', () => {
        // Given data whose stack total cannot be looked up
        const data = buildData([{values: {stack0: 60}}]);

        // When the outline is laid out without the key of the total
        const rects = getStackOutlineRects({data, totalKey: undefined, xScale, yScale, barWidth: 20, offset: 0});

        // Then there is no outline, so nothing is drawn for a stack that cannot be measured
        expect(rects).toEqual([]);
    });
});
