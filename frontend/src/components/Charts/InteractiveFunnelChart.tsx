import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  Tooltip,
  Chip,
  useTheme,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { TrendingDown, Info } from '@mui/icons-material';

interface FunnelStage {
  id: string;
  name: string;
  value: number;
  color?: string;
  percentage?: number;
  conversionRate?: number;
  dropOffCount?: number;
  metadata?: {
    conversionRate?: number;
    dropOffRate?: number;
    previousStage?: string;
  };
}

interface InteractiveFunnelChartProps {
  data: FunnelStage[];
  title?: string;
  orientation?: 'vertical' | 'horizontal';
  showConversionRates?: boolean;
  showDropOffRates?: boolean;
  onStageClick?: (stage: FunnelStage) => void;
  height?: number;
  colorScheme?: 'default' | 'gradient' | 'performance';
}

const InteractiveFunnelChart: React.FC<InteractiveFunnelChartProps> = ({
  data,
  title = 'Sales Conversion Funnel',
  orientation = 'vertical',
  showConversionRates = true,
  showDropOffRates = true,
  onStageClick,
  height = 500,
  colorScheme = 'default',
}) => {
  const theme = useTheme();
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [viewMode, setViewMode] = useState<'absolute' | 'percentage'>('absolute');

  // Color schemes
  const getColorScheme = (scheme: string, index: number, total: number) => {
    switch (scheme) {
      case 'gradient':
        const intensity = 1 - (index / total);
        return `rgba(25, 118, 210, ${0.3 + intensity * 0.7})`;
      case 'performance':
        const colors = ['#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
        return colors[index % colors.length];
      default:
        const defaultColors = ['#1976d2', '#1e88e5', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb'];
        return defaultColors[index % defaultColors.length];
    }
  };

  // Calculate funnel metrics
  const funnelMetrics = useMemo(() => {
    return data.map((stage, index) => {
      const previousStage = index > 0 ? data[index - 1] : null;
      const conversionRate = previousStage ? (stage.value / previousStage.value) * 100 : 100;
      const dropOffRate = previousStage ? ((previousStage.value - stage.value) / previousStage.value) * 100 : 0;
      const dropOffCount = previousStage ? previousStage.value - stage.value : 0;
      
      return {
        ...stage,
        conversionRate,
        dropOffRate,
        dropOffCount,
        percentage: (stage.value / data[0].value) * 100,
        color: stage.color || getColorScheme(colorScheme, index, data.length),
      };
    });
  }, [data, colorScheme]);

  // Calculate stage dimensions
  const calculateStageDimensions = (stage: any, index: number) => {
    const maxValue = data[0].value;
    const stageRatio = stage.value / maxValue;
    
    if (orientation === 'vertical') {
      const stageHeight = 60;
      const maxWidth = 400;
      const width = Math.max(100, maxWidth * stageRatio);
      const y = index * 80;
      const x = (maxWidth - width) / 2;
      
      return { x, y, width, height: stageHeight };
    } else {
      const stageWidth = 80;
      const maxHeight = 300;
      const height = Math.max(40, maxHeight * stageRatio);
      const x = index * 100;
      const y = maxHeight - height;
      
      return { x, y, width: stageWidth, height };
    }
  };

  // Format value for display
  const formatValue = (value: number) => {
    return value.toLocaleString();
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Handle stage click
  const handleStageClick = (stage: any) => {
    setSelectedStage(stage);
    if (onStageClick) {
      onStageClick(stage);
    }
  };

  const containerHeight = orientation === 'vertical' ? data.length * 80 + 40 : 400;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
            <Tooltip title="Click on stages to view detailed conversion analytics">
              <Info fontSize="small" color="action" />
            </Tooltip>
          </Box>
        }
        action={
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>View</InputLabel>
            <Select
              value={viewMode}
              label="View"
              onChange={(e) => setViewMode(e.target.value as 'absolute' | 'percentage')}
            >
              <MenuItem value="absolute">Absolute</MenuItem>
              <MenuItem value="percentage">Percentage</MenuItem>
            </Select>
          </FormControl>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {/* Funnel visualization */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: containerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <svg width="100%" height={containerHeight} style={{ overflow: 'visible' }}>
            {funnelMetrics.map((stage, index) => {
              const dimensions = calculateStageDimensions(stage, index);
              const isSelected = selectedStage?.id === stage.id;
              
              return (
                <g key={stage.id}>
                  {/* Stage rectangle */}
                  <rect
                    x={dimensions.x}
                    y={dimensions.y}
                    width={dimensions.width}
                    height={dimensions.height}
                    fill={stage.color}
                    stroke={isSelected ? theme.palette.primary.main : theme.palette.divider}
                    strokeWidth={isSelected ? 3 : 1}
                    rx={4}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => handleStageClick(stage)}
                  />
                  
                  {/* Stage label */}
                  <text
                    x={dimensions.x + dimensions.width / 2}
                    y={dimensions.y + dimensions.height / 2 - 8}
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {stage.name}
                  </text>
                  
                  {/* Stage value */}
                  <text
                    x={dimensions.x + dimensions.width / 2}
                    y={dimensions.y + dimensions.height / 2 + 8}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    style={{ pointerEvents: 'none' }}
                  >
                    {viewMode === 'absolute' ? formatValue(stage.value) : formatPercentage(stage.percentage)}
                  </text>
                  
                  {/* Conversion rate indicator */}
                  {showConversionRates && index > 0 && (
                    <text
                      x={orientation === 'vertical' ? dimensions.x + dimensions.width + 10 : dimensions.x + dimensions.width / 2}
                      y={orientation === 'vertical' ? dimensions.y + dimensions.height / 2 : dimensions.y - 10}
                      fill={stage.conversionRate > 50 ? theme.palette.success.main : theme.palette.warning.main}
                      fontSize="11"
                      fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      {formatPercentage(stage.conversionRate)}
                    </text>
                  )}
                  
                  {/* Drop-off visualization */}
                  {showDropOffRates && index > 0 && stage.dropOffCount > 0 && (
                    <g>
                      <rect
                        x={orientation === 'vertical' ? dimensions.x - 60 : dimensions.x - 20}
                        y={orientation === 'vertical' ? dimensions.y + 10 : dimensions.y + dimensions.height + 5}
                        width={orientation === 'vertical' ? 50 : dimensions.width}
                        height={orientation === 'vertical' ? dimensions.height - 20 : 15}
                        fill={theme.palette.error.light}
                        opacity={0.6}
                        rx={2}
                      />
                      <text
                        x={orientation === 'vertical' ? dimensions.x - 35 : dimensions.x + dimensions.width / 2}
                        y={orientation === 'vertical' ? dimensions.y + dimensions.height / 2 : dimensions.y + dimensions.height + 15}
                        textAnchor="middle"
                        fill={theme.palette.error.dark}
                        fontSize="10"
                        fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        -{formatValue(stage.dropOffCount)}
                      </text>
                    </g>
                  )}
                  
                  {/* Connection lines */}
                  {index > 0 && orientation === 'vertical' && (
                    <line
                      x1={dimensions.x + dimensions.width / 2}
                      y1={dimensions.y}
                      x2={calculateStageDimensions(funnelMetrics[index - 1], index - 1).x + calculateStageDimensions(funnelMetrics[index - 1], index - 1).width / 2}
                      y2={calculateStageDimensions(funnelMetrics[index - 1], index - 1).y + calculateStageDimensions(funnelMetrics[index - 1], index - 1).height}
                      stroke={theme.palette.divider}
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </Box>

        {/* Funnel summary */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label={`Total Stages: ${data.length}`}
            variant="outlined"
          />
          <Chip
            label={`Overall Conversion: ${formatPercentage((data[data.length - 1].value / data[0].value) * 100)}`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`Total Drop-off: ${formatValue(data[0].value - data[data.length - 1].value)}`}
            color="error"
            variant="outlined"
            icon={<TrendingDown />}
          />
        </Box>

        {/* Stage details */}
        {selectedStage && (
          <Box
            sx={{
              p: 2,
              backgroundColor: theme.palette.grey[50],
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" gutterBottom>
              {selectedStage.name} - Detailed Analytics
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Stage Value
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatValue(selectedStage.value)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Percentage of Total
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatPercentage(selectedStage.percentage)}
                </Typography>
              </Box>
              {selectedStage.conversionRate < 100 && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Conversion Rate
                  </Typography>
                  <Typography variant="h6" color={selectedStage.conversionRate > 50 ? 'success.main' : 'warning.main'}>
                    {formatPercentage(selectedStage.conversionRate)}
                  </Typography>
                </Box>
              )}
              {selectedStage.dropOffCount > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Drop-off Count
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {formatValue(selectedStage.dropOffCount)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Conversion insights */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Conversion Insights
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {funnelMetrics.slice(1).map((stage, index) => {
              const actualIndex = index + 1;
              const isGoodConversion = stage.conversionRate > 70;
              const isOkConversion = stage.conversionRate > 40;
              
              return (
                <Chip
                  key={stage.id}
                  label={`${stage.name}: ${formatPercentage(stage.conversionRate)}`}
                  size="small"
                  color={isGoodConversion ? 'success' : isOkConversion ? 'warning' : 'error'}
                  variant="outlined"
                />
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default InteractiveFunnelChart;
