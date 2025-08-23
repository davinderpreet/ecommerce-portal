import React, { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Chip,
  useTheme,
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Delete,
  Settings,
  Fullscreen,
  GetApp,
  Share,
  Refresh,
  DragIndicator,
} from '@mui/icons-material';
import { useDrag, useDrop } from 'react-dnd';

interface WidgetConfig {
  id: string;
  title: string;
  type: 'chart' | 'kpi' | 'table' | 'metric';
  size: 'small' | 'medium' | 'large';
  refreshInterval?: number;
  dataSource?: string;
  chartType?: string;
  filters?: any;
  position?: { x: number; y: number };
}

interface CustomizableWidgetProps {
  config: WidgetConfig;
  children: React.ReactNode;
  onConfigChange?: (config: WidgetConfig) => void;
  onDelete?: (id: string) => void;
  onMove?: (dragId: string, hoverId: string) => void;
  isDraggable?: boolean;
  isEditable?: boolean;
}

const CustomizableWidget: React.FC<CustomizableWidgetProps> = ({
  config,
  children,
  onConfigChange,
  onDelete,
  onMove,
  isDraggable = true,
  isEditable = true,
}) => {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editedConfig, setEditedConfig] = useState<WidgetConfig>(config);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drag and drop functionality
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'widget',
    item: { id: config.id, type: 'widget' },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isDraggable,
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'widget',
    hover: (item: { id: string }) => {
      if (item.id !== config.id && onMove) {
        onMove(item.id, config.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Combine drag and drop refs
  if (isDraggable) {
    drag(drop(ref));
  }

  // Handle menu actions
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    setEditedConfig(config);
    setConfigDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(config.id);
    }
    handleMenuClose();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
    handleMenuClose();
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Exporting widget:', config.id);
    handleMenuClose();
  };

  const handleShare = () => {
    // Implement share functionality
    navigator.clipboard.writeText(`${window.location.origin}/widget/${config.id}`);
    handleMenuClose();
  };

  const handleFullscreen = () => {
    // Implement fullscreen functionality
    console.log('Opening widget in fullscreen:', config.id);
    handleMenuClose();
  };

  // Handle config save
  const handleConfigSave = () => {
    if (onConfigChange) {
      onConfigChange(editedConfig);
    }
    setConfigDialogOpen(false);
  };

  // Get widget size styles
  const getWidgetSize = (size: string) => {
    switch (size) {
      case 'small':
        return { minHeight: 200, gridColumn: 'span 1' };
      case 'large':
        return { minHeight: 400, gridColumn: 'span 2' };
      default: // medium
        return { minHeight: 300, gridColumn: 'span 1' };
    }
  };

  const sizeStyles = getWidgetSize(config.size);

  return (
    <>
      <Card
        ref={ref}
        sx={{
          ...sizeStyles,
          opacity: isDragging ? 0.5 : 1,
          transform: isOver ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s ease',
          border: isOver ? `2px dashed ${theme.palette.primary.main}` : '1px solid',
          borderColor: theme.palette.divider,
          position: 'relative',
          '&:hover .widget-controls': {
            opacity: 1,
          },
        }}
      >
        {/* Drag handle */}
        {isDraggable && (
          <Box
            className="widget-controls"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              opacity: 0,
              transition: 'opacity 0.2s ease',
              zIndex: 10,
            }}
          >
            <IconButton size="small" sx={{ cursor: 'grab' }}>
              <DragIndicator />
            </IconButton>
          </Box>
        )}

        {/* Widget controls */}
        <Box
          className="widget-controls"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            opacity: 0,
            transition: 'opacity 0.2s ease',
            zIndex: 10,
          }}
        >
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 1)',
              },
            }}
          >
            <MoreVert />
          </IconButton>
        </Box>

        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" component="h3">
                {config.title}
              </Typography>
              <Chip
                label={config.type}
                size="small"
                variant="outlined"
                color="primary"
              />
              {isRefreshing && (
                <Chip
                  label="Refreshing..."
                  size="small"
                  color="info"
                  variant="filled"
                />
              )}
            </Box>
          }
          sx={{ pb: 1 }}
        />
        <CardContent sx={{ pt: 0, height: '100%' }}>
          {children}
        </CardContent>

        {/* Context menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {isEditable && (
            <MenuItem onClick={handleEdit}>
              <Edit fontSize="small" sx={{ mr: 1 }} />
              Edit Widget
            </MenuItem>
          )}
          <MenuItem onClick={handleRefresh}>
            <Refresh fontSize="small" sx={{ mr: 1 }} />
            Refresh Data
          </MenuItem>
          <MenuItem onClick={handleFullscreen}>
            <Fullscreen fontSize="small" sx={{ mr: 1 }} />
            Fullscreen
          </MenuItem>
          <MenuItem onClick={handleExport}>
            <GetApp fontSize="small" sx={{ mr: 1 }} />
            Export
          </MenuItem>
          <MenuItem onClick={handleShare}>
            <Share fontSize="small" sx={{ mr: 1 }} />
            Share
          </MenuItem>
          {isEditable && (
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          )}
        </Menu>
      </Card>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Settings />
            Configure Widget
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 3, pt: 2 }}>
            <TextField
              label="Widget Title"
              value={editedConfig.title}
              onChange={(e) => setEditedConfig({ ...editedConfig, title: e.target.value })}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Widget Type</InputLabel>
              <Select
                value={editedConfig.type}
                label="Widget Type"
                onChange={(e) => setEditedConfig({ ...editedConfig, type: e.target.value as any })}
              >
                <MenuItem value="chart">Chart</MenuItem>
                <MenuItem value="kpi">KPI Metric</MenuItem>
                <MenuItem value="table">Data Table</MenuItem>
                <MenuItem value="metric">Single Metric</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Widget Size</InputLabel>
              <Select
                value={editedConfig.size}
                label="Widget Size"
                onChange={(e) => setEditedConfig({ ...editedConfig, size: e.target.value as any })}
              >
                <MenuItem value="small">Small (1x1)</MenuItem>
                <MenuItem value="medium">Medium (1x2)</MenuItem>
                <MenuItem value="large">Large (2x2)</MenuItem>
              </Select>
            </FormControl>

            {editedConfig.type === 'chart' && (
              <FormControl fullWidth>
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={editedConfig.chartType || ''}
                  label="Chart Type"
                  onChange={(e) => setEditedConfig({ ...editedConfig, chartType: e.target.value })}
                >
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="pie">Pie Chart</MenuItem>
                  <MenuItem value="area">Area Chart</MenuItem>
                  <MenuItem value="heatmap">Heatmap</MenuItem>
                  <MenuItem value="treemap">Treemap</MenuItem>
                  <MenuItem value="funnel">Funnel Chart</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label="Data Source"
              value={editedConfig.dataSource || ''}
              onChange={(e) => setEditedConfig({ ...editedConfig, dataSource: e.target.value })}
              fullWidth
              placeholder="API endpoint or data source identifier"
            />

            <TextField
              label="Refresh Interval (seconds)"
              type="number"
              value={editedConfig.refreshInterval || 300}
              onChange={(e) => setEditedConfig({ ...editedConfig, refreshInterval: parseInt(e.target.value) })}
              fullWidth
              inputProps={{ min: 30, max: 3600 }}
            />

            {/* Advanced configuration section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Configuration
              </Typography>
              <TextField
                label="Custom Filters (JSON)"
                value={JSON.stringify(editedConfig.filters || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const filters = JSON.parse(e.target.value);
                    setEditedConfig({ ...editedConfig, filters });
                  } catch (error) {
                    // Invalid JSON, ignore
                  }
                }}
                multiline
                rows={4}
                fullWidth
                placeholder='{"dateRange": "last30days", "channel": "all"}'
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfigSave} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CustomizableWidget;
