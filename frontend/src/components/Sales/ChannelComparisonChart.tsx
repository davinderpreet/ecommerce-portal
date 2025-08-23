import React, { useState } from 'react';
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
  Grid,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { PieChart as PieChartIcon, BarChart as BarChartIcon, Radar as RadarIcon } from '@mui/icons-material';

interface ChannelData {
  channel: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
  conversionRate: number;
  customerSatisfaction: number;
  color: string;
}

interface ChannelComparisonChartProps {
  data: ChannelData[];
  title?: string;
  height?: number;
  showMetrics?: boolean;
}

type ChartType = 'pie' | 'bar' | 'radar';

const ChannelComparisonChart: React.FC<ChannelComparisonChartProps> = ({
  data,
  title = 'Channel Performance Comparison',
  height = 400,
  showMetrics = true,
}) => {
  const theme = useTheme();
  const [chartType, setChartType] = useState<ChartType>('pie');

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

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const totalRevenue = data.reduce((sum, channel) => sum + channel.revenue, 0);
  const totalOrders = data.reduce((sum, channel) => sum + channel.orders, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 2,
            boxShadow: theme.shadows[8],
            minWidth: 200,
          }}
        >
          <Typography variant="subtitle2" color="text.primary" mb={1} fontWeight="bold">
            {data.channel}
          </Typography>
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography variant="body2" color="text.secondary">
              Revenue: {formatCurrency(data.revenue)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Orders: {data.orders.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AOV: {formatCurrency(data.avgOrderValue)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Conversion: {formatPercentage(data.conversionRate)}
            </Typography>
          </Box>
        </Box>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (chartType) {
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ channel, revenue }) => `${channel}: ${formatCurrency(revenue)}`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="revenue"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        );

      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis dataKey="channel" stroke={theme.palette.text.secondary} />
            <YAxis yAxisId="revenue" orientation="left" stroke={theme.palette.text.secondary} />
            <YAxis yAxisId="orders" orientation="right" stroke={theme.palette.text.secondary} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId="revenue"
              dataKey="revenue"
              name="Revenue"
              radius={[4, 4, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
            <Bar
              yAxisId="orders"
              dataKey="orders"
              name="Orders"
              radius={[4, 4, 0, 0]}
              opacity={0.7}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        );

      case 'radar':
        const radarData = data.map(channel => ({
          channel: channel.channel,
          Revenue: (channel.revenue / totalRevenue) * 100,
          Orders: (channel.orders / totalOrders) * 100,
          'Conversion Rate': channel.conversionRate,
          'Customer Satisfaction': channel.customerSatisfaction,
          'AOV Score': (channel.avgOrderValue / 200) * 100, // Normalized to 100
        }));

        return (
          <RadarChart data={radarData}>
            <PolarGrid stroke={theme.palette.divider} />
            <PolarAngleAxis dataKey="channel" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickCount={5}
            />
            {data.map((channel, index) => (
              <Radar
                key={channel.channel}
                name={channel.channel}
                dataKey={channel.channel === 'Amazon' ? 'Revenue' : 
                         channel.channel === 'Shopify' ? 'Orders' : 'Conversion Rate'}
                stroke={channel.color}
                fill={channel.color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
            <Tooltip />
            <Legend />
          </RadarChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
        }
        action={
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size="small"
          >
            <ToggleButton value="pie" aria-label="pie chart">
              <PieChartIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="bar" aria-label="bar chart">
              <BarChartIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="radar" aria-label="radar chart">
              <RadarIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>

        {showMetrics && (
          <Box mt={3}>
            <Typography variant="subtitle2" color="text.secondary" mb={2}>
              Channel Performance Summary
            </Typography>
            <Grid container spacing={2}>
              {data.map((channel) => (
                <Grid item xs={12} sm={6} md={4} key={channel.channel}>
                  <Box
                    sx={{
                      p: 2,
                      border: `2px solid ${channel.color}20`,
                      borderRadius: 2,
                      backgroundColor: `${channel.color}10`,
                      borderLeft: `4px solid ${channel.color}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: channel.color,
                        }}
                      />
                      <Typography variant="subtitle2" fontWeight="bold">
                        {channel.channel}
                      </Typography>
                    </Box>
                    <Box display="flex" flexDirection="column" gap={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        Revenue: {formatCurrency(channel.revenue)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Orders: {channel.orders.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        AOV: {formatCurrency(channel.avgOrderValue)}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Conversion: {formatPercentage(channel.conversionRate)}
                        </Typography>
                        <Chip
                          label={
                            channel.conversionRate >= 5 ? 'High' :
                            channel.conversionRate >= 3 ? 'Medium' : 'Low'
                          }
                          size="small"
                          color={
                            channel.conversionRate >= 5 ? 'success' :
                            channel.conversionRate >= 3 ? 'warning' : 'error'
                          }
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ChannelComparisonChart;
