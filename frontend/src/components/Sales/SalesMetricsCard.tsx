import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  useTheme,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  AttachMoney,
  ShoppingCart,
  People,
  Speed,
} from '@mui/icons-material';

interface SalesMetricsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtitle?: string;
  target?: number;
  current?: number;
  type?: 'revenue' | 'orders' | 'customers' | 'velocity';
  isLoading?: boolean;
  lastUpdated?: string;
}

const SalesMetricsCard: React.FC<SalesMetricsCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  subtitle,
  target,
  current,
  type = 'revenue',
  isLoading = false,
  lastUpdated,
}) => {
  const theme = useTheme();

  const getIcon = () => {
    switch (type) {
      case 'revenue':
        return <AttachMoney fontSize="large" />;
      case 'orders':
        return <ShoppingCart fontSize="large" />;
      case 'customers':
        return <People fontSize="large" />;
      case 'velocity':
        return <Speed fontSize="large" />;
      default:
        return <AttachMoney fontSize="large" />;
    }
  };

  const getTrendIcon = () => {
    switch (changeType) {
      case 'increase':
        return <TrendingUp fontSize="small" />;
      case 'decrease':
        return <TrendingDown fontSize="small" />;
      default:
        return <TrendingFlat fontSize="small" />;
    }
  };

  const getTrendColor = () => {
    switch (changeType) {
      case 'increase':
        return theme.palette.success.main;
      case 'decrease':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'revenue':
        return theme.palette.success.main;
      case 'orders':
        return theme.palette.primary.main;
      case 'customers':
        return theme.palette.secondary.main;
      case 'velocity':
        return theme.palette.warning.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const progressValue = target && current ? (current / target) * 100 : 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        overflow: 'visible',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[12],
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${getTypeColor()}, ${getTypeColor()}80)`,
          borderRadius: '4px 4px 0 0',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="h3" color="text.secondary" fontWeight={500}>
            {title}
          </Typography>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: getTypeColor() + '20',
              color: getTypeColor(),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {getIcon()}
          </Box>
        </Box>
        
        {isLoading ? (
          <Box sx={{ mb: 2 }}>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Loading real-time data...
            </Typography>
          </Box>
        ) : (
          <>
            <Typography
              variant="h3"
              component="div"
              fontWeight="bold"
              color={getTypeColor()}
              mb={1}
              sx={{
                fontSize: { xs: '1.8rem', sm: '2.5rem' },
                lineHeight: 1.2,
              }}
            >
              {value}
            </Typography>

            {subtitle && (
              <Typography variant="body2" color="text.secondary" mb={1}>
                {subtitle}
              </Typography>
            )}

            {target && current && (
              <Box sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Progress to Target
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {progressValue.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(progressValue, 100)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.palette.grey[200],
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getTypeColor(),
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>
            )}

            {change !== undefined && (
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Chip
                  icon={getTrendIcon()}
                  label={`${change > 0 ? '+' : ''}${change}%`}
                  size="small"
                  sx={{
                    backgroundColor: getTrendColor() + '20',
                    color: getTrendColor(),
                    fontWeight: 600,
                    '& .MuiChip-icon': {
                      color: getTrendColor(),
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  vs last period
                </Typography>
              </Box>
            )}

            {lastUpdated && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Updated: {lastUpdated}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesMetricsCard;
