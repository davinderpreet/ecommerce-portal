import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp,
  Warning,
  CheckCircle,
  Assessment,
} from '@mui/icons-material';
import MetricCard from '../components/Common/MetricCard';
import QualityMetricsChart from '../components/Charts/QualityMetricsChart';
import { qualityAPI, salesAPI } from '../services/api';

interface QualityMetric {
  id: string;
  metric_name: string;
  metric_category: string;
  current_value: number;
  threshold_critical: number;
  threshold_warning: number;
  status: string;
}

const Dashboard: React.FC = () => {
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetric[]>([]);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load quality metrics from M12 Data Validation System
      const qualityResponse = await qualityAPI.getDashboard();
      if (qualityResponse.success && qualityResponse.dashboard) {
        setQualityMetrics(qualityResponse.dashboard);
      }

      // Load sales summary from M11 Sales Reporting
      try {
        const salesResponse = await salesAPI.getSummary();
        if (salesResponse.success) {
          setSalesSummary(salesResponse.data);
        }
      } catch (salesError) {
        console.warn('Sales data not available:', salesError);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getMetricIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'product':
        return <Assessment />;
      case 'order':
        return <CheckCircle />;
      case 'inventory':
        return <Warning />;
      default:
        return <TrendingUp />;
    }
  };

  const getMetricColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'normal':
        return 'success';
      default:
        return 'primary';
    }
  };

  const formatMetricValue = (value: number, metricName: string) => {
    if (metricName.includes('percentage') || metricName.includes('rate')) {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  // Sample chart data for quality trends
  const qualityTrendData = qualityMetrics.map(metric => ({
    name: metric.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: metric.current_value,
    threshold: metric.threshold_warning,
  }));

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Dashboard Overview
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Real-time insights from your multi-channel e-commerce operations
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Quality Metrics Section */}
      <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Data Quality Metrics
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {qualityMetrics.map((metric) => (
          <Grid item xs={12} sm={6} md={4} key={metric.id}>
            <MetricCard
              title={metric.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              value={formatMetricValue(metric.current_value, metric.metric_name)}
              subtitle={`${metric.metric_category} quality`}
              icon={getMetricIcon(metric.metric_category)}
              color={getMetricColor(metric.status) as any}
            />
          </Grid>
        ))}
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <QualityMetricsChart
              data={qualityTrendData}
              type="bar"
              title="Quality Metrics Overview"
              height={350}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h3" gutterBottom fontWeight={600}>
              System Status
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                M12 Data Validation System: Operational
              </Alert>
              <Alert severity="success" sx={{ mb: 2 }}>
                M11 Sales Reporting: Active
              </Alert>
              <Alert severity="info">
                M13 Dashboard UI: Initializing
              </Alert>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Sales Summary Section */}
      {salesSummary && (
        <>
          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, mb: 2 }}>
            Sales Overview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Total Sales"
                value={`$${salesSummary.total_sales?.toLocaleString() || '0'}`}
                icon={<TrendingUp />}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Orders"
                value={salesSummary.total_orders || '0'}
                icon={<CheckCircle />}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Avg Order Value"
                value={`$${salesSummary.avg_order_value?.toFixed(2) || '0.00'}`}
                icon={<Assessment />}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Active Channels"
                value="3"
                subtitle="Shopify, BestBuy, Amazon"
                icon={<DashboardIcon />}
                color="secondary"
              />
            </Grid>
          </Grid>
        </>
      )}

      {/* Welcome Message for M13 */}
      <Card sx={{ mt: 4, bgcolor: 'primary.main', color: 'white' }}>
        <CardContent>
          <Typography variant="h6" component="h3" gutterBottom>
            🎉 Welcome to Milestone 13: Dashboard UI Framework
          </Typography>
          <Typography variant="body1">
            This dashboard integrates with your M12 Data Validation System and provides 
            real-time insights into data quality, sales performance, and system health. 
            The foundation is now ready for M14 Real-time Sales Dashboard development.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;
