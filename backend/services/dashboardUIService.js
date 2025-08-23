// Dashboard UI Service - Minimal implementation
class DashboardUIService {
  async getDashboardConfig(userId) {
    return {
      success: true,
      data: {
        widgets: [],
        layout: 'default',
        theme: 'light'
      },
      message: 'Dashboard config retrieved'
    };
  }

  async updateDashboardConfig(userId, config) {
    return {
      success: true,
      data: config,
      message: 'Dashboard config updated'
    };
  }
}

module.exports = new DashboardUIService();
