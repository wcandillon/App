import ChartFontsLoaderProvider from '@components/Charts/context/ChartFontsLoaderProvider';
import {useVictoryChartContext} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/context/VictoryChartContext';
import {VictoryChartRenderArgsProvider} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/context/VictoryChartRenderArgsContext';
import type {CartesianChartLayoutArgs} from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/types';
import getChartDesignWidth from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/getChartDesignWidth';
import getChartLayoutModeProps from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/getChartLayoutModeProps';
import getHierarchyID from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/getHierarchyID';
import resolveChartThemeColor from '@components/HTMLEngineProvider/HTMLRenderers/VictoryChartRenderer/utils/resolveChartThemeColor';

import useCurrentTimezone from '@hooks/useCurrentTimezone';
import useTheme from '@hooks/useTheme';

import ThemeContext from '@styles/theme/context/ThemeContext';

import React, {useEffect} from 'react';
import {CartesianChart} from 'victory-native';

import VictoryChartLabel from './VictoryChartLabel';
import VictoryChartLegend from './VictoryChartLegend';
import VictoryChartSeries from './VictoryChartSeries';

type VictoryChartCartesianProps = {
    /** Explicit width/height when chart is rendered outside auto-layout */
    explicitSize?: {width: number; height: number};

    /** When true, renders without visible chrome (used for snapshots/tests) */
    headless?: boolean;

    /** Called after the chart renders with new points, bounds or y scale, never during the render itself */
    onRenderArgs?: (renderArgs: CartesianChartLayoutArgs) => void;
};

type ChartLayoutReporterProps = CartesianChartLayoutArgs & {
    onRenderArgs: (renderArgs: CartesianChartLayoutArgs) => void;
};

/**
 * Reports where the chart laid out its points. It renders inside the chart because the points only exist there,
 * and reports from an effect because the callback writes shared values, which must not happen while the chart renders.
 */
function ChartLayoutReporter({points, chartBounds, yScale, onRenderArgs}: ChartLayoutReporterProps) {
    useEffect(() => {
        onRenderArgs({points, chartBounds, yScale});
    }, [points, chartBounds, yScale, onRenderArgs]);

    return null;
}

/**
 * Renders the CartesianChart with data, axes, and domain config drawn from context.
 * Labels and legend overlays are handled internally via `renderOutside`.
 */
function VictoryChartCartesian({explicitSize, headless, onRenderArgs}: VictoryChartCartesianProps) {
    const {tnode, data, xKey, yKeys, xAxis, yAxis, domain, domainPadding, padding, isHorizontal, labelItems, legendItems, chartContentStyles, pixelScale} = useVictoryChartContext();
    const theme = useTheme();
    const timezone = useCurrentTimezone();
    const designWidth = getChartDesignWidth(explicitSize, chartContentStyles.width);

    const resolvedXAxis = xAxis
        ? {
              ...xAxis,
              lineColor: typeof xAxis.lineColor === 'string' ? resolveChartThemeColor(xAxis.lineColor, theme) : xAxis.lineColor,
              labelColor: typeof xAxis.labelColor === 'string' ? resolveChartThemeColor(xAxis.labelColor, theme) : xAxis.labelColor,
          }
        : xAxis;
    const resolvedYAxis = yAxis?.map((axis) => ({
        ...axis,
        lineColor: typeof axis.lineColor === 'string' ? resolveChartThemeColor(axis.lineColor, theme) : axis.lineColor,
        labelColor: typeof axis.labelColor === 'string' ? resolveChartThemeColor(axis.labelColor, theme) : axis.labelColor,
    }));

    return (
        <CartesianChart
            data={Object.values(data)}
            xKey={xKey}
            yKeys={yKeys}
            xAxis={resolvedXAxis}
            yAxis={resolvedYAxis}
            domain={domain}
            domainPadding={domainPadding}
            padding={padding}
            {...getChartLayoutModeProps(explicitSize, headless)}
            renderOutside={(renderArgs) => {
                const overlayContent = (
                    <VictoryChartRenderArgsProvider value={{...renderArgs, pixelScale}}>
                        {labelItems.map((labelItem) => (
                            <VictoryChartLabel
                                key={`label-${labelItem.x}-${labelItem.y}-${timezone}`}
                                {...labelItem}
                                timezone={timezone}
                            />
                        ))}
                        {legendItems.map((legendItem) => (
                            <VictoryChartLegend
                                key={`legend-${legendItem.x}-${legendItem.y}`}
                                {...legendItem}
                                chartWidth={designWidth}
                            />
                        ))}
                    </VictoryChartRenderArgsProvider>
                );

                if (headless) {
                    return <ThemeContext.Provider value={theme}>{overlayContent}</ThemeContext.Provider>;
                }

                // React context does not propagate across the Skia renderOutside boundary.
                return (
                    <ThemeContext.Provider value={theme}>
                        <ChartFontsLoaderProvider>{overlayContent}</ChartFontsLoaderProvider>
                    </ThemeContext.Provider>
                );
            }}
        >
            {(renderArgs) => (
                <VictoryChartRenderArgsProvider value={{...renderArgs, pixelScale}}>
                    {!!onRenderArgs && (
                        <ChartLayoutReporter
                            points={renderArgs.points}
                            chartBounds={renderArgs.chartBounds}
                            yScale={renderArgs.yScale}
                            onRenderArgs={onRenderArgs}
                        />
                    )}
                    {tnode.children.map((child) => (
                        <VictoryChartSeries
                            key={`${child.tagName ?? 'node'}-${getHierarchyID(child)}`}
                            tnode={child}
                            isHorizontal={isHorizontal}
                        />
                    ))}
                </VictoryChartRenderArgsProvider>
            )}
        </CartesianChart>
    );
}

export default VictoryChartCartesian;
