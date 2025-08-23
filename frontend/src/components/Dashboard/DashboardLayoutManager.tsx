import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Add,
  BarChart,
  PieChart,
  ShowChart,
  TableChart,
  Assessment,
  TrendingUp,
} from '@mui/icons-material';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import CustomizableWidget from './CustomizableWidget';

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

interface DashboardLayoutManagerProps {
  initialWidgets?: WidgetConfig[];
  onLayoutChange?: (widgets: WidgetConfig[]) => void;
  isEditable?: boolean;
}

const DashboardLayoutManager: React.FC<DashboardLayoutManagerProps> = ({
  initialWidgets = [],
  onLayoutChange,
  isEditable = true,
}) => {
  const theme = useTheme();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [addWidgetDialogOpen, setAddWidgetDialogOpen] = useState(false);

  // Predefined widget templates
  const widgetTemplates = [
    {
      id: 'revenue-chart',
      title: 'Revenue Trend',
      type: 'chart' as const,
      size: 'medium' as const,
      chartType: 'line',
      dataSource: '/api/sales/revenue-trend',
      icon: <ShowChart />,
      description: 'Line chart showing revenue trends over time'
    },
    {
      id: 'sales-funnel',
      title: 'Sales Conversion Funnel',
      type: 'chart' as const,
      size: 'large' as const,
      chartType: 'funnel',
      dataSource: '/api/sales/conversion-funnel',
      icon: <Assessment />,
      description: 'Funnel chart showing sales conversion stages'
    },
    {
      id: 'channel-performance',
      title: 'Channel Performance',
      type: 'chart' as const,
      size: 'medium' as const,
      chartType: 'pie',
      dataSource: '/api/sales/channel-performance',
      icon: <PieChart />,
      description: 'Pie chart comparing sales across channels'
    },
    {
      id: 'product-heatmap',
      title: 'Product Performance Heatmap',
      type: 'chart' as const,
      size: 'large' as const,
      chartType: 'heatmap',
      dataSource: '/api/products/performance-heatmap',
      icon: <BarChart />,
      description: 'Heatmap showing product performance by category'
    },
    {
      id: 'kpi-dashboard',
      title: 'Key Performance Indicators',
      type: 'kpi' as const,
      size: 'large' as const,
      dataSource: '/api/kpi/dashboard',
      icon: <TrendingUp />,
      description: 'Grid of key business metrics and KPIs'
    },
    {
      id: 'orders-table',
      title: 'Recent Orders',
      type: 'table' as const,
      size: 'large' as const,
      dataSource: '/api/orders/recent',
      icon: <TableChart />,
      description: 'Table showing recent order details'
    },
  ];

  // Handle adding a new widget
  const handleAddWidget = useCallback((template: any) => {
    const newWidget: WidgetConfig = {
      ...template,
      id: `${template.id}-${Date.now()}`,
      refreshInterval: 300,
      filters: {},
    };

    const updatedWidgets = [...widgets, newWidget];
    setWidgets(updatedWidgets);
    
    if (onLayoutChange) {
      onLayoutChange(updatedWidgets);
    }
    
    setAddWidgetDialogOpen(false);
  }, [widgets, onLayoutChange]);

  // Handle widget configuration change
  const handleWidgetConfigChange = useCallback((updatedConfig: WidgetConfig) => {
    const updatedWidgets = widgets.map(widget =>
      widget.id === updatedConfig.id ? updatedConfig : widget
    );
    setWidgets(updatedWidgets);
    
    if (onLayoutChange) {
      onLayoutChange(updatedWidgets);
    }
  }, [widgets, onLayoutChange]);

  // Handle widget deletion
  const handleWidgetDelete = useCallback((widgetId: string) => {
    const updatedWidgets = widgets.filter(widget => widget.id !== widgetId);
    setWidgets(updatedWidgets);
    
    if (onLayoutChange) {
      onLayoutChange(updatedWidgets);
    }
  }, [widgets, onLayoutChange]);

  // Handle widget reordering
  const handleWidgetMove = useCallback((dragId: string, hoverId: string) => {
    const dragIndex = widgets.findIndex(widget => widget.id === dragId);
    const hoverIndex = widgets.findIndex(widget => widget.id === hoverId);
    
    if (dragIndex === -1 || hoverIndex === -1) return;

    const updatedWidgets = [...widgets];
    const draggedWidget = updatedWidgets[dragIndex];
    
    updatedWidgets.splice(dragIndex, 1);
    updatedWidgets.splice(hoverIndex, 0, draggedWidget);
    
    setWidgets(updatedWidgets);
    
    if (onLayoutChange) {
      onLayoutChange(updatedWidgets);
    }
  }, [widgets, onLayoutChange]);

  // Render widget content based on type
  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.type) {
      case 'chart':
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {widget.chartType?.toUpperCase()} Chart
              <br />
              Data Source: {widget.dataSource}
            </Typography>
          </Box>
        );
      case 'kpi':
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              KPI Metrics Dashboard
              <br />
              Data Source: {widget.dataSource}
            </Typography>
          </Box>
        );
      case 'table':
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Data Table
              <br />
              Data Source: {widget.dataSource}
            </Typography>
          </Box>
        );
      case 'metric':
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Single Metric Display
              <br />
              Data Source: {widget.dataSource}
            </Typography>
          </Box>
        );
      default:
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Widget Content
            </Typography>
          </Box>
        );
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <Box sx={{ position: 'relative', minHeight: '100vh', p: 3 }}>
        {/* Dashboard Grid */}
        <Grid
          container
          spacing={3}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 3,
          }}
        >
          {widgets.map((widget) => (
            <CustomizableWidget
              key={widget.id}
              config={widget}
              onConfigChange={handleWidgetConfigChange}
              onDelete={handleWidgetDelete}
              onMove={handleWidgetMove}
              isDraggable={isEditable}
              isEditable={isEditable}
            >
              {renderWidgetContent(widget)}
            </CustomizableWidget>
          ))}
        </Grid>

        {/* Empty state */}
        {widgets.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              textAlign: 'center',
              border: `2px dashed ${theme.palette.divider}`,
              borderRadius: 2,
              p: 4,
            }}
          >
            <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Widgets Added
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start building your dashboard by adding widgets
            </Typography>
            {isEditable && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAddWidgetDialogOpen(true)}
              >
                Add Your First Widget
              </Button>
            )}
          </Box>
        )}

        {/* Add Widget FAB */}
        {isEditable && widgets.length > 0 && (
          <Fab
            color="primary"
            aria-label="add widget"
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
            }}
            onClick={() => setAddWidgetDialogOpen(true)}
          >
            <Add />
          </Fab>
        )}

        {/* Add Widget Dialog */}
        <Dialog
          open={addWidgetDialogOpen}
          onClose={() => setAddWidgetDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <Add />
              Add New Widget
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a widget template to add to your dashboard
            </Typography>
            <List>
              {widgetTemplates.map((template) => (
                <ListItem
                  key={template.id}
                  button
                  onClick={() => handleAddWidget(template)}
                  sx={{
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon>
                    {template.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={template.title}
                    secondary={template.description}
                  />
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Size: {template.size}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddWidgetDialogOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DndProvider>
  );
};

export default DashboardLayoutManager;
