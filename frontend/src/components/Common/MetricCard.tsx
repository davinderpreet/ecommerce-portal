import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  subtitle,
  icon,
  color = 'primary',
}) => {
  const theme = useTheme();

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

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" component="h2" color="text.secondary" fontWeight={500}>
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                backgroundColor: theme.palette[color].main + '20',
                color: theme.palette[color].main,
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        
        <Typography
          variant="h3"
          component="div"
          fontWeight="bold"
          color={theme.palette[color].main}
          mb={1}
        >
          {value}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary" mb={1}>
            {subtitle}
          </Typography>
        )}

        {change !== undefined && (
          <Box display="flex" alignItems="center" gap={0.5}>
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
      </CardContent>
    </Card>
  );
};

export default MetricCard;
