import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Typography,
  Button,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  FilterList,
  Clear,
  Refresh,
  DateRange,
  Store,
  Category,
} from '@mui/icons-material';

interface FilterOptions {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  channels: string[];
  categories: string[];
  minOrderValue: number | null;
  maxOrderValue: number | null;
  customerSegment: string[];
  realTimeUpdates: boolean;
}

interface SalesFilterControlsProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableChannels: string[];
  availableCategories: string[];
  availableSegments: string[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const SalesFilterControls: React.FC<SalesFilterControlsProps> = ({
  filters,
  onFiltersChange,
  availableChannels,
  availableCategories,
  availableSegments,
  isLoading = false,
  onRefresh,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleDateRangeChange = (field: 'start' | 'end', date: Date | null) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: date,
      },
    });
  };

  const handleChannelChange = (channels: string[]) => {
    onFiltersChange({
      ...filters,
      channels,
    });
  };

  const handleCategoryChange = (categories: string[]) => {
    onFiltersChange({
      ...filters,
      categories,
    });
  };

  const handleSegmentChange = (segments: string[]) => {
    onFiltersChange({
      ...filters,
      customerSegment: segments,
    });
  };

  const handleOrderValueChange = (field: 'min' | 'max', value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onFiltersChange({
      ...filters,
      minOrderValue: field === 'min' ? numValue : filters.minOrderValue,
      maxOrderValue: field === 'max' ? numValue : filters.maxOrderValue,
    });
  };

  const handleRealTimeToggle = (enabled: boolean) => {
    onFiltersChange({
      ...filters,
      realTimeUpdates: enabled,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: { start: null, end: null },
      channels: [],
      categories: [],
      minOrderValue: null,
      maxOrderValue: null,
      customerSegment: [],
      realTimeUpdates: true,
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.channels.length > 0) count++;
    if (filters.categories.length > 0) count++;
    if (filters.minOrderValue !== null || filters.maxOrderValue !== null) count++;
    if (filters.customerSegment.length > 0) count++;
    return count;
  };

  const quickDateRanges = [
    { label: 'Today', days: 0 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ];

  const setQuickDateRange = (days: number) => {
    const end = new Date();
    const start = days === 0 ? new Date() : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    onFiltersChange({
      ...filters,
      dateRange: { start, end },
    });
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterList />
            <Typography variant="h6">Sales Filters</Typography>
            {getActiveFiltersCount() > 0 && (
              <Chip
                label={`${getActiveFiltersCount()} active`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.realTimeUpdates}
                  onChange={(e) => handleRealTimeToggle(e.target.checked)}
                  size="small"
                />
              }
              label="Real-time"
              sx={{ mr: 1 }}
            />
            {onRefresh && (
              <Button
                variant="outlined"
                size="small"
                onClick={onRefresh}
                disabled={isLoading}
                startIcon={<Refresh />}
              >
                Refresh
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={clearAllFilters}
              startIcon={<Clear />}
            >
              Clear All
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Less' : 'More'} Filters
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {/* Date Range */}
          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <DateRange fontSize="small" />
              <Typography variant="subtitle2">Date Range</Typography>
            </Box>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box display="flex" gap={1} mb={1}>
                <DatePicker
                  label="Start Date"
                  value={filters.dateRange.start}
                  onChange={(date) => handleDateRangeChange('start', date)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
                <DatePicker
                  label="End Date"
                  value={filters.dateRange.end}
                  onChange={(date) => handleDateRangeChange('end', date)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Box>
            </LocalizationProvider>
            <Box display="flex" gap={1} flexWrap="wrap">
              {quickDateRanges.map((range) => (
                <Chip
                  key={range.label}
                  label={range.label}
                  size="small"
                  variant="outlined"
                  clickable
                  onClick={() => setQuickDateRange(range.days)}
                />
              ))}
            </Box>
          </Grid>

          {/* Channels */}
          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Store fontSize="small" />
              <Typography variant="subtitle2">Sales Channels</Typography>
            </Box>
            <FormControl fullWidth size="small">
              <InputLabel>Select Channels</InputLabel>
              <Select
                multiple
                value={filters.channels}
                onChange={(e) => handleChannelChange(e.target.value as string[])}
                renderValue={(selected) => (
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {availableChannels.map((channel) => (
                  <MenuItem key={channel} value={channel}>
                    {channel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {expanded && (
            <>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              {/* Categories */}
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Category fontSize="small" />
                  <Typography variant="subtitle2">Product Categories</Typography>
                </Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Categories</InputLabel>
                  <Select
                    multiple
                    value={filters.categories}
                    onChange={(e) => handleCategoryChange(e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {availableCategories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Order Value Range */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" mb={1}>
                  Order Value Range
                </Typography>
                <Box display="flex" gap={1}>
                  <TextField
                    label="Min Value"
                    type="number"
                    size="small"
                    value={filters.minOrderValue || ''}
                    onChange={(e) => handleOrderValueChange('min', e.target.value)}
                    InputProps={{
                      startAdornment: '$',
                    }}
                  />
                  <TextField
                    label="Max Value"
                    type="number"
                    size="small"
                    value={filters.maxOrderValue || ''}
                    onChange={(e) => handleOrderValueChange('max', e.target.value)}
                    InputProps={{
                      startAdornment: '$',
                    }}
                  />
                </Box>
              </Grid>

              {/* Customer Segments */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" mb={1}>
                  Customer Segments
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Segments</InputLabel>
                  <Select
                    multiple
                    value={filters.customerSegment}
                    onChange={(e) => handleSegmentChange(e.target.value as string[])}
                    renderValue={(selected) => (
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {availableSegments.map((segment) => (
                      <MenuItem key={segment} value={segment}>
                        {segment}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default SalesFilterControls;
