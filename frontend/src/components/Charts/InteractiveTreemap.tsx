import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  Tooltip,
  Breadcrumbs,
  Link,
  Chip,
  useTheme,
} from '@mui/material';
import { Home, NavigateNext } from '@mui/icons-material';

interface TreemapNode {
  id: string;
  name: string;
  value: number;
  children?: TreemapNode[];
  color?: string;
  metadata?: any;
}

interface InteractiveTreemapProps {
  data: TreemapNode;
  title?: string;
  colorScheme?: 'revenue' | 'orders' | 'performance';
  onNodeClick?: (node: TreemapNode, path: string[]) => void;
  height?: number;
  showBreadcrumbs?: boolean;
}

const InteractiveTreemap: React.FC<InteractiveTreemapProps> = ({
  data,
  title = 'Sales Hierarchy Treemap',
  colorScheme = 'revenue',
  onNodeClick,
  height = 500,
  showBreadcrumbs = true,
}) => {
  const theme = useTheme();
  const [currentNode, setCurrentNode] = useState<TreemapNode>(data);
  const [breadcrumbPath, setBreadcrumbPath] = useState<TreemapNode[]>([data]);
  const [hoveredNode, setHoveredNode] = useState<TreemapNode | null>(null);

  // Color schemes
  const getColorPalette = (scheme: string) => {
    switch (scheme) {
      case 'revenue':
        return ['#e8f5e8', '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20'];
      case 'orders':
        return ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1'];
      case 'performance':
        return ['#fff3e0', '#ffe0b2', '#ffcc02', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00', '#e65100'];
      default:
        return ['#f5f5f5', '#eeeeee', '#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575', '#616161', '#424242', '#303030', '#212121'];
    }
  };

  const colorPalette = getColorPalette(colorScheme);

  // Calculate layout using squarified treemap algorithm
  const calculateLayout = (node: TreemapNode, x: number, y: number, width: number, height: number): any[] => {
    if (!node.children || node.children.length === 0) {
      return [{
        ...node,
        x,
        y,
        width,
        height,
        area: width * height,
      }];
    }

    const totalValue = node.children.reduce((sum, child) => sum + child.value, 0);
    const layouts: any[] = [];
    
    // Sort children by value (descending)
    const sortedChildren = [...node.children].sort((a, b) => b.value - a.value);
    
    let currentX = x;
    let currentY = y;
    let remainingWidth = width;
    let remainingHeight = height;
    
    sortedChildren.forEach((child, index) => {
      const ratio = child.value / totalValue;
      
      if (width > height) {
        // Split horizontally
        const childWidth = remainingWidth * ratio;
        layouts.push({
          ...child,
          x: currentX,
          y: currentY,
          width: childWidth,
          height: height,
          area: childWidth * height,
          colorIndex: index % colorPalette.length,
        });
        currentX += childWidth;
        remainingWidth -= childWidth;
      } else {
        // Split vertically
        const childHeight = remainingHeight * ratio;
        layouts.push({
          ...child,
          x: currentX,
          y: currentY,
          width: width,
          height: childHeight,
          area: width * childHeight,
          colorIndex: index % colorPalette.length,
        });
        currentY += childHeight;
        remainingHeight -= childHeight;
      }
    });

    return layouts;
  };

  const nodeLayouts = useMemo(() => {
    return calculateLayout(currentNode, 0, 0, 800, height - 100);
  }, [currentNode, height]);

  // Format value for display
  const formatValue = (value: number) => {
    if (colorScheme === 'revenue') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString();
  };

  // Handle node click
  const handleNodeClick = (node: any) => {
    if (node.children && node.children.length > 0) {
      setCurrentNode(node);
      setBreadcrumbPath([...breadcrumbPath, node]);
    }
    
    if (onNodeClick) {
      const path = breadcrumbPath.map(n => n.name);
      onNodeClick(node, path);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    const newPath = breadcrumbPath.slice(0, index + 1);
    setBreadcrumbPath(newPath);
    setCurrentNode(newPath[newPath.length - 1]);
  };

  // Calculate percentage of parent
  const getPercentage = (value: number) => {
    const totalValue = currentNode.children?.reduce((sum, child) => sum + child.value, 0) || currentNode.value;
    return ((value / totalValue) * 100).toFixed(1);
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
              label={`${nodeLayouts.length} items`}
              size="small"
              variant="outlined"
            />
          </Box>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {/* Breadcrumbs */}
        {showBreadcrumbs && breadcrumbPath.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
              {breadcrumbPath.map((node, index) => (
                <Link
                  key={node.id}
                  component="button"
                  variant="body2"
                  onClick={() => handleBreadcrumbClick(index)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    textDecoration: 'none',
                    color: index === breadcrumbPath.length - 1 ? 'text.primary' : 'primary.main',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  {index === 0 && <Home fontSize="small" />}
                  {node.name}
                </Link>
              ))}
            </Breadcrumbs>
          </Box>
        )}

        {/* Treemap visualization */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: height - 100,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {nodeLayouts.map((node, index) => {
            const isHovered = hoveredNode?.id === node.id;
            const hasChildren = node.children && node.children.length > 0;
            
            return (
              <Tooltip
                key={node.id}
                title={
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {node.name}
                    </Typography>
                    <Typography variant="body2">
                      Value: {formatValue(node.value)}
                    </Typography>
                    <Typography variant="body2">
                      Share: {getPercentage(node.value)}%
                    </Typography>
                    {hasChildren && (
                      <Typography variant="caption" color="primary">
                        Click to drill down
                      </Typography>
                    )}
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  sx={{
                    position: 'absolute',
                    backgroundColor: colorPalette[node.colorIndex] || colorPalette[0],
                    border: isHovered ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
                    cursor: hasChildren ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 1,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: hasChildren ? 'scale(1.02)' : 'none',
                      zIndex: 10,
                      boxShadow: theme.shadows[4],
                    },
                  }}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                  }}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Node content */}
                  {node.width > 80 && node.height > 40 && (
                    <>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                          textAlign: 'center',
                          fontSize: Math.min(14, node.width / 8, node.height / 4),
                          lineHeight: 1.2,
                          mb: 0.5,
                          wordBreak: 'break-word',
                        }}
                      >
                        {node.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          textAlign: 'center',
                          fontSize: Math.min(12, node.width / 10, node.height / 6),
                          opacity: 0.8,
                        }}
                      >
                        {formatValue(node.value)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          textAlign: 'center',
                          fontSize: Math.min(10, node.width / 12, node.height / 8),
                          opacity: 0.7,
                        }}
                      >
                        {getPercentage(node.value)}%
                      </Typography>
                    </>
                  )}
                  
                  {/* Small nodes - show only value */}
                  {(node.width <= 80 || node.height <= 40) && node.width > 40 && node.height > 20 && (
                    <Typography
                      variant="caption"
                      sx={{
                        textAlign: 'center',
                        fontSize: Math.min(10, node.width / 6, node.height / 3),
                        fontWeight: 'bold',
                      }}
                    >
                      {formatValue(node.value)}
                    </Typography>
                  )}

                  {/* Drill-down indicator */}
                  {hasChildren && node.width > 60 && node.height > 30 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}
                    >
                      +
                    </Box>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {/* Summary information */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`Total: ${formatValue(currentNode.value)}`}
            color="primary"
            variant="outlined"
          />
          {currentNode.children && (
            <Chip
              label={`${currentNode.children.length} categories`}
              variant="outlined"
            />
          )}
          {hoveredNode && (
            <Chip
              label={`Selected: ${hoveredNode.name} (${getPercentage(hoveredNode.value)}%)`}
              color="secondary"
              variant="filled"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default InteractiveTreemap;
