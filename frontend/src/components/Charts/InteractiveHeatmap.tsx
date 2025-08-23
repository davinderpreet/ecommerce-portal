import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  useTheme,
} from '@mui/material';
import { TrendingUp, TrendingDown, Info } from '@mui/icons-material';

interface HeatmapDataPoint {
  x: string;
  y: string;
  value: number;
  label?: string;
  metadata?: any;
}

interface InteractiveHeatmapProps {
  data: HeatmapDataPoint[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colorScheme?: 'revenue' | 'orders' | 'performance' | 'custom';
  onCellClick?: (dataPoint: HeatmapDataPoint) => void;
  showTooltips?: boolean;
  height?: number;
  width?: number;
}

const InteractiveHeatmap: React.FC<InteractiveHeatmapProps> = ({
  data,
  title = 'Sales Performance Heatmap',
  xAxisLabel = 'Time Period',
  yAxisLabel = 'Sales Channel',
  colorScheme = 'revenue',
  onCellClick,
  showTooltips = true,
  height = 400,
  width = 800,
}) => {
  const theme = useTheme();
  const [selectedMetric, setSelectedMetric] = useState('value');
  const [hoveredCell, setHoveredCell] = useState<HeatmapDataPoint | null>(null);

  // Get unique x and y values
  const xValues = useMemo(() => [...new Set(data.map(d => d.x))].sort(), [data]);
  const yValues = useMemo(() => [...new Set(data.map(d => d.y))].sort(), [data]);

  // Calculate min and max values for color scaling
  const { minValue, maxValue } = useMemo(() => {
    const values = data.map(d => d.value);
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [data]);

  // Color schemes
  const getColorScheme = (scheme: string) => {
    switch (scheme) {
      case 'revenue':
        return {
          low: '#e8f5e8',
          medium: '#81c784',
          high: '#2e7d32',
        };
      case 'orders':
        return {
          low: '#e3f2fd',
          medium: '#64b5f6',
          high: '#1976d2',
        };
      case 'performance':
        return {
          low: '#fff3e0',
          medium: '#ffb74d',
          high: '#f57c00',
        };
      default:
        return {
          low: '#f5f5f5',
          medium: '#9e9e9e',
          high: '#424242',
        };
    }
  };

  const colors = getColorScheme(colorScheme);

  // Get color for a value
  const getColor = (value: number) => {
    if (maxValue === minValue) return colors.medium;
    
    const normalized = (value - minValue) / (maxValue - minValue);
    
    if (normalized < 0.33) return colors.low;
    if (normalized < 0.66) return colors.medium;
    return colors.high;
  };

  // Get data point for specific x, y coordinates
  const getDataPoint = (x: string, y: string) => {
    return data.find(d => d.x === x && d.y === y);
  };

  // Format value for display
  const formatValue = (value: number) => {
    if (colorScheme === 'revenue') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString();
  };

  // Calculate cell dimensions
  const cellWidth = Math.max(60, (width - 120) / xValues.length);
  const cellHeight = Math.max(40, (height - 120) / yValues.length);

  const handleCellClick = (dataPoint: HeatmapDataPoint) => {
    if (onCellClick) {
      onCellClick(dataPoint);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
            <Tooltip title="Click on cells to drill down into detailed analytics">
              <Info fontSize="small" color="action" />
            </Tooltip>
          </Box>
        }
        action={
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Metric</InputLabel>
            <Select
              value={selectedMetric}
              label="Metric"
              onChange={(e) => setSelectedMetric(e.target.value)}
            >
              <MenuItem value="value">Primary Value</MenuItem>
              <MenuItem value="growth">Growth Rate</MenuItem>
              <MenuItem value="trend">Trend Analysis</MenuItem>
            </Select>
          </FormControl>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 0, overflow: 'auto' }}>
        <Box sx={{ position: 'relative', minWidth: width, minHeight: height }}>
          {/* Y-axis labels */}
          <Box sx={{ position: 'absolute', left: 0, top: 60 }}>
            {yValues.map((y, index) => (
              <Box
                key={y}
                sx={{
                  height: cellHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  pr: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
                style={{ top: index * cellHeight }}
              >
                {y}
              </Box>
            ))}
          </Box>

          {/* X-axis labels */}
          <Box sx={{ position: 'absolute', top: 0, left: 100 }}>
            {xValues.map((x, index) => (
              <Box
                key={x}
                sx={{
                  width: cellWidth,
                  height: 50,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transform: 'rotate(-45deg)',
                  transformOrigin: 'center',
                }}
                style={{ left: index * cellWidth }}
              >
                {x}
              </Box>
            ))}
          </Box>

          {/* Heatmap cells */}
          <Box sx={{ position: 'absolute', top: 60, left: 100 }}>
            {yValues.map((y, yIndex) =>
              xValues.map((x, xIndex) => {
                const dataPoint = getDataPoint(x, y);
                if (!dataPoint) return null;

                const cellColor = getColor(dataPoint.value);
                const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;

                return (
                  <Tooltip
                    key={`${x}-${y}`}
                    title={
                      showTooltips ? (
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {y} - {x}
                          </Typography>
                          <Typography variant="body2">
                            Value: {formatValue(dataPoint.value)}
                          </Typography>
                          {dataPoint.label && (
                            <Typography variant="body2">
                              {dataPoint.label}
                            </Typography>
                          )}
                        </Box>
                      ) : ''
                    }
                    arrow
                    placement="top"
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        width: cellWidth - 2,
                        height: cellHeight - 2,
                        backgroundColor: cellColor,
                        border: isHovered ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
                        borderRadius: 1,
                        cursor: onCellClick ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: dataPoint.value > (maxValue * 0.6) ? 'white' : 'black',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: onCellClick ? 'scale(1.05)' : 'none',
                          zIndex: 10,
                          boxShadow: theme.shadows[4],
                        },
                      }}
                      style={{
                        left: xIndex * cellWidth,
                        top: yIndex * cellHeight,
                      }}
                      onClick={() => dataPoint && handleCellClick(dataPoint)}
                      onMouseEnter={() => setHoveredCell(dataPoint)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {formatValue(dataPoint.value)}
                    </Box>
                  </Tooltip>
                );
              })
            )}
          </Box>

          {/* Axis labels */}
          <Typography
            variant="body2"
            sx={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              fontWeight: 500,
            }}
          >
            {xAxisLabel}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'rotate(-90deg) translateX(-50%)',
              transformOrigin: 'center',
              fontWeight: 500,
            }}
          >
            {yAxisLabel}
          </Typography>
        </Box>

        {/* Legend */}
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" fontWeight={500}>
            Legend:
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: colors.low,
                border: '1px solid #e0e0e0',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption">Low</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: colors.medium,
                border: '1px solid #e0e0e0',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption">Medium</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: colors.high,
                border: '1px solid #e0e0e0',
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption">High</Typography>
          </Box>
          <Chip
            label={`Range: ${formatValue(minValue)} - ${formatValue(maxValue)}`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Hover details */}
        {hoveredCell && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: theme.palette.grey[50], borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Selected: {hoveredCell.y} - {hoveredCell.x}
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Chip
                label={`Value: ${formatValue(hoveredCell.value)}`}
                size="small"
                color="primary"
              />
              {hoveredCell.metadata && (
                <Chip
                  label={`Growth: ${hoveredCell.metadata.growth > 0 ? '+' : ''}${hoveredCell.metadata.growth}%`}
                  size="small"
                  icon={hoveredCell.metadata.growth > 0 ? <TrendingUp /> : <TrendingDown />}
                  color={hoveredCell.metadata.growth > 0 ? 'success' : 'error'}
                />
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default InteractiveHeatmap;
