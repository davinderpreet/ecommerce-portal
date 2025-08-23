import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  Breadcrumbs,
  Link,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  useTheme,
} from '@mui/material';
import {
  Home,
  NavigateNext,
  ArrowBack,
  FilterList,
  TrendingUp,
  TrendingDown,
  Remove,
} from '@mui/icons-material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface DrillDownLevel {
  id: string;
  name: string;
  type: 'category' | 'product' | 'channel' | 'time' | 'customer';
  data: any[];
  parentId?: string;
  metadata?: any;
}

interface DrillDownAnalyticsProps {
  initialData: DrillDownLevel;
  title?: string;
  onLevelChange?: (level: DrillDownLevel, path: DrillDownLevel[]) => void;
  maxDepth?: number;
  chartType?: 'bar' | 'line' | 'pie';
}

const DrillDownAnalytics: React.FC<DrillDownAnalyticsProps> = ({
  initialData,
  title = 'Drill-Down Analytics',
  onLevelChange,
  maxDepth = 5,
  chartType = 'bar',
}) => {
  const theme = useTheme();
  const [drillPath, setDrillPath] = useState<DrillDownLevel[]>([initialData]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});

  const currentLevel = drillPath[drillPath.length - 1];
  const canDrillDown = drillPath.length < maxDepth;

  // Handle drilling down to next level
  const handleDrillDown = useCallback(async (item: any) => {
    if (!canDrillDown) return;

    // Simulate fetching drill-down data (in real implementation, call API)
    const nextLevelData = await fetchDrillDownData(currentLevel, item);
    
    if (nextLevelData && nextLevelData.data.length > 0) {
      const newLevel: DrillDownLevel = {
        id: `${currentLevel.id}_${item.id}`,
        name: item.name || item.label,
        type: getNextLevelType(currentLevel.type),
        data: nextLevelData.data,
        parentId: currentLevel.id,
        metadata: { ...nextLevelData.metadata, parentItem: item }
      };

      const newPath = [...drillPath, newLevel];
      setDrillPath(newPath);
      setSelectedItem(null);

      if (onLevelChange) {
        onLevelChange(newLevel, newPath);
      }
    }
  }, [currentLevel, drillPath, canDrillDown, onLevelChange]);

  // Handle drilling up (breadcrumb navigation)
  const handleDrillUp = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= drillPath.length) return;

    const newPath = drillPath.slice(0, targetIndex + 1);
    setDrillPath(newPath);
    setSelectedItem(null);

    if (onLevelChange) {
      onLevelChange(newPath[newPath.length - 1], newPath);
    }
  }, [drillPath, onLevelChange]);

  // Simulate fetching drill-down data
  const fetchDrillDownData = async (currentLevel: DrillDownLevel, item: any) => {
    // This would be replaced with actual API calls
    const mockData = generateMockDrillDownData(currentLevel.type, item);
    return mockData;
  };

  // Generate mock drill-down data
  const generateMockDrillDownData = (currentType: string, item: any) => {
    switch (currentType) {
      case 'category':
        return {
          data: [
            { id: 'p1', name: `${item.name} Product A`, value: item.value * 0.4, trend: 'up' },
            { id: 'p2', name: `${item.name} Product B`, value: item.value * 0.35, trend: 'down' },
            { id: 'p3', name: `${item.name} Product C`, value: item.value * 0.25, trend: 'up' },
          ],
          metadata: { type: 'products', parentCategory: item.name }
        };
      case 'product':
        return {
          data: [
            { id: 'c1', name: 'Amazon', value: item.value * 0.5, trend: 'up' },
            { id: 'c2', name: 'Shopify', value: item.value * 0.3, trend: 'flat' },
            { id: 'c3', name: 'BestBuy', value: item.value * 0.2, trend: 'down' },
          ],
          metadata: { type: 'channels', parentProduct: item.name }
        };
      case 'channel':
        return {
          data: [
            { id: 't1', name: 'Q1 2024', value: item.value * 0.3, trend: 'up' },
            { id: 't2', name: 'Q2 2024', value: item.value * 0.35, trend: 'up' },
            { id: 't3', name: 'Q3 2024', value: item.value * 0.35, trend: 'flat' },
          ],
          metadata: { type: 'time', parentChannel: item.name }
        };
      default:
        return { data: [], metadata: {} };
    }
  };

  // Determine next level type
  const getNextLevelType = (currentType: string): any => {
    const typeFlow = {
      'category': 'product',
      'product': 'channel',
      'channel': 'time',
      'time': 'customer'
    };
    return typeFlow[currentType] || 'category';
  };

  // Format value for display
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" fontSize="small" />;
      case 'down':
        return <TrendingDown color="error" fontSize="small" />;
      default:
        return <Remove color="action" fontSize="small" />;
    }
  };

  // Render chart based on type
  const renderChart = () => {
    const data = currentLevel.data.map(item => ({
      ...item,
      label: item.name,
      displayValue: formatValue(item.value)
    }));

    const colors = ['#1976d2', '#1e88e5', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb'];

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <RechartsTooltip formatter={(value) => [formatValue(value), 'Value']} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={theme.palette.primary.main} 
                strokeWidth={2}
                dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: theme.palette.primary.main, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value) => [formatValue(value), 'Value']} />
            </PieChart>
          </ResponsiveContainer>
        );

      default: // bar
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <RechartsTooltip formatter={(value) => [formatValue(value), 'Value']} />
              <Bar 
                dataKey="value" 
                fill={theme.palette.primary.main}
                onClick={(data) => handleDrillDown(data)}
                style={{ cursor: canDrillDown ? 'pointer' : 'default' }}
              />
            </BarChart>
          </ResponsiveContainer>
        );
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
            <Chip
              label={`Level ${drillPath.length}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        }
        action={
          <Box display="flex" gap={1}>
            <Tooltip title="Apply Filters">
              <IconButton size="small">
                <FilterList />
              </IconButton>
            </Tooltip>
            {drillPath.length > 1 && (
              <Tooltip title="Go Back">
                <IconButton size="small" onClick={() => handleDrillUp(drillPath.length - 2)}>
                  <ArrowBack />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {/* Breadcrumb navigation */}
        {drillPath.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
              {drillPath.map((level, index) => (
                <Link
                  key={level.id}
                  component="button"
                  variant="body2"
                  onClick={() => handleDrillUp(index)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    textDecoration: 'none',
                    color: index === drillPath.length - 1 ? 'text.primary' : 'primary.main',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  {index === 0 && <Home fontSize="small" />}
                  {level.name}
                </Link>
              ))}
            </Breadcrumbs>
          </Box>
        )}

        {/* Current level info */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {currentLevel.name}
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label={`${currentLevel.data.length} items`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={currentLevel.type}
              size="small"
              color="secondary"
              variant="outlined"
            />
            {canDrillDown && (
              <Chip
                label="Click items to drill down"
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        {/* Chart visualization */}
        <Box sx={{ mb: 3 }}>
          {renderChart()}
        </Box>

        {/* Data table */}
        <Grid container spacing={1}>
          {currentLevel.data.map((item, index) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <Card
                variant="outlined"
                sx={{
                  cursor: canDrillDown ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: canDrillDown ? theme.shadows[4] : 'none',
                    transform: canDrillDown ? 'translateY(-2px)' : 'none',
                  },
                }}
                onClick={() => canDrillDown && handleDrillDown(item)}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {item.name}
                    </Typography>
                    {getTrendIcon(item.trend)}
                  </Box>
                  <Typography variant="h6" color="primary">
                    {formatValue(item.value)}
                  </Typography>
                  {item.percentage && (
                    <Typography variant="caption" color="text.secondary">
                      {item.percentage.toFixed(1)}% of total
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Summary */}
        <Box sx={{ mt: 3, p: 2, backgroundColor: theme.palette.grey[50], borderRadius: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Level Summary
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <Typography variant="body2">
              <strong>Total Value:</strong> {formatValue(currentLevel.data.reduce((sum, item) => sum + item.value, 0))}
            </Typography>
            <Typography variant="body2">
              <strong>Items:</strong> {currentLevel.data.length}
            </Typography>
            <Typography variant="body2">
              <strong>Type:</strong> {currentLevel.type}
            </Typography>
            {currentLevel.metadata && (
              <Typography variant="body2">
                <strong>Context:</strong> {JSON.stringify(currentLevel.metadata)}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DrillDownAnalytics;
