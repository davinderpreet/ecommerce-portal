import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Chip,
  useTheme,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ShowChart, BarChart as BarChartIcon, Timeline } from '@mui/icons-material';

interface SalesDataPoint {
  timestamp: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
  channel?: string;
}

interface RealTimeSalesChartProps {
  data: SalesDataPoint[];
  title?: string;
  height?: number;
  showChannels?: boolean;
  isLoading?: boolean;
  lastUpdated?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

type ChartType = 'line' | 'area' | 'bar';

const RealTimeSalesChart: React.FC<RealTimeSalesChartProps> = ({
  data,
  title = 'Real-time Sales Performance',
  height = 400,
  showChannels = false,
  isLoading = false,
  lastUpdated,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const theme = useTheme();
  const [chartType, setChartType] = useState<ChartType>('line');
  const [isLive, setIsLive] = useState(autoRefresh);

  useEffect(() => {
    if (!isLive || !autoRefresh) return;

    const interval = setInterval(() => {
      // This would trigger a data refresh in the parent component
      console.log('Refreshing real-time sales data...');
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isLive, autoRefresh, refreshInterval]);

  const handleChartTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newType: ChartType,
  ) => {
    if (newType !== null) {
      setChartType(newType);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 2,
            boxShadow: theme.shadows[8],
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" mb={1}>
            {formatTime(label)}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} display="flex" alignItems="center" gap={1} mb={0.5}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                }}
              />
              <Typography variant="body2" color="text.primary">
                {entry.name}: {
                  entry.dataKey === 'revenue' || entry.dataKey === 'avgOrderValue'
                    ? formatCurrency(entry.value)
                    : entry.value
                }
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8} />
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.8} />
                <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke={theme.palette.text.secondary}
            />
            <YAxis yAxisId="revenue" orientation="left" stroke={theme.palette.text.secondary} />
            <YAxis yAxisId="orders" orientation="right" stroke={theme.palette.text.secondary} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke={theme.palette.primary.main}
              fillOpacity={1}
              fill="url(#revenueGradient)"
              name="Revenue"
            />
            <Area
              yAxisId="orders"
              type="monotone"
              dataKey="orders"
              stroke={theme.palette.secondary.main}
              fillOpacity={1}
              fill="url(#ordersGradient)"
              name="Orders"
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke={theme.palette.text.secondary}
            />
            <YAxis yAxisId="revenue" orientation="left" stroke={theme.palette.text.secondary} />
            <YAxis yAxisId="orders" orientation="right" stroke={theme.palette.text.secondary} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId="revenue"
              dataKey="revenue"
              fill={theme.palette.primary.main}
              name="Revenue"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="orders"
              dataKey="orders"
              fill={theme.palette.secondary.main}
              name="Orders"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke={theme.palette.text.secondary}
            />
            <YAxis yAxisId="revenue" orientation="left" stroke={theme.palette.text.secondary} />
            <YAxis yAxisId="orders" orientation="right" stroke={theme.palette.text.secondary} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke={theme.palette.primary.main}
              strokeWidth={3}
              dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: theme.palette.primary.main, strokeWidth: 2 }}
              name="Revenue"
            />
            <Line
              yAxisId="orders"
              type="monotone"
              dataKey="orders"
              stroke={theme.palette.secondary.main}
              strokeWidth={3}
              dot={{ fill: theme.palette.secondary.main, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: theme.palette.secondary.main, strokeWidth: 2 }}
              name="Orders"
            />
          </LineChart>
        );
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
            {isLive && (
              <Chip
                label="LIVE"
                size="small"
                sx={{
                  backgroundColor: theme.palette.success.main,
                  color: 'white',
                  fontWeight: 600,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 },
                  },
                }}
              />
            )}
          </Box>
        }
        action={
          <Box display="flex" alignItems="center" gap={2}>
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Updated: {lastUpdated}
              </Typography>
            )}
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={handleChartTypeChange}
              size="small"
            >
              <ToggleButton value="line" aria-label="line chart">
                <ShowChart fontSize="small" />
              </ToggleButton>
              <ToggleButton value="area" aria-label="area chart">
                <Timeline fontSize="small" />
              </ToggleButton>
              <ToggleButton value="bar" aria-label="bar chart">
                <BarChartIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {isLoading ? (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height={height}
            flexDirection="column"
            gap={2}
          >
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary">
              Loading real-time sales data...
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default RealTimeSalesChart;
